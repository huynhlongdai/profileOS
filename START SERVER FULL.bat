@echo off
REM File khoi dong server voi kiem tra GPMLogin va port
REM Double-click de chay

cd /d "%~dp0"
call start-server-full.bat
if %errorlevel% neq 0 (
    echo.
    echo Co loi xay ra. Nhan phim bat ky de thoat...
    pause >nul
)

