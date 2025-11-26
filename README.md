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
- GROQ_API_KEY: clave de Groq (texto)
- CIVITAI_API_KEY: clave opcional (para NSFW y cuota)
- PRESETS_DIR: ruta absoluta al folder presets de Stable Diffusion

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
- El endpoint /save-files guarda personajes.txt y poses.txt en REFORGE_PATH con formato:
  - "trigger1, trigger2, nombre_limpio, masterpiece, best quality, amazing quality, absurdres, explicit, nsfw, (highly detailed face:1.2)"
- CORS habilitado para http://localhost:3000.

## Scripts útiles
- Backend salud: GET http://127.0.0.1:8000/
- Scan Civitai: GET http://127.0.0.1:8000/scan/civitai
- Proceso IA: POST http://127.0.0.1:8000/process-ai
- Guardar archivos: POST http://127.0.0.1:8000/save-files

## Desarrollo y Git
- Ramas activas: develop, feature/git-setup
- Convencional Commits, PRs a develop (previo a merge)

## Seguridad
- No subir secretos. Usa .env locales.
- Validación de inputs en el backend con Pydantic.