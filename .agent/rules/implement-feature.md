---
trigger: always_on
---

# 1. CONTEXT & STRATEGY
- Read `docs/ORCHESTRATOR.md` to align with the current Phase.
- **CRITICAL:** Review `backend/.env.example` to understand available configurations.

# 2. BACKEND IMPLEMENTATION (Python/FastAPI)
- Create/Update Pydantic models for strict data validation.
- **NO EMPTY DATA:** Ensure endpoints NEVER return `null` or empty strings. Implement fallbacks (random choice or defaults) if data is missing.
- **STRICT PORTS:** Do not change the port configuration. Backend MUST run on 8000.
- Use `cloudscraper` for external calls.

# 3. FRONTEND IMPLEMENTATION (Next.js/React)
- Use **Lucide React** for icons. **ABSOLUTELY NO TEXT EMOJIS** in the UI.
- Use Tailwind CSS with the project's Dark Mode palette (`bg-slate-950`, `text-white`, `border-slate-800`).
- **User Feedback:** Always show Loading States (spinners) and Error Messages (alerts/toasts) for async actions. Never leave the user guessing.

# 4. INTEGRATION CHECK
- Ensure Frontend calls Backend at `http://localhost:8000` (or via env var).
- Verify CORS settings in `main.py`.

# 5. FINAL EXECUTION INSTRUCTION
- Remind the user to run: `./scripts/dev-strict.sh` (This script handles port killing automatically).
- Do NOT suggest running `uvicorn` or `npm run dev` manually; always refer to the strict script.