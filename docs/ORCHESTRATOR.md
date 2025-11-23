# 🧠 LADYMANAGER - ORCHESTRATION LOG
> ESTADO: ACTIVO | FASE: 3.5 (Planificador V4 + Base de Conocimiento)

## 🗺️ VISIÓN DEL PROYECTO
Construir un CMS (Sistema de Gestión de Contenido) local para producción masiva de Anime NSFW utilizando Stable Diffusion (ReForge).
El objetivo es automatizar el ciclo: Descubrimiento (Radar) -> Estrategia (Planificador) -> Ejecución (Fábrica) -> Distribución (Galería).

## 🚧 ESTADO TÉCNICO ACTUAL
- **Stack:** Monorepo (FastAPI :8000 + Next.js :3000).
- **Integraciones:** Civitai (Scraping), Groq (Llama 3 Intelligence), ReForge (SD API).
- **Persistencia:** Archivos locales (`.txt` en `backend/resources`, imágenes en `outputs/`).

## 📋 ROADMAP ACTIVO (PRIORIDAD ALTA)
1. **[BACKEND] Knowledge Seeder:** Script para poblar `resources/` con IA.
2. **[BACKEND] Planner Draft V2:** Lógica de "Embudo de Ventas" (Safe/Ecchi/NSFW) + Ingeniería Inversa de Civitai.
3. **[FRONTEND] Planner UI V5:** Diseño "Character-Centric" con Tarjetas de Job, Selectores Visuales y Panel de Configuración Técnica.
4. **[FRONTEND] Galería V1:** Visor de historial de producción.

## 🔮 FUTURO (IDEAS APROBADAS)
- **AI Assistants UI:** Integración visual de personajes (Hinata, Senku, Mei) para feedback.
- **Auto-Snatcher:** Descarga automática nocturna de tendencias.
- **Post-Producción:** IA de Visión para control de calidad y auto-tagging para DeviantArt/Patreon.

## ⚖️ REGLAS DE ORO (NO ROMPER)
1. **Puertos Estrictos:** 8000 (Backend) y 3000 (Frontend). Matar procesos zombis antes de iniciar.
2. **Cero Vacíos:** El backend NUNCA devuelve campos vacíos. Si falta data, usa `random.choice` o defaults seguros.
3. **Estética:** UI Dark Mode profesional, Iconos Lucide (Sin emojis de texto), Bordes Gradientes para items Top.
4. **Rutas:** Usar siempre `os.getenv('OUTPUTS_DIR')` y `LORA_PATH`.