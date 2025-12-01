import os
import glob
from pathlib import Path

# Mocking the backend logic
def sanitize_filename(name: str) -> str:
    return "".join([c for c in name if c.isalnum() or c in "._- "]).strip()

def _find_lora_info_path(d: Path, character_name: str) -> Path | None:
    key = sanitize_filename(character_name)
    print(f"Searching for key: {key}")
    
    # 1. Exact match
    exact = (d / f"{key}.civitai.info").resolve()
    if exact.exists():
        print(f"Exact match found: {exact.name}")
        return exact
    
    # 2. Fuzzy match
    print("Exact match not found. Trying fuzzy search...")
    best: Path | None = None
    for info in d.glob("*.civitai.info"):
        base = info.stem.lower()
        # Logic from backend/main.py
        if key in base or base in key:
            print(f" - Candidate: {info.name}")
            if best is None or len(base) > len(best.stem.lower()):
                best = info
    
    if best:
        print(f"Best fuzzy match: {best.name}")
    else:
        print("No fuzzy match found.")
    return best

LORA_PATH = r"c:\Users\aleag\Downloads\SD FORGE\webui\models\Lora"
d = Path(LORA_PATH)

print(f"LORA_DIR: {d}")
target_name = "hinata_boruto_naruto_next_generations"

# Run the simulation
found = _find_lora_info_path(d, target_name)

# Also list all hinata files to see what's actually there
print("\n--- Actual Files on Disk ---")
files = glob.glob(os.path.join(LORA_PATH, "*hinata*.civitai.info"))
for f in files:
    print(os.path.basename(f))
