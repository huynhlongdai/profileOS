@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title GPM Tool Server - Port 3211
color 0A

echo.
echo ========================================
echo    GPM Tool Server Startup
echo    Port: 3211
echo ========================================
echo.

REM Kiểm tra và kill port 3211 nếu đang được sử dụng
echo [1/4] Kiểm tra port 3211...
netstat -ano | findstr ":3211" >nul 2>&1
if %errorlevel% equ 0 (
    echo    ⚠ Port 3211 đang được sử dụng!
    echo    Đang tìm và kill process...
    echo.
    
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3211"') do (
        set PID=%%a
        echo    Tìm thấy PID: !PID!
        taskkill /PID !PID! /F >nul 2>&1
        if !errorlevel! equ 0 (
            echo    ✓ Đã kill process PID: !PID!
        ) else (
            echo    ⚠ Không thể kill PID: !PID!
        )
    )
    
    timeout /t 2 /nobreak >nul
    echo.
) else (
    echo    ✓ Port 3211 đang trống
    echo.
)

REM Kiểm tra Node.js
echo [2/4] Kiểm tra Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo    ❌ Node.js chưa được cài đặt!
    echo    Vui lòng cài đặt Node.js từ https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%a in ('node --version') do set NODE_VERSION=%%a
echo    ✓ Node.js: %NODE_VERSION%
echo.

REM Kiểm tra dependencies
echo [3/4] Kiểm tra dependencies...
if not exist "node_modules" (
    echo    ⚠ node_modules không tồn tại
    echo    Đang cài đặt dependencies...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo    ❌ Lỗi khi cài đặt dependencies
        pause
        exit /b 1
    )
    echo    ✓ Đã cài đặt dependencies
) else (
    echo    ✓ Dependencies đã được cài đặt
)
echo.

REM Khởi động server
echo [4/4] Khởi động server...
echo.
echo ========================================
echo    Server đang khởi động...
echo    URL: http://localhost:3211
echo    Nhấn Ctrl+C để dừng server
echo ========================================
echo.

REM Chạy server
call npm run dev:3211

REM Nếu server dừng, giữ cửa sổ mở
if %errorlevel% neq 0 (
    echo.
    echo ❌ Server đã dừng với lỗi
    pause
)

