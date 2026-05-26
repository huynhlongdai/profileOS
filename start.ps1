$Host.UI.RawUI.WindowTitle = "ProfileOS - Local Server (Port 3211)"
Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "    ProfileOS - Local Server" -ForegroundColor White
Write-Host "    http://localhost:3211" -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js not found! Install from https://nodejs.org" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Install dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "[SETUP] Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm install failed!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Check .env
if (-not (Test-Path ".env")) {
    Write-Host "[SETUP] Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "[INFO] Please edit .env with your database URL." -ForegroundColor Yellow
    notepad ".env"
}

# Generate Prisma
npx prisma generate 2>$null | Out-Null

# Build if needed
if (-not (Test-Path ".next")) {
    Write-Host "[BUILD] Building..." -ForegroundColor Yellow
    npm run build
}

Write-Host ""
Write-Host "Starting ProfileOS on http://localhost:3211 ..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

# Open browser
Start-Process "http://localhost:3211"

# Start server
npm run start:3211
