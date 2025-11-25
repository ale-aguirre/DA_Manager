# 🗺️ LadyManager Roadmap 
 
## 🟢 Fase 1: Infraestructura y Radar (Actual) 
 - [x] Configuración de Monorepo (Back/Front). 
 - [x] Variables de entorno dinámicas (.env). 
 - [x] Endpoint de Scraping a Civitai (usando cloudscraper). 
 - [x] Interfaz básica para ver JSON crudo de Civitai. 
 
 ## 🟡 Fase 2: Inteligencia y Procesamiento 
 - [x] Integración con Groq (Llama 3) para limpiar datos. 
 - [x] Separación lógica de Personajes vs. Poses. 
 - [x] Endpoint para guardar archivos .txt en la carpeta de ReForge. 
 
 ## 🟠 Fase 3: Conexión con Stable Diffusion 
 - [x] Botón en el Dashboard para activar generación en ReForge. 
 - [x] Visor de galería local (ver qué se está generando). 

 # 🗺️ LadyManager Roadmap (Windows/Mac Hybrid)
> **Estado:** FASE 3.5 (Estabilización Final & UX)
> **Motor:** Forge f2.0 / ReForge (API Compatible)

## 🟢 FASE 3.5: Estabilización y UX
El objetivo actual es cerrar los bugs visuales y asegurar que la "Fábrica" sea usable y bonita.

### 🔧 Correcciones Pendientes
- [x] **FIX Visual de Jobs:** Agregar Iconos (Lucide) a los selectores de Outfit/Pose para identificación rápida.
- [x] **FIX Selector Checkpoints:** Asegurar que el botón "Actualizar" fuerce un re-render visual del dropdown.
- [x] **FIX LoRAs Extra:** Asegurar que la lista se cargue y permita selección múltiple con peso.
- [x] **FIX Galería Header:** Restaurar la barra superior con la ruta actual y el botón de "Abrir en Explorador".

### ⚙️ Lógica de Negocio
- [x] **Prompt Base Limpio:** Backend debe dejar de concatenar `base_prompt` si el frontend ya lo envió. (Evitar duplicados).
- [x] **Inteligencia Real:** Backend debe leer `.civitai.info` y forzar los `trainedWords` en el prompt base, prohibiendo a la IA inventar.
- [x] **Hires Fix Seguro:** Backend debe enviar `hr_additional_modules: ["Use same choices"]` para evitar Error 500 en Forge.

## 🔵 FASE 4: Escalamiento y Marketing (PRÓXIMO)
Una vez que la fábrica sea estable, nos enfocamos en la post-producción.

- [ ] Integración con Gemini Vision. 
- [ ] Filtrado automático de imágenes defectuosas.
- [ ] **Asistente de Marketing V2:** Generación de Título/Tags optimizados para Twitter/DeviantArt usando Groq.
- [ ] **Auto-Tagging:** Inyectar metadatos EXIF en los PNGs finales.
- [ ] **Gestión de Archivos:** Mover/Borrar archivos desde la Galería.

## 🔮 FASE 5: Futuro (V4 - "El Imperio")
- [ ] **Vision AI:** Integrar `LLaVA` o similar para que una IA revise las fotos y borre las deformes automáticamente.
- [ ] **Auto-Snatcher:** Script nocturno que descargue lo más popular de Civitai automáticamente.
- [ ] **Publicación:** Integración con API de DeviantArt.

## ⚖️ Reglas de Oro (Técnicas)
1.  **Rutas:** Siempre `os.path.join`. Compatibilidad Windows/Mac.
2.  **API Forge:** Siempre enviar `hr_scale` como float y `hr_additional_modules` si Hires Fix está activo.
3.  **UI:** Lucide Icons, Dark Mode, Feedback visual (Toasts/Spinners).

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

## 🟢 Phase 3.5 — Refinements & Manual Downloads — 2025-11-23

### Real-time Progress Tracking
- [x] Backend: Added `/reforge/progress` endpoint to proxy ReForge's progress API.
- [x] Backend: Added `get_progress()` function in `services/reforge.py`.
- [x] Frontend: Updated `FactoryView.tsx` to poll `/reforge/progress` for real-time generation status.
- [x] Frontend: Improved progress bar to show actual generation percentage instead of job-based estimation.

### Planner Configuration Enhancements
- [x] Frontend: Added **Batch Size** slider (1-8) in Technical Config panel.
- [x] Frontend: Added **Adetailer** toggle for face enhancement.
- [x] Backend: Updated `GroupConfigItem` to include `batch_size` and `adetailer` fields.
- [x] Backend: Updated `produce_jobs` to pass `batch_size` and `adetailer` to ReForge.
- [x] Backend: Implemented Adetailer via `alwayson_scripts` in `call_txt2img`.

### Improved Intensity Tags
- [x] Frontend: Enhanced `setIntensity` function in `PlannerView.tsx` with comprehensive tag lists:
  - **Safe**: `rating_safe, best quality, masterpiece`
  - **Ecchi**: `rating_questionable, cleavage, swimsuit, (ecchi:1.2), best quality, masterpiece`
  - **NSFW**: `rating_explicit, nsfw, nipple, pussy, nude, best quality, masterpiece`

