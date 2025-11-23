import os
import asyncio
import random
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
import httpx
from services.reforge import call_txt2img, list_checkpoints, set_active_checkpoint, get_options, interrupt_generation, list_vaes
from services.lora import ensure_lora
import cloudscraper
from pydantic import BaseModel
from urllib.parse import quote
from typing import List, Optional
import json
try:
    from groq import Groq
except Exception:
    Groq = None

# Cargar variables desde .env (ubicado en la carpeta /backend)
BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH, override=False)

# Variables de entorno
REFORGE_PATH = os.getenv("REFORGE_PATH")
LORA_PATH = os.getenv("LORA_PATH")
CIVITAI_API_KEY = os.getenv("CIVITAI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PORT = int(os.getenv("PORT", "8000"))
OUTPUTS_DIR = os.getenv("OUTPUTS_DIR")
RESOURCES_DIR = os.getenv("RESOURCES_DIR")

# Listas de emergencia (Hardcode) para recursos vacíos
FALLBACK_OUTFITS = [
    "casual clothes",
    "bikini",
    "school uniform",
    "nurse outfit",
    "maid outfit",
]
FALLBACK_POSES = [
    "standing pose",
    "hands on hips",
    "sitting pose",
    "leaning against wall",
]
FALLBACK_LOCATIONS = [
    "studio",
    "bedroom",
    "beach",
    "classroom",
]

# Utilidades
def sanitize_filename(name: str) -> str:
    """Sanitiza nombres para uso en sistemas de archivos: minúsculas, '_' y '-'."""
    base = (name or "").strip().lower().replace(" ", "_")
    allowed = set("abcdefghijklmnopqrstuvwxyz0123456789_-")
    cleaned = "".join(c for c in base if c in allowed)
    while "__" in cleaned:
        cleaned = cleaned.replace("__", "_")
    return cleaned or "unknown"

# Modelos Pydantic para IA
class AIItem(BaseModel):
    id: Optional[int] = None
    name: str
    tags: Optional[List[str]] = None

class ProcessRequest(BaseModel):
    items: List[AIItem]
    apiKeyOverride: Optional[str] = None

class AIEntity(BaseModel):
    nombre: str
    triggers: List[str] = []

class AIOutput(BaseModel):
    personajes: List[AIEntity] = []
    poses: List[AIEntity] = []

class CheckpointRequest(BaseModel):
    title: str

class DreamRequest(BaseModel):
    character: str
    tags: Optional[str] = None

class GenerateRequest(BaseModel):
    prompt: Optional[str] = None
    batch_size: Optional[int] = None
    cfg_scale: Optional[float] = None

# Planner models (Fase 3)
class PlannerDraftItem(BaseModel):
    character_name: str
    trigger_words: List[str] = []
    # Nuevo: permitir especificar cantidad de jobs deseados por personaje (opcional)
    batch_count: Optional[int] = None
    # Distribución explícita por intensidad (opcional)
    safe_count: Optional[int] = None
    ecchi_count: Optional[int] = None
    nsfw_count: Optional[int] = None

class PlannerJob(BaseModel):
    character_name: str
    prompt: str
    seed: int
    negative_prompt: Optional[str] = None

class PlannerExecutionRequest(BaseModel):
    # Usamos modelos tipados para asegurar parseo desde Body
    jobs: List[PlannerJob]
    resources_meta: Optional[List[dict]] = []

class MagicFixRequest(BaseModel):
    prompt: str

# Advertencias y configuración de entorno (inicio)
print(f"\033[33m[ENV] REFORGE_PATH: {REFORGE_PATH}\033[0m")
print(f"\033[33m[ENV] OUTPUTS_DIR: {OUTPUTS_DIR}\033[0m")
print(f"\033[33m[ENV] LORA_PATH: {LORA_PATH}\033[0m")

if not REFORGE_PATH:
    print("\033[33m[Advertencia] REFORGE_PATH no está definido en .env.\033[0m")
else:
    rp = Path(REFORGE_PATH)
    if not rp.exists():
        print(f"\033[33m[Advertencia] REFORGE_PATH '{REFORGE_PATH}' no existe en el sistema.\033[0m")

if not OUTPUTS_DIR:
    print("\033[33m[Advertencia] OUTPUTS_DIR no está definido en .env.\033[0m")

# [CONFIG] Log inicial del directorio de LoRAs
try:
    lora_dir_init = None
    if 'LORA_PATH' in globals() and LORA_PATH and str(LORA_PATH).strip():
        lora_dir_init = Path(LORA_PATH).resolve()
    elif REFORGE_PATH and str(REFORGE_PATH).strip():
        try:
            lora_dir_init = Path(REFORGE_PATH).resolve().parents[3] / "models" / "Lora"
        except Exception:
            lora_dir_init = None
    if lora_dir_init:
        print(f"[CONFIG] Guardando LoRAs en: {str(lora_dir_init)}")
    else:
        print("\033[33m[CONFIG] LORA_PATH no configurado y no se pudo deducir desde REFORGE_PATH.\033[0m")
except Exception as e:
    print(f"\033[33m[CONFIG] Error resolviendo LORA_PATH: {e}\033[0m")

app = FastAPI(title="LadyManager Backend", version="0.1.0")

# CORS para el frontend (localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar directorio estático para servir imágenes generadas
try:
    if OUTPUTS_DIR and Path(OUTPUTS_DIR).exists():
        app.mount("/files", StaticFiles(directory=str(OUTPUTS_DIR)), name="files")
        print(f"[Static] Mounted OUTPUTS_DIR at /files: {OUTPUTS_DIR}")
    else:
        print("[Static] OUTPUTS_DIR no configurado o no existe; no se monta /files")
except Exception as e:
    print(f"[Static] Error montando /files: {e}")

@app.get("/")
async def root():
    """Endpoint básico de salud del sistema."""
    return {
        "status": "online",
        "reforge_path": REFORGE_PATH,
    }

# Endpoint para borrar archivos bajo OUTPUTS_DIR
@app.delete("/files")
async def delete_file(path: str):
    if not OUTPUTS_DIR:
        raise HTTPException(status_code=400, detail="OUTPUTS_DIR no configurado en .env.")
    base = Path(OUTPUTS_DIR).resolve()
    # Normalizar y evitar traversal
    try:
        target = (base / path).resolve()
        if base not in target.parents and target != base:
            raise HTTPException(status_code=400, detail="Ruta fuera de OUTPUTS_DIR")
        if not target.exists():
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
        if target.is_dir():
            raise HTTPException(status_code=400, detail="Ruta apunta a directorio, no archivo")
        target.unlink()
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error borrando archivo: {e}")

# Modelo y endpoint de galería
class GalleryItem(BaseModel):
    filename: str
    path: str
    url: str
    character: str
    timestamp: int

@app.get("/gallery")
async def get_gallery(page: int = 1, limit: int = 100, character: Optional[str] = None):
    """Explora OUTPUTS_DIR y devuelve lista paginada de imágenes.
    - filename: nombre del archivo
    - path: ruta relativa dentro de OUTPUTS_DIR (usada para DELETE)
    - url: /files/<path> para servir en navegador
    - character: nombre del personaje (top-level folder)
    - timestamp: mtime del archivo (segundos)
    """
    if not OUTPUTS_DIR:
        raise HTTPException(status_code=400, detail="OUTPUTS_DIR no configurado en .env.")
    base = Path(OUTPUTS_DIR)
    if not base.exists():
        raise HTTPException(status_code=404, detail="OUTPUTS_DIR no existe en el sistema")
    exts = {".png", ".jpg", ".jpeg", ".webp"}
    items: list[GalleryItem] = []
    try:
        def scan() -> list[GalleryItem]:
            out: list[GalleryItem] = []
            for root, _, files in os.walk(base):
                for fname in files:
                    ext = os.path.splitext(fname)[1].lower()
                    if ext not in exts:
                        continue
                    fpath = Path(root) / fname
                    rel = fpath.relative_to(base)
                    rel_str = str(rel).replace("\\", "/")
                    # Importante: codificar URL para manejar espacios y caracteres especiales
                    url = f"/files/{quote(rel_str)}"
                    # derivar personaje desde primer segmento
                    parts = rel_str.split("/")
                    char_name = parts[0] if parts else "unknown"
                    # presentación amigable
                    character_pretty = char_name.replace("_", " ")
                    ts = int(fpath.stat().st_mtime)
                    out.append(GalleryItem(
                        filename=fname,
                        path=rel_str,
                        url=url,
                        character=character_pretty,
                        timestamp=ts,
                    ))
            return out
        all_items = await asyncio.to_thread(scan)
        # filtro por personaje si se envía
        if character and character.strip():
            cc = character.strip().lower()
            all_items = [it for it in all_items if it.character.lower() == cc]
        # ordenar por fecha desc
        all_items.sort(key=lambda x: x.timestamp, reverse=True)
        # paginación simple
        page = max(1, int(page))
        limit = max(1, min(500, int(limit)))
        start = (page - 1) * limit
        end = start + limit
        return JSONResponse(content=[it.dict() for it in all_items[start:end]])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error escaneando galería: {e}")

@app.get("/scan/civitai")
async def scan_civitai(page: int = 1, period: str = "Week", sort: str = "Highest Rated"):
    """Escanea modelos de Civitai usando cloudscraper.
    Devuelve una lista con los campos necesarios para el Radar:
    id, name, tags, stats, images (url + tipo) y modelVersions (para baseModel).
    """
    url = "https://civitai.com/api/v1/models"
    # Mapear desde UI a valores válidos de Civitai
    sort_map = {
        "Rating": "Highest Rated",
        "Downloads": "Most Downloaded",
        "Highest Rated": "Highest Rated",
        "Most Downloaded": "Most Downloaded",
    }
    period_map = {
        "Day": "Day",
        "Week": "Week",
        "Month": "Month",
        "AllTime": "AllTime",
    }
    civitai_sort = sort_map.get(sort, "Highest Rated")
    civitai_period = period_map.get(period, "Week")
    params = {
        "types": "LORA",
        "sort": civitai_sort,
        "period": civitai_period,
        "page": page,
        "limit": 100,
        "nsfw": "true",
        "include": "tags",
    }
    token = os.getenv("CIVITAI_API_KEY")
    if token:
        params["token"] = token

    scraper = cloudscraper.create_scraper()

    def _detect_type(url: str | None) -> str:
        u = (url or "").lower()
        return "video" if u.endswith((".mp4", ".webm")) else "image"

    try:
        def fetch():
            resp = scraper.get(url, params=params, timeout=20)
            resp.raise_for_status()
            return resp.json()

        data = await asyncio.to_thread(fetch)
        items = data.get("items", [])
        if not isinstance(items, list):
            raise HTTPException(status_code=502, detail="Respuesta inválida de Civitai: 'items' no es lista.")

        def normalize_item(item: dict) -> dict:
            # Campos base
            _id = item.get("id")
            name = item.get("name")
            tags = item.get("tags") if isinstance(item.get("tags"), list) else []
            stats_raw = item.get("stats") or {}
            stats = dict(stats_raw)  # pasar tal cual, con pequeños fallbacks si existen en el item
            model_versions = item.get("modelVersions") or []
            # Fecha de creación/publicación
            created_at = (
                item.get("createdAt")
                or item.get("publishedAt")
                or (model_versions and (model_versions[0].get("createdAt") or model_versions[0].get("publishedAt")))
            )
            # Fallback de claves frecuentes en stats si están fuera del objeto o faltan
            if "downloadCount" not in stats and item.get("downloadCount") is not None:
                stats["downloadCount"] = item.get("downloadCount")
            if "thumbsUpCount" not in stats and item.get("thumbsUpCount") is not None:
                stats["thumbsUpCount"] = item.get("thumbsUpCount")
            if "rating" not in stats and item.get("rating") is not None:
                stats["rating"] = item.get("rating")
            
            # Recolectar imágenes (top-level y dentro de modelVersions)
            images: list[dict] = []

            for img in (item.get("images") or []):
                urlx = img.get("url")
                if urlx:
                    entry = {"url": urlx, "type": _detect_type(urlx)}
                    nsfw = img.get("nsfwLevel")
                    if nsfw is not None:
                        entry["nsfwLevel"] = nsfw
                    images.append(entry)

            for mv in model_versions:
                for img in (mv.get("images") or []):
                    urlx = img.get("url")
                    if urlx:
                        entry = {"url": urlx, "type": _detect_type(urlx)}
                        nsfw = img.get("nsfwLevel")
                        if nsfw is not None:
                            entry["nsfwLevel"] = nsfw
                        images.append(entry)

            return {
                "id": _id,
                "name": name,
                "createdAt": created_at,
                "tags": tags,
                "stats": stats,
                "images": images,
                "modelVersions": model_versions,
            }

        normalized = [normalize_item(it) for it in items if isinstance(it, dict)]

        # Fallback de página: si hay menos de 12 elementos, solicitar página 2 y completar hasta 12
        if len(normalized) < 12:
            params2 = dict(params)
            params2["page"] = page + 1
            def fetch2():
                resp = scraper.get(url, params=params2, timeout=20)
                resp.raise_for_status()
                return resp.json()
            data2 = await asyncio.to_thread(fetch2)
            items2 = data2.get("items", [])
            normalized2 = [normalize_item(it) for it in items2 if isinstance(it, dict)]
            seen_ids = set()
            merged = []
            for it in (normalized + normalized2):
                _id = it.get("id")
                if _id in seen_ids:
                    continue
                seen_ids.add(_id)
                merged.append(it)
            normalized = merged

        # Clasificación IA (Groq) de categorías: Character, Pose, Clothing, Style, Concept
        classified = normalized

        # Heurística de respaldo para clasificar si Groq falla o no devuelve categoría válida
        allowed_categories = {"Character", "Pose", "Clothing", "Style", "Concept"}
        def classify_item(it: dict) -> str:
            # Heurística estricta basada únicamente en tags
            tl = [ (t or "").lower() for t in (it.get("tags") or []) ]
            if any(x in tl for x in ["character", "personaje", "waifu", "1girl"]):
                return "Character"
            if any(x in tl for x in ["clothing", "outfit", "costume", "dress"]):
                return "Clothing"
            if any(x in tl for x in ["pose", "action"]):
                return "Pose"
            if any(x in tl for x in ["style", "art style"]):
                return "Style"
            return "Concept"

        if GROQ_API_KEY and Groq is not None:
            try:
                client = Groq(api_key=GROQ_API_KEY)
                compact = [
                    {"id": it.get("id"), "name": it.get("name"), "tags": it.get("tags", [])}
                    for it in normalized
                ]
                system_prompt = (
                    "Analyze this JSON list of Civitai models.\n"
                    "Return a JSON object where keys are Model IDs and values are their CATEGORY.\n"
                    "Categories must be strictly: 'Character', 'Pose', 'Clothing', 'Style', 'Concept'.\n\n"
                    "Rules:\n"
                    "- If it's a specific named Anime Girl -> 'Character'.\n"
                    "- If it's a pose or action -> 'Pose'.\n"
                    "- If it's an outfit or costume -> 'Clothing'.\n"
                    "- If it's an art style or visual tweak -> 'Style'.\n"
                    "- Anything else -> 'Concept'.\n\n"
                    "Output format: { '12345': 'Character', '67890': 'Pose' }"
                )
                user_prompt = "List:\n" + json.dumps(compact)
                completion = await groq_chat_with_fallbacks(
                    client,
                    [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.0,
                )
                content = completion.choices[0].message.content.strip()
                # Intentar parsear estrictamente como objeto JSON { id: category }
                start = content.find("{")
                end = content.rfind("}")
                json_str = content[start:end+1] if start != -1 and end != -1 else content
                id_to_cat = {}
                try:
                    parsed = json.loads(json_str)
                    if isinstance(parsed, dict):
                        id_to_cat = parsed
                    else:
                        raise ValueError("Groq returned non-dict JSON")
                except Exception:
                    id_to_cat = {}
                for it in classified:
                    _id = it.get("id")
                    key_candidates = [str(_id), _id]
                    cat = None
                    for k in key_candidates:
                        if k in id_to_cat:
                            cat = id_to_cat[k]
                            break
                    if isinstance(cat, str) and cat in allowed_categories:
                        it["ai_category"] = cat
                    else:
                        it["ai_category"] = classify_item(it)
            except Exception as e:
                print(f"[scan_civitai] Clasificación Groq falló: {e}. Aplicando heurística de respaldo.")
                for it in classified:
                    it["ai_category"] = classify_item(it)
        else:
            for it in classified:
                it["ai_category"] = classify_item(it)

        # Enriquecer con existencia local y devolver TODOS los items (sin filtrar), por página
        base_dir = Path(OUTPUTS_DIR) if OUTPUTS_DIR else None
        try:
            if base_dir:
                base_dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
        def enrich_local(it: dict) -> dict:
            clean = sanitize_filename(it.get("name") or "")
            local_exists = bool(base_dir and (base_dir / clean).exists())
            it["local_exists"] = bool(local_exists)
            return it
        final = [enrich_local(it) for it in classified]

        return JSONResponse(content=final)
    except HTTPException as he:
        print(f"[scan_civitai] HTTPException: {getattr(he, 'detail', he)}")
        raise
    except Exception as e:
        print(f"[scan_civitai] Error de conexión/parseo: {repr(e)}")
        raise HTTPException(status_code=502, detail=f"Error al consultar Civitai: {str(e)}")

@app.post("/process-ai")
async def process_ai(req: ProcessRequest):
    """Procesa items crudos con Groq (Llama 3) y devuelve estructura {personajes:[], poses:[]}"""
    api_key = req.apiKeyOverride or GROQ_API_KEY
    if not api_key:
        raise HTTPException(status_code=400, detail="GROQ_API_KEY no disponible (env o override).")
    if Groq is None:
        raise HTTPException(status_code=500, detail="Groq SDK no disponible en el servidor.")

    # Preparar entrada (máx 50 para reducir tokens)
    items_text = "\n".join([
        f"- {i.name} | tags: {', '.join(i.tags or [])}" for i in req.items[:50]
    ])

    system_prompt = (
        "Eres un asistente de datos que normaliza nombres y extrae entidades y acciones. "
        "Devuelve SOLO JSON con el esquema EXACTO: "
        "{\"personajes\":[{\"nombre\":\"string\",\"triggers\":[\"string\"]}],"
        "\"poses\":[{\"nombre\":\"string\",\"triggers\":[\"string\"]}]}"
    )
    user_prompt = (
        f"Entrada (máx 50):\n{items_text}\n\n"
        "Instrucciones:\n- Extrae personajes y poses/acciones.\n"
        "- Normaliza nombres (sin emojis).\n- Incluye triggers concisos.\n- Devuelve SOLO JSON."
    )

    try:
        client = Groq(api_key=api_key)
        completion = await groq_chat_with_fallbacks(
            client,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
        content = completion.choices[0].message.content.strip()
        # Extraer JSON si viene con fences
        start = content.find("{")
        end = content.rfind("}")
        json_str = content[start:end+1] if start != -1 and end != -1 else content
        parsed = json.loads(json_str)
        # Validar y sanear
        try:
            out = AIOutput(**parsed)
        except Exception:
            personajes = parsed.get("personajes", []) or []
            poses = parsed.get("poses", []) or []
            out = AIOutput(
                personajes=[AIEntity(**p) for p in personajes if isinstance(p, dict)],
                poses=[AIEntity(**p) for p in poses if isinstance(p, dict)],
            )
        return out.dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al procesar IA: {str(e)}")

# Fase 3: Planificador de batalla

def _read_lines(file_name: str) -> List[str]:
    # Rutas SIEMPRE desde .env (disciplina de entorno). Si falta, devolvemos vacío con advertencia.
    if not RESOURCES_DIR:
        print("[Advertencia] RESOURCES_DIR no está definido en .env. No se pueden cargar recursos.")
        return []
    path = Path(RESOURCES_DIR) / file_name
    try:
        text = path.read_text(encoding="utf-8")
        return [ln.strip() for ln in text.splitlines() if ln.strip()]
    except Exception as e:
        print(f"[Advertencia] No se pudo leer {path}: {e}")
        return []

QUALITY_TAGS = (
    "masterpiece, best quality, absurdres, nsfw"
)

@app.get("/planner/resources")
async def planner_resources():
    """Devuelve listas de recursos para planificación.
    Incluye: outfits, poses, locations y además lighting (styles/lighting.txt), camera (styles/camera.txt), expressions (visuals/expressions.txt), hairstyles (visuals/hairstyles.txt) y upscalers (tech/upscalers.txt). También styles y concepts legacy.
    """
    # Lectura desde ambas rutas para máxima compatibilidad
    outfits_top = _read_lines("outfits.txt")
    outfits_casual = _read_lines("wardrobe/casual.txt")
    outfits_lingerie = _read_lines("wardrobe/lingerie.txt")
    outfits_cosplay = _read_lines("wardrobe/cosplay.txt")
    poses_top = _read_lines("poses.txt")
    poses_concepts = _read_lines("concepts/poses.txt")
    locations_top = _read_lines("locations.txt")
    locations_concepts = _read_lines("concepts/locations.txt")
    styles = _read_lines("styles.txt")
    concepts = _read_lines("concepts.txt")
    lighting = _read_lines("styles/lighting.txt")
    camera = _read_lines("styles/camera.txt")
    expressions = _read_lines("visuals/expressions.txt")
    hairstyles = _read_lines("visuals/hairstyles.txt")
    upscalers = _read_lines("tech/upscalers.txt")

    # Unificar y deduplicar
    outfits = list(dict.fromkeys([x for x in (outfits_top + outfits_casual + outfits_lingerie + outfits_cosplay) if x and x.strip()]))
    poses = list(dict.fromkeys([x for x in (poses_top + poses_concepts) if x and x.strip()]))
    locations = list(dict.fromkeys([x for x in (locations_top + locations_concepts) if x and x.strip()]))

    # Fallback de emergencia para evitar vacíos
    if not outfits:
        outfits = FALLBACK_OUTFITS
    if not poses:
        poses = FALLBACK_POSES
    if not locations:
        locations = FALLBACK_LOCATIONS

    return {
        "outfits": outfits,
        "poses": poses,
        "locations": locations,
        "lighting": lighting,
        "camera": camera,
        "styles": styles,
        "concepts": concepts,
        "expressions": expressions,
        "hairstyles": hairstyles,
        "upscalers": upscalers,
    }

@app.get("/resources/expressions")
async def resources_expressions():
    items = _read_lines("visuals/expressions.txt")
    return {"items": items}

@app.get("/resources/hairstyles")
async def resources_hairstyles():
    items = _read_lines("visuals/hairstyles.txt")
    return {"items": items}

@app.get("/resources/upscalers")
async def resources_upscalers():
    items = _read_lines("tech/upscalers.txt")
    return {"items": items}

async def _get_atmospheres_for_character(character: str) -> List[str]:
    """Intenta obtener 3 descripciones cortas de atmósfera/iluminación vía Groq (70B)."""
    if not GROQ_API_KEY or Groq is None:
        return [
            "soft ambient light",
            "moody shadows",
            "neon glow",
        ]
    try:
        client = Groq(api_key=GROQ_API_KEY)
        system_prompt = (
            "You generate short visual atmosphere descriptors for Stable Diffusion. "
            "Return ONLY a JSON array of 3 short English phrases (3-6 words)."
        )
        user_prompt = (
            f"Character: {character}\nTask: 3 varying atmosphere/lighting cues (English). Return ONLY JSON array."
        )
        completion = await groq_chat_with_fallbacks(
            client,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
        content = completion.choices[0].message.content.strip()
        start = content.find("[")
        end = content.rfind("]")
        json_str = content[start:end+1] if start != -1 and end != -1 else content
        arr = json.loads(json_str)
        if isinstance(arr, list) and arr:
            return [str(x) for x in arr[:3]]
        return [
            "soft ambient light",
            "moody shadows",
            "neon glow",
        ]
    except Exception as e:
        print(f"[planner] Atmospheres via Groq failed: {e}")
        return [
            "soft ambient light",
            "moody shadows",
            "neon glow",
        ]

@app.post("/planner/draft")
async def planner_draft(payload: List[PlannerDraftItem], job_count: Optional[int] = None):
    """Genera 10 jobs por personaje con relleno INFALIBLE y enriquece contexto:
    - Intento IA (Groq) para sugerir combinaciones Outfit+Pose+Location.
    - Validación y Fallback determinista: si IA falla o hay vacíos, se eligen aleatorios.
    - Enriquecimiento Civitai: base_prompt, reference_images, recommended_params.

    Devuelve compatiblemente "jobs" agregados y además "drafts" por personaje.
    """
    # Lectura desde nueva estructura jerárquica en RESOURCES_DIR
    poses = _read_lines("concepts/poses.txt")
    locations = _read_lines("concepts/locations.txt")
    outfits_casual = _read_lines("wardrobe/casual.txt")
    outfits_lingerie = _read_lines("wardrobe/lingerie.txt")
    outfits_cosplay = _read_lines("wardrobe/cosplay.txt")
    lighting = _read_lines("styles/lighting.txt")
    camera = _read_lines("styles/camera.txt")
    expressions = _read_lines("visuals/expressions.txt")
    hairstyles = _read_lines("visuals/hairstyles.txt")

    # Unificar outfits y aplicar fallbacks de emergencia
    all_outfits = list(dict.fromkeys([x for x in ([*outfits_casual, *outfits_lingerie, *outfits_cosplay]) if x and x.strip()]))
    if not all_outfits:
        all_outfits = FALLBACK_OUTFITS

    # Fallbacks si los recursos están vacíos
    if not poses:
        poses = FALLBACK_POSES
    if not locations:
        locations = FALLBACK_LOCATIONS
    if not lighting:
        lighting = ["soft lighting"]
    if not camera:
        camera = ["front view", "cowboy shot"]
    if not expressions:
        expressions = ["smile", "blushing"]
    if not hairstyles:
        hairstyles = ["ponytail", "long hair"]

    # Filtro simple para SAFE (evitar poses más explícitas).
    banned = {"spread legs", "straddling", "all fours"}
    safe_poses = [p for p in poses if not any(b in p.lower() for b in banned)] or poses

    # Helper: enriquecer con Civitai
    async def civitai_enrich(character_name: str, trigger_words: List[str]) -> dict:
        lora_tag = f"<lora:{sanitize_filename(character_name)}:0.8>"
        triggers = ", ".join([t for t in (trigger_words or []) if t.strip()]) or sanitize_filename(character_name)
        # Fallback base prompt cuando Civitai no está disponible
        fallback_quality = "masterpiece, best quality, absurdres"
        base_prompt = f"{lora_tag}, {triggers}, {fallback_quality}"

        token = os.getenv("CIVITAI_API_KEY")
        scraper = cloudscraper.create_scraper()
        model_id: int | None = None
        try:
            def fetch_model():
                params = {
                    "types": "LORA",
                    "query": character_name,
                    "limit": 1,
                    "nsfw": "true",
                }
                if token:
                    params["token"] = token
                resp = scraper.get("https://civitai.com/api/v1/models", params=params, timeout=20)
                resp.raise_for_status()
                return resp.json()
            data_m = await asyncio.to_thread(fetch_model)
            items_m = data_m.get("items", []) if isinstance(data_m, dict) else []
            if items_m and isinstance(items_m[0], dict) and items_m[0].get("id"):
                model_id = int(items_m[0]["id"])
        except Exception:
            model_id = None

        reference_images: List[dict] = []
        recommended_params = {"cfg": 7, "steps": 28, "sampler": "Euler a"}

        if model_id is not None:
            try:
                def fetch_images():
                    params = {
                        "modelId": model_id,
                        "limit": 50,
                        "nsfw": "true",
                        "sort": "Most Reactions",
                    }
                    if token:
                        params["token"] = token
                    resp = scraper.get("https://civitai.com/api/v1/images", params=params, timeout=20)
                    resp.raise_for_status()
                    return resp.json()
                data_i = await asyncio.to_thread(fetch_images)
                items_i = data_i.get("items", []) if isinstance(data_i, dict) else []
                top = [it for it in items_i[:5] if isinstance(it, dict)]
                steps_list: List[int] = []
                cfg_list: List[float] = []
                sampler_list: List[str] = []
                for it in top:
                    urlx = it.get("url") or it.get("imageUrl")
                    meta = it.get("meta") or {}
                    m = {}
                    if isinstance(meta, dict):
                        for k in ["prompt", "negativePrompt", "Seed", "Steps", "CFG scale", "Sampler"]:
                            if meta.get(k) is not None:
                                m[k] = meta.get(k)
                        try:
                            s = int(meta.get("Steps")) if meta.get("Steps") is not None else None
                            if isinstance(s, int):
                                steps_list.append(s)
                        except Exception:
                            pass
                        try:
                            c = meta.get("CFG scale")
                            if c is not None:
                                c = float(c)
                                cfg_list.append(c)
                        except Exception:
                            pass
                        sam = meta.get("Sampler")
                        if isinstance(sam, str) and sam.strip():
                            sampler_list.append(sam.strip())
                    if urlx:
                        reference_images.append({"url": urlx, "meta": m})
                def mode_str(vals: List[str], default: str) -> str:
                    if not vals:
                        return default
                    counts: dict[str, int] = {}
                    for v in vals:
                        counts[v] = counts.get(v, 0) + 1
                    return sorted(counts.items(), key=lambda x: (-x[1], x[0]))[0][0]
                def avg_int(vals: List[int], default: int) -> int:
                    if not vals:
                        return default
                    return int(round(sum(vals) / max(1, len(vals))))
                def avg_float(vals: List[float], default: float) -> float:
                    if not vals:
                        return default
                    return float(round(sum(vals) / max(1, len(vals))))
                recommended_params = {
                    "cfg": avg_float(cfg_list, 7.0),
                    "steps": avg_int(steps_list, 28),
                    "sampler": mode_str(sampler_list, "Euler a"),
                }
            except Exception:
                pass

        return {
            "base_prompt": base_prompt,
            "reference_images": reference_images,
            "recommended_params": recommended_params,
        }

    async def groq_suggest_combos(character_name: str, trigger_words: List[str], preferred_location: Optional[str] = None, count: int = 10) -> List[dict]:
        """Solicita a Groq una lista de combinaciones. Devuelve [{outfit, pose, location, lighting, camera}]"""
        if not GROQ_API_KEY or Groq is None:
            return []
        try:
            client = Groq(api_key=GROQ_API_KEY)
            system_prompt = (
                "You are an Anime Art Director. Based on the character '{name}' and location '{location}', select the BEST matching Outfit, Lighting, and Camera angle from the provided lists. "
                "Ensure visual coherence (e.g., dark lighting for dungeons, torchlight for caves, armor for dangerous areas). "
                "Return ONLY JSON array with format: [{\"outfit\":\"...\",\"pose\":\"...\",\"location\":\"...\",\"lighting\":\"...\",\"camera\":\"...\"}] with up to 10 elements."
            )
            user_prompt = (
                f"Character: {character_name}\n"
                f"Triggers: {', '.join(trigger_words or [])}\n"
                f"Preferred Location (optional): {preferred_location or '(none)'}\n"
                f"Outfit list (examples): {', '.join((outfits_casual + outfits_lingerie + outfits_cosplay)[:15])}\n"
                f"Pose list (examples): {', '.join(poses[:15])}\n"
                f"Location list (examples): {', '.join(locations[:15])}\n"
                f"Lighting list (examples): {', '.join(lighting[:15])}\n"
                f"Camera list (examples): {', '.join(camera[:15])}\n"
                "Return ONLY JSON array with the specified format."
            )
            completion = await groq_chat_with_fallbacks(
                client,
                [
                    {"role": "system", "content": system_prompt.replace("{name}", character_name).replace("{location}", preferred_location or "(none)")},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
            )
            content = completion.choices[0].message.content.strip()
            start = content.find("[")
            end = content.rfind("]")
            json_str = content[start:end+1] if start != -1 and end != -1 else content
            data = json.loads(json_str)
            combos: List[dict] = []
            if isinstance(data, list):
                for it in data:
                    if isinstance(it, dict) and it.get("outfit") and it.get("pose") and it.get("location"):
                        combos.append({
                            "outfit": str(it["outfit"]),
                            "pose": str(it["pose"]),
                            "location": str(it["location"]),
                            "lighting": str(it.get("lighting") or ""),
                            "camera": str(it.get("camera") or ""),
                        })
            return combos[:count]
        except Exception:
            return []

    def random_combo() -> dict:
        return {
            "outfit": random.choice(all_outfits) if all_outfits else random.choice(FALLBACK_OUTFITS),
            "pose": random.choice(safe_poses) if safe_poses else random.choice(FALLBACK_POSES),
            "location": random.choice(locations) if locations else random.choice(FALLBACK_LOCATIONS),
            "lighting": random.choice(lighting) if lighting else "soft lighting",
            "camera": random.choice(camera) if camera else "front view",
        }

    # Construcción de trabajos y borradores enriquecidos por personaje
    all_jobs: List[PlannerJob] = []
    drafts: List[dict] = []

    def _compute_distribution(n: int) -> tuple[int, int, int]:
        """Devuelve (safe_count, ecchi_count, nsfw_count) proporcional al total n.
        Para n < 9 usa 20/40/40 con al menos 1 SAFE.
        Para n >= 9 usa 30/40/30.
        """
        if n <= 0:
            return (0, 0, 0)
        if n < 9:
            safe = max(1, int(n * 0.2))
            ecchi = int(n * 0.4)
            nsfw = n - safe - ecchi
        else:
            safe = int(round(n * 0.3))
            ecchi = int(round(n * 0.4))
            nsfw = n - safe - ecchi
        # Ajustes por redondeo
        if safe + ecchi + nsfw != n:
            nsfw = n - safe - ecchi
        return (safe, ecchi, nsfw)

    for char in payload:
        lora_tag = f"<lora:{sanitize_filename(char.character_name)}:0.8>"
        trigger = ", ".join([t for t in (char.trigger_words or []) if t.strip()]) or sanitize_filename(char.character_name)
        # Determinar cantidad de jobs solicitada
        requested_n = job_count if (isinstance(job_count, int) and job_count > 0) else (char.batch_count if (hasattr(char, "batch_count") and isinstance(char.batch_count, int) and char.batch_count and char.batch_count > 0) else 10)

        # 1) Intentar combos con IA
        combos = await groq_suggest_combos(char.character_name, char.trigger_words or [], None, requested_n)
        # 2) Validación y fallback determinista
        while len(combos) < requested_n:
            combos.append(random_combo())
        # Garantía de no vacíos
        validated: List[dict] = []
        def _bad_value(s: str) -> bool:
            low = (s or "").strip().lower()
            return low in ("none", "null", "n/a", "na", "vacío", "empty", "undefined")
        def _pick_outfit() -> str:
            pool = all_outfits
            return random.choice(pool) if pool else random.choice(FALLBACK_OUTFITS)
        def _pick_pose() -> str:
            pool = safe_poses if safe_poses else poses
            return random.choice(pool) if pool else random.choice(FALLBACK_POSES)
        def _pick_location() -> str:
            return random.choice(locations) if locations else random.choice(FALLBACK_LOCATIONS)
        for c in combos[:requested_n]:
            o_raw = (c.get("outfit") or "")
            p_raw = (c.get("pose") or "")
            l_raw = (c.get("location") or "")
            li_raw = (c.get("lighting") or "")
            ca_raw = (c.get("camera") or "")
            o = _pick_outfit() if _bad_value(o_raw) or (o_raw.strip() == "") else o_raw.strip()
            p = _pick_pose() if _bad_value(p_raw) or (p_raw.strip() == "") else p_raw.strip()
            l = _pick_location() if _bad_value(l_raw) or (l_raw.strip() == "") else l_raw.strip()
            li = (li_raw or "").strip()
            ca = (ca_raw or "").strip()
            # Coherencia básica: evitar bikini en dungeon
            if "dungeon" in (l or "").lower() and "bikini" in (o or "").lower():
                o = "armor" if "armor" in [x.lower() for x in all_outfits] else "rags"
            # Garantizar string seguro
            o = o or "casual clothes"
            p = p or "standing pose"
            l = l or "studio"
            validated.append({"outfit": o, "pose": p, "location": l, "lighting": li, "camera": ca})

        per_char_jobs: List[PlannerJob] = []
        per_char_jobs_payload: List[dict] = []
        atmospheres: List[str] = await _get_atmospheres_for_character(char.character_name)

        # Clasificar intensidad usando distribución explícita si viene en el payload; si no, proporcional al N solicitado
        def _clean_int(v: Optional[int]) -> int:
            try:
                return int(v) if (v is not None and int(v) > 0) else 0
            except Exception:
                return 0
        explicit_safe = _clean_int(getattr(char, "safe_count", None))
        explicit_ecchi = _clean_int(getattr(char, "ecchi_count", None))
        explicit_nsfw = _clean_int(getattr(char, "nsfw_count", None))
        if (explicit_safe + explicit_ecchi + explicit_nsfw) > 0:
            # Ajustar para que siempre sumen al total solicitado
            safe_count = min(explicit_safe, requested_n)
            ecchi_count = min(explicit_ecchi, max(0, requested_n - safe_count))
            nsfw_count = max(0, requested_n - safe_count - ecchi_count)
        else:
            safe_count, ecchi_count, nsfw_count = _compute_distribution(requested_n)
        for i, base in enumerate(validated[:requested_n]):
            if i < safe_count:
                intensity = "SAFE"
            elif i < safe_count + ecchi_count:
                intensity = "ECCHI"
            else:
                intensity = "NSFW"
            rating = "rating_safe" if intensity == "SAFE" else ("rating_questionable, cleavage" if intensity == "ECCHI" else "rating_explicit, nsfw, explicit")
            # Lighting/Cámara: usar sugerencia IA si existe; si no, fallback y atmósfera
            lighting_choice = (base.get("lighting") or "").strip() or (random.choice(lighting) if lighting else "soft lighting")
            atmo_choice = random.choice(atmospheres) if atmospheres else ""
            cam_choice = (base.get("camera") or "").strip() or (random.choice(camera) if camera else ("front view" if intensity == "SAFE" else "cowboy shot"))
            expression_choice = random.choice(expressions) if expressions else "smile"
            hairstyle_choice = random.choice(hairstyles) if hairstyles else "ponytail"
            quality_end = "masterpiece, best quality, absurdres"
            # Prompt incluye cámara, expresión, peinado y estilo/atmósfera además del triplete base
            parts = [
                lora_tag,
                trigger,
                cam_choice,
                expression_choice,
                hairstyle_choice,
                (lighting_choice or atmo_choice or "soft lighting"),
                rating,
                base["outfit"],
                base["pose"],
                base["location"],
                quality_end,
            ]
            prompt = ", ".join([p for p in parts if p and str(p).strip()])
            # Debug: registrar valores generados
            print(f"[planner/draft] Generando Job: Outfit={base['outfit']}, Pose={base['pose']}, Location={base['location']}")
            seed = random.randint(0, 2_147_483_647)
            job_model = PlannerJob(character_name=char.character_name, prompt=prompt, seed=seed)
            per_char_jobs.append(job_model)
            # Marcar visibilidad de IA en campos técnicos cuando provienen de la sugerencia
            ai_meta = {}
            if (base.get("lighting") or "").strip():
                ai_meta["lighting"] = "Sugerido por IA por coherencia"
            if (base.get("camera") or "").strip():
                ai_meta["camera"] = "Sugerido por IA por coherencia"
            if (c.get("outfit") or "").strip():
                ai_meta["outfit"] = "Sugerido por IA por coherencia"

            per_char_jobs_payload.append({
                **job_model.model_dump(),
                "intensity": intensity,
                "outfit": base["outfit"],
                "pose": base["pose"],
                "location": base["location"],
                "lighting": lighting_choice or atmo_choice,
                "camera": cam_choice,
                "expression": expression_choice,
                "hairstyle": hairstyle_choice,
                "ai_meta": ai_meta,
            })

        # Enriquecimiento de contexto por personaje (Civitai)
        enrich = await civitai_enrich(char.character_name, char.trigger_words or [])
        drafts.append({
            "character": char.character_name,
            "base_prompt": enrich.get("base_prompt"),
            "recommended_params": enrich.get("recommended_params"),
            "reference_images": enrich.get("reference_images"),
            "jobs": per_char_jobs_payload,
        })
        all_jobs.extend(per_char_jobs)
        # También agregamos payload extendido para la respuesta agregada
        if "all_jobs_payload" not in locals():
            all_jobs_payload = []
        all_jobs_payload.extend(per_char_jobs_payload)

    return JSONResponse(content={
        "jobs": all_jobs_payload,
        "drafts": drafts,
    })

@app.post("/planner/magicfix")
async def planner_magicfix(req: MagicFixRequest):
    """Sugiere SOLO una nueva combinación coherente de Outfit+Pose+Location.
    No reescribe el prompt; mantiene la estructura técnica intacta en el cliente.
    Devuelve JSON: {"outfit": str, "pose": str, "location": str}
    """
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt requerido")
    outfits = _read_lines("outfits.txt")
    poses = _read_lines("poses.txt")
    locations = _read_lines("locations.txt")
    if not outfits or not poses or not locations:
        raise HTTPException(status_code=500, detail="Recursos insuficientes: outfits/poses/locations vacíos.")

    # Fallback sin Groq: sugerir combinación aleatoria válida
    if not GROQ_API_KEY or Groq is None:
        return {
            "outfit": random.choice(outfits),
            "pose": random.choice(poses),
            "location": random.choice(locations),
        }

    # Con Groq: sugerir combinación coherente basada en el prompt y recursos
    try:
        client = Groq(api_key=GROQ_API_KEY)
        system_prompt = (
            "Eres un asistente de planificación para Stable Diffusion. "
            "Lee el prompt/tags existente y sugiere EXACTAMENTE UNA combinación coherente de Outfit+Pose+Location que encaje con el personaje. "
            "NO reescribas el prompt completo y NO incluyas explicaciones. "
            'Devuelve SOLO JSON con formato EXACTO: {"outfit":"...","pose":"...","location":"..."}.'
        )
        example_outfits = ", ".join(outfits[:10])
        example_poses = ", ".join(poses[:10])
        example_locations = ", ".join(locations[:10])
        user_prompt = (
            f"Prompt existente (tags): {req.prompt}\n"
            f"Outfits disponibles (ejemplos): {example_outfits}\n"
            f"Poses disponibles (ejemplos): {example_poses}\n"
            f"Locations disponibles (ejemplos): {example_locations}\n"
            "Responde con SOLO JSON del triplete."
        )
        completion = await groq_chat_with_fallbacks(
            client,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
        content = completion.choices[0].message.content.strip()
        start = content.find("{")
        end = content.rfind("}")
        json_str = content[start:end+1] if start != -1 and end != -1 else content
        try:
            data = json.loads(json_str)
            if isinstance(data, dict) and data.get("outfit") and data.get("pose") and data.get("location"):
                return {
                    "outfit": str(data["outfit"]),
                    "pose": str(data["pose"]),
                    "location": str(data["location"]),
                }
        except Exception:
            pass
        return {
            "outfit": random.choice(outfits),
            "pose": random.choice(poses),
            "location": random.choice(locations),
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error en Groq: {str(e)}")

class PlannerAnalyzeRequest(BaseModel):
    character_name: str
    tags: List[str] = []

@app.post("/planner/analyze")
async def planner_analyze(req: PlannerAnalyzeRequest):
    if not req.character_name or not req.character_name.strip():
        raise HTTPException(status_code=400, detail="character_name requerido")
    outfits = _read_lines("outfits.txt")
    poses = _read_lines("poses.txt")
    locations = _read_lines("locations.txt")
    styles = _read_lines("styles.txt")
    concepts = _read_lines("concepts.txt")
    if not poses or not outfits or not locations:
        raise HTTPException(status_code=500, detail="Recursos insuficientes: poses/outfits/locations vacíos.")

    combos_sugeridos: List[dict] = []
    lore_text: str = ""
    if GROQ_API_KEY and Groq is not None:
        try:
            client = Groq(api_key=GROQ_API_KEY)
            system_prompt = (
                "Eres un experto otaku. Analiza este personaje. Dime su personalidad, ropa canónica y escenarios típicos en 1-2 frases. "
                "Luego, sugiere 5 combinaciones de Outfit+Pose+Location que encajen con su historia pero sean NSFW/Ecchi. "
                'Devuelve SOLO JSON con formato: {"lore":"texto breve","combos":[{"outfit":"...","pose":"...","location":"..."}]}'
            )
            user_prompt = (
                f"Nombre: {req.character_name}\n"
                f"Tags: {', '.join(req.tags or [])}\n"
                f"Outfits disponibles (ejemplo): {', '.join(outfits[:10])}\n"
                f"Poses disponibles (ejemplo): {', '.join(poses[:10])}\n"
                f"Locations disponibles (ejemplo): {', '.join(locations[:10])}\n"
                "Responde en español con SOLO JSON."
            )
            completion = await groq_chat_with_fallbacks(
                client,
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
            )
            content = completion.choices[0].message.content.strip()
            # Intentar extraer el objeto JSON
            start = content.find("{")
            end = content.rfind("}")
            json_str = content[start:end+1] if start != -1 and end != -1 else content
            try:
                data = json.loads(json_str)
                if isinstance(data, dict):
                    if isinstance(data.get("lore"), str):
                        lore_text = data["lore"]
                    if isinstance(data.get("combos"), list):
                        for c in data["combos"]:
                            if isinstance(c, dict) and c.get("outfit") and c.get("pose") and c.get("location"):
                                combos_sugeridos.append({
                                    "outfit": str(c["outfit"]),
                                    "pose": str(c["pose"]),
                                    "location": str(c["location"]),
                                })
            except Exception:
                pass
        except Exception as e:
            print(f"[planner/analyze] Groq falló: {e}")

    # Fallback: 5 combinaciones aleatorias
    if not combos_sugeridos:
        from itertools import product
        all_combos = list(product(outfits, poses, locations))
        random.shuffle(all_combos)
        for o, p, l in all_combos[:5]:
            combos_sugeridos.append({"outfit": o, "pose": p, "location": l})

    # Generar 10 jobs con enriquecimiento de style/concept y QUALITY_TAGS
    lora_tag = f"<lora:{sanitize_filename(req.character_name)}:0.8>"
    trigger = ", ".join([t for t in (req.tags or []) if t.strip()]) or sanitize_filename(req.character_name)
    jobs: List[PlannerJob] = []
    style_pool = styles or []
    concept_pool = concepts or []
    atmospheres: List[str] = await _get_atmospheres_for_character(req.character_name)

    for i in range(10):
        base = combos_sugeridos[i % len(combos_sugeridos)]
        style = (random.choice(style_pool) if style_pool else random.choice(atmospheres))
        concept = (random.choice(concept_pool) if concept_pool else "")
        parts = [lora_tag, trigger, base["outfit"], base["pose"], base["location"]]
        if style:
            parts.append(style)
        if concept:
            parts.append(concept)
        parts.append(QUALITY_TAGS)
        prompt = ", ".join(parts)
        seed = random.randint(0, 2_147_483_647)
        jobs.append(PlannerJob(character_name=req.character_name, prompt=prompt, seed=seed))

    return {"jobs": [j.model_dump() for j in jobs], "lore": lore_text}

# BLOQUE DUPLICADO ELIMINADO: se removieron definiciones duplicadas de endpoints y clases añadidas por error durante la edición.

def get_lora_dir() -> Path | None:
    # Prioridad: LORA_PATH explícita; fallback: 4 niveles desde REFORGE_PATH
    try:
        if LORA_PATH and str(LORA_PATH).strip():
            d = Path(LORA_PATH).resolve()
        elif REFORGE_PATH and str(REFORGE_PATH).strip():
            base = Path(REFORGE_PATH).resolve()
            d = base.parents[3] / "models" / "Lora"
        else:
            return None
        d.mkdir(parents=True, exist_ok=True)
        try:
            print(f"[CONFIG] Guardando LoRAs en: {str(d.resolve())}")
        except Exception:
            pass
        return d
    except Exception:
        return None

# Nota: _parse_lora_names unificado y definido una sola vez más abajo para evitar duplicaciones.

# Nota: _lora_exists unificado y definido una sola vez más arriba para evitar duplicaciones.
# async def _maybe_download_lora(name: str) -> bool:
#     # Sin metadata de URL en PlannerJob, registramos y omitimos descarga.
#     _log(f"LoRA '{name}' no encontrado; no hay metadata para descargar. Se omite.")
#     return False

async def _save_image(character_name: str, image_b64: str, override_dir: Optional[str] = None) -> str:
    if not OUTPUTS_DIR:
        raise HTTPException(status_code=400, detail="OUTPUTS_DIR no configurado en .env.")
    # Resolver directorio de salida respetando tokens de entorno
    base_env = Path(OUTPUTS_DIR)
    dest_dir = base_env / sanitize_filename(character_name)
    if isinstance(override_dir, str) and override_dir.strip():
        try:
            raw = override_dir.strip()
            # Permitir tokens: OUTPUTS_DIR y {Character}
            resolved = raw.replace("OUTPUTS_DIR", str(base_env))
            resolved = resolved.replace("{Character}", sanitize_filename(character_name))
            dest_dir = Path(resolved)
        except Exception:
            # Fallback seguro
            dest_dir = base_env / sanitize_filename(character_name)
    dest_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    target = dest_dir / f"{ts}.png"
    try:
        data = base64.b64decode(image_b64)
        target.write_bytes(data)
    except Exception as e:
        _log(f"Error guardando imagen: {e}")
        raise HTTPException(status_code=500, detail=f"Error guardando imagen: {str(e)}")
    return str(target)

# [DEPRECATED] produce_jobs (v1) eliminado. Usar produce_jobs para producción asíncrona con aprovisionamiento.

# ===== FASE 4: Motor de Producción =====
from fastapi import BackgroundTasks
import base64
from datetime import datetime
from typing import Dict, Any

class ResourceMeta(BaseModel):
    character_name: str
    download_url: Optional[str] = None
    filename: Optional[str] = None

class ExecuteRequest(BaseModel):
    jobs: List[PlannerJob]
    resources_meta: Optional[List[ResourceMeta]] = []

# Nuevo: configuración por personaje (steps/cfg)
class GroupConfigItem(BaseModel):
    character_name: str
    cfg_scale: Optional[float] = None
    steps: Optional[int] = None
    hires_fix: Optional[bool] = None
    denoising_strength: Optional[float] = None
    output_path: Optional[str] = None
    extra_loras: Optional[List[str]] = []
    hires_steps: Optional[int] = None
    batch_size: Optional[int] = None
    adetailer: Optional[bool] = None
    # Nuevos controles técnicos avanzados
    vae: Optional[str] = None
    clip_skip: Optional[int] = None
    # Hires Fix y sampler/upscaler/checkpoint
    upscale_by: Optional[float] = None
    upscaler: Optional[str] = None
    sampler: Optional[str] = None
    checkpoint: Optional[str] = None

class ExecuteV2Request(BaseModel):
    jobs: List[PlannerJob]
    resources_meta: Optional[List[ResourceMeta]] = []
    group_config: Optional[List[GroupConfigItem]] = []

# Estado global de Fábrica (consulta vía /factory/status)
FACTORY_STATE: Dict[str, Any] = {
    "is_active": False,
    "current_job_index": 0,
    "total_jobs": 0,
    "current_character": None,
    "last_image_path": None,
    "logs": [],
    "stop_requested": False,
}

def _log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    FACTORY_STATE["logs"].append(f"[{ts}] {msg}")
    # Limitar tamaño de log para no crecer indefinidamente
    if len(FACTORY_STATE["logs"]) > 400:
        FACTORY_STATE["logs"] = FACTORY_STATE["logs"][-300:]

from services.reforge import get_progress

@app.get("/reforge/progress")
async def reforge_progress():
    """Proxy para obtener progreso real desde ReForge."""
    try:
        return await get_progress()
    except Exception as e:
        # Si falla, devolver estructura vacía para no romper frontend
        return {"progress": 0, "eta_relative": 0, "state": {"job": "", "job_no": 0, "job_count": 0}}

async def produce_jobs(jobs: List[PlannerJob], group_config: Optional[List[GroupConfigItem]] = None):
    FACTORY_STATE.update({
        "is_active": True,
        "current_job_index": 0,
        "total_jobs": len(jobs),
        "current_character": None,
        "last_image_path": FACTORY_STATE.get("last_image_path"),
        "stop_requested": False,
        "current_prompt": None,
        "current_negative_prompt": None,
        "current_config": None,
    })
    cfg_map: Dict[str, GroupConfigItem] = {}
    for gc in (group_config or []):
        name = (gc.character_name or "").strip()
        if name:
            cfg_map[name] = gc
    _log(f"Producción iniciada: {len(jobs)} trabajos.")
    for idx, job in enumerate(jobs, start=1):
        if FACTORY_STATE.get("stop_requested"):
            _log("Parada de emergencia solicitada. Deteniendo cola.")
            break
        FACTORY_STATE["current_job_index"] = idx
        FACTORY_STATE["current_character"] = job.character_name
        _log(f"Procesando {idx}/{len(jobs)}: {job.character_name}")
        loras = _parse_lora_names(job.prompt)
        for name in loras:
            if not _lora_exists(name):
                _log(f"LoRA faltante: {name}. Intentando descarga...")
                ok = await _maybe_download_lora(name)
                if not ok:
                    _log(f"Descarga omitida: no hay metadata disponible para '{name}'.")
        gc = cfg_map.get(job.character_name)
        steps_override = gc.steps if gc and isinstance(gc.steps, int) else None
        cfg_override = gc.cfg_scale if gc and isinstance(gc.cfg_scale, (int, float)) else None
        
        # Inyección de LoRAs extra
        final_prompt = job.prompt
        extra_loras = gc.extra_loras if gc and isinstance(gc.extra_loras, list) else []
        if extra_loras:
            # Formato esperado: "nombre_archivo" (sin extensión ni ruta, ya que ReForge lo busca por nombre)
            # Se asume peso 0.7 por defecto si no se especifica, pero el frontend enviará strings formateados si es necesario.
            # Aquí el frontend enviará strings como "pixel_art_v2:0.8" o simplemente "pixel_art_v2".
            # Nosotros envolvemos en <lora:...>
            lora_blocks = []
            for l in extra_loras:
                if ":" in l:
                    lora_blocks.append(f"<lora:{l}>")
                else:
                    lora_blocks.append(f"<lora:{l}:0.7>")
            if lora_blocks:
                final_prompt = f"{final_prompt}, {', '.join(lora_blocks)}"

        try:
            actual_steps = steps_override if isinstance(steps_override, int) else 28
            actual_cfg = cfg_override if isinstance(cfg_override, (int, float)) else 7
            options = await get_options()
            ckpt = (options.get("sd_model_checkpoint") if isinstance(options, dict) else None) or "Desconocido"
            enable_hr = options.get("enable_hr") if isinstance(options, dict) else False
            hr_scale = options.get("hr_scale") if isinstance(options, dict) else 1.5
            hires_str = f"ON (x{hr_scale})" if enable_hr else "OFF"
            bs = options.get("sd_batch_size") if isinstance(options, dict) else None
            bs = bs if isinstance(bs, int) else 1
            # Persistir prompt y configuración actual
            FACTORY_STATE["current_prompt"] = final_prompt
            FACTORY_STATE["current_negative_prompt"] = getattr(job, "negative_prompt", None)
            # Override de checkpoint por job si se especifica
            if gc and isinstance(gc.checkpoint, str) and gc.checkpoint.strip():
                new_ckpt = gc.checkpoint.strip()
                if ckpt != new_ckpt:
                    try:
                        await set_active_checkpoint(new_ckpt)
                        ckpt = new_ckpt
                        _log(f"Checkpoint activado para {job.character_name}: {ckpt}")
                    except Exception as e:
                        _log(f"Error activando checkpoint '{new_ckpt}': {e}")
            
            # Obtener opciones actuales para loguear hr_scale real
            options = await get_options()
            hr_scale = options.get("hr_scale") if isinstance(options, dict) else 1.5
            
            # Determinar estado real de Hires Fix para el log
            hr_override = (gc.hires_fix if (gc and isinstance(gc.hires_fix, bool)) else None)
            actual_hr = hr_override if hr_override is not None else enable_hr
            # Si hay override de escala desde el group_config, úsalo para el log
            hr_scale_override = (gc.upscale_by if (gc and isinstance(gc.upscale_by, (int, float))) else None)
            hires_str = f"ON (x{(hr_scale_override if (actual_hr and hr_scale_override is not None) else hr_scale)})" if actual_hr else "OFF"

            FACTORY_STATE["current_config"] = {
                "steps": actual_steps,
                "cfg": actual_cfg,
                "batch_size": bs,
                "hires_fix": actual_hr,
                "hr_scale": (hr_scale_override if (actual_hr and hr_scale_override is not None) else hr_scale),
                "seed": job.seed,
                "checkpoint": ckpt,
            }
            _log(f"Enviando a ReForge: [Seed {job.seed}] Prompt: {final_prompt}")
            _log(f"Checkpoint: {ckpt}")
            _log(f"Config: Steps {actual_steps}, CFG {actual_cfg}, Batch Size {bs}, Hires Fix: {hires_str}")
            # Logs de upscaler/adetailer
            if gc and isinstance(gc.upscaler, str) and gc.upscaler.strip():
                _log(f"Upscaler: {gc.upscaler}")
            if gc and gc.adetailer:
                _log("ADetailer: ON (face)")
            _log(f"Generando imagen {idx}/{len(jobs)}...")
            
            # Overrides de Hires Fix y Denoising según group_config
            dn_override = (float(gc.denoising_strength) if (gc and isinstance(gc.denoising_strength, (int, float))) else None)
            hr_steps_override = (gc.hires_steps if (gc and isinstance(gc.hires_steps, int)) else None)
            
            # Batch Size override
            bs_override = (gc.batch_size if (gc and isinstance(gc.batch_size, int) and gc.batch_size > 0) else None)
            
            # Adetailer script construction (formato API estándar: lista name/args)
            scripts_arr = []
            if gc and gc.adetailer:
                scripts_arr.append({
                    "name": "ADetailer",
                    "args": [
                        True,
                        False,
                        {"ad_model": "face_yolo8n.pt"},
                    ],
                })

            # Upscaler override (si existe en group config o se pasa como extra)
            # Nota: call_txt2img debe soportar hr_upscaler si queremos cambiarlo dinámicamente.
            # Por ahora solo logueamos, la implementación completa requeriría actualizar call_txt2img.
            
            # Overrides avanzados: VAE y Clip Skip (CLIP_stop_at_last_layers)
            vae_override = (gc.vae if (gc and isinstance(gc.vae, str) and gc.vae.strip()) else None)
            cs_override = (gc.clip_skip if (gc and isinstance(gc.clip_skip, int) and 1 <= gc.clip_skip <= 12) else None)
            override_settings = {}
            if vae_override:
                override_settings["sd_vae"] = vae_override
            if cs_override is not None:
                override_settings["CLIP_stop_at_last_layers"] = cs_override

            # Upscaler y escala de Hires (si viene del group_config)
            hr_upscaler = gc.upscaler if (gc and isinstance(gc.upscaler, str) and gc.upscaler.strip()) else None
            hr_scale_override = gc.upscale_by if (gc and isinstance(gc.upscale_by, (int, float))) else None

            data = await call_txt2img(
                prompt=final_prompt, 
                negative_prompt=getattr(job, "negative_prompt", None),
                cfg_scale=cfg_override, 
                steps=steps_override, 
                enable_hr=hr_override, 
                denoising_strength=dn_override, 
                hr_second_pass_steps=hr_steps_override,
                batch_size=bs_override,
                hr_upscaler=hr_upscaler,
                hr_scale=hr_scale_override,
                alwayson_scripts=scripts_arr if scripts_arr else None,
                override_settings=override_settings or None
            )
            # Si se solicitó STOP mientras esperábamos respuesta, no continuar.
            if FACTORY_STATE.get("stop_requested"):
                _log("Parada detectada tras la respuesta. Omitiendo guardado y cancelando cola.")
                break
            images = data.get("images", []) if isinstance(data, dict) else []
            if not images:
                _log("ReForge no devolvió imágenes.")
                continue
            last_b64 = images[0]
            # Guardado con posible override de ruta basado en env tokens
            override_dir = (gc.output_path if (gc and isinstance(gc.output_path, str) and gc.output_path.strip()) else None)
            path = await _save_image(job.character_name, last_b64, override_dir=override_dir)
            FACTORY_STATE["last_image_path"] = path
            FACTORY_STATE["last_image_b64"] = f"data:image/png;base64,{last_b64}"
            _log(f"Guardado en disco: {path}")
        except Exception as e:
            _log(f"Error en generación: {e}")
            continue
    FACTORY_STATE["is_active"] = False
    _log("Producción finalizada.")

def schedule_production(jobs: List[PlannerJob]):
    try:
        loop = asyncio.get_event_loop()
        loop.create_task(produce_jobs(jobs))
    except RuntimeError:
        # Si no hay loop (entornos específicos), ejecutar en to_thread
        asyncio.run(produce_jobs(jobs))

async def execute_pipeline(jobs: List[PlannerJob], resources: Optional[List[ResourceMeta]] = None, group_config: Optional[List[GroupConfigItem]] = None):
    # Limpieza de cola y reseteo de contadores antes de iniciar
    FACTORY_STATE.update({
        "is_active": True,
        "stop_requested": False,
        "current_job_index": 0,
        "total_jobs": len(jobs),
        "current_character": None,
        "current_prompt": None,
        "current_config": None,
    })
    _log("Iniciando aprovisionamiento de LoRAs...")
    # Normalización robusta de resources_meta (dicts/objetos) y filtrado por URL válida
    normalized = []
    try:
        raw_list = resources or []
        for rm in raw_list:
            if rm is None:
                continue
            d = None
            try:
                if isinstance(rm, dict):
                    d = rm
                elif hasattr(rm, "model_dump"):
                    d = rm.model_dump()
                elif hasattr(rm, "dict"):
                    d = rm.dict()
                else:
                    d = {
                        "character_name": getattr(rm, "character_name", None),
                        "download_url": getattr(rm, "download_url", None),
                        "filename": getattr(rm, "filename", None),
                    }
            except Exception:
                d = {}
            char_name = (d.get("character_name") or d.get("characterName") or d.get("name") or "").strip()
            url_raw = (d.get("download_url") or d.get("downloadUrl") or d.get("url") or "")
            url = url_raw.strip().replace("`", "").strip('"').strip("'")
            fname = d.get("filename") or (char_name.lower().replace(" ", "_") if char_name else None)
            if not char_name or not url:
                continue
            normalized.append({"character_name": char_name, "download_url": url, "filename": fname})
        _log(f"Recibido Meta: {json.dumps(normalized, indent=2)}")
    except Exception as e:
        _log(f"Recibido Meta: (error normalizando) {e}")
    meta_map = { (d.get("character_name") or "").strip(): d for d in normalized if (d.get("character_name") or "").strip() }
    unique_chars = sorted(set(j.character_name for j in jobs))
    succeeded = set()
    failed = set()
    for char in unique_chars:
        rm = meta_map.get(char)
        filename = sanitize_filename(char)
        # Feedback de inicio: verificar existencia en disco antes de descargar
        safe_fname = filename if filename.lower().endswith(".safetensors") else filename + ".safetensors"
        d = get_lora_dir()
        if d and d.exists():
            _log(f"[INFO] Verificando existencia de {safe_fname} en disco...")
            target = (d / safe_fname)
            if target.exists():
                _log("[INFO] Archivo encontrado. Omitiendo descarga.")
                succeeded.add(char)
                continue
        download_url = (rm.get("download_url") if rm else "")
        try:
            ok = await ensure_lora(char, filename, download_url, _log)
        except Exception as e:
            _log(f"❌ Error de conexión con Civitai para {safe_fname}: {e}")
            ok = False
        if not ok:
            _log(f"❌ Error descargando {char}. Saltando sus trabajos.")
            failed.add(char)
        else:
            succeeded.add(char)
    filtered_jobs = [j for j in jobs if j.character_name in succeeded]
    activos = len(filtered_jobs)
    omitidos = len(failed)
    FACTORY_STATE["total_jobs"] = activos
    _log(f"Producción ajustada: {activos} trabajos activos ({omitidos} omitidos por error de descarga).")
    if activos == 0:
        FACTORY_STATE["is_active"] = False
        _log("No hay trabajos ejecutables tras aprovisionamiento.")
        return
    _log("Aprovisionamiento completado. Iniciando generación...")
    await produce_jobs(filtered_jobs, group_config)

@app.post("/planner/execute")
async def execute_plan(payload: ExecuteRequest, background_tasks: BackgroundTasks):
    """
    Endpoint V1 (legacy): No soporta configuración por personaje.
    """
    if FACTORY_STATE["is_active"]:
        raise HTTPException(status_code=400, detail="Fábrica ocupada")
    
    # Validar jobs
    if not payload.jobs:
        raise HTTPException(status_code=400, detail="Lista de jobs vacía")

    # Iniciar proceso en background
    background_tasks.add_task(execute_pipeline, payload.jobs, payload.resources_meta or [], [])
    return {"status": "started", "total_jobs": len(payload.jobs)}

@app.post("/planner/execute_v2")
async def execute_plan_v2(payload: ExecuteV2Request, background_tasks: BackgroundTasks):
    """
    Endpoint V2: Soporta configuración por personaje (steps, cfg, hires fix, etc).
    """
    if FACTORY_STATE["is_active"]:
        raise HTTPException(status_code=400, detail="Fábrica ocupada")
    
    if not payload.jobs:
        raise HTTPException(status_code=400, detail="Lista de jobs vacía")

    background_tasks.add_task(execute_pipeline, payload.jobs, payload.resources_meta or [], payload.group_config or [])
    return {"status": "started", "total_jobs": len(payload.jobs), "version": "v2"}

# Lista de modelos Groq con fallback (prioridad de calidad -> rapidez -> legacy)
GROQ_MODEL_FALLBACKS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
]

async def groq_chat_with_fallbacks(client, messages: list, temperature: float = 0.2):
  """Intenta solicitar a Groq iterando sobre GROQ_MODEL_FALLBACKS antes de rendirse."""
  last_error = None
  for model in GROQ_MODEL_FALLBACKS:
    try:
      completion = await asyncio.to_thread(
        lambda: client.chat.completions.create(
          model=model,
          messages=messages,
          temperature=temperature,
        )
      )
      return completion
    except Exception as e:
      last_error = e
      continue
  raise HTTPException(status_code=502, detail=f"Error en Groq (fallback agotado): {str(last_error)}")

@app.get("/reforge/checkpoints")
async def reforge_checkpoints():
    try:
        titles = await list_checkpoints()
        return {"titles": titles}
    except httpx.HTTPStatusError as e:
        status = e.response.status_code if getattr(e, "response", None) else None
        message = "No se detecta ReForge. Asegúrate de iniciarlo con el argumento --api." if status == 404 else f"Error al contactar ReForge (status {status}). Asegúrate de iniciarlo con --api."
        raise HTTPException(status_code=502, detail=message)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail="No se detecta ReForge. Asegúrate de iniciarlo con el argumento --api.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado: {str(e)}")


@app.get("/reforge/vaes")
async def reforge_vaes():
    """Lista VAEs disponibles desde ReForge/SD WebUI."""
    try:
        names = await list_vaes()
        return {"names": names}
    except httpx.HTTPStatusError as e:
        status = e.response.status_code if getattr(e, "response", None) else None
        message = "No se detecta ReForge. Asegúrate de iniciarlo con el argumento --api." if status == 404 else f"Error al contactar ReForge (status {status}). Asegúrate de iniciarlo con --api."
        raise HTTPException(status_code=502, detail=message)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="No se detecta ReForge. Asegúrate de iniciarlo con el argumento --api.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado: {str(e)}")


@app.get("/reforge/options")
async def reforge_options():
    """Lee configuración actual simplificada: VAE y Clip Skip."""
    try:
        opts = await get_options()
        current_vae = None
        current_clip_skip = None
        if isinstance(opts, dict):
            current_vae = opts.get("sd_vae")
            current_clip_skip = opts.get("CLIP_stop_at_last_layers")
        return {
            "current_vae": current_vae or "Automatic",
            "current_clip_skip": int(current_clip_skip) if isinstance(current_clip_skip, (int, float)) else 1,
        }
    except httpx.HTTPStatusError as e:
        status = e.response.status_code if getattr(e, "response", None) else None
        message = "No se detecta ReForge. Asegúrate de iniciarlo con el argumento --api." if status == 404 else f"Error al contactar ReForge (status {status}). Asegúrate de iniciarlo con --api."
        raise HTTPException(status_code=502, detail=message)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="No se detecta ReForge. Asegúrate de iniciarlo con el argumento --api.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado: {str(e)}")


@app.post("/reforge/checkpoint")
async def reforge_set_checkpoint(req: CheckpointRequest):
    if not req.title or not req.title.strip():
        raise HTTPException(status_code=400, detail="title requerido")
    try:
        result = await set_active_checkpoint(req.title.strip())
        return result
    except httpx.HTTPStatusError as e:
        status = e.response.status_code if getattr(e, "response", None) else None
        message = "No se detecta ReForge. Asegúrate de iniciarlo con el argumento --api." if status == 404 else f"Error al contactar ReForge (status {status}). Asegúrate de iniciarlo con --api."
        raise HTTPException(status_code=502, detail=message)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail="No se detecta ReForge. Asegúrate de iniciarlo con el argumento --api.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado: {str(e)}")


@app.post("/dream")
async def dream(req: DreamRequest):
    api_key = GROQ_API_KEY
    if not api_key:
        raise HTTPException(status_code=400, detail="GROQ_API_KEY no disponible")
    if Groq is None:
        raise HTTPException(status_code=500, detail="Groq SDK no disponible en el servidor")

    system_prompt = (
        "You are a Stable Diffusion Prompt Engineer. You DO NOT speak Spanish. "
        "You ONLY output comma-separated Danbooru tags in English. NO sentences. NO explanations."
    )
    user_prompt = f"Character: {req.character}\nTags: {req.tags or ''}\nOutput: comma-separated Danbooru tags in English."

    try:
        client = Groq(api_key=api_key)
        completion = await groq_chat_with_fallbacks(
            client,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
        content = completion.choices[0].message.content.strip()
        # Devuelve solo texto plano
        return PlainTextResponse(content=content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error en Groq: {str(e)}")


@app.post("/generate")
async def generate(payload: GenerateRequest):
    """Genera imagen vía ReForge (txt2img) con posibilidad de overrides."""
    try:
        # Logs previos a la generación (transparencia)
        cfg = payload.cfg_scale if payload.cfg_scale is not None else 7
        _log(f"Enviando a ReForge: [Seed N/A] Prompt: {payload.prompt}")
        options = await get_options()
        ckpt = (options.get("sd_model_checkpoint") if isinstance(options, dict) else None) or "Desconocido"
        enable_hr = options.get("enable_hr") if isinstance(options, dict) else False
        hr_scale = options.get("hr_scale") if isinstance(options, dict) else 1.5
        hires_str = f"ON (x{hr_scale})" if enable_hr else "OFF"
        _log(f"Checkpoint: {ckpt}")
        bs = payload.batch_size if payload.batch_size is not None else 1
        _log(f"Config: Steps 28, CFG {cfg}, Batch Size {bs}, Hires Fix: {hires_str}")
        data = await call_txt2img(
            prompt=payload.prompt,
            batch_size=payload.batch_size,
            cfg_scale=payload.cfg_scale,
        )
        images = data.get("images", []) if isinstance(data, dict) else []
        info = data.get("info") if isinstance(data, dict) else None
        return JSONResponse(content={"images": images, "info": info})
    except httpx.HTTPStatusError as e:
        status = e.response.status_code if getattr(e, "response", None) else None
        message = "No se detecta ReForge. Asegúrate de iniciarlo con el argumento --api." if status == 404 else f"Error al contactar ReForge (status {status}). Asegúrate de iniciarlo con --api."
        raise HTTPException(status_code=502, detail=message)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail="No se detecta ReForge. Asegúrate de iniciarlo con el argumento --api.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al generar: {str(e)}")

@app.post("/save-files")
async def save_files(payload: dict):
    """Guarda personajes.txt y poses.txt en REFORGE_PATH con formato consolidado por entidad:
    trigger1, trigger2, nombre_limpio, tags_calidad
    - Sobrescribe o crea si no existen.
    - No guarda JSON, solo texto plano.
    """
    out = payload.get("output")
    if not out or not isinstance(out, dict):
        raise HTTPException(status_code=400, detail="Formato inválido: 'output' requerido.")
    if not REFORGE_PATH:
        raise HTTPException(status_code=400, detail="REFORGE_PATH no configurado en .env.")

    # Cadena estricta de calidad (Anime/NSFW optimizada)
    quality_tags = (
        "masterpiece, best quality, amazing quality, absurdres, explicit, nsfw, (highly detailed face:1.2)"
    )

    try:
        def write_files():
            base = Path(REFORGE_PATH)
            base.mkdir(parents=True, exist_ok=True)

            personajes = out.get("personajes", []) or []
            poses = out.get("poses", []) or []

            def make_line(entity: dict) -> str | None:
                if not isinstance(entity, dict):
                    return None
                nombre = (entity.get("nombre") or "").strip()
                triggers = [
                    (t or "").strip() for t in (entity.get("triggers") or []) if (t or "").strip()
                ]
                if not nombre:
                    return None
                # Consolidar todos los triggers en una sola línea
                prefix = ", ".join(triggers) if triggers else ""
                if prefix:
                    return f"{prefix}, {nombre}, {quality_tags}"
                else:
                    # Si no hay triggers, aún guardamos nombre + calidad
                    return f"{nombre}, {quality_tags}"

            personajes_lines = [l for l in (make_line(e) for e in personajes) if l]
            poses_lines = [l for l in (make_line(e) for e in poses) if l]

            (base / "personajes.txt").write_text(
                "\n".join(personajes_lines) + ("\n" if personajes_lines else ""),
                encoding="utf-8",
            )
            (base / "poses.txt").write_text(
                "\n".join(poses_lines) + ("\n" if poses_lines else ""),
                encoding="utf-8",
            )

        await asyncio.to_thread(write_files)
        return {"status": "ok", "saved": ["personajes.txt", "poses.txt"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar archivos: {str(e)}")

# Modelos definidos arriba

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)


class DownloadLoraRequest(BaseModel):
    url: str
    filename: str | None = None

class DeleteLoraRequest(BaseModel):
    filename: str

@app.post("/download-lora")
async def download_lora(req: DownloadLoraRequest):
    """Descarga un archivo .safetensors desde Civitai usando cloudscraper y lo guarda en la carpeta de LoRAs.
    Destino: REFORGE_PATH/../../models/Lora
    """
    if not REFORGE_PATH:
        raise HTTPException(status_code=400, detail="REFORGE_PATH no configurado en .env.")
    if not req.url or not isinstance(req.url, str):
        raise HTTPException(status_code=400, detail="url requerida")

    def _safe_name(name: str) -> str:
        base = name.strip().lower().replace(" ", "_")
        if not base.endswith(".safetensors"):
            base += ".safetensors"
        # evitar caracteres peligrosos
        return "".join(c for c in base if c.isalnum() or c in ["_", ".", "-"])

    async def _run() -> dict:
        try:
            base = Path(REFORGE_PATH).resolve()
            lora_dir = base.parents[1] / "models" / "Lora"
            lora_dir.mkdir(parents=True, exist_ok=True)
            filename = _safe_name(req.filename or "downloaded_lora.safetensors")
            target = lora_dir / filename

            def _download():
                scraper = cloudscraper.create_scraper()
                with scraper.get(req.url, stream=True, timeout=120) as r:
                    r.raise_for_status()
                    with open(target, "wb") as f:
                        for chunk in r.iter_content(chunk_size=1024 * 1024):  # 1MB
                            if chunk:
                                f.write(chunk)
                return target.stat().st_size

            size = await asyncio.to_thread(_download)
            return {"status": "ok", "saved": str(target), "size_bytes": size}
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Error HTTP al descargar: {str(e)}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Error descargando LORA: {str(e)}")

    return await _run()

class DownloadCheckpointRequest(BaseModel):
    url: str
    filename: str | None = None

@app.post("/download-checkpoint")
async def download_checkpoint(req: DownloadCheckpointRequest):
    """Descarga un archivo .safetensors desde Civitai usando cloudscraper y lo guarda en la carpeta de Checkpoints.
    Destino: REFORGE_PATH/../../models/Stable-diffusion
    """
    if not REFORGE_PATH:
        raise HTTPException(status_code=400, detail="REFORGE_PATH no configurado en .env.")
    if not req.url or not isinstance(req.url, str):
        raise HTTPException(status_code=400, detail="url requerida")

    def _safe_name(name: str) -> str:
        base = name.strip().lower().replace(" ", "_")
        if not base.endswith(".safetensors"):
            base += ".safetensors"
        return "".join(c for c in base if c.isalnum() or c in ["_", ".", "-"])

    async def _run() -> dict:
        try:
            base = Path(REFORGE_PATH).resolve()
            # Checkpoints están en models/Stable-diffusion
            ckpt_dir = base.parents[1] / "models" / "Stable-diffusion"
            ckpt_dir.mkdir(parents=True, exist_ok=True)
            filename = _safe_name(req.filename or "downloaded_checkpoint.safetensors")
            target = ckpt_dir / filename

            def _download():
                scraper = cloudscraper.create_scraper()
                with scraper.get(req.url, stream=True, timeout=120) as r:
                    r.raise_for_status()
                    with open(target, "wb") as f:
                        for chunk in r.iter_content(chunk_size=1024 * 1024):  # 1MB
                            if chunk:
                                f.write(chunk)
                return target.stat().st_size

            size = await asyncio.to_thread(_download)
            return {"status": "ok", "saved": str(target), "size_bytes": size}
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Error HTTP al descargar: {str(e)}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Error descargando Checkpoint: {str(e)}")

    return await _run()

@app.get("/local/loras")
async def list_local_loras():
    """Lista archivos .safetensors en la carpeta de LoRAs"""
    if not REFORGE_PATH:
        raise HTTPException(status_code=400, detail="REFORGE_PATH no configurado en .env.")

    def _list() -> list[str]:
        base = Path(REFORGE_PATH).resolve()
        lora_dir = base.parents[1] / "models" / "Lora"
        if not lora_dir.exists():
            return []
        # Escaneo recursivo
        return [p.stem for p in lora_dir.rglob("*.safetensors") if p.is_file()]

    files = await asyncio.to_thread(_list)
    return {"files": files}

@app.delete("/local/lora")
async def delete_local_lora(req: DeleteLoraRequest):
    """Elimina un archivo .safetensors de la carpeta de LoRAs de forma segura"""
    if not REFORGE_PATH:
        raise HTTPException(status_code=400, detail="REFORGE_PATH no configurado en .env.")
    if not req.filename or not isinstance(req.filename, str):
        raise HTTPException(status_code=400, detail="filename requerido")

    def _delete() -> dict:
        base = Path(REFORGE_PATH).resolve()
        lora_dir = base.parents[1] / "models" / "Lora"
        lora_dir.mkdir(parents=True, exist_ok=True)
        target = (lora_dir / req.filename).resolve()
        # prevención de path traversal
        if lora_dir.resolve() not in target.parents:
            raise HTTPException(status_code=400, detail="Ruta inválida")
        if not target.exists() or not target.is_file():
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
        target.unlink()
        return {"status": "ok", "deleted": req.filename}

    return await asyncio.to_thread(_delete)



# get_lora_dir centralizado en la sección superior. Esta definición duplicada ha sido eliminada para unificar rutas.

def _parse_lora_names(prompt: str) -> List[str]:
    names: List[str] = []
    p = (prompt or "")
    # Formatos esperados: <lora:NAME> o <lora:NAME:WEIGHT>
    import re
    for m in re.finditer(r"<lora:([a-zA-Z0-9_\-\.]+)(?::[0-9\.]+)?>", p):
        names.append(m.group(1))
    return names

def _lora_exists(name: str) -> bool:
    d = get_lora_dir()
    if not d:
        return False
    if not d.exists():
        return False
    name_low = name.strip().lower()
    for f in d.glob("*.safetensors"):
        if name_low in f.name.lower():
            return True
    return False

async def _maybe_download_lora(name: str) -> bool:
    # Sin metadata de URL en PlannerJob, registramos y omitimos descarga.
    _log(f"LoRA '{name}' no encontrado; no hay metadata para descargar. Se omite.")
    return False

async def _save_image(character_name: str, image_b64: str, override_dir: Optional[str] = None) -> str:
    if not OUTPUTS_DIR:
        raise HTTPException(status_code=400, detail="OUTPUTS_DIR no configurado en .env.")
    # Resolver directorio de salida respetando tokens de entorno
    base_env = Path(OUTPUTS_DIR)
    dest_dir = base_env / sanitize_filename(character_name)
    if isinstance(override_dir, str) and override_dir.strip():
        try:
            raw = override_dir.strip()
            # Permitir tokens: OUTPUTS_DIR y {Character}
            resolved = raw.replace("OUTPUTS_DIR", str(base_env))
            resolved = resolved.replace("{Character}", sanitize_filename(character_name))
            dest_dir = Path(resolved)
        except Exception:
            # Fallback seguro
            dest_dir = base_env / sanitize_filename(character_name)
    dest_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    target = dest_dir / f"{ts}.png"
    try:
        data = base64.b64decode(image_b64)
        target.write_bytes(data)
    except Exception as e:
        _log(f"Error guardando imagen: {e}")
        raise HTTPException(status_code=500, detail=f"Error guardando imagen: {str(e)}")
    return str(target)


def schedule_production(jobs: List[PlannerJob]):
    try:
        loop = asyncio.get_event_loop()
        loop.create_task(produce_jobs(jobs))
    except RuntimeError:
        # Si no hay loop (entornos específicos), ejecutar en to_thread
        asyncio.run(produce_jobs(jobs))


@app.get("/factory/status")
async def factory_status(limit: int = 50):
    # Limitar los logs devueltos para evitar sobrecarga del payload
    try:
        logs_all = FACTORY_STATE.get("logs", [])
        l = int(limit)
        if l <= 0:
            logs_slice = []
        else:
            logs_slice = logs_all[-l:]
    except Exception:
        logs_slice = FACTORY_STATE.get("logs", [])[-50:]

    return {
        "is_active": bool(FACTORY_STATE.get("is_active")),
        "current_job_index": int(FACTORY_STATE.get("current_job_index", 0)),
        "total_jobs": int(FACTORY_STATE.get("total_jobs", 0)),
        "current_character": FACTORY_STATE.get("current_character"),
        "current_prompt": FACTORY_STATE.get("current_prompt"),
        "current_negative_prompt": FACTORY_STATE.get("current_negative_prompt"),
        "current_config": FACTORY_STATE.get("current_config"),
        "last_image_url": FACTORY_STATE.get("last_image_path"),
        "last_image_b64": FACTORY_STATE.get("last_image_b64"),
        "logs": logs_slice,
    }

@app.post("/factory/stop")
async def factory_stop():
    FACTORY_STATE["stop_requested"] = True
    _log("Parada de emergencia activada por el usuario. Solicitando interrupción a Stable Diffusion...")
    try:
        data = await interrupt_generation()
        status = data.get("status", "ok") if isinstance(data, dict) else "ok"
        _log(f"Interrupción enviada a ReForge: {status}")
    except Exception as e:
        _log(f"Error al interrumpir la generación en ReForge: {e}")
    return {"status": "stopping"}