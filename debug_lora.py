import os
import glob

LORA_PATH = r"c:\Users\aleag\Downloads\SD FORGE\webui\models\Lora"
print(f"Searching in: {LORA_PATH}")

pattern = os.path.join(LORA_PATH, "*leslie*.civitai.info")
files = glob.glob(pattern)

if files:
    print(f"Found {len(files)} files:")
    for f in files:
        print(f" - {os.path.basename(f)}")
else:
    print("No *leslie*.civitai.info files found.")

# Also check for safetensors to see if the model exists at all
pattern_safe = os.path.join(LORA_PATH, "*leslie*.safetensors")
files_safe = glob.glob(pattern_safe)
if files_safe:
    print(f"Found {len(files_safe)} safetensors files:")
    for f in files_safe:
        print(f" - {os.path.basename(f)}")
else:
    print("No *leslie*.safetensors files found.")
