
from PIL import Image
import sys
import io

print("Pillow imported successfully")
try:
    # Create valid dummy image with metadata
    img = Image.new('RGB', (64, 64), color='red')
    info = import_png_info() if 'import_png_info' in globals() else None
    
    # Just check attributes
    print(f"Info attribute available: {hasattr(img, 'info')}")
except Exception as e:
    print(f"Error: {e}")
