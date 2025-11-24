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

def generate_list(client: Groq, title: str, count: int = 60) -> list[str]:
    sys = (
        "You generate clean lists for an anime content planner.\n"
        "Return ONLY plain text with one item per line. No numbering, no bullets, no punctuation.\n"
        "Strictly avoid Photorealistic, Cosplay, or 3D Render styles. Focus on 2D Anime/Manga aesthetics."
    )
    user = f"Generate {count} items for: {title}."
    completion = client.chat.completions.create(
        model="llama-3.1-70b-versatile",
        messages=[
            {"role": "system", "content": sys},
            {"role": "user", "content": user},
        ],
        temperature=0.2,
    )
    content = completion.choices[0].message.content or ""
    return parse_lines(content)

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

if __name__ == "__main__":
    main()

