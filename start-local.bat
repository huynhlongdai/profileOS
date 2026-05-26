@echo off
title ProfileOS - Local Mode (SQLite + Port 3211)
color 0A

echo ============================================
echo   ProfileOS - Local Mode (SQLite)
echo   http://localhost:3211
echo   Database: SQLite (0 latency)
echo ============================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Install from https://nodejs.org
    pause
    exit /b 1
)

:: Install dependencies
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

:: Setup .env for SQLite mode
if not exist ".env" (
    echo [SETUP] Creating .env for SQLite local mode...
    copy .env.local.example .env
    echo [OK] .env created with SQLite config
    echo.
)

:: Check if DATABASE_URL is SQLite
findstr /C:"file:" .env >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARN] .env does not use SQLite. Switching to local mode...
    echo [INFO] Backing up current .env to .env.remote
    copy .env .env.remote
    copy .env.local.example .env
    echo [OK] Switched to SQLite mode
    echo.
)

:: Generate Prisma client for SQLite
echo [SETUP] Generating Prisma client (SQLite)...
call npx prisma generate --schema=prisma/schema.local.prisma
if %errorlevel% neq 0 (
    echo [ERROR] Prisma generate failed!
    pause
    exit /b 1
)

:: Create/update SQLite database tables
echo [SETUP] Syncing database schema...
call npx prisma db push --schema=prisma/schema.local.prisma --accept-data-loss 2>nul
if %errorlevel% neq 0 (
    echo [WARN] db push had issues, trying again...
    call npx prisma db push --schema=prisma/schema.local.prisma --force-reset
)

echo.
echo [OK] SQLite database ready: prisma/dev.db
echo.
echo Starting ProfileOS on http://localhost:3211 ...
echo (Turbopack enabled - fast hot reload)
echo Press Ctrl+C to stop
echo.

:: Open browser after short delay
timeout /t 3 /nobreak >nul
start http://localhost:3211

:: Start dev server
call npm run dev:3211

pause
