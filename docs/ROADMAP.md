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


## 🟣 Descargas y Gestor Local — 2025-11-22
- Backend: `POST /download-lora` (cloudscraper, streaming a REFORGE_PATH/../../models/Lora), `GET /local/loras` (listar .safetensors) y `DELETE /local/lora` (borrado seguro con validación de ruta).
- Frontend: Botón "⬇️ Descargar" en cada `CivitaiCard` con estados (Descargando/✅ Instalado); nueva vista `LocalFilesView` integrada en Sidebar como "Archivos Locales" para listar/borrar LoRAs.
- Objetivo de flujo: Radar → Descargar LoRA → Studio → "Yor Forger" → IA devuelve tags en inglés → Generar con LoRA recién instalado.

## 🔵 Studio Mode (Manual) — 2025-11-22
- Backend: Añadidos endpoints `GET /reforge/checkpoints`, `POST /reforge/checkpoint`, `POST /dream` (Groq, texto plano), y actualización de `POST /generate` con overrides (`prompt`, `batch_size`, `cfg_scale`).
- Frontend: Nuevo `StudioView` con selector de modelo, sliders de Batch/CFG, área de prompting con botón "✨ Soñar Prompt (IA)" y botón de acción "🚀 Generar [N] Imágenes". Integrado en Sidebar y `app/page.tsx`.
- Cómo: `httpx` para llamadas a ReForge (127.0.0.1:7860), `cloudscraper` para Civitai, `groq` para IA con clave desde `.env`, CORS habilitado para `http://localhost:3000`. Ejecutado con `scripts/dev-strict.sh` en puertos fijos (3000/8000).
- Próximos pasos: mover textos a `copy_blocks`/`site_settings`, validaciones (Zod en frontend si aplica), persistencia simple para preferencias del Studio.

## 🟣 Marketing Inspector — 2025-11-22
- Backend: `POST /marketing/generate` (Groq Llama 3, US English, 30 tags exactos) y `DELETE /files` con validación de ruta dentro de `OUTPUTS_DIR`.
- Frontend: `ImageModal` con overlay de imagen, prompt usado, botón “🪄 Generar Info para DeviantArt”, inputs (Title/Description/Tags), “Copiar Todo” en formato `TITLE\n\nDESCRIPTION\n\nTAGS`, y borrado con confirmación nativa.
- Persistencia: guarda metadatos en `localStorage` usando `marketing_meta::<filename>`; carga automática al abrir modal y escritura automática al editar o generar.
- Objetivo de flujo: Generate → Inspect (IA Marketing) → Copy & Publish.

## 🟡 Ideas Futuras — 2025-11-22
- [ ] Sistema de Mascotas UI: integrar asistentes interactivos por área
  - Hinata (Radar)
  - Senku (Planner)
  - Mei (Factory)
- [ ] Favoritos: marcar LoRAs/Checkpoints como favoritos y permitir filtrado por favoritos en UI


## 🟣 V3 — Precisión y Calidad — 2025-11-23

### Planificador V3
- Selección de Checkpoint por Job (listado desde `/reforge/checkpoints`).
- Adición manual de LoRAs extra por Job o por Personaje (estilos/efectos).
- Configuración detallada de Hires/Upscaler (Hires Fix, Hires Steps, Denoising Strength, Upscaler).
- Nuevos campos de control de escena: Expression y Hairstyle.

### Recursos V3
- Nuevas categorías: `visuals/expressions.txt` y `visuals/hairstyles.txt`.
- Lista técnica: `tech/upscalers.txt`.
- Endpoints dedicados: `GET /resources/expressions`, `GET /resources/hairstyles`, `GET /resources/upscalers`.
- Base de conocimiento enriquecida y deduplicada; disciplina `.env` para `RESOURCES_DIR`.

### Lógica de Coherencia (IA)
- Mejora del System Prompt de Groq: coherencia Outfit/Location.
  - Ej.: Si `Location` es "dungeon", NO usar "bikini" salvo que se indique explícitamente; preferir "armor" o "rags".
- Defaults inteligentes cuando falte información: `camera` → "front view"/"cowboy shot" según intensidad; `lighting` → "soft lighting".

### Galería V3 (QC)
- Preparación para integrar Vision AI (detección de artefactos y fallos).
- Auto-Tagging para plataformas (DeviantArt, Pixiv) con mapeos consistentes.

### Estado y Próximos Pasos
- [ ] Implementar endpoints y archivos de recursos.
- [ ] Extender `/planner/draft` con campos Expression/Hairstyle y coherencia IA.
- [ ] UI Planner: selectores por Job y panel técnico por personaje.
- [ ] Validar visualmente en Preview y registrar en `/docs/LEARNING_LOG.md`.