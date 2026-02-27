@echo off
cd /d "%~dp0"

REM ── Detener servidor anterior si está corriendo ───────────────────────
echo Deteniendo servidor anterior (si existe)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":3000 " 2^>nul') do (
  taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

REM ── Instalar dependencias si no existen ───────────────────────────────
if not exist "node_modules" (
    echo Instalando dependencias por primera vez...
    npm install
    echo.
)

REM ── Levantar el servidor en una ventana separada ──────────────────────
echo Iniciando servidor...
start "Jira ^→ Google Calendar | Servidor" cmd /k "node server.js"

REM ── Esperar que el servidor arranque ─────────────────────────────────
timeout /t 2 /nobreak >nul

REM ── Abrir el navegador ────────────────────────────────────────────────
echo Abriendo http://localhost:3000 ...
start http://localhost:3000

echo.
echo Servidor corriendo en http://localhost:3000
echo Para detenerlo, cierra la ventana "Servidor".
