@echo off 
TITLE LadyManager Orchestrator 
echo 🚀 Iniciando LadyManager Factory (Windows)... 

:: 1. LIMPIEZA DE PUERTOS (Matar procesos viejos en 8000 y 3000) 
echo 🧹 Limpiando puertos 8000 y 3000... 
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1 
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1 

:: 2. INICIAR BACKEND (En ventana separada) 
echo 🧠 Encendiendo Cerebro (Backend)... 
start "LadyManager Backend" cmd /k "cd backend && python -m venv venv && call venv\Scripts\activate && pip install -r requirements.txt && uvicorn main:app --host 127.0.0.1 --port 8000 --reload" 

:: 3. INICIAR FRONTEND (En ventana separada) 
echo 🎨 Encendiendo Interfaz (Frontend)... 
start "LadyManager Frontend" cmd /k "cd frontend && npm install && npm run dev" 

echo. 
echo ✅ Sistemas iniciados. 
echo 🌍 Abre: http://localhost:3000 
echo. 
pause
