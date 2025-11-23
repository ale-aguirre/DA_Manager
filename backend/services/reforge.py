from typing import Any, Dict, Optional, List
import httpx

# Instrucción del usuario: URL base de ReForge hardcodeada por ahora
BASE_URL = "http://127.0.0.1:7860"
TXT2IMG_ENDPOINT = "/sdapi/v1/txt2img"
MODELS_ENDPOINT = "/sdapi/v1/sd-models"
OPTIONS_ENDPOINT = "/sdapi/v1/options"
INTERRUPT_ENDPOINT = "/sdapi/v1/interrupt"


def build_txt2img_payload(prompt: Optional[str] = None,
                           batch_size: Optional[int] = None,
                           cfg_scale: Optional[float] = None,
                           steps: Optional[int] = None,
                           enable_hr: Optional[bool] = None,
                           denoising_strength: Optional[float] = None) -> Dict[str, Any]:
    """Devuelve el payload para txt2img con overrides opcionales.
    - Si 'prompt' viene definido, NO usa wildcards por defecto.
    - 'batch_size', 'cfg_scale' y 'steps' se aplican si se proveen.
    - Si 'enable_hr' y 'denoising_strength' se proveen, se habilita Hires Fix.
    """
    payload = {
        "prompt": "__personajes__, __poses__, (masterpiece, best quality:1.2), nsfw, explicit, <lora:PonyXL:1>",
        "negative_prompt": "bad quality, worst quality, sketch, censor, mosaic",
        "steps": 28,
        "width": 896,
        "height": 1152,
        "batch_size": 1,
        "n_iter": 1,
        "cfg_scale": 7,
    }
    if prompt and prompt.strip():
        payload["prompt"] = prompt.strip()
    if isinstance(batch_size, int) and 1 <= batch_size <= 10:
        payload["batch_size"] = batch_size
    if isinstance(cfg_scale, (int, float)) and 1 <= float(cfg_scale) <= 15:
        payload["cfg_scale"] = float(cfg_scale)
    if isinstance(steps, int) and 1 <= steps <= 100:
        payload["steps"] = steps
    if isinstance(enable_hr, bool):
        payload["enable_hr"] = enable_hr
        # Si enable_hr está activo y hay valor válido de denoising, aplicarlo
        if isinstance(denoising_strength, (int, float)):
            val = float(denoising_strength)
            if 0.0 <= val <= 1.0:
                payload["denoising_strength"] = val
    return payload


async def call_txt2img(prompt: Optional[str] = None,
                       batch_size: Optional[int] = None,
                       cfg_scale: Optional[float] = None,
                       steps: Optional[int] = None,
                       enable_hr: Optional[bool] = None,
                       denoising_strength: Optional[float] = None) -> Dict[str, Any]:
    """Realiza la llamada a la API de ReForge txt2img y devuelve el JSON de respuesta.
    Aplica overrides si se proporcionan.
    """
    url = f"{BASE_URL}{TXT2IMG_ENDPOINT}"
    payload = build_txt2img_payload(prompt=prompt, batch_size=batch_size, cfg_scale=cfg_scale, steps=steps, enable_hr=enable_hr, denoising_strength=denoising_strength)
    # Timeout ampliado a 600s para evitar 502 por Mac M2
    async with httpx.AsyncClient(timeout=httpx.Timeout(600.0)) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        return resp.json()


async def list_checkpoints() -> List[str]:
    """Obtiene la lista de modelos (checkpoints) y devuelve solo los 'title'."""
    url = f"{BASE_URL}{MODELS_ENDPOINT}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
        # La API devuelve una lista de objetos; extraemos 'title'
        titles: List[str] = []
        if isinstance(data, list):
            for item in data:
                title = item.get("title") if isinstance(item, dict) else None
                if title:
                    titles.append(title)
        return titles


async def set_active_checkpoint(title: str) -> Dict[str, Any]:
    """Cambia el modelo activo enviando opciones a la API."""
    url = f"{BASE_URL}{OPTIONS_ENDPOINT}"
    payload = {"sd_model_checkpoint": title}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        return {"status": "ok", "applied": title}


async def get_options() -> Dict[str, Any]:
    """Obtiene las opciones actuales de ReForge (incluye sd_model_checkpoint, enable_hr, hr_scale, etc.)."""
    url = f"{BASE_URL}{OPTIONS_ENDPOINT}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


async def interrupt_generation() -> Dict[str, Any]:
    """Interrumpe la generación actual en ReForge/Stable Diffusion (endpoint oficial /sdapi/v1/interrupt)."""
    url = f"{BASE_URL}{INTERRUPT_ENDPOINT}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url)
        # Algunas implementaciones devuelven 200 sin cuerpo; asegurar status
        try:
            resp.raise_for_status()
        except Exception:
            # Si falla, devolvemos un estado parcial para log
            return {"status": "error", "code": resp.status_code}
        try:
            data = resp.json()
        except Exception:
            data = {"status": "ok"}
        return data