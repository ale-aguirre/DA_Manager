import requests
import json

BASE_URL = "http://127.0.0.1:8000"
MODEL_NAME = "leslie__demon_deals__ponyxl__sd_1.5__illustrious"

output_file = "debug_output.txt"

with open(output_file, "w", encoding="utf-8") as f:
    f.write(f"Querying API for: {MODEL_NAME}\n")
    try:
        res = requests.get(f"{BASE_URL}/local/lora-info", params={"name": MODEL_NAME})
        f.write(f"Status Code: {res.status_code}\n")
        if res.status_code == 200:
            data = res.json()
            f.write("Response JSON:\n")
            f.write(json.dumps(data, indent=2))
            
            tw = data.get("trainedWords")
            if tw and len(tw) > 0:
                f.write(f"\nSUCCESS: Found {len(tw)} trainedWords.\n")
                f.write(f"First trigger: {tw[0]}\n")
            else:
                f.write("\nFAILURE: trainedWords is empty or missing.\n")
        else:
            f.write(f"Error: {res.text}\n")
    except Exception as e:
        f.write(f"Request failed: {e}\n")

print("Done writing to debug_output.txt")
