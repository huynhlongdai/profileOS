@echo off
setlocal enabledelayedexpansion
set PORT=3211

echo ========================================
echo   GPM Tool Startup Script
echo   Port: %PORT%
echo ========================================
echo.

:CHECK_GPM
echo [1/4] Kiem tra GPMLogin (Port 19995)...
netstat -ano | findstr ":19995" >nul 2>&1
if !errorlevel! equ 0 (
    echo    [OK] GPMLogin dang chay.
    goto :CHECK_PORT
)

echo    [WARN] GPMLogin chua chay. Dang tim de khoi dong...

set "GPM_EXE="
if defined GPMLOGIN_EXE_PATH if exist "!GPMLOGIN_EXE_PATH!" set "GPM_EXE=!GPMLOGIN_EXE_PATH!"
if not defined GPM_EXE if exist "C:\GPMS\GPMLogin\GPMLogin.exe" set "GPM_EXE=C:\GPMS\GPMLogin\GPMLogin.exe"
if not defined GPM_EXE if exist "C:\Program Files\GPMLogin\GPMLogin.exe" set "GPM_EXE=C:\Program Files\GPMLogin\GPMLogin.exe"
if not defined GPM_EXE if exist "C:\Program Files (x86)\GPMLogin\GPMLogin.exe" set "GPM_EXE=C:\Program Files (x86)\GPMLogin\GPMLogin.exe"
if not defined GPM_EXE if exist "!LocalAppData!\GPMLogin\GPMLogin.exe" set "GPM_EXE=!LocalAppData!\GPMLogin\GPMLogin.exe"

if not defined GPM_EXE (
    echo    [ERROR] Khong tim thay GPMLogin.exe. Vui long mo thu cong.
    goto :CHECK_PORT
)

echo    Tim thay GPMLogin: !GPM_EXE!
echo    Dang khoi dong GPMLogin...
start "" "!GPM_EXE!"
echo    Doi 5 giay de GPMLogin khoi dong...
timeout /t 5 /nobreak >nul

:CHECK_PORT
echo.
echo [2/4] Kiem tra port %PORT%...
netstat -ano | findstr ":%PORT%" >nul 2>&1
if !errorlevel! neq 0 (
    echo    [OK] Port %PORT% dang trong.
    goto :CHECK_NODE
)

echo    [WARN] Port %PORT% dang bi chiem. Dang giai phong...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%"') do (
    set "PID=%%a"
    echo    Dang kill PID: !PID!...
    taskkill /PID !PID! /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

:CHECK_NODE
echo.
echo [3/4] Kiem tra Node.js...
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
echo [4/4] Kiem tra dependencies...
if not exist "node_modules" (
    echo    [WARN] node_modules khong ton tai. Dang install...
    call npm install
) else (
    echo    [OK] Dependencies da san sang.
)

:START_SERVER
echo.
echo ========================================
echo   Dang khoi dong GPM Tool...
echo   URL: http://localhost:%PORT%
echo ========================================
echo.

call npx next dev -p %PORT%

if !errorlevel! neq 0 (
    echo.
    echo [ERROR] Server dung dot ngot voi loi.
    pause
)
