# Script khởi động GPM Tool trên port 3211
# Tự động kiểm tra và kill process nếu port đang được sử dụng

$PORT = 3211

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GPM Tool Startup Script" -ForegroundColor Cyan
Write-Host "  Port: $PORT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Hàm kiểm tra port có đang được sử dụng không
function Test-Port {
    param([int]$Port)
    
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
        return $connection
    } catch {
        return $false
    }
}

# Hàm tìm và kill process đang sử dụng port
function Kill-ProcessOnPort {
    param([int]$Port)
    
    Write-Host "Đang tìm process sử dụng port $Port..." -ForegroundColor Yellow
    
    try {
        # Sử dụng netstat để tìm process
        $netstatOutput = netstat -ano | Select-String ":$Port\s"
        
        if ($netstatOutput) {
            $processIds = $netstatOutput | ForEach-Object {
                $line = $_.ToString().Trim()
                $parts = $line -split '\s+'
                $pid = $parts[-1]
                if ($pid -match '^\d+$') {
                    return [int]$pid
                }
            } | Where-Object { $_ -ne $null } | Select-Object -Unique
            
            foreach ($pid in $processIds) {
                try {
                    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-Host "  Tìm thấy process: $($process.ProcessName) (PID: $pid)" -ForegroundColor Yellow
                        Write-Host "  Đang kill process..." -ForegroundColor Yellow
                        Stop-Process -Id $pid -Force -ErrorAction Stop
                        Write-Host "  ✓ Đã kill process PID: $pid" -ForegroundColor Green
                        Start-Sleep -Seconds 1
                    }
                } catch {
                    Write-Host "  ⚠ Không thể kill process PID: $pid - $($_.Exception.Message)" -ForegroundColor Red
                }
            }
            
            # Đợi một chút để port được giải phóng
            Start-Sleep -Seconds 2
            
            # Kiểm tra lại port
            if (Test-Port -Port $Port) {
                Write-Host "  ⚠ Port vẫn còn được sử dụng sau khi kill process" -ForegroundColor Red
                return $false
            } else {
                Write-Host "  ✓ Port đã được giải phóng" -ForegroundColor Green
                return $true
            }
        } else {
            Write-Host "  ✓ Không tìm thấy process nào sử dụng port $Port" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Host "  ⚠ Lỗi khi kiểm tra port: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Kiểm tra port
Write-Host "[1/3] Kiểm tra port $PORT..." -ForegroundColor Cyan

if (Test-Port -Port $PORT) {
    Write-Host "  ⚠ Port $PORT đang được sử dụng!" -ForegroundColor Yellow
    Write-Host ""
    
    # Hỏi người dùng có muốn kill process không
    $response = Read-Host "  Bạn có muốn kill process đang sử dụng port này? (Y/N)"
    
    if ($response -eq 'Y' -or $response -eq 'y') {
        $killed = Kill-ProcessOnPort -Port $PORT
        if (-not $killed) {
            Write-Host ""
            Write-Host "❌ Không thể giải phóng port $PORT. Vui lòng kiểm tra thủ công." -ForegroundColor Red
            Write-Host "   Bạn có thể sử dụng lệnh sau để tìm và kill process:" -ForegroundColor Yellow
            Write-Host "   netstat -ano | findstr :$PORT" -ForegroundColor Yellow
            Write-Host "   taskkill /PID <PID> /F" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "  Đã hủy. Thoát script." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "  ✓ Port $PORT đang trống" -ForegroundColor Green
}

Write-Host ""

# Kiểm tra Node.js
Write-Host "[2/3] Kiểm tra Node.js..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version
    Write-Host "  ✓ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Node.js chưa được cài đặt hoặc không có trong PATH" -ForegroundColor Red
    Write-Host "     Vui lòng cài đặt Node.js từ https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Kiểm tra dependencies
Write-Host "[3/3] Kiểm tra dependencies..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules")) {
    Write-Host "  ⚠ node_modules không tồn tại. Đang cài đặt dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Lỗi khi cài đặt dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ Đã cài đặt dependencies" -ForegroundColor Green
} else {
    Write-Host "  ✓ Dependencies đã được cài đặt" -ForegroundColor Green
}

Write-Host ""

# Khởi động server
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Đang khởi động GPM Tool..." -ForegroundColor Cyan
Write-Host "  URL: http://localhost:$PORT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set biến môi trường PORT và khởi động
$env:PORT = $PORT
Write-Host "Đang khởi động Next.js trên port $PORT..." -ForegroundColor Green
Write-Host "Nhấn Ctrl+C để dừng server" -ForegroundColor Yellow
Write-Host ""

# Khởi động Next.js với port 3211
npx next dev -p $PORT
