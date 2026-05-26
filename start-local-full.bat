@echo off
title ProfileOS - Local Full Stack (SQLite + Agent)
color 0E

echo ============================================
echo   ProfileOS - Local Full Stack
echo   UI:    http://localhost:3211 (SQLite)
echo   Agent: Background polling (local)
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
    echo [SETUP] Installing UI dependencies...
    call npm install
    echo.
)

if not exist "agent\node_modules" (
    echo [SETUP] Installing Agent dependencies...
    cd agent
    call npm install
    cd ..
    echo.
)

:: Setup .env for SQLite
if not exist ".env" (
    echo [SETUP] Creating .env for SQLite local mode...
    copy .env.local.example .env
    echo [OK] .env created
    echo.
)

:: Check if DATABASE_URL is SQLite
findstr /C:"file:" .env >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARN] .env does not use SQLite. Switching to local mode...
    copy .env .env.remote
    copy .env.local.example .env
    echo [OK] Switched to SQLite mode (old .env saved as .env.remote)
    echo.
)

:: Setup agent .env
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
    echo [OK] Agent .env created
    echo.
)

:: Generate Prisma client (SQLite)
echo [SETUP] Generating Prisma client (SQLite)...
call npx prisma generate --schema=prisma/schema.local.prisma

:: Create/sync database
echo [SETUP] Syncing database...
call npx prisma db push --schema=prisma/schema.local.prisma --accept-data-loss 2>nul

echo.
echo [OK] SQLite database ready!
echo.

echo [1/2] Starting Agent in background...
start "ProfileOS Agent" cmd /c "cd agent && npm start"

echo [2/2] Starting UI server (Turbopack)...
echo.
echo Opening http://localhost:3211 ...
timeout /t 3 /nobreak >nul
start http://localhost:3211

call npm run dev:3211

pause
