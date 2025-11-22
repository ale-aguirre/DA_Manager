# Project: LadyNuggets Manager (Local Monorepo)

## 1. Project Overview & Architecture
This is a local full-stack application designed to automate Stable Diffusion workflows.
- **Architecture:** Monorepo structure.
  - `/frontend`: Next.js application (User Interface).
  - `/backend`: FastAPI application (Business Logic, Scraping, AI processing).
- **Goal:** Scalable, local-first automation. All file system paths must be dynamic via Environment Variables.

## 2. Framework Version and Dependencies

### Frontend (Client)
- **Framework:** Next.js 14+ (App Router `src/app`).
- **Language:** TypeScript (Strict mode).
- **Styling:** Tailwind CSS (Mobile-first, dark mode default).
- **Icons:** Lucide React.
- **State Management:** React Hooks (`useState`, `useEffect`) or Context API for simple global state.
- **HTTP Client:** Native `fetch` API.

### Backend (Server)
- **Framework:** FastAPI (Python 3.10+).
- **Server:** Uvicorn (standard host: 127.0.0.1, port: 8000).
- **Validation:** Pydantic V2 models.
- **Environment Management:** `python-dotenv` (CRITICAL: All local paths must be loaded from .env).
- **Scraping:** `cloudscraper` (Must be used to bypass Cloudflare protection).
- **AI Integration:** `groq` (official SDK) for text processing.

## 3. Testing Framework
- **Backend:** `pytest` for unit testing logic and API endpoints.
- **Frontend:** No comprehensive testing suite required for MVP, but code must be modular to allow `Vitest` implementation later.

## 4. API & Implementation Constraints (Do's and Don'ts)

### ⛔ AVOID (Don'ts)
- **NO `requests` library for Scraping:** Civitai and Rule34 block standard `requests`. YOU MUST USE `cloudscraper` for any external scraping.
- **NO Hardcoded Paths:** Never write paths like `/Users/alexis...` in the Python or TypeScript code. Always use `os.getenv("REFORGE_PATH")` or similar.
- **NO Synchronous Blocking:** Ensure scraping and AI tasks run asynchronously or in background tasks to keep the UI responsive.
- **NO Complex Database:** For this version, use JSON files or direct `.txt` file manipulation. Do not implement PostgreSQL/SQLite yet.

### ✅ PREFER (Do's)
- **Error Handling:** Always wrap external API calls (Civitai/Groq) in try/except blocks and return meaningful HTTP errors.
- **Typing:** Use strict Pydantic models for Backend responses and TypeScript interfaces for Frontend props.
- **Monorepo Awareness:** Remember that Frontend runs on port 3000 and Backend on port 8000. Ensure CORS is correctly configured in FastAPI to allow `http://localhost:3000`.

## 5. Environment Variables Structure
The project depends on a `.env` file in the `/backend` directory with the following keys:
- `REFORGE_PATH`: Absolute path to the Stable Diffusion wildcards folder.
- `GROQ_API_KEY`: API Key for AI processing.
- `CIVITAI_API_KEY`: Optional key for NSFW content fetching.

## Ports and Execution Discipline
- Frontend: must run strictly on port 3000 (http://localhost:3000). If the port is occupied, free conflicting processes and retry; do not use alternative ports.
- Backend: must run strictly on port 8000 (http://127.0.0.1:8000). If port 8000 is occupied, the server must fail and notify; do not switch ports automatically.
- Rationale: ensure consistent local environment and avoid connection errors between UI and API.

### Recommended dev script (strict)
- Use `./scripts/dev-strict.sh` to start services with port discipline.
- Behavior:
  - Frees port 3000 if it is occupied to prevent Next from switching to 3001.
  - Checks port 8000; if occupied, fails and warns (does not change port).
  - Starts backend on `127.0.0.1:8000` and frontend on `http://localhost:3000`.