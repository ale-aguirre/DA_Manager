# Learning Log

## 2025-11-21
- Issue: Inicialización de monorepo con configuración dinámica y coherencia Back/Front.
- Cause: Riesgo de rutas hardcodeadas y bloqueo por uso de librerías incorrectas para scraping.
- Fix: Variables en /backend/.env + carga con python-dotenv; advertencias no bloqueantes si REFORGE_PATH falta; CORS para localhost:3000; Tailwind v4 confirmado; página simplificada.
- Prevention: Mantener disciplina de .env (sin hardcode), usar cloudscraper en scraping, validar UI con preview antes de cerrar tareas, correr ESLint/TypeScript en cada cambio significativo.

## 2025-11-21
**Issue:** UI básica no cumplía el estándar "Professional Dark Dashboard".
**Cause:** Layout inicial minimal (lista simple, sin grid ni loaders visuales).
**Fix:** Overhaul en frontend/app/page.tsx: header con gradiente, grid de tarjetas (aspect ratio vertical, hover scale y borde sutil), badges de tags (máximo 3), spinner en botón y skeleton loader animado. Se usó <img> para evitar configurar dominios de imágenes por ahora.

## 2025-11-21 10:55
- Issue: Error de linter por conflicto de identificador "Home" (ícono importado vs componente React).
- Cause: El componente exportado se llamaba `Home`, igual que el ícono `Home` de lucide-react.
- Fix: Se aliasó el ícono como `HomeIcon` y se actualizó su uso en `NavItem`.
- Prevention: Evitar nombres de componentes que colisionen con íconos/constantes importadas; usar alias sistemáticos (`XIcon`).

## 2025-11-21 11:10
- Issue: Código monolítico en frontend/app/page.tsx dificultaba escalabilidad y mantenimiento.
- Cause: UI y lógica de escaneo/estados concentrados en un único archivo sin componentes reutilizables.
- Fix: Refactorización modular: creación de src/components (layout/Sidebar.tsx con logo circular, dashboard/StatCard.tsx, dashboard/LogConsole.tsx, radar/RadarView.tsx) y limpieza de page.tsx (<100 líneas) orquestando el layout y estados globales.
- Prevention: Mantener arquitectura de componentes, tipar props e interfaces, y reutilizar tipos desde src/types; revisar previews tras cambios de estructura.

## 2025-11-22
- Issue: Botón de descarga en Radar usando `model.modelVersions[0].downloadUrl` rompía el linter (prop inexistente en tipos).
- Cause: Tipado minimal de `CivitaiModelVersion` no incluía `downloadUrl`.
- Fix: Extender `src/types/civitai.ts` añadiendo `downloadUrl?: string` en `CivitaiModelVersion` y manejar estados de descarga/instalación.
- Prevention: Revisar tipos antes de usar campos de APIs externas; mantener tipos alineados a las respuestas que se consumen.

## 2025-11-22
- Issue: Next intentó moverse al puerto 3001 por ocupación del 3000, y bloqueo por lock de dev.
- Cause: Proceso `node` activo en 3000 (PID 86556) y lock `.next/dev/lock` presente.
- Fix: Identificar y matar el proceso (`lsof -i :3000` + `kill -9 86556`) y reiniciar `npm run dev` en 3000.
- Prevention: Usar script `scripts/dev-strict.sh` para disciplina de puertos; revisar y liberar 3000 antes de iniciar frontend.
- Issue: Error de tipos entre `View` en Sidebar y `View` en page.tsx; además botones sin `cursor-pointer`/`active:scale-95`.
- Cause: Definiciones separadas de `View` sin la nueva opción `studio`; estilos de interacción omitidos.
- Fix: Se unificó el literal `View` añadiendo "studio" en ambos archivos y se integró la vista `StudioView` en `page.tsx`. Se actualizaron clases de botones en Sidebar, RadarView, ProcessView y FactoryControl.
- Prevention: Centralizar tipos de navegación en `src/types` para evitar divergencias; checklist UI para interacción mínima (`cursor-pointer`, `transition-all`, `active:scale-95`) antes de cerrar PR.

## 2025-11-23
- Issue: Errores de TypeScript al actualizar `PlannerView.tsx` (propiedades desconocidas en `setTechConfig`: `upscaler`, `checkpoint`).
- Cause: Se añadieron nuevos controles al panel técnico sin extender el tipo del helper `setTechConfig`.
- Fix: Extender el tipo de `setTechConfig` para incluir `{ upscaler: string; checkpoint: string }` y persistir correctamente en `techConfigByCharacter`.
- Prevention: Cada vez que se agreguen controles o propiedades nuevas en el estado técnico, actualizar los tipos y ejecutar ESLint/TS antes del commit. Añadir verificación en PR checklist.

