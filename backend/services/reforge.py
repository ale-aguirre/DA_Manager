from typing import Any, Dict, Optional, List
import httpx

# Instrucción del usuario: URL base de ReForge hardcodeada por ahora
BASE_URL = "http://127.0.0.1:7860"
TXT2IMG_ENDPOINT = "/sdapi/v1/txt2img"
MODELS_ENDPOINT = "/sdapi/v1/sd-models"
OPTIONS_ENDPOINT = "/sdapi/v1/options"
INTERRUPT_ENDPOINT = "/sdapi/v1/interrupt"
VAES_ENDPOINT = "/sdapi/v1/sd-vae"


def build_txt2img_payload(prompt: Optional[str] = None,
                           negative_prompt: Optional[str] = None,
                           batch_size: Optional[int] = None,
                           cfg_scale: Optional[float] = None,
                           steps: Optional[int] = None,
                           enable_hr: Optional[bool] = None,
                           denoising_strength: Optional[float] = None,
                           hr_second_pass_steps: Optional[int] = None,
                           hr_upscaler: Optional[str] = None,
                           hr_scale: Optional[float] = None) -> Dict[str, Any]:
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
    if negative_prompt is not None:
        # Permitir vacío explícito o override personalizado
        payload["negative_prompt"] = negative_prompt.strip() if isinstance(negative_prompt, str) else ""
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
        # Hires Steps (0 = mismo que steps base)
        if isinstance(hr_second_pass_steps, int) and hr_second_pass_steps >= 0:
            payload["hr_second_pass_steps"] = hr_second_pass_steps
        # Upscaler y escala de Hires Fix
        if isinstance(hr_scale, (int, float)):
            val = float(hr_scale)
            # rangos típicos aceptados por A1111: 1.0 - 4.0
            if 1.0 <= val <= 4.0:
                payload["hr_scale"] = val
        if isinstance(hr_upscaler, str) and hr_upscaler.strip():
            payload["hr_upscaler"] = hr_upscaler.strip()

    return payload


async def get_progress() -> Dict[str, Any]:
    """Consulta el progreso actual de generación en ReForge."""
    url = f"{BASE_URL}/sdapi/v1/progress"
    async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()

async def call_txt2img(prompt: Optional[str] = None,
                       negative_prompt: Optional[str] = None,
                       batch_size: Optional[int] = None,
                       cfg_scale: Optional[float] = None,
                       steps: Optional[int] = None,
                       enable_hr: Optional[bool] = None,
                       denoising_strength: Optional[float] = None,
                       hr_second_pass_steps: Optional[int] = None,
                       hr_upscaler: Optional[str] = None,
                       hr_scale: Optional[float] = None,
                       alwayson_scripts: Optional[Any] = None,
                       override_settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Realiza la llamada a la API de ReForge txt2img y devuelve el JSON de respuesta.
    Aplica overrides si se proporcionan.
    """
    url = f"{BASE_URL}{TXT2IMG_ENDPOINT}"
    payload = build_txt2img_payload(
        prompt=prompt,
        negative_prompt=negative_prompt,
        batch_size=batch_size,
        cfg_scale=cfg_scale,
        steps=steps,
        enable_hr=enable_hr,
        denoising_strength=denoising_strength,
        hr_second_pass_steps=hr_second_pass_steps,
        hr_upscaler=hr_upscaler,
        hr_scale=hr_scale,
    )
    # Compatibilidad: aceptar dict o lista para alwayson_scripts
    if alwayson_scripts:
        if isinstance(alwayson_scripts, dict):
            arr = []
            for name, obj in alwayson_scripts.items():
                args = obj.get("args") if isinstance(obj, dict) else obj
                arr.append({"name": name, "args": args})
            payload["alwayson_scripts"] = arr
        elif isinstance(alwayson_scripts, list):
            payload["alwayson_scripts"] = alwayson_scripts
        else:
            # formato desconocido: ignorar silenciosamente
            pass
    if override_settings:
        # Inyección directa de opciones avanzadas (sd_vae, CLIP_stop_at_last_layers, etc.)
        payload["override_settings"] = override_settings
    
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

async def list_vaes() -> List[str]:
    """Obtiene la lista de VAEs y devuelve solo los 'model_name'."""
    url = f"{BASE_URL}{VAES_ENDPOINT}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
        names: List[str] = []
        if isinstance(data, list):
            for item in data:
                name = item.get("model_name") if isinstance(item, dict) else None
                if name:
                    names.append(name)
        return names


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