### Radar Manual Download Mode
- [x] Backend: Added `/download-checkpoint` endpoint for manual checkpoint downloads.
- [x] Backend: Checkpoint saving path correctly configured to `REFORGE_PATH/../../models/Stable-diffusion`.
- [x] Frontend: Added `postDownloadCheckpoint` and `postDownloadLora` API functions.
- [x] Frontend: Implemented `ManualDownloadView` component with URL input and type selection (LoRA/Checkpoint).
- [x] Frontend: Refactored Manual Mode as a modal (not a filter tab) to avoid UI crashes.
- [x] Frontend: Added "Descarga Manual" button in Radar toolbar.

### Bug Fixes
- [x] Fixed compilation error in `api.ts` (API_BASE → BASE_URL).
- [x] Fixed duplicate `tab` state declaration in `RadarView.tsx`.
- [x] Fixed crash when clicking "Manual" tab (removed from filter tabs, now a modal).

### Default Values
- [x] Set default **Hires Steps** to 15 in Planner.
- [x] Set default **Upscaler** to "R-ESRGAN 4x+" in Planner.
- [x] Set default **Hairstyle** to "(Original/Vacío)" to respect LoRA tags.
## 🟢 Hotfix & IA Enhancements — 2025-11-24

### Generación Estable (Forge)
- [x] Validación Hires Fix en `build_txt2img_payload` (coerción de `hr_scale` a float, default `2.0`; `hr_upscaler` default `Latent`).
- [x] Inclusión de `hr_additional_modules` a nivel raíz del payload: `["Use same choices"]`.
- [x] Logs de depuración: `[DEBUG] Hires Payload: scale=..., upscaler=..., modules=[...]]` y dump completo del payload antes del POST.
  - Backend: `backend/services/reforge.py`.

### Planner UX
- [x] Selector de Intensidad: botón hereda color (SFW=verde, ECCHI=amarillo, NSFW=rojo), menú oscuro y opciones coloreadas.
- [x] Reescritura de tags en cambio de intensidad (`rating_safe`/`rating_questionable`/`rating_explicit+nsfw`) y re-render forzado.
- [x] Spinner breve sobre el área del prompt mientras se recalculan los tags.
- [x] Toasts de IA y ThinkingBadge (`Brain`) en Analyze/Magic Fix.
  - Frontend: `frontend/src/components/planner/PlannerView.tsx`.

### Metadatos y Triggers Oficiales
- [x] Guardado `.civitai.info` inmediatamente tras descarga usando `VERSION_ID` del `download_url` (`api/v1/model-versions/{id}`); fallback por `by-hash`.
- [x] Script retroactivo actualizado: `scripts/fetch_missing_meta.py` ahora escribe `{ id, modelId, name, trainedWords, baseModel, description, hash }`.
- [x] Inyección de triggers oficiales desde `.civitai.info` en `/planner/draft` y prompts.
  - Backend: `backend/services/lora.py`, `backend/main.py`.

### Estilos de Alta Calidad (Style Learning)
- [x] Archivo `backend/resources/learning/user_styles.txt` con ejemplos de estilo.
- [x] Inyección de “STYLE EXAMPLES” en System Prompt de Groq dentro de `/planner/draft`.

### LoRAs Extra (Toggle)
- [x] Switch “Permitir Sugerencias de LoRAs Extra” por personaje (persistido en `localStorage`).
- [x] `/planner/draft` acepta `allow_extra_loras` y puede incluir `<lora:NAME:0.6>` si el toggle está activo.

### Galería Operativa
- [x] Static mount robusto de `/files` con `OUTPUTS_DIR` absoluto.
- [x] `/gallery` devuelve URLs absolutas y codificadas (quote) para manejar espacios.
- [x] `GalleryView.tsx` muestra `title` y `onError` con URL para diagnóstico.

### Nombres de Archivo Informativos
- [x] Guardado con `[Timestamp]_[HR]_[AD]_[Seed].png` y log `[INFO] Imagen guardada en: ...`.
  - Backend: `backend/main.py`.

### Limpieza de Prompts
- [x] Deduplicación de `<lora:NAME:weight>` y tags repetidos en producción.
  - Backend: `backend/main.py`.

### Verificación de Calidad
- [x] ESLint y TypeScript OK en frontend (warnings no críticos).
- [x] Compilación de Python OK (`py_compile`).

### Próximos pasos (propuestos)
- [ ] Mover toasts y mensajes IA a `copy_blocks/site_settings`.
- [ ] Añadir pruebas unitarias para dedupe de LoRA/tags y `/gallery` encoding.
- [ ] Revisar sampler/checkpoint defaults desde Planner → Backend para consistencia.

## 🟢 Calidad & Config — 2025-11-25

### Ajustes de UX del Planner
- Rediseño del panel técnico con tabs: `Generation / Hires / ADetailer`.
- Botón principal renombrado a `Generar` para claridad.
- Etiqueta `Prompt Base (Positivo)` renombrada a `Prompt Positivo`.
- Densidad visual: reducción de `p-4 → p-3`, `gap-6 → gap-4`, `space-y-6 → space-y-4` en secciones clave.
- Lista de jobs más compacta (`space-y-2`).

