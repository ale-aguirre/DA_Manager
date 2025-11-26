# Project: LadyManager (Local Monorepo)

## 1. Project Overview & Architecture

Local full-stack application for automated NSFW Anime production using Stable Diffusion (ReForge).

- **Stack:** FastAPI (Backend :8000) + Next.js (Frontend :3000).
- **Goal:** "Click-to-Manufacture". Automation of discovery, planning, and generation.

## 2. Critical Behavioral Rules (THE LAW)

### 🚨 DATA INTEGRITY (No Empty States)

- **NEVER return `null`, `undefined`, or empty strings** to the Frontend for critical fields (Outfit, Pose, Location).
- **FALLBACK LOGIC IS MANDATORY:** If AI (Groq) fails or returns empty data, the Backend MUST select a random line from `backend/resources/`.
- **The UI must never show "(vacio)"**. It is better to show a random valid value than an empty error.
- Always check /docs for the latest tasks.
- if you want to check lint, with npm run lint, open a new terminal and run it.

### 🎨 UI/UX STANDARDS (High Density)

- **Style:** "Technical Dashboard" (inspired by Automatic1111/ComfyUI). Avoid "Landing Page" styles with too much whitespace.
- **Components:**
  - Use **Lucide React** icons exclusively. **NO TEXT EMOJIS** in the UI.
  - Use **Dense Grids**. Maximize screen real estate.
  - **Inputs:** Inputs should be aligned and compact. Use Sliders with numeric inputs side-by-side.
- **Feedback:** Always show loading states (Spinners) and Toast/Alerts for errors.

### 🛠️ GIT WORKFLOW (Trunk-Based)

- **Branch:** Work DIRECTLY on `main`.
- **NO Feature Branches:** Do not create `feature/xyz` branches unless explicitly asked. We prioritize speed.
- **Commit:** Use conventional commits (`feat:`, `fix:`, `chore:`).

### 🖥️ ENVIRONMENT AWARENESS (Windows/Mac)

- **OS Agnostic:** Do not assume Linux/Mac paths (`/`). Use `os.path.join` or `pathlib` in Python.
- **Startup:** Always refer to `start.bat` (Windows) or `scripts/dev-strict.sh` (Mac/Linux) for starting servers.
- **Ports:** Strict adherence to 3000 (Front) and 8000 (Back). Kill processes if occupied.

## 3. Tech Stack Constraints

### Backend (FastAPI)

- **AI (Groq):** Use `llama-3.3-70b-versatile`. MUST implement fallback logic to older models if the API returns 404/Decommissioned.
- **Scraping:** ALWAYS use `cloudscraper` (never `requests`) to bypass Cloudflare.
- **Paths:** ALWAYS use `os.getenv("OUTPUTS_DIR")` and `os.getenv("LORA_PATH")`. Never hardcode local paths.

### Frontend (Next.js 14)

- **Images:** Use standard `<img>` tags for local files or external URLs to avoid Next.js Image Optimization strictness (unless domain is configured).
- **State:** Persist critical user preferences (e.g., Batch Count, Last Tab) in `localStorage`.

## 4. Business Logic (The "Factory" Concept)

1.  **Radar:** Discovery. Must filter for "Anime/2D" strictly.
2.  **Planner:** Strategy. "Character-Centric" view. Users edit the _plan_ here.
    - Logic: `[Trigger Words] + [Outfit] + [Pose] + [Location] + [Tech Config]`.
3.  **Factory:** Execution. Background processing. Must provide real-time logs via API polling.
4.  **Gallery:** Asset Management.

## 5. Environment Variables (Reference)

Ensure `.env` contains:

- `REFORGE_PATH` (Wildcards folder)
- `LORA_PATH` (Models/Lora folder)
- `OUTPUTS_DIR` (Where images are saved)
- `CIVITAI_API_KEY`
- `GROQ_API_KEY`
