# LadyManager — STATUS (V3)

## Estado
- V3 completada y estable para Producción Local (MVP).
- Frontend en `:3000` y Backend en `:8000` activos.

## Características Operativas
- Radar V3: descubrimiento y análisis por personaje, dedupe y triggers.
- Planner V5: construcción de plan, refresh de checkpoints/LoRAs, debug con rutas de guardado.
- Factory V2: ejecución en lote, guardado en `OUTPUTS_DIR`, logs y progreso.
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
