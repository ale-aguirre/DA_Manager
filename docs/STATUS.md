# LadyManager — STATUS (V3)

## Estado
- V3 completada y estable para Producción Local (MVP).
- Frontend en `:3000` y Backend en `:8000` activos.

## Características Operativas
- Radar V3: descubrimiento y análisis por personaje, dedupe y triggers, búsqueda manual mejorada.
- Planner V5: construcción de plan, refresh de checkpoints/LoRAs, global prompts con persistencia en backend.
- Factory V2: ejecución en lote con Hires Fix funcional, guardado en `OUTPUTS_DIR`, logs y progreso.
- Gallery V1: navegación por carpetas, persistencia de selección, abrir contenedor en Windows.

## Observaciones
- Checkpoints dependen de ReForge (`--api` y puerto correcto). Indicador de salud en Planner.
- ESLint: warnings tolerables bajo Política MVP Local; limpieza progresiva con orquestador.

## Próximos pasos
- Parametrización completa de BASE_URL en frontend.
- Unificación total de utilidades de API y manejo de errores.

---

## Planner UI V5 — Estado (2025-11-26)

### Alcance Aprobado
- Panel Técnico: incluye Multi-LoRA, Prompts Positivo/Negativo, Checkpoint, VAE, Clip Skip, botón "Actualizar tech" y "Generar" con acciones inferiores (Guardar/Borrar/Cargar Positivo/Negativo/Tags).
- Control Panel: sliders técnicos (Width/Height, Steps, CFG), Hires/ADetailer; "Generar" siempre visible.
- Producción: tarjetas con edición rápida, intensidad y borrado.

### Arquitectura
- `PlannerView.tsx` como contenedor único de estado.
- Tipos en `src/types/planner.ts`.
- API cruda en `src/lib/api.ts`.
- Lógica de negocio en `src/helpers/planner.ts` (`initTechBootstrap`, `generateDrafts`, `constructFinalPrompt`), funciones puras.

### Reglas operativas
- Fallbacks obligatorios para Outfit/Pose/Location.
- Silenciador permitido para `<img>` bajo MVP local.
- Puertos activos: Front 3000 / Back 8000.

---

### Objetivo Principal
- Reducir `PlannerView.tsx` y delegar lógica a `helpers` y UI a sub-componentes presentacionales.

### Arquitectura de Carpetas (estricta)
- Tipos en `src/types/planner.ts` (e.g., `TechConfig`, `PlannerJob`, `ResourceMeta`).
- API cruda en `src/lib/api.ts`.
- Lógica de negocio en `src/helpers/planner.ts` (`initTechBootstrap`, `generateDrafts`, `constructFinalPrompt`) como funciones puras.

### Componentes
- `TechnicalModelPanel`: Checkpoint/VAE/ClipSkip, prompts Pos/Neg, Generar y acciones inferiores.
- `ControlPanel`: sliders, Hires, ADetailer; Generar visible.
- `ProductionQueue`: tarjetas y acciones.

### Preservación
- Lógica de Batch Count y Multi-LoRA Selector intactas.
- Estilo visual técnico y densidad alta.

## Arquitectura V4 (Smart Hybrid) — 2025-12-08
- Cambio de paradigma: De reglas rígidas a híbrido (IA + Lógica Estricta).
- Integración aprobada: Ollama (Local) y Resource Manager.
- Documentación Maestra: ARCHITECTURE_AND_RULES.md establecida.

---

## Actualizaciones — 2025-12-09

### 🎯 Global Prompts System (COMPLETADO)
**Componente:** `PromptsEditor.tsx`

**Características:**
- ✅ Persistencia en backend (archivos `.txt` en `PRESETS_DIR`)
- ✅ Botón Save abre automáticamente la carpeta de presets en Windows Explorer
- ✅ Sistema de carga unificado (sin filtrado por positivo/negativo)
- ✅ Nuevo endpoint: `POST /presets/open` para abrir carpeta del sistema
- ✅ Integración completa con `PlannerContext` para inyección global en jobs

**Backend:**
- `GET /presets/list` - Lista presets guardados
- `GET /presets/read?name=X` - Lee contenido de preset
- `POST /presets/save` - Guarda preset y retorna path
- `POST /presets/open` - Abre carpeta en explorador de archivos (Windows/macOS/Linux)

**Frontend:**
- Componente refactorizado para usar API de backend
- Toasts para feedback visual
- Carga dinámica de presets al montar

---

### 🔍 Radar Search Improvements (COMPLETADO)
**Componente:** `RadarView.tsx`

**Cambios:**
- ✅ **Eliminado auto-search:** Ya NO busca automáticamente al escribir
- ✅ **Búsqueda manual:** Solo ejecuta búsqueda al hacer click en botón "Buscar"
- ✅ **Fix Civitai API:** Removido parámetro `page` incompatible con query searches
- ✅ **Mejores logs:** Logging detallado de requests/responses en terminal

**Issue Fixed:**
- Error 400: "Cannot use page param with query search" → Resuelto
- UX mejorada: Usuario tiene control total sobre cuándo buscar

---

### 🧠 AI Provider Status & Monitoring (COMPLETADO)
**Componentes:** `AIStatusBadge.tsx`, `LLMService`

**Características:**
- ✅ **Nuevo endpoint:** `GET /planner/ai-status` retorna provider activo y configuración
- ✅ **Badge visual:** Indicador en Planner mostrando Ollama/Groq con modelo activo
- ✅ **Logging mejorado:** LLM service ahora muestra requests/responses detallados
- ✅ **Auto-refresh:** Badge se actualiza cada 30 segundos
- ✅ **Colores dinámicos:** Azul para Ollama (local), Morado para Groq (cloud)

**Logging en Terminal:**
```
[AI Provider] Using: OLLAMA
[LLM/Ollama] 📤 Request to http://localhost:11434
[LLM/Ollama] 📥 Response received (523 chars)
[LLM/Ollama] Raw Output: [{"outfit": "..."...
```

---

### 🐛 Critical Bug Fixes (COMPLETADO)

**1. Hires Fix Not Working**
- **Issue:** Variable `hr_override` faltante causaba que Hires Fix siempre estuviera OFF
- **Fix:** Agregada definición de `hr_override` en `produce_jobs()` (línea 1946)
- **Status:** ✅ Hires Fix ahora funciona correctamente

**2. Civitai Search 400 Error**
- **Issue:** Parámetro `page` no soportado en búsquedas con query
- **Fix:** Removido `page` de `params_search` en `/scan/civitai`
- **Status:** ✅ Búsquedas funcionan correctamente

---

### 📝 Documentación de LLM

**Función de la LLM en el Proyecto:**
La LLM genera automáticamente escenarios visuales (outfit/pose/location) para personajes durante la generación de drafts en Planner, evitando configuración manual repetitiva y aumentando variedad creativa.

**Providers Soportados:**
- **Ollama (Local):** Default, modelo `dolphin-llama3`
- **Groq (Cloud):** Fallback, modelo `llama3-8b-8192`

**Configuración (`.env`):**
```bash
AI_PROVIDER=ollama  # o "groq"
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=dolphin-llama3
GROQ_API_KEY=tu_key  # Solo si usas Groq
```

