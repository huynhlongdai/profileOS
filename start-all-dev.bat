@echo off
title ProfileOS - Full Stack Dev Mode (UI + Agent)
color 0B

echo ============================================
echo   ProfileOS - Full Stack (Dev Mode)
echo   UI:    http://localhost:3211 (hot reload)
echo   Agent: Background polling
echo ============================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Install from https://nodejs.org
    pause
    exit /b 1
)

:: Install main dependencies
if not exist "node_modules\next" (
    echo [SETUP] Installing UI dependencies...
    call npm install
    echo.
)

:: Install agent dependencies
if not exist "agent\node_modules" (
    echo [SETUP] Installing Agent dependencies...
    cd agent
    call npm install
    cd ..
    echo.
)

:: Check .env
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

:: Check agent .env
if not exist "agent\.env" (
    echo [SETUP] Creating agent\.env...
    (
        echo PROFILEOS_URL=http://localhost:3211
        echo AGENT_SECRET=profileos-agent-2024-secret-key
        echo GPMLOGIN_API_URL=http://127.0.0.1:19995
        echo GPMLOGIN_API_VERSION=v3
        echo GPMGLOBAL_API_URL=http://127.0.0.1:9495
        echo GPMGLOBAL_API_VERSION=v1
        echo POLL_INTERVAL=5000
        echo HEARTBEAT_INTERVAL=15000
        echo SYNC_INTERVAL=60000
    ) > agent\.env
    echo [INFO] Agent .env created with defaults.
    echo.
)

:: Generate Prisma
call npx prisma generate >nul 2>nul

echo.
echo [1/2] Starting Agent in background...
start "ProfileOS Agent" cmd /c "cd agent && npm start"

echo [2/2] Starting UI dev server (hot reload)...
echo.
echo Opening http://localhost:3211 ...
timeout /t 3 /nobreak >nul
start http://localhost:3211

:: Start dev server (foreground - no build needed!)
call npm run dev:3211

pause
