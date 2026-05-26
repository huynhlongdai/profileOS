@echo off
title ProfileOS - Local Server (Port 3211)
color 0A

echo ============================================
echo   ProfileOS - Local Server
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
if not exist "node_modules\next" (
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
    echo.
    echo [IMPORTANT] Edit .env with your Supabase DATABASE_URL and DIRECT_URL
    echo            Save the file, then come back here.
    echo.
    notepad .env
    echo.
)

:: Generate Prisma client
echo [SETUP] Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo [ERROR] Prisma generate failed! Check your .env DATABASE_URL
    pause
    exit /b 1
)

:: Always build before starting production
echo.
echo [BUILD] Building production bundle...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [WARN] Build failed! Starting in dev mode instead...
    echo.
    start http://localhost:3211
    call npm run dev:3211
    pause
    exit /b 0
)

echo.
echo [OK] Build successful!
echo.
echo Starting ProfileOS on http://localhost:3211 ...
echo Press Ctrl+C to stop
echo.

:: Open browser
start http://localhost:3211

:: Start production server
call npm run start:3211

pause
