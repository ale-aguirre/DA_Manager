
import os
import json
from pathlib import Path
from typing import Dict, List, Optional, Any

DATA_DIR = Path(__file__).parent.parent / "data"
LIBRARY_FILE = DATA_DIR / "user_library.json"

class LibraryService:
    def __init__(self):
        self._ensure_data_dir()
        self.library = self._load_library()

    def _ensure_data_dir(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if not LIBRARY_FILE.exists():
            LIBRARY_FILE.write_text("{}", encoding="utf-8")

    def _load_library(self) -> Dict[str, Any]:
        try:
            content = LIBRARY_FILE.read_text(encoding="utf-8")
            return json.loads(content)
        except Exception as e:
            print(f"[LibraryService] Error loading library: {e}")
            return {}

    def _save_library(self):
        try:
            LIBRARY_FILE.write_text(json.dumps(self.library, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"[LibraryService] Error saving library: {e}")

    def get_metadata(self, filename: str, lora_path: Optional[Path] = None) -> Dict[str, Any]:
        """
        Retorna metadatos combinados (User JSON + Sidecar .info).
        """
        # 1. Datos del usuario (Alias, Tags manuales)
        user_data = self.library.get(filename, {})
        
        # 2. Datos automáticos (Civitai Info)
        auto_data = {}
        if lora_path and lora_path.exists():
            info_path = lora_path.with_suffix(".civitai.info")
            if info_path.exists():
                try:
                    info = json.loads(info_path.read_text(encoding="utf-8"))
                    auto_data["triggers"] = info.get("trainedWords") or info.get("triggers") or info.get("trained_words") or []
                    auto_data["base_model"] = info.get("baseModel", "Unknown")
                    # Intentar obtener thumbnail
                    images = info.get("images", [])
                    if images and isinstance(images, list):
                        auto_data["thumbnail"] = images[0].get("url")
                except Exception:
                    pass
        
        # Merge: User data gana
        return {
            "filename": filename,
            "alias": user_data.get("alias", ""),
            "tags": user_data.get("tags", []),
            "type": user_data.get("type", "Unknown"),
            "triggers": user_data.get("triggers") or auto_data.get("triggers", []),
            "thumbnail": user_data.get("thumbnail") or auto_data.get("thumbnail", None),
            "base_model": auto_data.get("base_model", "Unknown")
        }

    def update_metadata(self, filename: str, data: Dict[str, Any]):
        """
        Actualiza los metadatos de usuario para un archivo.
        data puede contener: alias, tags, type, triggers (override manual).
        """
        if filename not in self.library:
            self.library[filename] = {}
        
        # Solo actualizamos keys permitidas para evitar basura
        allowed_keys = ["alias", "tags", "type", "triggers", "thumbnail"]
        for k in allowed_keys:
            if k in data:
                self.library[filename][k] = data[k]
        
        self._save_library()
        print(f"[LibraryService] Updated metadata for {filename}")

