
# 🗺️ LadyManager Roadmap (Actualizado 2025-11-26)

**Stack:** FastAPI (Backend `:8000`) + Next.js 14 (Frontend `:3000`).

**Módulos activos:** `Radar`, `Planner`, `Factory`, `Gallery`, `Studio`, `Archivos Locales`.

**Principios clave:**
- Sin vacíos críticos: Outfit/Pose/Location siempre con fallback desde `backend/resources`.
- UI densa tipo Technical Dashboard, íconos Lucide, loaders/toasts.
- Rutas y paths por `.env`: `REFORGE_PATH`, `LORA_PATH`, `OUTPUTS_DIR`, `CIVITAI_API_KEY`, `GROQ_API_KEY`.
- Puertos fijos `3000/8000`.

## Estado actual
- Planner estable con previews locales desde `.civitai.info`; se consulta Civitai solo si faltan imágenes en local.
- Cache y dedupe de metadatos en `frontend/src/lib/api.ts` (TTL: `local/lora-info` 2m, `civitai/model-info` 5m).
- Se eliminaron preloads masivos y escaneos innecesarios; carga bajo demanda al hacer hover.
- Factory con progreso en vivo (`GET /reforge/progress`) y guardado de archivos `[Timestamp]_[HR]_[AD]_[Seed].png`.
- Radar con escaneo bajo demanda y descarga manual de LoRA + `.civitai.info`.
- Gallery montada con rutas absolutas y botón “Abrir carpeta”.

## Cambios recientes (qué y cómo — 2025-12-06)
- **Planner Refactor**: Layout de 3 columnas para estrategias, botón "Set Workflow" compacto con loader, scroll automático a la mesa de trabajo.
- **I18n System**: Implementado `frontend/src/data/translations.ts` y hook `useTranslation` para textos en ES/EN.
- **Draft Logic Fixed**: Solucionado error 500 en backend (función auxiliar `sanitize_tag`) y restaurada lógica de re-generación forzada.
- Calidad: JSX de `PlannerView` reparado, warnings de lint limpios.

## Endpoints activos (resumen)
- `GET /local/lora-info` → lee `.civitai.info` (`trainedWords`, `imageUrls`, `modelId`, `id`).
- `GET /local/loras`, `POST /download-lora`, `POST /download-checkpoint`.
- `GET /reforge/checkpoints`, `POST /reforge/checkpoint`, `POST /generate`, `GET /reforge/progress`.
- `GET /gallery`, `GET /gallery/folders`, `POST /system/open-folder`.

## Próximos 7 días (entregables)
- Carrito en Radar + modal de confirmación con pipeline de descargas y progreso.
- Planner: LoRA global vs por-job (un solo trigger por LoRA de personaje) y botón “Generar” fijo.
- Validación: E2E Radar→Planner→Factory, unit tests de dedupe LoRA/tags y encoding de `/gallery`.

## Calidad y disciplina
- ESLint y TypeScript se ejecutan antes de cerrar tareas; tolerar warnings acordados por política.
- Python compila (`py_compile`) tras cambios de endpoints.
- Preview manual (Vercel local o equivalente) antes de merge.

## Operativa
- Puertos: solo `3000`/`8000` activos.
- Copys: sin hardcode; usar `copy_blocks`/`site_settings`.
- Seguridad: nada de `.env` en el repo; validar entradas y respetar ACL/RLS cuando aplique.

---

Última actualización: 2025-12-06 (America/Buenos_Aires)
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
### Radar — Paginación (Pendiente)
- [ ] Implementar paginación revisada para Radar (todas las pestañas), evitando repetición de resultados entre páginas.

## 🟢 Planner UX & Safety — 2025-11-26

### Type Safety
- [x] Type guards para `ai_meta` en `PlannerView.tsx` para evitar acceso a propiedades de tipo `unknown`.

### Control Panel
- [x] Botón "Generar" persistente y visible siempre en `ControlPanel.tsx` (fuera de tabs), manteniendo el flujo de regeneración de drafts.

### Producción
- [x] Silenciador `<img>` en `ProductionQueue.tsx` (`loading="lazy"`, `decoding="async"`, `referrerPolicy="no-referrer"`) bajo política MVP local.

### Calidad
- [x] `tsc --noEmit` sin errores.
- [x] ESLint con warnings tolerables (`@next/next/no-img-element`) alineados a reglas del proyecto.

### Arquitectura (continuidad)
- [x] Bootstrap técnico con función pura `computeTechBootstrap` en helpers; contenedor ejecuta fetch y aplica sugerencias.
  - Observación actual: al avanzar de página, Civitai devuelve items repetidos con algunos `sort/period`; el frontend deduplica pero no aporta nuevos LoRAs.
  - Próximo: diseñar estrategia de paginación con combinación de `sort/period` y `query` y/o “cargar más” acumulativo con señalización de “0 nuevos”.
  - Validación: ver nuevos ids por página; indicador de items agregados; rendimiento estable.
