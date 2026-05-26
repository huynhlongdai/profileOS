@echo off
title ProfileOS - Full Stack (UI + Agent)
color 0E

echo ============================================
echo   ProfileOS - Full Stack Launcher
echo   UI:    http://localhost:3211
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
if not exist "node_modules\" (
    echo [SETUP] Installing UI dependencies...
    call npm install
    echo.
)

:: Install agent dependencies
if not exist "agent\node_modules\" (
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
    echo [INFO] Edit .env with your database URL, then save and close.
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

echo [2/2] Starting UI server...
echo.
echo Opening http://localhost:3211 ...
start http://localhost:3211

:: Start dev server (foreground)
call npm run dev:3211

pause
