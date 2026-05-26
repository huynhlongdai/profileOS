@echo off
title ProfileOS - Dev Server (Port 3211)
color 0B

echo ============================================
echo   ProfileOS - Dev Mode (Hot Reload)
echo   http://localhost:3211
echo ============================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Install from https://nodejs.org
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules\" (
    echo [SETUP] Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
    echo.
)

:: Check if .env exists
if not exist ".env" (
    echo [SETUP] Creating .env from .env.example...
    copy .env.example .env
    echo [INFO] Please edit .env with your database URL.
    notepad .env
    echo.
)

:: Generate Prisma client
call npx prisma generate >nul 2>nul

echo.
echo Starting dev server on http://localhost:3211 ...
echo (Hot reload enabled - changes auto-refresh)
echo Press Ctrl+C to stop
echo.

:: Open browser
start http://localhost:3211

:: Start dev server
call npm run dev:3211

pause
