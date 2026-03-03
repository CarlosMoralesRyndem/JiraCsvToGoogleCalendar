@echo off
chcp 65001 >nul
title Jira a Google Calendar - Servidor Local
cd /d "%~dp0"

echo.
echo =========================================================
echo        JIRA TO GOOGLE CALENDAR - LAUNCHER
echo =========================================================
echo.

:: 1. Verificar Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado o no esta en el PATH.
    echo Instala Node.js desde https://nodejs.org/ e intenta de nuevo.
    echo.
    pause
    exit /b 1
)

:: 2. Matar procesos anteriores en puerto 3000
echo [1/4] Comprobando puerto 3000...
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| find "LISTEN" ^| find ":3000"') do (
    taskkill /F /PID %%p >nul 2>&1
)

:: 3. Instalar dependencias si faltan
if not exist "node_modules\" (
    echo [2/4] Instalando dependencias necesarias...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Fallo al instalar dependencias.
        pause
        exit /b 1
    )
) else (
    echo [2/4] Dependencias OK.
)

:: 4. Preparar y lanzar
echo [3/4] Preparando aplicacion...
echo [4/4] Abriendo navegador...

start "" http://localhost:3000

echo.
echo =========================================================
echo    Servidor:   ONLINE
echo    URL:        http://localhost:3000
echo.
echo    Mantenga esta ventana abierta.
echo    Para salir, cierre esta ventana o presione Ctrl+C.
echo =========================================================
echo.

node server.js

pause
