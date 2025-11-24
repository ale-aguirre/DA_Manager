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
