# Script khoi dong GPM Tool Server voi kiem tra GPMLogin
# Tu dong kiem tra va kill process neu port bi chiem
# Tu dong khoi dong GPMLogin neu chua chay

$SERVER_PORT = 3211
$GPMLOGIN_PORT = 19995
$GPMLOGIN_API_URL = "http://127.0.0.1:$GPMLOGIN_PORT"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GPM Tool Server - Full Startup" -ForegroundColor Cyan
Write-Host "  Server Port: $SERVER_PORT" -ForegroundColor Cyan
Write-Host "  GPMLogin Port: $GPMLOGIN_PORT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ham kiem tra port co dang duoc su dung khong
function Test-Port {
    param([int]$Port)
    
    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        return $null -ne $connection
    } catch {
        return $false
    }
}

# Ham tim va kill process dang su dung port
function Stop-ProcessOnPort {
    param([int]$Port)
    
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($connections) {
            $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
            foreach ($pid in $pids) {
                $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "   Dang kill process: $($process.ProcessName) (PID: $pid)..." -ForegroundColor Yellow
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Seconds 1
                }
            }
        }
        return $true
    } catch {
        return $false
    }
}

# Ham tim GPMLogin executable
function Find-GPMLoginExecutable {
    $paths = @()
    
    # Kiem tra bien moi truong
    if ($env:GPMLOGIN_EXE_PATH -and (Test-Path $env:GPMLOGIN_EXE_PATH)) {
        return $env:GPMLOGIN_EXE_PATH
    }
    
    # Tim trong cac thu muc thong thuong
    $commonPaths = @(
        "$env:ProgramFiles\GPMLogin\GPMLogin.exe",
        "${env:ProgramFiles(x86)}\GPMLogin\GPMLogin.exe",
        "$env:LOCALAPPDATA\GPMLogin\GPMLogin.exe",
        "$PWD\GPMLogin.exe",
        "$PWD\gpm.exe",
        "$PWD\GPMLogin\GPMLogin.exe"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            return $path
        }
    }
    
    return $null
}

# ============================================
# Step 1: Kiem tra GPMLogin
# ============================================
Write-Host "[1/5] Kiem tra GPMLogin (Port $GPMLOGIN_PORT)..." -ForegroundColor Cyan

