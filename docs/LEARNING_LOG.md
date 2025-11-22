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
- Issue: Error de tipos entre `View` en Sidebar y `View` en page.tsx; además botones sin `cursor-pointer`/`active:scale-95`.
- Cause: Definiciones separadas de `View` sin la nueva opción `studio`; estilos de interacción omitidos.
- Fix: Se unificó el literal `View` añadiendo "studio" en ambos archivos y se integró la vista `StudioView` en `page.tsx`. Se actualizaron clases de botones en Sidebar, RadarView, ProcessView y FactoryControl.
- Prevention: Centralizar tipos de navegación en `src/types` para evitar divergencias; checklist UI para interacción mínima (`cursor-pointer`, `transition-all`, `active:scale-95`) antes de cerrar PR.