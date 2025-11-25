@echo off
setlocal EnableDelayedExpansion
TITLE LadyManager Backend Dev
echo 🧠 Iniciando Backend FastAPI (Puerto 8000)

:: 0) Ubicación del script
cd /d %~dp0

:: 1) Verificar Python en PATH
where python >nul 2>&1
if errorlevel 1 (
  echo ❌ Python no encontrado en PATH. Instala Python 3.11+ y reintenta.
  pause
  exit /b 1
)

:: 2) Matar procesos previos en 8000 (si estaban escuchando)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R /C:":8000" ^| findstr /C:"LISTENING"') do taskkill /f /pid %%a >nul 2>&1

:: 3) Crear/activar venv
if not exist venv\Scripts\python.exe (
  echo 🔧 Creando venv local...
  python -m venv venv
)
call venv\Scripts\activate

:: 4) Instalar dependencias si existen
if exist requirements.txt (
  echo 📦 Instalando dependencias (requirements.txt)...
  pip install -r requirements.txt
)

:: 5) Levantar Uvicorn
echo 🚀 Iniciando Uvicorn...
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
if errorlevel 1 (
  echo ❌ Uvicorn no pudo iniciar. Intentando con Python global...
  deactivate >nul 2>&1
  python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
)

echo.
echo ✅ Backend corriendo en http://127.0.0.1:8000
pause
