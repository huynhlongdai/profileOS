@echo off
echo ========================================
echo   GPM Tool EXE Builder
echo   Su dung IExpress (Windows built-in)
echo ========================================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo Tao file cau hinh IExpress...

(
echo [Version]
echo Class=IEXPRESS
echo SEDVersion=3
echo [Options]
echo PackagePurpose=InstallApp
echo ShowInstallProgramWindow=0
echo HideExtractAnimation=1
echo UseLongFileName=1
echo InsideCompressed=0
echo CAB_FixedSize=0
echo CAB_ResvCodeSigning=0
echo RebootMode=N
echo InstallPrompt=
echo DisplayLicense=
echo FinishMessage=
echo TargetName=%SCRIPT_DIR%GPMTool.exe
echo FriendlyName=GPM Tool Launcher
echo AppLaunched=cmd /c start.bat
echo PostInstallCmd=^<None^>
echo AdminQuietInstCmd=
echo UserQuietInstCmd=
echo SourceFiles=SourceFiles
echo [Strings]
echo FILE0="start.bat"
echo [SourceFiles]
echo SourceFiles0=%SCRIPT_DIR%
echo [SourceFiles0]
echo %%FILE0%%=
) > "%SCRIPT_DIR%gpmtool.sed"

echo.
echo Dang tao file GPMTool.exe...
iexpress /N /Q "%SCRIPT_DIR%gpmtool.sed"

if exist "%SCRIPT_DIR%GPMTool.exe" (
    echo.
    echo ========================================
    echo   [OK] Tao thanh cong: GPMTool.exe
    echo ========================================
    del "%SCRIPT_DIR%gpmtool.sed" 2>nul
) else (
    echo.
    echo [ERROR] Khong the tao file EXE.
    echo Thu phuong phap khac...
    goto :ALT_METHOD
)
goto :END

:ALT_METHOD
echo.
echo Dang tao launcher bang PowerShell...

powershell -Command ^
"$code = @'" ^
Add-Type -TypeDefinition @\" ^
using System; ^
using System.Diagnostics; ^
public class Launcher { ^
    public static void Main() { ^
        string dir = System.IO.Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location); ^
        ProcessStartInfo psi = new ProcessStartInfo(); ^
        psi.FileName = \"cmd.exe\"; ^
        psi.Arguments = \"/c start.bat\"; ^
        psi.WorkingDirectory = dir; ^
        psi.UseShellExecute = false; ^
        Process.Start(psi); ^
    } ^
} ^
\"@ -OutputAssembly GPMTool.exe -OutputType ConsoleApplication ^
'@" 

echo.
if exist "%SCRIPT_DIR%GPMTool.exe" (
    echo [OK] Tao thanh cong: GPMTool.exe
) else (
    echo [INFO] Vui long su dung Visual Studio hoac .NET SDK de build EXE.
)

:END
del "%SCRIPT_DIR%gpmtool.sed" 2>nul
echo.
pause