### Navegación
- Eliminado el botón de ocultar menú dentro del Sidebar; se mantiene uno global fijo en la esquina, ligeramente más grande para accesibilidad.
- [x] Uso del nombre real del archivo `.safetensors` (stem) en el tag de LoRA: `<lora:RealStem:0.8>` en `/planner/draft` y `/planner/analyze`.
- [x] Endpoint local `GET /local/lora-info` para leer `trainedWords` desde `.civitai.info` y usarlos en la previsualización cuando no hay `base_prompt`.

### VAE y Resolución (SDXL)
- [x] Default VAE `Automatic` (sin hardcode); override por usuario desde Planner.
- [x] Sliders `Width` y `Height` en Planner (por personaje): defaults `832x1216`, rango `512–2048`, paso `8`, con clamp múltiplo de 8 en backend.
- [x] Payload ReForge ampliado con `width`/`height` y verificación de límites.

### ADetailer
- [x] Modelo por defecto: `face_yolov8n.pt` cuando `adetailer` está ON; log en Factory y fallback sin ADetailer si Forge retorna 4xx.

### Recursos V3 y Analyze
- [x] `/planner/analyze` ahora usa recursos V3 con fallbacks seguros (no estados vacíos): `wardrobe/*`, `concepts/*`, `styles/*`.

### Upscalers / UI
- [x] Botón “Actualizar Upscalers” funcional con spinner y re-render forzado; lista incluye `Latent`.

### Verificación de Calidad
- [x] ESLint y TypeScript OK (warnings menores). `py_compile` OK.

### Pendientes / Próximos
- [ ] Selector de modelo para ADetailer (UI) y botón “Actualizar VAEs”.
- [ ] Validación de entradas numéricas (NaN) robusta en Planner.
- [ ] Unificar duplicación de `_save_image` en backend.
- [ ] Parametrizar `BASE_URL` de ReForge en `.env` (evitar hardcode).
## 🟢 Fix Checkpoints & Galería UX — 2025-11-24

- Backend: `GET /reforge/checkpoints` ahora devuelve `{"titles": []}` ante cualquier fallo (sin 500) para cumplir UI sin estados vacíos críticos.
- Backend: `POST /reforge/refresh` que invoca `services.reforge.refresh_checkpoints()` (Forge: `/sdapi/v1/refresh-checkpoints`).
- Frontend Planner: botón “Actualizar” muestra spinner “Escaneando disco...” y espera 2s reales antes de reconsultar; autoselecciona el primer checkpoint si no hay actual.
- Backend: `GET /gallery/folders` lista subcarpetas de `OUTPUTS_DIR`.
- Frontend Galería: Sidebar de carpetas (estilo explorador), persistencia en `localStorage` de la última carpeta, carga automática al entrar.
- Backend: `POST /system/open-folder` (Windows) abre carpeta relativa a `OUTPUTS_DIR` con `os.startfile`.
- Frontend Galería: botón 📂 junto al título para abrir la carpeta actual.

## 🟢 Correcciones Críticas (Compatibilidad y UX) — 2025-11-24

### Compatibilidad Windows/Mac
- [x] Auditoría y normalización de rutas en Backend usando `pathlib.Path` y `os.path.join` donde aplica.
- [x] Guardado de imágenes con tokens (`OUTPUTS_DIR`, `{Character}`) resueltos sin concatenación manual.

### Lógica de Batch Count
- [x] Generación exacta de `job_count` con distribución SFW/Ecchi/NSFW proporcional sin excedentes.

### Botón de Refresh de Recursos
- [x] Botón “Actualizar” para Checkpoints en Planner (consulta `/reforge/checkpoints`).
- [x] Botón “LoRAs” para refrescar lista local (consulta `/local/loras`).

### Debugger de Payload (Dry Run)
- [x] Botón “Simular Envío” en header del Planificador con modal que muestra `jobs`, `resources_meta` y `group_config` exactamente como se enviaría.

### Inyección de Trigger Words
- [x] Lectura de `trainedWords` desde `.civitai.info` y colocación al inicio del prompt tras `<lora:...>`.

### Visor en Vivo
- [x] Spinner “Cargando Preview...” en `FactoryView.tsx` cuando la fábrica está activa y aún no hay imagen.
## 🔎 Informe de Estado — 2025-11-24
- Front/Back reiniciados y operativos en `3000/8000`.
- Checkpoints vacíos: backend devuelve `[]` si Forge/API no responde (`backend/main.py:1972-1978`).
- LoRAs backend OK (`backend/main.py:2327-2340`), UI dependiente del estado del backend.
- Duplicación detectada de `_save_image` (`backend/main.py:1467-1509` y `2362-2399`); requiere unificación.
- BASE_URL de ReForge hardcodeada (`backend/services/reforge.py:5-7`); pendiente parametrizar en `.env`.
- Se agregó `docs/STATUS_REPORT_2025-11-24.md` con detalles, riesgos y plan de mejora.
