# Quick Start Guide

## 🚀 Khởi động nhanh

### Bước 1: Tạo file .env

Tạo file `.env` trong thư mục gốc với nội dung:

```env
DATABASE_URL="file:./dev.db"
GPMLOGIN_API_URL="http://127.0.0.1:19995"
GPMLOGIN_API_VERSION="v3"
PROXY_API_SERVER_URL=""
NODE_ENV="development"
```

### Bước 2: Setup Database

```powershell
# Set environment variable
$env:DATABASE_URL="file:./dev.db"

# Generate Prisma Client (nếu chưa có)
npm run db:generate

# Push schema to database
npm run db:push
```

### Bước 3: Khởi động Server

```powershell
# Set environment variables
$env:DATABASE_URL="file:./dev.db"
$env:GPMLOGIN_API_URL="http://127.0.0.1:19995"
$env:GPMLOGIN_API_VERSION="v3"

# Start dev server
npm run dev
```

### Bước 4: Mở Browser

Truy cập: **http://localhost:3000**

## ✅ Kiểm tra

1. **Health Check**: http://localhost:3000/api/health
   - Nên trả về: `{"status":"ok","timestamp":"..."}`

2. **Dashboard**: http://localhost:3000/dashboard
   - Xem thống kê tổng quan

3. **Accounts**: http://localhost:3000/accounts
   - Quản lý tài khoản

4. **Profiles**: http://localhost:3000/profiles
   - Quản lý GPM profiles

## 🔧 Troubleshooting

### Lỗi "Module not found: playwright"
```powershell
npm install playwright
npx playwright install chromium
```

### Lỗi "Environment variable not found: DATABASE_URL"
- Đảm bảo đã tạo file `.env` hoặc set environment variable
- Chạy: `$env:DATABASE_URL="file:./dev.db"`

### Lỗi Prisma Client
```powershell
npm run db:generate
```

### Server không khởi động
- Kiểm tra port 3000 có bị chiếm không: `netstat -ano | findstr :3000`
- Đổi port: `$env:PORT=3001; npm run dev`

## 📝 Lưu ý

1. **GPMLogin**: Đảm bảo GPMLogin đang chạy trước khi test các tính năng liên quan
2. **Database**: File `dev.db` sẽ được tạo tự động khi chạy `db:push`
3. **Plugins**: Tự động khởi tạo khi truy cập API lần đầu

## 🎯 Test các tính năng

1. **Tạo Account**: Vào `/accounts`, click "Add Account"
2. **Sync Profiles**: Vào `/profiles`, click "Sync from GPMLogin"
3. **Check Account**: Click nút "Check" trên một account
4. **Xem Logs**: Vào `/logs` để xem logs chi tiết

