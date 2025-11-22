import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
import httpx
from services.reforge import call_txt2img, list_checkpoints, set_active_checkpoint
import cloudscraper
from pydantic import BaseModel
from typing import List, Optional
import json
import base64
from datetime import datetime
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
# Directorio de salidas (server-only); fallback a LadyManager/outputs si no está definido
REPO_ROOT = BASE_DIR.parent
OUTPUTS_DIR = os.getenv("OUTPUTS_DIR") or str(REPO_ROOT / "outputs")

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


# Advertencias no bloqueantes
if not REFORGE_PATH:
    print("[Advertencia] REFORGE_PATH no está definido en .env.")
else:
    rp = Path(REFORGE_PATH)
    if not rp.exists():
        print(f"[Advertencia] REFORGE_PATH '{REFORGE_PATH}' no existe en el sistema.")

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
    # Validación ligera de parámetros
    valid_periods = {"Day", "Week", "Month", "Year", "AllTime"}
    valid_sorts = {"Highest Rated", "Most Downloaded", "Newest"}
    period_val = period if period in valid_periods else "Week"
    sort_val = sort if sort in valid_sorts else "Highest Rated"

    url = "https://civitai.com/api/v1/models"
    params = {
        "types": "LORA",
        "sort": sort_val,
        "period": period_val,
        "limit": 10,
        "page": max(1, int(page or 1)),
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
            stats = item.get("stats") or {}
            model_versions = item.get("modelVersions") or []

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
                "tags": tags,
                "stats": stats,
                "images": images,
                "modelVersions": model_versions,
            }

        normalized = [normalize_item(it) for it in items if isinstance(it, dict)]
        return JSONResponse(content=normalized)
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
        completion = await asyncio.to_thread(
            lambda: client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
            )
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
        """
You are a Master Stable Diffusion Prompter specialized in Anime/Hentai.
Your goal is to generate high-quality Danbooru tags based on a character name.

RULES:
1. OUTPUT ONLY the tags separated by commas. No JSON, no intro, no sentences.
2. Analyze the character's canonical personality and appearance.
3. Always include quality tags: "masterpiece, best quality, absurdres".
4. Use specific Danbooru tags for clothes and body types.

EXAMPLES:
Input: "Frieren"
Output: "frieren, sousou no frieren, elf, long white hair, green eyes, twintails, white capelet, pantyhose, skirt, holding staff, stoic expression, slight smile, fantasy world, masterpiece, best quality, absurdres, 1girl"

Input: "Yor Forger"
Output: "yor forger, spy x family, assassin outfit, black dress, halterneck, cleavage, red eyes, black hair, hair ornament, weapon, blood on face, seductive smile, masterpiece, best quality, absurdres, 1girl"

NOW GENERATE FOR THE USER INPUT.
"""
    )
    user_prompt = f"Character: {req.character}\nTags: {req.tags or ''}\nOutput: comma-separated Danbooru tags in English."

    try:
        client = Groq(api_key=api_key)
        completion = await asyncio.to_thread(
            lambda: client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
            )
        )
        content = completion.choices[0].message.content.strip()
        # Devuelve solo texto plano
        return PlainTextResponse(content=content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error en Groq: {str(e)}")


@app.post("/generate")
async def generate(payload: GenerateRequest):
    """Genera imagen vía ReForge (txt2img) con posibilidad de overrides.
    Auto-guarda las imágenes generadas en OUTPUTS_DIR/fecha/timestamp_seed.png y devuelve paths.
    """
    try:
        data = await call_txt2img(
            prompt=payload.prompt,
            batch_size=payload.batch_size,
            cfg_scale=payload.cfg_scale,
        )
        images = data.get("images", []) if isinstance(data, dict) else []
        info = data.get("info") if isinstance(data, dict) else None

        # Preparar carpeta de salida: outputs/YYYY-MM-DD
        out_base = Path(OUTPUTS_DIR)
        out_date = datetime.now().strftime("%Y-%m-%d")
        out_dir = out_base / out_date
        out_dir.mkdir(parents=True, exist_ok=True)

        # Parsear seeds si vienen
        seeds: List[str] = []
        try:
            if isinstance(info, str):
                parsed = json.loads(info)
                if isinstance(parsed, dict):
                    if isinstance(parsed.get("all_seeds"), list):
                        seeds = [str(s) for s in parsed.get("all_seeds")]
                    elif parsed.get("seed") is not None:
                        seeds = [str(parsed.get("seed"))] * len(images)
            elif isinstance(info, dict):
                if isinstance(info.get("all_seeds"), list):
                    seeds = [str(s) for s in info.get("all_seeds")]
                elif info.get("seed") is not None:
                    seeds = [str(info.get("seed"))] * len(images)
        except Exception:
            seeds = []
        if not seeds or len(seeds) != len(images):
            # Fallback si no hay seeds o número no coincide
            seeds = ["unknown"] * len(images)

        saved_paths: List[str] = []
        ts_base = datetime.now().strftime("%H%M%S")
        # Guardar imágenes en disco
        for idx, img_b64 in enumerate(images):
            try:
                binary = base64.b64decode(img_b64)
                seed = seeds[idx] if idx < len(seeds) else "unknown"
                filename = f"{ts_base}_{seed}_{idx}.png"
                target = out_dir / filename
                with open(target, "wb") as f:
                    f.write(binary)
                saved_paths.append(str(target))
            except Exception:
                # no bloquear por un fallo de guardado individual
                continue

        return JSONResponse(content={"images": images, "info": info, "saved_paths": saved_paths})
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

@app.get("/reforge/progress")
async def reforge_progress():
    """Proxy de progreso desde ReForge (Automatic1111). Devuelve progreso, ETA y estado."""
    url = "http://127.0.0.1:7860/sdapi/v1/progress"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            # Filtrar campos principales
            out = {
                "progress": data.get("progress", 0),
                "eta_relative": data.get("eta_relative", None),
                "state": data.get("state", {}),
            }
            return JSONResponse(content=out)
    except httpx.HTTPStatusError as e:
        status = e.response.status_code if getattr(e, "response", None) else None
        message = "No se detecta ReForge. Asegúrate de iniciarlo con el argumento --api." if status == 404 else f"Error al contactar ReForge (status {status}). Asegúrate de iniciarlo con --api."
        raise HTTPException(status_code=502, detail=message)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="No se detecta ReForge. Asegúrate de iniciarlo con el argumento --api.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al consultar progreso: {str(e)}")