## 2025-11-24
- Issue: LoRAs descargados sin metadatos completos; faltaban `trainedWords`, `modelId` y `name` en `.civitai.info`.
- Cause: Post-proceso basado solo en hash (`by-hash`) y estructura parcial; no se extraía `VERSION_ID` desde la URL.
- Fix: Actualizar `backend/services/lora.py` para extraer `VERSION_ID` de `download_url` y consultar `api/v1/model-versions/{id}`; fallback por hash. Actualizar `scripts/fetch_missing_meta.py` para la nueva estructura.
- Prevention: Priorizar extracción de ID desde URL y mantener fallback por hash; validar con `py_compile`, ESLint y `tsc --noEmit` antes de cerrar tarea.
## 2025-11-24
- Issue: Error 500 en generación por `NoneType` en Hires Fix.
- Cause: Falta el campo `hr_additional_modules` en payload y valores `hr_scale/hr_upscaler` vacíos.
- Fix: Forzar `hr_scale` `float` (default 2.0), `hr_upscaler` `Latent`, y agregar `hr_additional_modules` `["Use same choices"]` al nivel raíz. Logs `[DEBUG]` + dump de payload.
- Prevention: Checklist de validación de payload ReForge (claves obligatorias cuando `enable_hr=True`), pruebas de compilación Python tras cambios, verificación en consola antes de enviar.

- Issue: Prompts finales con duplicados (`<lora:A>, trigger, <lora:A>, trigger`).
- Cause: `job.prompt` ya contiene LoRA/base, y producción añadía LoRAs extra sin dedup.
- Fix: Deduplicar tokens y consolidar `<lora:NAME:weight>` por nombre (mantener mayor peso), evitar concatenar base duplicada.
- Prevention: Política de “job.prompt como cuerpo/delta” y limpieza previa; pruebas unitarias recomendadas.

- Issue: Galería no mostraba imágenes tras generación.
- Cause: URLs relativas sin codificar y montaje estático sin ruta absoluta (Windows con espacios).
- Fix: `StaticFiles` con `Path.resolve()`, `/gallery` devuelve URLs absolutas con `quote`, `GalleryView.tsx` `onError` con URL.
- Prevention: Usar `quote` en rutas de servidor, priorizar URLs absolutas, diagnóstico visual en UI.

## 2025-11-24 14:00
- Issue: Planner retorna múltiples nodos raíz y rompe JSX (parse error `')' expected`).
- Cause: Se añadió un modal fuera del contenedor principal del `return` generando siblings sin fragment.
- Fix: Reubicar el modal dentro del contenedor principal; evitar hermanos en el `return` sin fragment.
- Prevention: En UI complejas, envolver nodos condicionales en el contenedor principal o usar `<>...</>`.

## 2025-11-24 14:05
- Issue: Triggers oficiales no se aplicaban desde `.civitai.info`.
- Cause: El código leía `triggers` pero los metadatos usan `trainedWords`.
- Fix: Lectura prioritaria de `trainedWords` con fallback a `triggers` y colocación al inicio del prompt tras `<lora:...>`.
- Prevention: Validar estructura de metadatos de Civitai; pruebas con archivos reales; añadir script de verificación.

## 2025-11-24 18:30
- Issue: Botón “Actualizar Checkpoints” no reflejaba cambios y la API devolvía 500.
- Cause: Falta de endpoint de refresh en Backend y manejo de errores frágil en `/reforge/checkpoints`.
- Fix: Añadido `POST /reforge/refresh` (Forge `/sdapi/v1/refresh-checkpoints`), `GET /reforge/checkpoints` devuelve `[]` ante fallos; en Planner, spinner + espera real de 2s y autoselección del primer checkpoint cuando no hay seleccionado.
- Prevention: Política de “fallbacks seguros” en endpoints críticos y secuencias de refresh con delays explícitos; test manual en Preview y ESLint/TypeScript en cada cambio.

## 2025-11-24 18:35
- Issue: Galería confusa por prompt “Seleccionar ubicación” y sin navegación por carpetas.
- Cause: UX basada en `prompt()` y parámetro `override_base` sin descubrir carpetas.
- Fix: `GET /gallery/folders` para listar subcarpetas en `OUTPUTS_DIR`; Sidebar de carpetas con persistencia en `localStorage`; botón 📂 “Abrir carpeta” junto al título; `POST /system/open-folder` en Backend (Windows) usando `os.startfile`.
 - Prevention: Evitar `prompt()` para flujos de navegación; usar exploradores laterales con estados persistentes; verificación visual en Preview.

