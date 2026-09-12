@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist node_modules (
  echo [NovaEPUB] Installing dependencies...
  call npm install
)

echo [NovaEPUB] Starting development server...
echo.
echo Open browser at: http://localhost:5173/
echo Press Ctrl+C to stop.
echo.
call npm run dev
pause
