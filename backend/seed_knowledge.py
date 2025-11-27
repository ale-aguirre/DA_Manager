import os
from pathlib import Path
from dotenv import load_dotenv

try:
    from groq import Groq
except Exception:
    Groq = None

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH, override=False)

RESOURCES_DIR = os.getenv("RESOURCES_DIR")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def write_lines(path: Path, lines: list[str]):
    ensure_dir(path.parent)
    text = "\n".join([ln.strip() for ln in lines if ln and ln.strip()]) + "\n"
    path.write_text(text, encoding="utf-8")

def parse_lines(s: str) -> list[str]:
    raw = [ln.strip() for ln in s.splitlines()]
    out = []
    for ln in raw:
        if not ln:
            continue
        ln = ln.strip("-•* ")
        if ln and not ln.isdigit():
            out.append(ln)
    return out

GROQ_MODEL_FALLBACKS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama3-70b-8192",
]

def generate_list(client: Groq, title: str, count: int = 60) -> list[str]:
    sys = (
        "You generate clean lists for an anime content planner.\n"
        "Return ONLY plain text with one item per line. No numbering, no bullets, no punctuation.\n"
        "Strictly avoid Photorealistic, Cosplay, or 3D Render styles. Focus on 2D Anime/Manga aesthetics."
    )
    user = f"Generate {count} items for: {title}."
    last_err = None
    for model in GROQ_MODEL_FALLBACKS:
        try:
            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": sys},
                    {"role": "user", "content": user},
                ],
                temperature=0.8,
            )
            content = completion.choices[0].message.content or ""
            return parse_lines(content)
        except Exception as e:
            last_err = e
            continue
    raise RuntimeError(f"Groq generation failed: {last_err}")