## 2025-11-25
- Issue: Doble botón de “Ocultar menú” y densidad visual baja en Planner.
- Cause: Toggle duplicado en Sidebar y paddings/gaps grandes en secciones del Planner.
- Fix: Eliminar toggle interno del Sidebar y ampliar el global; reducir `p-4→p-3`, `gap-6→gap-4`, `space-y-6→space-y-4`; compactar lista de jobs a `space-y-2`; renombrar etiquetas a “Prompt Positivo” y botón principal a “Generar”.
- Prevention: Checklist de UX denso (“Technical Dashboard”) antes de cerrar tareas; evitar controles redundantes; preferir toggles globales.

## 2025-11-26
- Issue: Errores de TypeScript por `ai_meta` (`unknown`) y advertencias de `<img>` en producción.
- Cause: Acceso directo a propiedades de `ai_meta` sin type guards y uso intencional de `<img>` por política del proyecto.
- Fix: Type guards en `PlannerView.tsx` para `outfit/lighting/camera`; silenciador en `<img>` (`loading="lazy"`, `decoding="async"`, `referrerPolicy="no-referrer"`). Botón "Generar" persistente en `ControlPanel` para visibilidad constante.
- Prevention: Mantener tipos en `src/types`, validar con `tsc --noEmit` y tolerar warnings acordados de ESLint cuando la política del proyecto lo indica.
## 2025-11-26 11:43
- Issue: Duplicación de UI en Planner (Cola de Producción inline y componente separado).
- Cause: Inserción del componente `ProductionQueue` sin eliminar el bloque inline previo.
- Fix: Eliminación del render inline en `PlannerView.tsx` y uso exclusivo de `ProductionQueue`; ejecución de ESLint (warnings) y `tsc --noEmit` OK.
- Prevention: Al refactorizar vistas, reemplazar completamente bloques antiguos y correr validaciones antes de cerrar; evitar duplicación de props/estado.

## 2025-11-26 12:00
- Issue: Especificación incompleta del flujo Radar→Planificación V2 (truncado y secciones LoRA).
- Cause: Roadmap describía "N caracteres" y no explicitaba separación global vs por-job.
- Fix: Actualización de `docs/ROADMAP.md` fijando truncado a 16 y secciones separadas para LoRA global/por-job.
- Prevention: Documentar requisitos concretos (longitudes, alcances) antes de implementar UI; validar con ESLint y `tsc --noEmit` tras cambios.
 
## 2025-11-26 18:10
- Issue: Backend spameaba `GET /local/lora-info` y `GET /civitai/model-info` repetidamente al navegar en Planner/Radar.
- Cause: Efectos de precarga y fallback de previews hacían múltiples llamadas por los mismos nombres sin memoización.
- Fix: Cache en `frontend/src/lib/api.ts` con TTL (2m para `local/lora-info`, 5m para `civitai/model-info`) y dedupe de promesas pendientes por clave; además se eliminaron los preloads masivos y el fallback remoto de previews en `LorasSection`.
- Prevention: Centralizar memoización en la capa API y evitar precargas extensas; usar dependencias de efectos estables y revisar logs del Backend tras cambios.

## 2025-11-26 20:00
- Issue: Error de hidratación (`<button>` descendiente de `<button>`) en la tarjeta LoRA.
- Cause: La tarjeta era un `<button>` y el tooltip incluía otro `<button>` para "Info".
- Fix: Convertir ambos a `div` con `onClick` (manteniendo accesos y estilos), y priorizar previews locales desde `.civitai.info`.
- Prevention: Evitar elementos interactivos anidados del mismo tipo; revisión con ESLint y prueba manual de hover/click en Planner.

## 2025-11-26 19:13
- Issue: `docs/ROADMAP.md` desactualizado y con secciones obsoletas.
- Cause: Cambios recientes (Planner/LoRA previews, caches, progreso en vivo) no documentados; fases históricas sin vigencia.
- Fix: Reescritura compacta del Roadmap, centrada en estado actual, endpoints activos y entregables próximos; eliminación de contenido viejo.
- Prevention: Actualizar el Roadmap al cerrar fixes/refactors relevantes y registrar fecha; mantener una sección de "Cambios recientes" con qué y cómo.
