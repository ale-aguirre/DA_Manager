#!/usr/bin/env python3
"""
Script de diagnóstico para la Factory (LadyManager)

Uso:
  python debug_factory.py

Objetivo:
- Identificar si el fallo está en rutas (filesystem), red (cloudscraper) o lógica de descarga (ensure_lora base).

Notas:
- Carga .env desde la carpeta backend.
- Usa REFORGE_PATH para calcular ../../models/Lora.
- Descargas con cloudscraper en modo stream y timeout (15s conexión, 1800s lectura).
- Para la simulación de Civitai, puedes definir DEBUG_CIVITAI_URL en .env.
"""

import os
import sys
import time
import traceback
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:
    print("[IMPORT] python-dotenv no está instalado. Instala con: pip install python-dotenv")
    raise

try:
    import cloudscraper
except Exception:
    print("[IMPORT] cloudscraper no está instalado. Instala con: pip install cloudscraper")
    raise


def paso_1_entorno():
    """Diagnóstico de entorno: carga .env, calcula carpeta Lora, crea y prueba escritura."""
    print("== Paso 1: Diagnóstico de Entorno ==")
    backend_dir = Path(__file__).resolve().parent
    env_path = backend_dir / ".env"
    try:
        load_dotenv(env_path, override=False)
        print(f"[1.1] .env cargado desde: {env_path}")
    except Exception as e:
        print(f"[1.1] Error cargando .env: {e.__class__.__name__}: {e}")
        traceback.print_exc()

    reforge_path = os.getenv("REFORGE_PATH")
    print(f"[1.2] REFORGE_PATH crudo: {repr(reforge_path)}")
    if not reforge_path:
        print("[1.2] REFORGE_PATH no definido. Este valor es crítico para ubicar models/Lora.")
        return None, False

    try:
        # Calcula ruta absoluta de ../../models/Lora respecto a REFORGE_PATH
        ruta_absoluta = os.path.abspath(os.path.join(reforge_path, "../../models/Lora"))
        print(f"[1.3] Ruta Absoluta de '../../models/Lora': {ruta_absoluta}")
        lora_dir = Path(ruta_absoluta)
        try:
            os.makedirs(lora_dir, exist_ok=True)
            print(f"[1.4] Carpeta creada/verificada: {str(lora_dir)}")
        except Exception as e:
            print(f"[1.4] Error creando carpeta: {e.__class__.__name__}: {e}")
            traceback.print_exc()
            return None, False
        # Test de escritura
        try:
            test_file = lora_dir / "test_write.txt"
            with open(test_file, "w", encoding="utf-8") as f:
                f.write(f"debug write at {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            print(f"[1.5] Test de escritura OK: {str(test_file)}")
        except Exception as e:
            print(f"[1.5] Error de escritura: {e.__class__.__name__}: {e}")
            traceback.print_exc()
            return lora_dir, False
        return lora_dir, True
    except Exception as e:
        print(f"[1.x] Error procesando ruta: {e.__class__.__name__}: {e}")
        traceback.print_exc()
        return None, False


def paso_2_red():
    """Diagnóstico de red básico con cloudscraper: descarga de favicon de Google."""
    print("== Paso 2: Diagnóstico de Red (Cloudscraper) ==")
    url = "https://www.google.com/favicon.ico"
    try:
        scraper = cloudscraper.create_scraper()
        print(f"[2.1] Conectando a {url} ...")
        with scraper.get(url, stream=True, timeout=(15, 1800)) as r:
            r.raise_for_status()
            print("[2.2] Conexión OK. Descargando por stream (timeout=(15,1800))...")
            total = int(r.headers.get("Content-Length", "0")) if r.headers.get("Content-Length") else 0
            if total:
                print(f"[2.2] Tamaño reportado: {total} bytes")
            bytes_read = 0
            for chunk in r.iter_content(chunk_size=64 * 1024):  # 64KB
                if not chunk:
                    continue
                bytes_read += len(chunk)
                # Progreso visible cada ~256KB
                if bytes_read >= 64 * 1024 and (bytes_read // (256 * 1024)) > ((bytes_read - len(chunk)) // (256 * 1024)):
                    print(f"[2.2] Descargado: {bytes_read} bytes...")
            print("[2.3] Éxito: descarga de prueba completada.")
            return True
    except Exception as e:
        print(f"[2.x] Error de red: {e.__class__.__name__}: {e}")
        traceback.print_exc()
        return False


def ensure_lora_sync(character_name: str, filename: str, download_url: str, lora_dir: Path):
    """
    Versión síncrona y mínima de ensure_lora para diagnóstico:
    - Calcula nombre de archivo .safetensors seguro
    - Verifica existencia
    - Descarga con cloudscraper (stream, timeout) y progreso 10MB/10%
    """
    print("== Paso 3: Diagnóstico de Datos (Simulación) ==")
    try:
        if lora_dir is None:
            print("[3.0] lora_dir es None (Paso 1 falló). Abortando simulación.")
            return False
        fname = (filename or character_name).strip()
        if not fname.lower().endswith(".safetensors"):
            fname += ".safetensors"
        safe = "".join(c for c in fname if c.isalnum() or c in ["_", ".", "-"])
        target = (lora_dir / safe).resolve()
        print(f"[3.1] Archivo destino: {str(target)}")
        print(f"[3.2] URL objetivo: {repr(download_url)}")
        if target.exists():
            print("[3.3] Ya existe. Omitiendo descarga.")
            return True
        if not download_url:
            print("[3.3] download_url vacío. Abortando.")
            return False
        try:
            scraper = cloudscraper.create_scraper()
            print(f"[3.4] Conectando a Civitai para {safe} ...")
            with scraper.get(download_url, stream=True, timeout=(15, 1800)) as r:
                r.raise_for_status()
                total = int(r.headers.get("Content-Length", "0")) if r.headers.get("Content-Length") else 0
                total_mb = total // (1024 * 1024) if total else None
                print(f"[3.5] Descarga iniciada: {safe}. Tamaño: {total_mb if total_mb is not None else '??'}MB")
                bytes_read = 0
                next_percent = 10
                last_mb_logged = 0
                next_mb_mark = 10 * 1024 * 1024
                chunk_size = 1024 * 1024
                with open(target, "wb") as f:
                    for chunk in r.iter_content(chunk_size=chunk_size):
                        if not chunk:
                            continue
                        f.write(chunk)
                        bytes_read += len(chunk)
                        if bytes_read - last_mb_logged >= next_mb_mark:
                            last_mb_logged = bytes_read
                            cur_mb = bytes_read // (1024 * 1024)
                            print(f"[3.6] {cur_mb}MB descargados...")
                        if total:
                            percent = int((bytes_read * 100) / total)
                            if percent >= next_percent:
                                cur_mb = bytes_read // (1024 * 1024)
                                print(f"[3.7] {percent}% ({cur_mb}MB)")
                                next_percent += 10
            print(f"[3.8] Descarga completada: {target.name}")
            return target.exists()
        except Exception as e:
            print(f"[3.x] Error de conexión/descarga: {e.__class__.__name__}: {e}")
            traceback.print_exc()
            return False
    except Exception as e:
        print(f"[3.y] Error inesperado: {e.__class__.__name__}: {e}")
        traceback.print_exc()
        return False


if __name__ == "__main__":
    # Paso 1: Entorno
    lora_dir, ok_env = paso_1_entorno()
    # Paso 2: Red
    ok_net = paso_2_red()
    # Paso 3: Simulación de Datos
    civitai_url = os.getenv("DEBUG_CIVITAI_URL", "").strip()
    if not civitai_url:
        print("[3.p] DEBUG_CIVITAI_URL no definido en .env; usando placeholder que probablemente fallará.")
        civitai_url = "https://civitai.com/api/download/models/PLACEHOLDER"
    ok_data = ensure_lora_sync("debug_char", "debug_char", civitai_url, lora_dir)

    # Resumen
    print("\n== RESUMEN ==")
    print(f"Paso 1 (Entorno): {'OK' if ok_env else 'FALLÓ'}")
    print(f"Paso 2 (Red): {'OK' if ok_net else 'FALLÓ'}")
    print(f"Paso 3 (Datos/ensure_lora_sync): {'OK' if ok_data else 'FALLÓ'}")
    if not ok_env:
        sys.exit(2)
    elif not ok_net:
        sys.exit(3)
    elif not ok_data:
        sys.exit(4)
    else:
        sys.exit(0)