@echo off
echo ========================================
echo   GPM Tool EXE Compiler
echo   Su dung .NET Framework CSC
echo ========================================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: Tim C# Compiler
set "CSC_PATH="

:: Tim .NET Framework CSC
for %%v in (v4.0.30319 v3.5 v2.0.50727) do (
    if exist "C:\Windows\Microsoft.NET\Framework64\%%v\csc.exe" (
        set "CSC_PATH=C:\Windows\Microsoft.NET\Framework64\%%v\csc.exe"
        goto :FOUND
    )
    if exist "C:\Windows\Microsoft.NET\Framework\%%v\csc.exe" (
        set "CSC_PATH=C:\Windows\Microsoft.NET\Framework\%%v\csc.exe"
        goto :FOUND
    )
)

:FOUND
if not defined CSC_PATH (
    echo [ERROR] Khong tim thay C# Compiler (csc.exe)
    echo Vui long cai dat .NET Framework hoac Visual Studio
    pause
    exit /b 1
)

echo Tim thay compiler: %CSC_PATH%
echo.
echo Dang bien dich GPMToolLauncher.cs...
echo.

"%CSC_PATH%" /nologo /target:winexe /out:"..\GPMTool.exe" /reference:System.Windows.Forms.dll GPMToolLauncher.cs

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   [OK] Bien dich thanh cong!
    echo   File: ..\GPMTool.exe
    echo ========================================
    echo.
    echo Ban co the chay GPMTool.exe de khoi dong ung dung.
) else (
    echo.
    echo [ERROR] Bien dich that bai!
)

echo.
pause
