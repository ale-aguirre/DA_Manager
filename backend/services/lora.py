import os
from pathlib import Path
from typing import Optional, Callable
import cloudscraper


def ensure_lora(character_name: str, filename: str, download_url: str, on_log: Optional[Callable[[str], None]] = None) -> bool:
    """
    Asegura que el archivo LoRA exista en disco. Si no existe, lo descarga usando cloudscraper.
    - Ubicación de destino: REFORGE_PATH/../../models/Lora
    - filename puede incluir o no la extensión .safetensors; se forzará si falta.
    - on_log: función opcional para reportar progreso (se integra con FACTORY_STATE si se pasa).
    """
    base_env = os.getenv("REFORGE_PATH")
    if not base_env:
        if on_log:
            on_log("REFORGE_PATH no configurado en .env; no se puede ubicar carpeta de LoRAs.")
        return False
    try:
        base = Path(base_env).resolve()
        lora_dir = base.parents[1] / "models" / "Lora"
        lora_dir.mkdir(parents=True, exist_ok=True)

        fname = (filename or character_name).strip()
        if not fname.lower().endswith(".safetensors"):
            fname += ".safetensors"
        # Limpieza básica del nombre de archivo
        safe = "".join(c for c in fname if c.isalnum() or c in ["_", ".", "-"])
        target = (lora_dir / safe).resolve()
        # Prevención path traversal
        if lora_dir.resolve() not in target.parents:
            if on_log:
                on_log("Ruta de LoRA inválida; prevención activada.")
            return False

        if target.exists():
            if on_log:
                on_log(f"LoRA ya existe para {character_name}: {target.name}")
            return True

        if not download_url:
            if on_log:
                on_log(f"No hay download_url para {character_name}; omitiendo descarga.")
            return False

        if on_log:
            on_log(f"Descargando LoRA para {character_name}...")
        scraper = cloudscraper.create_scraper()
        with scraper.get(download_url, stream=True, timeout=180) as r:
            r.raise_for_status()
            with open(target, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):  # 1MB
                    if chunk:
                        f.write(chunk)
        if on_log:
            on_log(f"Descarga completada: {target.name}")
        return target.exists()
    except Exception as e:
        if on_log:
            on_log(f"Error descargando LoRA para {character_name}: {e}")
        return False