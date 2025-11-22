from typing import Any, Dict
import httpx

# Instrucción del usuario: URL base de ReForge hardcodeada por ahora
BASE_URL = "http://127.0.0.1:7860"
TXT2IMG_ENDPOINT = "/sdapi/v1/txt2img"


def build_txt2img_payload() -> Dict[str, Any]:
    """Devuelve el payload EXACTO solicitado para txt2img."""
    return {
        "prompt": "__personajes__, __poses__, (masterpiece, best quality:1.2), nsfw, explicit, <lora:PonyXL:1>",
        "negative_prompt": "bad quality, worst quality, sketch, censor, mosaic",
        "steps": 28,
        "width": 896,
        "height": 1152,
        "batch_size": 1,
        "n_iter": 1,
        "cfg_scale": 7,
    }


async def call_txt2img() -> Dict[str, Any]:
    """Realiza la llamada a la API de ReForge txt2img y devuelve el JSON de respuesta."""
    url = f"{BASE_URL}{TXT2IMG_ENDPOINT}"
    payload = build_txt2img_payload()
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        return resp.json()