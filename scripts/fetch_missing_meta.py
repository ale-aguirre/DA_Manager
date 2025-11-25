import os
from pathlib import Path
import hashlib
import json
import cloudscraper

def get_lora_dir() -> Path:
    le = os.getenv("LORA_PATH")
    re = os.getenv("REFORGE_PATH")
    if le and str(le).strip():
        return Path(le).resolve()
    if re and str(re).strip():
        return Path(re).resolve().parents[3] / "models" / "Lora"
    raise RuntimeError("Variables LORA_PATH/REFORGE_PATH no configuradas en .env")

def compute_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()

def fetch_meta_by_hash(file_hash: str) -> dict:
    api_key = os.getenv("CIVITAI_API_KEY")
    scraper = cloudscraper.create_scraper()
    url = f"https://civitai.com/api/v1/model-versions/by-hash/{file_hash}"
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    r = scraper.get(url, headers=headers, timeout=(15, 60))
    r.raise_for_status()
    data = r.json()
    if isinstance(data, dict):
        return {
            "id": data.get("id") or data.get("versionId"),
            "modelId": data.get("modelId") or data.get("model_id"),
            "name": data.get("name"),
            "trainedWords": data.get("trainedWords") or [],
            "baseModel": data.get("baseModel") or data.get("base_model") or "",
            "description": data.get("description") or "",
            "hash": file_hash,
        }
    return {
        "id": None,
        "modelId": None,
        "name": None,
        "trainedWords": [],
        "baseModel": "",
        "description": "",
        "hash": file_hash,
    }

def main():
    lora_dir = get_lora_dir()
    lora_dir.mkdir(parents=True, exist_ok=True)
    targets = list(lora_dir.glob("*.safetensors"))
    print(f"[Scan] {len(targets)} .safetensors en {lora_dir}")
    for st in targets:
        info = st.with_suffix(".civitai.info")
        if info.exists():
            continue
        try:
            file_hash = compute_sha256(st)
            meta = fetch_meta_by_hash(file_hash)
            info.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"[OK] {info.name} creado")
        except Exception as e:
            print(f"[ERR] {st.name}: {e}")

if __name__ == "__main__":
    main()
