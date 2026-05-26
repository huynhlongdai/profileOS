@echo off
setlocal enabledelayedexpansion
title GPM Tool Server - Full Startup
color 0A

set SERVER_PORT=3211
set GPMLOGIN_PORT=19995
set GPMLOGIN_API_URL=http://127.0.0.1:%GPMLOGIN_PORT%

echo ========================================
echo    GPM Tool Server - Full Startup
echo    Server Port: %SERVER_PORT%
echo    GPMLogin Port: %GPMLOGIN_PORT%
echo ========================================
echo.

:CHECK_GPM
echo [1/5] Kiem tra GPMLogin (Port %GPMLOGIN_PORT%)...
netstat -ano | findstr ":%GPMLOGIN_PORT%" >nul 2>&1
if !errorlevel! equ 0 (
    echo    [OK] GPMLogin dang chay.
    goto :CHECK_SERVER_PORT
)

echo    [WARN] GPMLogin chua chay. Dang tim de khoi dong...

set "GPM_EXE="
if defined GPMLOGIN_EXE_PATH if exist "!GPMLOGIN_EXE_PATH!" set "GPM_EXE=!GPMLOGIN_EXE_PATH!"
if not defined GPM_EXE if exist "C:\Program Files\GPMLogin\GPMLogin.exe" set "GPM_EXE=C:\Program Files\GPMLogin\GPMLogin.exe"
if not defined GPM_EXE if exist "C:\Program Files (x86)\GPMLogin\GPMLogin.exe" set "GPM_EXE=C:\Program Files (x86)\GPMLogin\GPMLogin.exe"
if not defined GPM_EXE if exist "!LocalAppData!\GPMLogin\GPMLogin.exe" set "GPM_EXE=!LocalAppData!\GPMLogin\GPMLogin.exe"

if not defined GPM_EXE (
    echo    [ERROR] Khong tim thay GPMLogin.exe.
    goto :CHECK_SERVER_PORT
)

echo    Tim thay GPMLogin: !GPM_EXE!
echo    Dang khoi dong GPMLogin...
start "" "!GPM_EXE!"
echo    Doi 5 giay de GPMLogin san sang...
timeout /t 5 /nobreak >nul

:CHECK_SERVER_PORT
echo.
echo [2/5] Kiem tra port %SERVER_PORT%...
netstat -ano | findstr ":%SERVER_PORT%" >nul 2>&1
if !errorlevel! neq 0 (
    echo    [OK] Port %SERVER_PORT% dang trong.
    goto :CHECK_NODE
)

echo    [WARN] Port %SERVER_PORT% dang bi chiếm. Dang giai phong...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%SERVER_PORT%"') do (
    set "PID=%%a"
    echo    Dang kill PID: !PID!...
    taskkill /PID !PID! /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

:CHECK_NODE
echo.
echo [3/5] Kiem tra Node.js...
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo    [ERROR] Node.js chua duoc cai dat.
    pause
    exit /b 1
)
for /f "tokens=*" %%a in ('node --version') do set "NODE_VERSION=%%a"
echo    [OK] Node.js: !NODE_VERSION!

:CHECK_DEPS
echo.
echo [4/5] Kiem tra dependencies...
if not exist "node_modules" (
    echo    [WARN] node_modules khong ton tai. Dang install...
    call npm install
) else (
    echo    [OK] Dependencies da san sang.
)

:START_SERVER
echo.
echo [5/5] Khoi dong server...
echo ========================================
echo    Server dang khoi dong...
echo    URL: http://localhost:%SERVER_PORT%
echo    GPMLogin API: %GPMLOGIN_API_URL%
echo    Nhan Ctrl+C de dung server
echo ========================================
echo.

call npm run dev:3211

if !errorlevel! neq 0 (
    echo.
    echo [ERROR] Server da dung voi loi.
    pause
)
