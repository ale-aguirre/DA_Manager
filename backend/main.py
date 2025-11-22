import os
import asyncio
import random
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
import httpx
from services.reforge import call_txt2img, list_checkpoints, set_active_checkpoint
from services.lora import ensure_lora
import cloudscraper
from pydantic import BaseModel
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
CIVITAI_API_KEY = os.getenv("CIVITAI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PORT = int(os.getenv("PORT", "8000"))
OUTPUTS_DIR = os.getenv("OUTPUTS_DIR")
RESOURCES_DIR = os.getenv("RESOURCES_DIR")

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

class PlannerJob(BaseModel):
    character_name: str
    prompt: str
    seed: int

class PlannerExecutionRequest(BaseModel):
    # Usamos modelos tipados para asegurar parseo desde Body
    jobs: List[PlannerJob]
    resources_meta: Optional[List[dict]] = []

class MagicFixRequest(BaseModel):
    prompt: str

# Advertencias no bloqueantes
if not REFORGE_PATH:
    print("[Advertencia] REFORGE_PATH no está definido en .env.")
else:
    rp = Path(REFORGE_PATH)
    if not rp.exists():
        print(f"[Advertencia] REFORGE_PATH '{REFORGE_PATH}' no existe en el sistema.")

if not OUTPUTS_DIR:
    print("[Advertencia] OUTPUTS_DIR no está definido en .env.")

app = FastAPI(title="LadyManager Backend", version="0.1.0")

# CORS para el frontend (localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Endpoint básico de salud del sistema."""
    return {
        "status": "online",
        "reforge_path": REFORGE_PATH,
    }

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
    """Devuelve listas de recursos (outfits, poses, locations) desde RESOURCES_DIR."""
    outfits = _read_lines("outfits.txt")
    poses = _read_lines("poses.txt")
    locations = _read_lines("locations.txt")
    if not outfits or not poses or not locations:
        raise HTTPException(status_code=500, detail="Recursos insuficientes o RESOURCES_DIR no configurado.")
    return {"outfits": outfits, "poses": poses, "locations": locations}

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
async def planner_draft(payload: List[PlannerDraftItem]):
    from itertools import product
    poses = _read_lines("poses.txt")
    outfits = _read_lines("outfits.txt")
    locations = _read_lines("locations.txt")
    if not poses or not outfits or not locations:
        raise HTTPException(status_code=500, detail="Recursos insuficientes: poses/outfits/locations vacíos.")

    jobs: List[PlannerJob] = []
    for char in payload:
        # Combinaciones únicas posibles
        all_combos = list(product(outfits, poses, locations))
        random.shuffle(all_combos)
        take = 10 if len(all_combos) >= 10 else len(all_combos)
        selected = all_combos[:take]
        # Si el espacio de combinaciones es menor que 10, rellenamos con elecciones aleatorias
        if take < 10 and all_combos:
            selected.extend(random.choice(all_combos) for _ in range(10 - take))
        # Construcción de prompt con formato estricto solicitado
        lora_tag = f"<lora:{sanitize_filename(char.character_name)}:0.8>"
        trigger = ", ".join([t for t in (char.trigger_words or []) if t.strip()]) or char.character_name
        for o, p, l in selected:
            prompt = f"{lora_tag}, {trigger}, {o}, {p}, {l}, {QUALITY_TAGS}"
            seed = random.randint(0, 2_147_483_647)
            jobs.append(PlannerJob(character_name=char.character_name, prompt=prompt, seed=seed))
    return JSONResponse(content={"jobs": [j.model_dump() for j in jobs]})

@app.post("/planner/magicfix")
async def planner_magicfix(req: MagicFixRequest):
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt requerido")
    if not GROQ_API_KEY or Groq is None:
        # Devuelve el mismo prompt si Groq no está disponible
        return {"prompt": req.prompt}
    try:
        client = Groq(api_key=GROQ_API_KEY)
        system_prompt = (
            "You are a Stable Diffusion Prompt editor. "
            "Rewrite the given prompt (tags) to be more coherent and evocative, in English, comma-separated tags only. "
            "Do NOT add explanations. Return ONLY the rewritten prompt."
        )
        user_prompt = req.prompt
        completion = await groq_chat_with_fallbacks(
            client,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
        )
        content = completion.choices[0].message.content.strip()
        return {"prompt": content}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error en Groq: {str(e)}")

# BLOQUE DUPLICADO ELIMINADO: se removieron definiciones duplicadas de endpoints y clases añadidas por error durante la edición.

def _get_lora_dir() -> Path | None:
    if not REFORGE_PATH:
        return None
    try:
        base = Path(REFORGE_PATH).resolve()
        return base.parents[1] / "models" / "Lora"
    except Exception:
        return None

def _parse_lora_names(prompt: str) -> List[str]:
    names: List[str] = []
    p = (prompt or "")
    # Formatos esperados: <lora:NAME> o <lora:NAME:WEIGHT>
    import re
    for m in re.finditer(r"<lora:([a-zA-Z0-9_\-\.]+)(?::[0-9\.]+)?>", p):
        names.append(m.group(1))
    return names

def _lora_exists(name: str) -> bool:
    d = _get_lora_dir()
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

async def _save_image(character_name: str, image_b64: str) -> str:
    if not OUTPUTS_DIR:
        raise HTTPException(status_code=400, detail="OUTPUTS_DIR no configurado en .env.")
    dest_dir = Path(OUTPUTS_DIR) / sanitize_filename(character_name)
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

async def produce_jobs(jobs: List[PlannerJob]):
    FACTORY_STATE.update({
        "is_active": True,
        "current_job_index": 0,
        "total_jobs": len(jobs),
        "current_character": None,
        "last_image_path": FACTORY_STATE.get("last_image_path"),
        "stop_requested": False,
    })
    _log(f"Producción iniciada: {len(jobs)} trabajos.")
    for idx, job in enumerate(jobs, start=1):
        if FACTORY_STATE.get("stop_requested"):
            _log("Parada de emergencia solicitada. Deteniendo cola.")
            break
        FACTORY_STATE["current_job_index"] = idx
        FACTORY_STATE["current_character"] = job.character_name
        _log(f"Procesando {idx}/{len(jobs)}: {job.character_name}")
        # Descarga inteligente de LoRA
        loras = _parse_lora_names(job.prompt)
        for name in loras:
            if not _lora_exists(name):
                _log(f"LoRA faltante: {name}. Intentando descarga...")
                ok = await _maybe_download_lora(name)
                if not ok:
                    _log(f"Descarga omitida: no hay metadata disponible para '{name}'.")
        # Generación vía ReForge
        try:
            _log(f"Generando imagen {idx}/{len(jobs)}...")
            data = await call_txt2img(prompt=job.prompt)
            images = data.get("images", []) if isinstance(data, dict) else []
            if not images:
                _log("ReForge no devolvió imágenes.")
                continue
            last_b64 = images[0]
            # Guardado
            path = await _save_image(job.character_name, last_b64)
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

async def execute_pipeline(jobs: List[PlannerJob], resources: Optional[List[ResourceMeta]] = None):
    FACTORY_STATE.update({
        "is_active": True,
        "current_job_index": 0,
        "total_jobs": len(jobs),
        "current_character": None,
    })
    _log("Iniciando aprovisionamiento de LoRAs...")
    meta_map = { (rm.character_name or "").strip(): rm for rm in (resources or []) if rm and (rm.character_name or "").strip() }
    unique_chars = sorted(set(j.character_name for j in jobs))
    succeeded = set()
    failed = set()
    for char in unique_chars:
        rm = meta_map.get(char)
        # Siempre usar nombre de archivo sanitizado basado en el personaje
        filename = sanitize_filename(char)
        download_url = rm.download_url if rm and rm.download_url else ""
        ok = await asyncio.to_thread(ensure_lora, char, filename, download_url, _log)
        if not ok:
            _log(f"❌ Error descargando {char}. Saltando sus trabajos.")
            failed.add(char)
        else:
            succeeded.add(char)
    filtered_jobs = [j for j in jobs if j.character_name in succeeded]
    # Ajustar conteo y log UX
    activos = len(filtered_jobs)
    omitidos = len(failed)
    FACTORY_STATE["total_jobs"] = activos
    _log(f"Producción ajustada: {activos} trabajos activos ({omitidos} omitidos por error de descarga).")
    if activos == 0:
        FACTORY_STATE["is_active"] = False
        _log("No hay trabajos ejecutables tras aprovisionamiento.")
        return
    _log("Aprovisionamiento completado. Iniciando generación...")
    await produce_jobs(filtered_jobs)

@app.post("/planner/execute")
async def execute_plan(payload: PlannerExecutionRequest, background_tasks: BackgroundTasks):
    if not isinstance(payload.jobs, list) or not payload.jobs:
        raise HTTPException(status_code=400, detail="jobs requerido y no vacío")
    # Inicializamos estado y programamos tarea de fondo
    FACTORY_STATE.update({
        "is_active": True,
        "current_job_index": 0,
        "total_jobs": len(payload.jobs),
        "current_character": None,
    })
    _log("Solicitud de ejecución recibida. Iniciando aprovisionamiento...")
    background_tasks.add_task(execute_pipeline, payload.jobs, payload.resources_meta or [])
    return {"status": "started", "total_jobs": len(payload.jobs)}

@app.get("/factory/status")
async def factory_status():
    return {
        "is_active": bool(FACTORY_STATE.get("is_active")),
        "current_job_index": int(FACTORY_STATE.get("current_job_index", 0)),
        "total_jobs": int(FACTORY_STATE.get("total_jobs", 0)),
        "current_character": FACTORY_STATE.get("current_character"),
        "last_image_url": FACTORY_STATE.get("last_image_path"),
        "last_image_b64": FACTORY_STATE.get("last_image_b64"),
        "logs": FACTORY_STATE.get("logs", [])[-100:],
    }

@app.post("/factory/stop")
async def factory_stop():
    FACTORY_STATE["stop_requested"] = True
    _log("Parada de emergencia activada por el usuario.")
    return {"status": "stopping"}

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
        return [p.name for p in lora_dir.glob("*.safetensors") if p.is_file()]

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

def _get_lora_dir() -> Path | None:
    if not REFORGE_PATH:
        return None
    try:
        base = Path(REFORGE_PATH).resolve()
        return base.parents[1] / "models" / "Lora"
    except Exception:
        return None

def _parse_lora_names(prompt: str) -> List[str]:
    names: List[str] = []
    p = (prompt or "")
    # Formatos esperados: <lora:NAME> o <lora:NAME:WEIGHT>
    import re
    for m in re.finditer(r"<lora:([a-zA-Z0-9_\-\.]+)(?::[0-9\.]+)?>", p):
        names.append(m.group(1))
    return names

def _lora_exists(name: str) -> bool:
    d = _get_lora_dir()
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

async def _save_image(character_name: str, image_b64: str) -> str:
    if not OUTPUTS_DIR:
        raise HTTPException(status_code=400, detail="OUTPUTS_DIR no configurado en .env.")
    dest_dir = Path(OUTPUTS_DIR) / sanitize_filename(character_name)
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

async def produce_jobs(jobs: List[PlannerJob]):
    FACTORY_STATE.update({
        "is_active": True,
        "current_job_index": 0,
        "total_jobs": len(jobs),
        "current_character": None,
        "last_image_path": FACTORY_STATE.get("last_image_path"),
        "stop_requested": False,
    })
    _log(f"Producción iniciada: {len(jobs)} trabajos.")
    for idx, job in enumerate(jobs, start=1):
        if FACTORY_STATE.get("stop_requested"):
            _log("Parada de emergencia solicitada. Deteniendo cola.")
            break
        FACTORY_STATE["current_job_index"] = idx
        FACTORY_STATE["current_character"] = job.character_name
        _log(f"Procesando {idx}/{len(jobs)}: {job.character_name}")
        # Descarga inteligente de LoRA
        loras = _parse_lora_names(job.prompt)
        for name in loras:
            if not _lora_exists(name):
                _log(f"LoRA faltante: {name}. Intentando descarga...")
                ok = await _maybe_download_lora(name)
                if not ok:
                    _log(f"Descarga omitida: no hay metadata disponible para '{name}'.")
        # Generación vía ReForge
        try:
            _log(f"Generando imagen {idx}/{len(jobs)}...")
            data = await call_txt2img(prompt=job.prompt)
            images = data.get("images", []) if isinstance(data, dict) else []
            if not images:
                _log("ReForge no devolvió imágenes.")
                continue
            last_b64 = images[0]
            # Guardado
            path = await _save_image(job.character_name, last_b64)
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

async def execute_pipeline(jobs: List[PlannerJob], resources: Optional[List[ResourceMeta]] = None):
    FACTORY_STATE.update({
        "is_active": True,
        "current_job_index": 0,
        "total_jobs": len(jobs),
        "current_character": None,
    })
    _log("Iniciando aprovisionamiento de LoRAs...")
    meta_map = { (rm.character_name or "").strip(): rm for rm in (resources or []) if rm and (rm.character_name or "").strip() }
    unique_chars = sorted(set(j.character_name for j in jobs))
    succeeded = set()
    failed = set()
    for char in unique_chars:
        rm = meta_map.get(char)
        # Siempre usar nombre de archivo sanitizado basado en el personaje
        filename = sanitize_filename(char)
        download_url = rm.download_url if rm and rm.download_url else ""
        ok = await asyncio.to_thread(ensure_lora, char, filename, download_url, _log)
        if not ok:
            _log(f"❌ Error descargando {char}. Saltando sus trabajos.")
            failed.add(char)
        else:
            succeeded.add(char)
    filtered_jobs = [j for j in jobs if j.character_name in succeeded]
    # Ajustar conteo y log UX
    activos = len(filtered_jobs)
    omitidos = len(failed)
    FACTORY_STATE["total_jobs"] = activos
    _log(f"Producción ajustada: {activos} trabajos activos ({omitidos} omitidos por error de descarga).")
    if activos == 0:
        FACTORY_STATE["is_active"] = False
        _log("No hay trabajos ejecutables tras aprovisionamiento.")
        return
    _log("Aprovisionamiento completado. Iniciando generación...")
    await produce_jobs(filtered_jobs)

@app.post("/planner/execute")
async def planner_execute(payload: ExecuteRequest, background_tasks: BackgroundTasks):
    if not isinstance(payload.jobs, list) or not payload.jobs:
        raise HTTPException(status_code=400, detail="jobs requerido y no vacío")
    # Inicializamos estado y programamos tarea de fondo
    FACTORY_STATE.update({
        "is_active": True,
        "current_job_index": 0,
        "total_jobs": len(payload.jobs),
        "current_character": None,
    })
    _log("Solicitud de ejecución recibida. Iniciando aprovisionamiento...")
    background_tasks.add_task(execute_pipeline, payload.jobs, payload.resources_meta or [])
    return {"status": "started", "total_jobs": len(payload.jobs)}

@app.get("/factory/status")
async def factory_status():
    return {
        "is_active": bool(FACTORY_STATE.get("is_active")),
        "current_job_index": int(FACTORY_STATE.get("current_job_index", 0)),
        "total_jobs": int(FACTORY_STATE.get("total_jobs", 0)),
        "current_character": FACTORY_STATE.get("current_character"),
        "last_image_url": FACTORY_STATE.get("last_image_path"),
        "last_image_b64": FACTORY_STATE.get("last_image_b64"),
        "logs": FACTORY_STATE.get("logs", [])[-100:],
    }

@app.post("/factory/stop")
async def factory_stop():
    FACTORY_STATE["stop_requested"] = True
    _log("Parada de emergencia activada por el usuario.")
    return {"status": "stopping"}