class MarketingRequest(BaseModel):
    prompt_used: str
    character: Optional[str] = None

class MarketingOutput(BaseModel):
    title: str
    description: str
    tags: List[str] = []

@app.post("/marketing/generate")
async def marketing_generate(req: MarketingRequest):
    """Genera metadatos de venta (título, descripción, tags) usando Groq (Llama 3).
    Devuelve JSON con campos: {title, description, tags[]}.
    """
    api_key = GROQ_API_KEY
    if not api_key:
        raise HTTPException(status_code=400, detail="GROQ_API_KEY no disponible")
    if Groq is None:
        raise HTTPException(status_code=500, detail="Groq SDK no disponible en el servidor")

    system_prompt = (
        "You are a US Marketing Expert for Adult Content (anime/NSFW). "
        "Use American English only. "
        "Generate a catchy Title (subtle clickbait), a short exciting Description, "
        "and exactly 30 relevant Tags separated by commas based on the user's prompt and character. "
        "Return strict JSON: {title, description, tags}."
    )
    user_prompt = (
        f"Prompt: {req.prompt_used}\n"
        f"Character: {req.character or ''}\n"
        "Strict output: ONLY JSON with keys 'title', 'description', 'tags'. No explanations."
    )

    try:
        client = Groq(api_key=api_key)
        completion = await asyncio.to_thread(
            lambda: client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.4,
            )
        )
        content = completion.choices[0].message.content.strip()
        # Intentar extraer JSON
        start = content.find("{")
        end = content.rfind("}")
        json_str = content[start:end+1] if start != -1 and end != -1 else content
        parsed = json.loads(json_str)
        title = str(parsed.get("title", "")).strip()
        description = str(parsed.get("description", "")).strip()
        raw_tags = parsed.get("tags")
        if isinstance(raw_tags, str):
            tags = [t.strip() for t in raw_tags.split(",") if t.strip()][:30]
        elif isinstance(raw_tags, list):
            tags = [str(t).strip() for t in raw_tags if str(t).strip()][:30]
        else:
            tags = []
        out = MarketingOutput(title=title or "", description=description or "", tags=tags)
        return out.dict()
    except json.JSONDecodeError:
        # Fallback: si el modelo no devolvió JSON válido, intentar heurística
        try:
            lines = [l.strip() for l in content.splitlines() if l.strip()]
            title = lines[0] if lines else ""
            description = lines[1] if len(lines) > 1 else ""
            tags_line = lines[2] if len(lines) > 2 else ""
            tags = [t.strip() for t in tags_line.split(",") if t.strip()][:30]
            out = MarketingOutput(title=title, description=description, tags=tags)
            return out.dict()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Respuesta no parseable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error en Groq: {str(e)}")

@app.delete("/files")
async def delete_file(path: str):
    """Elimina un archivo en OUTPUTS_DIR de forma segura. Usar query param: /files?path=<ruta>."""
    if not path or not isinstance(path, str):
        raise HTTPException(status_code=400, detail="path requerido")
    base = Path(OUTPUTS_DIR).resolve()
    target = Path(path).resolve()
    # Seguridad: la ruta debe estar dentro de OUTPUTS_DIR
    if base not in target.parents:
        raise HTTPException(status_code=400, detail="Ruta fuera de OUTPUTS_DIR")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    try:
        def _delete():
            target.unlink()
            return {"status": "ok", "deleted": str(target)}
        result = await asyncio.to_thread(_delete)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar archivo: {str(e)}")