def main():
    if Groq is None:
        raise RuntimeError("Groq SDK no disponible")
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY no definido en .env")
    if not RESOURCES_DIR:
        raise RuntimeError("RESOURCES_DIR no definido en .env")
    client = Groq(api_key=GROQ_API_KEY)
    root = Path(RESOURCES_DIR)

    outfits_path = root / "outfits.txt"
    poses_path = root / "poses.txt"
    locations_path = root / "locations.txt"
    styles_path = root / "styles.txt"
    concepts_poses_path = root / "concepts" / "poses.txt"
    concepts_locations_path = root / "concepts" / "locations.txt"
    styles_lighting_path = root / "styles" / "lighting.txt"
    styles_camera_path = root / "styles" / "camera.txt"
    visuals_expressions_path = root / "visuals" / "expressions.txt"
    visuals_hairstyles_path = root / "visuals" / "hairstyles.txt"
    wardrobe_casual_path = root / "wardrobe" / "casual.txt"
    wardrobe_lingerie_path = root / "wardrobe" / "lingerie.txt"
    wardrobe_cosplay_path = root / "wardrobe" / "cosplay.txt"

    try:
        needs_outfits = True
        try:
            existing = outfits_path.read_text(encoding="utf-8")
            needs_outfits = len(parse_lines(existing)) < 20
        except Exception:
            needs_outfits = True
        if needs_outfits:
            outfits = generate_list(client, "anime outfits for female characters (SFW)")
            write_lines(outfits_path, outfits)
            print(f"Wrote {len(outfits)} outfits -> {outfits_path}")
        else:
            print("Outfits already populated")
    except Exception as e:
        print(f"Outfits generation failed: {e}")

    try:
        needs_poses = True
        try:
            existing = poses_path.read_text(encoding="utf-8")
            needs_poses = len(parse_lines(existing)) < 20
        except Exception:
            needs_poses = True
        if needs_poses:
            poses = generate_list(client, "anime poses and actions for female characters (SFW)")
            write_lines(poses_path, poses)
            print(f"Wrote {len(poses)} poses -> {poses_path}")
        else:
            print("Poses already populated")
    except Exception as e:
        print(f"Poses generation failed: {e}")

    try:
        needs_locations = True
        try:
            existing = locations_path.read_text(encoding="utf-8")
            needs_locations = len(parse_lines(existing)) < 20
        except Exception:
            needs_locations = True
        if needs_locations:
            locations = generate_list(client, "anime scene locations and environments (SFW)")
            write_lines(locations_path, locations)
            write_lines(concepts_locations_path, locations)
            print(f"Wrote {len(locations)} locations -> {locations_path} and {concepts_locations_path}")
        else:
            print("Locations already populated")
    except Exception as e:
        print(f"Locations generation failed: {e}")

    try:
        needs_styles = True
        try:
            existing = styles_path.read_text(encoding="utf-8")
            needs_styles = len(parse_lines(existing)) < 20
        except Exception:
            needs_styles = True
        if needs_styles:
            styles = generate_list(client, "anime visual styles words (lighting, mood, camera), SFW")
            write_lines(styles_path, styles)
            print(f"Wrote {len(styles)} styles -> {styles_path}")
        else:
            print("Styles already populated")
    except Exception as e:
        print(f"Styles generation failed: {e}")

    try:
        needs_lighting = True
        try:
            existing = styles_lighting_path.read_text(encoding="utf-8")
            needs_lighting = len(parse_lines(existing)) < 20
        except Exception:
            needs_lighting = True
        if needs_lighting:
            lighting = generate_list(client, "anime lighting cues and descriptors (SFW)")
            write_lines(styles_lighting_path, lighting)
            print(f"Wrote {len(lighting)} lighting -> {styles_lighting_path}")
        else:
            print("Lighting already populated")
    except Exception as e:
        print(f"Lighting generation failed: {e}")

    try:
        needs_camera = True
        try:
            existing = styles_camera_path.read_text(encoding="utf-8")
            needs_camera = len(parse_lines(existing)) < 20
        except Exception:
            needs_camera = True
        if needs_camera:
            camera = generate_list(client, "anime camera angles and shot types (SFW)")
            write_lines(styles_camera_path, camera)
            print(f"Wrote {len(camera)} camera -> {styles_camera_path}")
        else:
            print("Camera already populated")
    except Exception as e:
        print(f"Camera generation failed: {e}")

    try:
        needs_expressions = True
        try:
            existing = visuals_expressions_path.read_text(encoding="utf-8")
            needs_expressions = len(parse_lines(existing)) < 20
        except Exception:
            needs_expressions = True
        if needs_expressions:
            expressions = generate_list(client, "anime facial expressions words")
            write_lines(visuals_expressions_path, expressions)
            print(f"Wrote {len(expressions)} expressions -> {visuals_expressions_path}")
        else:
            print("Expressions already populated")
    except Exception as e:
        print(f"Expressions generation failed: {e}")

    try:
        needs_hairstyles = True
        try:
            existing = visuals_hairstyles_path.read_text(encoding="utf-8")
            needs_hairstyles = len(parse_lines(existing)) < 20
        except Exception:
            needs_hairstyles = True
        if needs_hairstyles:
            hairstyles = generate_list(client, "anime hairstyles words")
            write_lines(visuals_hairstyles_path, hairstyles)
            print(f"Wrote {len(hairstyles)} hairstyles -> {visuals_hairstyles_path}")
        else:
            print("Hairstyles already populated")
    except Exception as e:
        print(f"Hairstyles generation failed: {e}")

    try:
        needs_concepts_poses = True
        try:
            existing = concepts_poses_path.read_text(encoding="utf-8")
            needs_concepts_poses = len(parse_lines(existing)) < 20
        except Exception:
            needs_concepts_poses = True
        if needs_concepts_poses:
            poses2 = generate_list(client, "anime action poses concise words")
            write_lines(concepts_poses_path, poses2)
            print(f"Wrote {len(poses2)} concept poses -> {concepts_poses_path}")
        else:
            print("Concept poses already populated")
    except Exception as e:
        print(f"Concept poses generation failed: {e}")

    try:
        needs_wardrobe_casual = True
        try:
            existing = wardrobe_casual_path.read_text(encoding="utf-8")
            needs_wardrobe_casual = len(parse_lines(existing)) < 20
        except Exception:
            needs_wardrobe_casual = True
        if needs_wardrobe_casual:
            casual = generate_list(client, "anime casual outfits words (SFW)")
            write_lines(wardrobe_casual_path, casual)
            print(f"Wrote {len(casual)} wardrobe casual -> {wardrobe_casual_path}")
        else:
            print("Wardrobe casual already populated")
    except Exception as e:
        print(f"Wardrobe casual generation failed: {e}")

    try:
        needs_wardrobe_lingerie = True
        try:
            existing = wardrobe_lingerie_path.read_text(encoding="utf-8")
            needs_wardrobe_lingerie = len(parse_lines(existing)) < 20
        except Exception:
            needs_wardrobe_lingerie = True
        if needs_wardrobe_lingerie:
            lingerie = generate_list(client, "anime lingerie outfits words (SFW)")
            write_lines(wardrobe_lingerie_path, lingerie)
            print(f"Wrote {len(lingerie)} wardrobe lingerie -> {wardrobe_lingerie_path}")
        else:
            print("Wardrobe lingerie already populated")
    except Exception as e:
        print(f"Wardrobe lingerie generation failed: {e}")

    try:
        needs_wardrobe_cosplay = True
        try:
            existing = wardrobe_cosplay_path.read_text(encoding="utf-8")
            needs_wardrobe_cosplay = len(parse_lines(existing)) < 20
        except Exception:
            needs_wardrobe_cosplay = True
        if needs_wardrobe_cosplay:
            cosplay = generate_list(client, "anime cosplay outfits words (SFW)")
            write_lines(wardrobe_cosplay_path, cosplay)
            print(f"Wrote {len(cosplay)} wardrobe cosplay -> {wardrobe_cosplay_path}")
        else:
            print("Wardrobe cosplay already populated")
    except Exception as e:
        print(f"Wardrobe cosplay generation failed: {e}")

if __name__ == "__main__":
    main()

