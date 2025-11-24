# Informe de Estado — LadyManager (2025-11-24)

## Resumen
- Frontend activo en `http://localhost:3000` y Backend en `http://127.0.0.1:8000`.
- Montaje de `OUTPUTS_DIR` correcto y accesible vía `/files`.
- La Fábrica ejecuta y guarda imágenes cuando se lanza producción desde Planificador (no desde Studio).
- La Galería muestra imágenes y permite abrir carpeta contenedora en Windows.

## Hallazgos Técnicos
- Checkpoints vacíos:
  - `backend/services/reforge.py:152-166` consulta `http://127.0.0.1:7860/sdapi/v1/sd-models` y extrae `title`.
  - `backend/main.py:1972-1978` hace fallback seguro `{"titles": []}` si la API falla.
  - Causa probable: ReForge/A1111 fuera de `7860` o sin `--api`.
- LoRAs locales OK en backend:
  - `backend/main.py:2327-2340` lista archivos `.safetensors` y devuelve su ruta (`LORA_PATH`).
  - En UI, si ves “failed to fetch”, suele ser por backend offline o CORS temporal.
- Duplicación de funciones:
  - `_save_image` está definida dos veces en `backend/main.py:1467-1509` y `backend/main.py:2362-2399`. Riesgo de mantenimiento y comportamiento divergente.
- BASE_URL de ReForge hardcodeado:
  - `backend/services/reforge.py:5-7` usa `http://127.0.0.1:7860`. Falta parametrizar vía `.env`.
- Sanitización de nombres de carpeta por personaje:
  - `backend/main.py:59-66` fuerza minúsculas y `_`. La carpeta real puede diferir del nombre visual del personaje; es intencional pero conviene mostrar ruta efectiva.
- Preview en vivo de Fábrica:
  - Progreso se obtiene en `backend/services/reforge.py:79-86` y se muestra en `frontend/src/components/factory/FactoryView.tsx:21-72, 152-167`. La prioridad mostrada es `lastImage` sobre `liveImage` (actualmente restaurado).
- Botón “Seleccionar ubicación” (Galería):
  - `backend/main.py:339-356` abre carpeta con `os.startfile`. Permite `path="."` para `OUTPUTS_DIR`.

## Errores y Posibles Bugs
- “Checkpoints no detectados”:
  - Si `GET /reforge/checkpoints` responde vacío y ReForge está activo con `--api`, puede deberse a puerto distinto, firewall, o estructura de payload cambiada.
- “Botones de escanear no detectan nada”:
  - `POST /reforge/refresh` existe (`backend/main.py:1980-1986`) y se usa en Planner (`frontend/src/components/planner/PlannerView.tsx:371-399`). Si Forge no responde, la UI queda sin modelos.
- “failed to fetch” en UI:
  - Observado cuando backend estaba offline/puerto ocupado. Tras reinicio, los fetch funcionan. 
- Duplicación de `_save_image`:
  - Debe unificarse para evitar divergencias en flags y sufijos de archivo.
- Studio no guarda:
  - `backend/main.py:2092-2118` devuelve imágenes en memoria; no persiste en disco. Es por diseño, pero puede confundir.

## Visión de Usuario
- Fallas en la búsqueda de checkpoints y LoRAs; botones de “escanear” no detectan nada.
- Muchos errores de ESLint y código residual; se requiere separar lo útil y lo obsoleto. El “orquestador” debe decidir y limpiar.

## Criterios de Validación
- Backend responde:
  - `GET /reforge/checkpoints` devuelve lista no vacía con Forge activo y `--api` en el puerto correcto.
  - `GET /local/loras` devuelve archivos y ruta.
- Fábrica:
  - Ejecuta lote y guarda en `OUTPUTS_DIR/{character_sanitizado}`; logs muestran “Imagen guardada en: …”.
- Galería:
  - Muestra imágenes por carpeta seleccionada; abre carpeta contenedora en Explorer.

## Plan de Mejora (Prioridades)
- Parametrizar `REFORGE_API_BASE_URL` en `.env` y usarlo en `services/reforge.py` (evitar hardcode `7860`).
- Endpoint de salud: `GET /reforge/health` con check a `/sdapi/v1/sd-models` y `/sdapi/v1/progress`; devolver estado y puerto para UI.
- Unificar `_save_image` (dejar una sola definición, mantener flags HR/AD/seed en nombre).
- UI de escaneo:
  - Mostrar error claro cuando `refresh` no detecta modelos (toast en Planner).
- Limpieza técnica (orquestador):
  - Ejecutar ESLint y TypeScript en CI; marcar TODOs; crear lista de componentes candidatos a eliminación.
  - Priorizar eliminación de duplicados, hooks sin uso y `no-img-element` donde aplique.
- Tests mínimos:
  - BE: `list_checkpoints`, `list_local_loras`, `gallery` con `override_base` y caracteres especiales.
  - FE: Planner refresh (espera 2s), Galería selección de carpeta y persistencia.

## Riesgos
- Cambiar BASE_URL puede afectar entornos distintos al local; se debe documentar env vars.
- Unificar `_save_image` requiere revisar todas las rutas de llamadas para no afectar flags.
- Limpieza masiva de UI sin orquestador puede romper flujos; hacerlo en ramas controladas.

## Recomendaciones Operativas
- Mantener puertos 3000 (front) y 8000 (back) libres. 
- Activar ReForge con `--api` en el puerto configurado. 
- Añadir `REFORGE_API_BASE_URL` al `.env` y documentarlo.
