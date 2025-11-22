import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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
    """Escanea modelos de Civitai usando cloudscraper y devuelve la lista cruda de 'items'."""
    url = "https://civitai.com/api/v1/models"
    params = {
        "types": "LORA",
        "sort": "Highest Rated",
        "period": "Week",
        "limit": 50,
        "nsfw": "true",
        "include": "tags",
    }
    token = os.getenv("CIVITAI_API_KEY")
    if token:
        params["token"] = token

    scraper = cloudscraper.create_scraper()

    try:
        def fetch():
            resp = scraper.get(url, params=params, timeout=20)
            resp.raise_for_status()
            return resp.json()

        data = await asyncio.to_thread(fetch)
        items = data.get("items", [])
        if not isinstance(items, list):
            raise HTTPException(status_code=502, detail="Respuesta inválida de Civitai: 'items' no es lista.")
        return items
    except HTTPException:
        # Propaga errores HTTP ya formateados
        raise
    except Exception as e:
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

@app.post("/save-files")
async def save_files(payload: dict):
    """Guarda el resultado de IA en archivos JSON dentro de REFORGE_PATH."""
    out = payload.get("output")
    if not out or not isinstance(out, dict):
        raise HTTPException(status_code=400, detail="Formato inválido: 'output' requerido.")
    if not REFORGE_PATH:
        raise HTTPException(status_code=400, detail="REFORGE_PATH no configurado en .env.")
    try:
        def write_files():
            base = Path(REFORGE_PATH)
            base.mkdir(parents=True, exist_ok=True)
            (base / "ai_personajes.json").write_text(
                json.dumps(out.get("personajes", []), ensure_ascii=False, indent=2), encoding="utf-8"
            )
            (base / "ai_poses.json").write_text(
                json.dumps(out.get("poses", []), ensure_ascii=False, indent=2), encoding="utf-8"
            )
        await asyncio.to_thread(write_files)
        return {"status": "ok", "saved": ["ai_personajes.json", "ai_poses.json"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar archivos: {str(e)}")

# Modelos definidos arriba

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=PORT, reload=True)