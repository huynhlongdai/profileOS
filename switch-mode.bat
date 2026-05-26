@echo off
title ProfileOS - Switch Mode
color 0F

echo ============================================
echo   ProfileOS - Switch Database Mode
echo ============================================
echo.
echo   1. Local (SQLite) - Fastest, 0 latency
echo   2. Remote (Supabase PostgreSQL) - Shared DB
echo.

set /p choice="Choose mode (1 or 2): "

if "%choice%"=="1" (
    echo.
    echo Switching to LOCAL mode (SQLite)...
    if exist ".env" copy .env .env.backup >nul
    copy .env.local.example .env >nul
    call npx prisma generate --schema=prisma/schema.local.prisma
    call npx prisma db push --schema=prisma/schema.local.prisma --accept-data-loss 2>nul
    echo.
    echo [OK] Switched to SQLite local mode!
    echo     DATABASE_URL = file:./dev.db
    echo.
    echo     Run: start-local.bat or start-local-full.bat
) else if "%choice%"=="2" (
    echo.
    echo Switching to REMOTE mode (Supabase)...
    if exist ".env.remote" (
        copy .env.remote .env >nul
        echo [OK] Restored .env.remote
    ) else if exist ".env.backup" (
        copy .env.backup .env >nul
        echo [OK] Restored .env.backup
    ) else (
        copy .env.example .env >nul
        echo [INFO] Created .env from .env.example
        echo [IMPORTANT] Edit .env with your Supabase DATABASE_URL!
        notepad .env
    )
    call npx prisma generate
    echo.
    echo [OK] Switched to PostgreSQL remote mode!
    echo.
    echo     Run: start-dev.bat or start-all-dev.bat
) else (
    echo Invalid choice!
)

echo.
pause
