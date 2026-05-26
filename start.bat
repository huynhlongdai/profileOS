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
    echo [INFO] Please edit .env with your database URL before continuing.
    echo        Open .env in a text editor and fill in DATABASE_URL and DIRECT_URL
    notepad .env
    echo.
)

:: Generate Prisma client
echo [SETUP] Generating Prisma client...
call npx prisma generate >nul 2>nul

:: Check if build exists
if not exist ".next\" (
    echo [BUILD] Building for first time...
    call npm run build
    if %errorlevel% neq 0 (
        echo [WARN] Build failed, starting in dev mode instead...
        echo.
        echo Starting dev server on http://localhost:3211 ...
        echo Press Ctrl+C to stop
        echo.
        start http://localhost:3211
        call npm run dev:3211
        goto :end
    )
)

echo.
echo Starting ProfileOS on http://localhost:3211 ...
echo Press Ctrl+C to stop
echo.

:: Open browser
start http://localhost:3211

:: Start production server
call npm run start:3211

:end
pause
