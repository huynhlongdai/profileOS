# Hướng dẫn khởi động GPM Tool

## Khởi động với port 3211

### Windows PowerShell (Khuyến nghị)

1. Mở PowerShell trong thư mục project
2. Chạy lệnh:
   ```powershell
   .\start.ps1
   ```

Script sẽ tự động:
- ✅ Kiểm tra port 3211 có đang được sử dụng không
- ✅ Tự động kill process nếu port bị chiếm
- ✅ Kiểm tra Node.js và dependencies
- ✅ Khởi động server trên port 3211

### Windows Batch (.bat)

1. Double-click vào file `start.bat`
2. Hoặc mở Command Prompt và chạy:
   ```cmd
   start.bat
   ```

### Sử dụng npm script trực tiếp

Nếu bạn muốn khởi động trực tiếp mà không dùng script:

```bash
npm run dev:3211
```

## Lưu ý

- Script sẽ tự động kill process đang sử dụng port 3211 nếu phát hiện
- Nếu bạn muốn giữ process hiện tại, hãy sử dụng port khác
- Để thay đổi port, sửa biến `PORT` trong file script

## Troubleshooting

### Port vẫn bị chiếm sau khi kill

Nếu script không thể tự động kill process, bạn có thể làm thủ công:

**Windows:**
```cmd
REM Tìm process đang dùng port
netstat -ano | findstr :3211

REM Kill process (thay <PID> bằng PID thực tế)
taskkill /PID <PID> /F
```

**PowerShell:**
```powershell
# Tìm process
Get-NetTCPConnection -LocalPort 3211 | Select-Object OwningProcess

# Kill process (thay <PID> bằng PID thực tế)
Stop-Process -Id <PID> -Force
```

### Lỗi "Node.js not found"

Đảm bảo Node.js đã được cài đặt và có trong PATH:
```bash
node --version
npm --version
```

### Lỗi "Dependencies not installed"

Chạy lệnh cài đặt dependencies:
```bash
npm install
```