if (Test-Port -Port $GPMLOGIN_PORT) {
    Write-Host "   [OK] GPMLogin dang chay (Port $GPMLOGIN_PORT dang duoc su dung)" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "   [WARN] GPMLogin chua chay (Port $GPMLOGIN_PORT trong)" -ForegroundColor Yellow
    Write-Host "   Dang tim GPMLogin executable de khoi dong..." -ForegroundColor Yellow
    Write-Host ""
    
    $gpmloginPath = Find-GPMLoginExecutable
    
    if ($gpmloginPath) {
        Write-Host "   Tim thay GPMLogin: $gpmloginPath" -ForegroundColor Green
        Write-Host "   Dang khoi dong GPMLogin..." -ForegroundColor Yellow
        
        try {
            Start-Process -FilePath $gpmloginPath -ErrorAction Stop
            Write-Host "   [OK] Da khoi dong GPMLogin, doi 5 giay de khoi dong..." -ForegroundColor Green
            Start-Sleep -Seconds 5
            
            # Kiem tra lai
            if (Test-Port -Port $GPMLOGIN_PORT) {
                Write-Host "   [OK] GPMLogin da khoi dong thanh cong" -ForegroundColor Green
            } else {
                Write-Host "   [WARN] GPMLogin co the chua san sang, nhung se tiep tuc..." -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   [ERROR] Loi khi khoi dong GPMLogin: $_" -ForegroundColor Red
            Write-Host "   Tiep tuc khoi dong server (GPMLogin co the khong san sang)..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "   [ERROR] Khong tim thay GPMLogin executable" -ForegroundColor Red
        Write-Host "   Vui long:" -ForegroundColor Yellow
        Write-Host "      1. Khoi dong GPMLogin thu cong, HOAC" -ForegroundColor Yellow
        Write-Host "      2. Set bien moi truong GPMLOGIN_EXE_PATH tro den file GPMLogin.exe" -ForegroundColor Yellow
        Write-Host "      Vi du: `$env:GPMLOGIN_EXE_PATH='C:\Program Files\GPMLogin\GPMLogin.exe'" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   Tiep tuc khoi dong server (GPMLogin co the khong san sang)..." -ForegroundColor Yellow
    }
    Write-Host ""
}

# ============================================
# Step 2: Kiem tra va kill port server
# ============================================
Write-Host "[2/5] Kiem tra port $SERVER_PORT..." -ForegroundColor Cyan

if (Test-Port -Port $SERVER_PORT) {
    Write-Host "   [WARN] Port $SERVER_PORT dang duoc su dung!" -ForegroundColor Yellow
    Write-Host "   Dang tim va kill process..." -ForegroundColor Yellow
    Write-Host ""
    
    $killed = Stop-ProcessOnPort -Port $SERVER_PORT
    Start-Sleep -Seconds 2
    
    # Kiem tra lai
    if (Test-Port -Port $SERVER_PORT) {
        Write-Host "   [ERROR] Port van con duoc su dung sau khi kill process" -ForegroundColor Red
        Write-Host "   Vui long kiem tra thu cong:" -ForegroundColor Yellow
        Write-Host "   Get-NetTCPConnection -LocalPort $SERVER_PORT | Select-Object OwningProcess" -ForegroundColor Yellow
        Write-Host "   Stop-Process -Id <PID> -Force" -ForegroundColor Yellow
        Read-Host "Nhan Enter de thoat"
        exit 1
    } else {
        Write-Host "   [OK] Port $SERVER_PORT da duoc giai phong" -ForegroundColor Green
    }
} else {
    Write-Host "   [OK] Port $SERVER_PORT dang trong" -ForegroundColor Green
}
Write-Host ""

# ============================================
# Step 3: Kiem tra Node.js
# ============================================
Write-Host "[3/5] Kiem tra Node.js..." -ForegroundColor Cyan

$nodePath = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodePath) {
    Write-Host "   [ERROR] Node.js chua duoc cai dat!" -ForegroundColor Red
    Write-Host "   Vui long cai dat Node.js tu https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Nhan Enter de thoat"
    exit 1
}

$nodeVersion = node --version
Write-Host "   [OK] Node.js: $nodeVersion" -ForegroundColor Green
Write-Host ""

# ============================================
# Step 4: Kiem tra dependencies
# ============================================
Write-Host "[4/5] Kiem tra dependencies..." -ForegroundColor Cyan

if (-not (Test-Path "node_modules")) {
    Write-Host "   [WARN] node_modules khong ton tai" -ForegroundColor Yellow
    Write-Host "   Dang cai dat dependencies..." -ForegroundColor Yellow
    Write-Host ""
    
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   [ERROR] Loi khi cai dat dependencies" -ForegroundColor Red
        Read-Host "Nhan Enter de thoat"
        exit 1
    }
    Write-Host "   [OK] Da cai dat dependencies" -ForegroundColor Green
} else {
    Write-Host "   [OK] Dependencies da duoc cai dat" -ForegroundColor Green
}
Write-Host ""

# ============================================
# Step 5: Khoi dong server
# ============================================
Write-Host "[5/5] Khoi dong server..." -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Server dang khoi dong..." -ForegroundColor Cyan
Write-Host "  URL: http://localhost:$SERVER_PORT" -ForegroundColor Cyan
Write-Host "  GPMLogin API: $GPMLOGIN_API_URL" -ForegroundColor Cyan
Write-Host "  Nhan Ctrl+C de dung server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Chay server
npm run dev:3211

# Neu server dung, giu cua so mo
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Server da dung voi loi" -ForegroundColor Red
    Read-Host "Nhan Enter de thoat"
}
