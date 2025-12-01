---
trigger: always_on
---

CONTEXT & STRATEGY
Read docs/ORCHESTRATOR.md to align with the current Phase.

CRITICAL: Review backend/.env.example. ALL external paths and URLs (Forge, Outputs, LoRAs) MUST come from Environment Variables.

2. BACKEND IMPLEMENTATION (Python/FastAPI)
Create/Update Pydantic models for strict data validation.

NO EMPTY DATA: Ensure endpoints NEVER return null or empty strings. Implement fallbacks (random choice or defaults) if data is missing.

NO HARDCODED PATHS: Never write C:/... or http://127.0.0.1:7860 in the code. Use os.getenv("REFORGE_API_BASE_URL") or similar variables defined in .env.

STRICT PORTS: Backend MUST run on port 8000.

Use cloudscraper for external calls to Civitai/etc.

3. FRONTEND IMPLEMENTATION (Next.js/React)
Use Lucide React for icons. ABSOLUTELY NO TEXT EMOJIS in the UI.

Use Tailwind CSS with the project's Dark Mode palette (bg-slate-950, text-white, border-slate-800).

User Feedback: Always show Loading States (spinners) and Error Messages (alerts/toasts) for async actions. Never leave the user guessing.

Clean Logic: Avoid monster components. If logic gets complex, separate it into helper functions or hooks.

4. INTEGRATION CHECK
DYNAMIC API URL: Frontend MUST use process.env.NEXT_PUBLIC_API_BASE_URL for all API calls.

Only use http://127.0.0.1:8000 as a fallback if the env var is missing.

Verify CORS settings in main.py.

5. FINAL EXECUTION INSTRUCTION
Remind the user to run: ./scripts/dev-strict.sh (This script handles port killing automatically).

Do NOT suggest running uvicorn or npm run dev manually; always refer to the strict script.