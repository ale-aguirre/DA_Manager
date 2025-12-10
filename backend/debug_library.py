
from services.library import LibraryService
from pathlib import Path

def main():
    print("--- Testing LibraryService ---")
    service = LibraryService()
    
    filename = "test_lora_v1.safetensors"
    
    print(f"1. Updating metadata for {filename}...")
    service.update_metadata(filename, {
        "alias": "Test Style", 
        "tags": ["style", "anime"],
        "type": "Style"
    })
    
    print("2. Reading metadata...")
    meta = service.get_metadata(filename)
    print("Metadata:", meta)
    
    if meta.get("alias") == "Test Style":
        print("✅ TEST PASS: Metadata persisted successfully.")
    else:
        print("❌ TEST FAIL: Persistence failed.")

if __name__ == "__main__":
    main()
