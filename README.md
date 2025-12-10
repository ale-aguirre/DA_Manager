# LadyNuggets Manager (Monorepo)

LadyNuggets Manager es un monorepo local para automatizar workflows de Stable Diffusion.

## Arquitectura
- frontend: Next.js 14 (App Router, TypeScript, Tailwind)
- backend: FastAPI (Python 3.10+), Uvicorn, Pydantic v2, python-dotenv

Puertos:
- Frontend: 3000
- Backend: 8000

## Requisitos Previos
- Node.js 18+
- Python 3.10+
- Bash / Terminal

## Configuración de Entornos
Backend (.env en /backend):
- REFORGE_PATH: ruta absoluta al folder wildcards de Dynamic Prompts
- OUTPUTS_DIR: ruta absoluta al folder de salida de imágenes generadas
- PRESETS_DIR: ruta absoluta al folder de presets (global prompts)
- AI_PROVIDER: "ollama" (local) o "groq" (cloud) para generación de escenarios
- OLLAMA_URL: URL de Ollama (default: http://localhost:11434)
- OLLAMA_MODEL: modelo de Ollama (default: dolphin-llama3)
- GROQ_API_KEY: clave de Groq (solo si AI_PROVIDER=groq)
- CIVITAI_API_KEY: clave opcional (para NSFW y cuota en Radar)

Ejemplo: ver backend/.env.example

Frontend (.env.local en /frontend):
- NEXT_PUBLIC_API_BASE_URL: URL base del API (ej.: http://127.0.0.1:8000)

Ejemplo: ver frontend/.env.local.example

## Instalación y Ejecución
### Backend
1. cd backend
2. python3 -m venv venv
3. source venv/bin/activate
   - Windows (PowerShell): python -m venv venv ; .\\venv\\Scripts\\activate
4. pip install -r requirements.txt
5. uvicorn main:app --host 127.0.0.1 --port 8000 --reload

### Frontend
1. cd frontend
2. npm install
3. npm run dev

Abrir http://localhost:3000

## Notas Importantes
- Todas las rutas locales deben provenir de variables de entorno (.env) — sin paths hardcodeados.
- Scraping externo usa cloudscraper (no usar requests para sitios protegidos por Cloudflare).
- CORS habilitado para http://localhost:3000.
- Global Prompts se guardan en PRESETS_DIR como archivos .txt

## Scripts útiles (Endpoints)
**Health & Config:**
- GET / - Health check del backend
- GET /planner/ai-status - Estado del provider de AI (Ollama/Groq)

**Radar (Búsqueda de modelos):**
- GET /scan/civitai - Búsqueda de LoRAs en Civitai
- POST /download-lora - Descarga de LoRA desde Civitai
- GET /local/loras - Lista LoRAs locales
- GET /local/lora-info?name=X - Info de LoRA local

**Planner (Generación de drafts):**
- POST /planner/draft - Genera jobs desde personajes seleccionados
- POST /planner/execute-v2 - Inicia producción con jobs

**Presets (Global Prompts):**
- GET /presets/list - Lista presets guardados
- GET /presets/read?name=X - Lee contenido de preset
- POST /presets/save - Guarda preset
- POST /presets/open - Abre carpeta de presets en explorador

**Factory (Producción):**
- GET /factory/status - Estado de producción actual
- POST /factory/stop - Detiene producción

**Gallery:**
- GET /gallery?folder=X - Lista imágenes de folder
- GET /gallery/metadata?path=X - Metadata de imagen

## Desarrollo y Git
- Ramas activas: develop, feature/git-setup
- Convencional Commits, PRs a develop (previo a merge)

## Seguridad
- No subir secretos. Usa .env locales.
- Validación de inputs en el backend con Pydantic.