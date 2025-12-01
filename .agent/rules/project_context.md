---
trigger: always_on
---

# 🗺️ LADYMANAGER - PROJECT CONTEXT

## WHAT IS THIS?
A local CMS for high-volume AI Anime generation using Stable Diffusion (ReForge). It uses a "Pipeline" approach.

## THE PIPELINE (Do not deviate)
1.  **Radar (Discovery):** User selects characters/styles.
    * *Output:* Downloads files to `backend/models/Lora`. Saves Metadata to `localStorage` (`planner_meta`, `planner_jobs`).
    * *Rule:* Sends models to Planner. NEVER to Factory directly.
2.  **Planner (Strategy):** User configures prompts and technical settings.
    * *UI:* Split view. Left: Tech/Global. Right: Job Cards.
    * *Key Feature:* "Remix" (formerly Alter Fate) uses LLM to rewrite the Scene (Outfit/Location) while keeping Identity (LoRA/Trigger) intact.
3.  **Factory (Execution):** Processes the jobs.
4.  **Gallery (Review):** View results.

## CRITICAL FEATURES (DO NOT BREAK)
- **Trigger Words:** Must be preserved exactly as they come from Civitai/Local Info.
- **Global Prompt:** Must be present in ALL job cards.
- **Remix Button:** Must REPLACE scene tags, not append. Must use resources from `backend/resources/`.
- **Intensity:** SFW/ECCHI/NSFW tags are vital business logic.