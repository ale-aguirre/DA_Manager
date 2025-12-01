---
trigger: always_on
---

# 🛡️ LADYMANAGER - AGENT CONSTITUTION & RULES

## 0. PRIME DIRECTIVE: NON-DESTRUCTIVE EDITING
- **NEVER** remove existing functionality without explicit instruction.
- **NEVER** overwrite complex logic with a "simplified" version unless you fully understand the original.
- If you see a function like `reconstructJobPrompt` or `extractTriplet`, assume it holds critical business logic. Read it twice before modifying.

## 1. ARCHITECTURE & STATE
- **Single Source of Truth:** `PlannerContext` (or `PlannerView` state) combined with `localStorage` is the database.
- **Data Flow:** Radar -> (Meta/Jobs in LocalStorage) -> Planner -> (Payload) -> Factory.
- **NO SHORTCUTS:** Never route Radar directly to Factory. The flow MUST go through Planner.

## 2. CODING STANDARDS
- **No Hallucinations:** Do not import components that do not exist. Do not call API endpoints that you haven't verified in `backend/main.py`.
- **No "Any":** Use defined types in `src/types/`.
- **No Hardcoding:** All paths and URLs must come from `.env`.
- **Error Handling:** Use `try/catch` blocks. If an API call fails (e.g., Radar download), catch it, log it, alert the user, but **DO NOT CRASH** the app.

## 3. PROMPT ENGINEERING LOGIC (CRITICAL)
- **Prompt Structure:** `<LoRA> + Trigger + [Global Prompt] + [Scene] + [Extras] + [Quality]`.
- **Idempotency:** Re-running a prompt generation must NOT duplicate tags. Always strip old tags before adding new ones.
- **Trigger Words:** Always prefer the official trigger word from metadata over the filename.

## 4. VERIFICATION
- Before submitting code, ask yourself: "Did I break the Intensity Selector? Did I break the Trigger Word injection?"
- Check for regression bugs.
## 5. PROTECTED FUNCTIONS (DO NOT TOUCH)
- **RadarView.tsx -> handleSendToPlanning**: This function contains critical logic for extracting trigger words using the *exact* downloaded filename (stripped of extension).
- **RULE:** Do NOT modify or delete this function without explicit user authorization.
- **REASON:** Modifying this breaks the link between Civitai models and local .civitai.info files, causing "missing trainedWords" errors.
