# 🗺️ LadyManager Roadmap 
 
 ## 🟢 Fase 1: Infraestructura y Radar (Actual) 
 - [ ] Configuración de Monorepo (Back/Front). 
 - [ ] Variables de entorno dinámicas (.env). 
 - [ ] Endpoint de Scraping a Civitai (usando cloudscraper). 
 - [ ] Interfaz básica para ver JSON crudo de Civitai. 
 
 ## 🟡 Fase 2: Inteligencia y Procesamiento 
 - [ ] Integración con Groq (Llama 3) para limpiar datos. 
 - [ ] Separación lógica de Personajes vs. Poses. 
 - [ ] Endpoint para guardar archivos .txt en la carpeta de ReForge. 
 
 ## 🟠 Fase 3: Conexión con Stable Diffusion 
 - [ ] Botón en el Dashboard para activar generación en ReForge. 
 - [ ] Visor de galería local (ver qué se está generando). 
 
 ## 🔴 Fase 4: Auditoría Visual (Futuro) 
 - [ ] Integración con Gemini Vision. 
 - [ ] Filtrado automático de imágenes defectuosas.


## 🔵 Studio Mode (Manual) — 2025-11-22
- Backend: Añadidos endpoints `GET /reforge/checkpoints`, `POST /reforge/checkpoint`, `POST /dream` (Groq, texto plano), y actualización de `POST /generate` con overrides (`prompt`, `batch_size`, `cfg_scale`).
- Frontend: Nuevo `StudioView` con selector de modelo, sliders de Batch/CFG, área de prompting con botón "✨ Soñar Prompt (IA)" y botón de acción "🚀 Generar [N] Imágenes". Integrado en Sidebar y `app/page.tsx`.
- Cómo: `httpx` para llamadas a ReForge (127.0.0.1:7860), `cloudscraper` para Civitai, `groq` para IA con clave desde `.env`, CORS habilitado para `http://localhost:3000`. Ejecutado con `scripts/dev-strict.sh` en puertos fijos (3000/8000).
- Próximos pasos: mover textos a `copy_blocks`/`site_settings`, validaciones (Zod en frontend si aplica), persistencia simple para preferencias del Studio.