import os
from pathlib import Path
from typing import Optional, Callable
import cloudscraper
import asyncio
import hashlib
import json
import re

class DownloadError(Exception):
    pass

async def ensure_lora(character_name: str, filename: str, download_url: str, on_log: Optional[Callable[[str], None]] = None) -> tuple[bool, str]:
    """
    Asegura que el archivo LoRA exista en disco. Si no existe, lo descarga usando cloudscraper en un hilo dedicado con progreso por chunks.
    - Ubicación de destino: LORA_PATH (prioridad) o fallback REFORGE_PATH/../../models/Lora
    - filename puede incluir o no la extensión .safetensors; se forzará si falta.
    - on_log: función opcional para reportar progreso.
    - Timeout: conexión 15s, lectura 1800s (30 min).
    - Usa autenticación con CIVITAI_API_KEY (Authorization y/o token en la URL) para evitar HTML de login.
    - Valida integridad: si el archivo final es <1MB, se borra y se considera error de descarga.
    
    Returns: (success, message)
    """
    lora_env = os.getenv("LORA_PATH")
    base_env = os.getenv("REFORGE_PATH")
    api_key = os.getenv("CIVITAI_API_KEY")

    if not lora_env and not base_env:
        msg = "REFORGE_PATH/LORA_PATH no configurados en .env; no se puede ubicar carpeta de LoRAs."
        if on_log:
            on_log(msg)
        return False, msg

    try:
        # Resolver carpeta destino
        if lora_env and str(lora_env).strip():
            lora_dir = Path(lora_env).resolve()
        else:
            base = Path(base_env).resolve()
            lora_dir = base.parents[3] / "models" / "Lora"
        lora_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            print(f"[CONFIG] Guardando LoRAs en: {str(lora_dir.resolve())}")
        except Exception:
            pass

        # Sanitización de URL
        raw_url = download_url or ""
        sanitized_url = raw_url.strip().replace("`", "").strip('"').strip("'")
        # Validación previa del URL
        if not sanitized_url or ("civitai.com" not in sanitized_url):
            msg = f"URL de descarga inválida o vacía: {sanitized_url}"
            if on_log:
                on_log(f"⚠️ Salteando {filename}: {msg}")
            print(f"[ERROR] {msg}")
            return False, msg

        # Inyectar token en URL si no presente
        if api_key and ("token=" not in sanitized_url):
            sep = "&" if "?" in sanitized_url else "?"
            sanitized_url = f"{sanitized_url}{sep}token={api_key}"

        # Preparar nombre de archivo
        fname = (filename or character_name).strip()
        if not fname.lower().endswith(".safetensors"):
            fname += ".safetensors"
        safe = "".join(c for c in fname if c.isalnum() or c in ["_", ".", "-"])
        target = (lora_dir / safe).resolve()

        # Logs de detective
        if on_log:
            on_log(f"[DEBUG] Ruta Absoluta de Destino: {str(target)}")
            on_log(f"[DEBUG] URL Objetivo: {sanitized_url}")
        try:
            print(f"[DEBUG] Ruta Absoluta de Destino: {str(target)}")
            print(f"[DEBUG] URL Objetivo: {sanitized_url}")
        except Exception:
            pass

        # Prevención path traversal
        if lora_dir.resolve() not in target.parents:
            msg = "Ruta de LoRA inválida (Path Traversal attempt)."
            if on_log:
                on_log(msg)
            return False, msg

        # Pre-check: si existe, omite descarga
        if target.exists():
            if on_log:
                on_log(f"LoRA ya existe para {character_name}: {target.name}")
            print(f"[DEBUG] File exists: {target}")
            return True, "File exists"
        else:
            print(f"[DEBUG] File NOT found: {target}")
            # Listar directorio para ver qué hay
            try:
                files = list(lora_dir.glob(f"*{safe[:10]}*"))
                print(f"[DEBUG] Candidates in {lora_dir}: {[f.name for f in files]}")
            except Exception:
                pass

        loop = asyncio.get_running_loop()

        def log_safe(msg: str):
            if on_log:
                try:
                    loop.call_soon_threadsafe(on_log, msg)
                except Exception:
                    on_log(msg)

        def download_task() -> tuple[bool, str]:
            try:
                scraper = cloudscraper.create_scraper()
                headers = {}
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"
                # Add Referer to mimic browser better
                headers["Referer"] = "https://civitai.com/"

                log_safe(f"[INFO] Conectando a Civitai para {safe}...")
                with scraper.get(sanitized_url, headers=headers, stream=True, timeout=(15, 1800)) as r:
                    r.raise_for_status()
                    ctype = (r.headers.get("Content-Type", "") or "").lower()
                    if "text/html" in ctype or "text/plain" in ctype:
                        # Try to read a bit of the content to guess the error
                        try:
                            preview = ""
                            for chunk in r.iter_content(chunk_size=4096):
                                preview = chunk.decode("utf-8", errors="ignore")
                                break
                            title_match = re.search(r"<title>(.*?)</title>", preview, re.IGNORECASE)
                            title = title_match.group(1).strip() if title_match else "Unknown Title"
                            if "Cloudflare" in title:
                                title = "Cloudflare Challenge (Try updating cloudscraper)"
                        except Exception:
                            title = "No preview"
                        
                        raise DownloadError(f"Respuesta inesperada (Content-Type={ctype}). Page Title: {title}")
                    total = int(r.headers.get("Content-Length", "0"))
                    total_mb = total // (1024 * 1024) if total else None
                    size_msg = f"Tamaño estimado: {total_mb}MB" if total_mb is not None else "Tamaño estimado: desconocido"
                    log_safe(f"[INFO] Descarga iniciada: {target.name}. {size_msg}")
                    bytes_read = 0
                    next_percent = 10
                    next_mb_mark = 10 * 1024 * 1024  # 10MB
                    last_mb_logged = 0
                    chunk_size = 1024 * 1024  # 1MB
                    with open(target, "wb") as f:
                        for chunk in r.iter_content(chunk_size=chunk_size):
                            if not chunk:
                                continue
                            f.write(chunk)
                            bytes_read += len(chunk)
                            if bytes_read - last_mb_logged >= next_mb_mark:
                                last_mb_logged = bytes_read
                                cur_mb = bytes_read // (1024 * 1024)
                                total_mb_str = f"{total_mb}MB" if total_mb is not None else "??MB"
                                log_safe(f"[INFO] Descargando {target.name}: {cur_mb}MB/{total_mb_str}...")
                            if total:
                                percent = int((bytes_read * 100) / total)
                                if percent >= next_percent:
                                    cur_mb = bytes_read // (1024 * 1024)
                                    total_mb_str = f"{total_mb}MB" if total_mb is not None else "??MB"
                                    log_safe(f"[INFO] Descargando {target.name}: {percent}% ({cur_mb}MB/{total_mb_str})...")
                                    next_percent += 10
                # Validación de integridad: tamaño mínimo
                try:
                    size_bytes = target.stat().st_size
                except Exception:
                    size_bytes = 0
                if size_bytes < (1024 * 1024):
                    # Borrar archivo corrupto y reportar error
                    try:
                        target.unlink(missing_ok=True)
                    except Exception:
                        pass
                    raise DownloadError("Archivo descargado demasiado pequeño (<1MB). Posible HTML de login o error.")
                log_safe(f"[INFO] Descarga completada: {target.name}")
                return True, "Downloaded"
            except DownloadError as e:
                msg = str(e)
                log_safe(f"❌ Error crítico descargando {safe}: {msg}")
                try:
                    target.unlink(missing_ok=True)
                except Exception:
                    pass
                return False, msg
            except Exception as e:
                msg = str(e)
                log_safe(f"❌ Error crítico descargando {safe}: {msg}")
                try:
                    target.unlink(missing_ok=True)
                except Exception:
                    pass
                return False, msg

        ok, reason = await asyncio.to_thread(download_task)
        if not ok or not target.exists():
            return False, reason

        try:
            info_path = target.with_suffix(".civitai.info")
            version_id = None
            m = re.search(r"/download/models/(\d+)", sanitized_url)
            if not m:
                m = re.search(r"/model-versions/(\d+)", sanitized_url)
            if m:
                try:
                    version_id = int(m.group(1))
                except Exception:
                    version_id = None
            meta = None
            if version_id:
                scraper = cloudscraper.create_scraper()
                headers = {}
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"
                url = f"https://civitai.com/api/v1/model-versions/{version_id}"
                r = scraper.get(url, headers=headers, timeout=(15, 60))
                r.raise_for_status()
                data = r.json()
                if isinstance(data, dict):
                    meta = {
                        "id": data.get("id"),
                        "modelId": data.get("modelId") or data.get("model_id"),
                        "name": data.get("name"),
                        "trainedWords": data.get("trainedWords") or [],
                        "baseModel": data.get("baseModel") or data.get("base_model") or "",
                        "description": data.get("description") or "",
                    }
            if meta is None:
                h = hashlib.sha256()
                with open(target, "rb") as f:
                    for chunk in iter(lambda: f.read(1024 * 1024), b""):
                        if not chunk:
                            break
                        h.update(chunk)
                file_hash = h.hexdigest()
                scraper = cloudscraper.create_scraper()
                headers = {}
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"
                info_url = f"https://civitai.com/api/v1/model-versions/by-hash/{file_hash}"
                r = scraper.get(info_url, headers=headers, timeout=(15, 60))
                r.raise_for_status()
                data = r.json()
                if isinstance(data, dict):
                    meta = {
                        "id": data.get("id") or data.get("versionId"),
                        "modelId": data.get("modelId") or data.get("model_id"),
                        "name": data.get("name"),
                        "trainedWords": data.get("trainedWords") or [],
                        "baseModel": data.get("baseModel") or data.get("base_model") or "",
                        "description": data.get("description") or "",
                        "hash": file_hash,
                    }
            if isinstance(meta, dict):
                try:
                    info_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
                    if on_log:
                        on_log(f"[INFO] Metadatos Civitai guardados: {info_path.name}")
                except Exception:
                    pass
        except Exception as e:
            if on_log:
                on_log(f"⚠️ No se pudo obtener metadatos Civitai: {str(e)}")
        return True, "OK"
    except Exception as e:
        msg = f"Excepción general: {str(e)}"
        if on_log:
            on_log(f"❌ Error crítico descargando {filename}: {msg}")
        return False, msg
