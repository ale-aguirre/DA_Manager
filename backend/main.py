import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
from services.reforge import call_txt2img
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
async def scan_civitai():
    """Escanea modelos de Civitai usando cloudscraper.
    Devuelve una lista con los campos necesarios para el Radar:
    id, name, tags, stats, images (url + tipo) y modelVersions (para baseModel).
    """
    url = "https://civitai.com/api/v1/models"
    params = {
        "types": "LORA",
        "sort": "Highest Rated",
        "period": "Week",
        "limit": 10,
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

@app.post("/generate")
async def generate():
    """Genera imagen vía ReForge (txt2img) usando payload V1 fijo.
    Devuelve solo 'images' (base64) y 'info' (metadatos)."""
    try:
        data = await call_txt2img()
        images = data.get("images", []) if isinstance(data, dict) else []
        info = data.get("info") if isinstance(data, dict) else None
        return JSONResponse(content={"images": images, "info": info})
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"ReForge respondió con error: {e.response.text}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Error de red al contactar ReForge: {str(e)}")
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