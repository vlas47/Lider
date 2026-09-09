"""Create optimized web assets from the approved, unmodified image generations."""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
manifest_path = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "docs/website-images.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
target = ROOT / manifest.get("output_dir", "static/img/services/websites")
target.mkdir(parents=True, exist_ok=True)
for entry in manifest["images"]:
    with Image.open(entry["source"]) as image:
        image.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        output = target / entry.get("output", entry["slug"] + "-v2.webp")
        image.convert("RGB").save(output, "WEBP", quality=85, method=6)
        print(f"{output.name}: {image.size}, {output.stat().st_size} bytes")
