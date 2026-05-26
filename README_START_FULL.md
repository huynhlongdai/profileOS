# Hướng dẫn khởi động Server đầy đủ (với kiểm tra GPMLogin)

Script khởi động server với các tính năng:
- ✅ Kiểm tra GPMLogin có đang chạy không (port 19995)
- ✅ Tự động khởi động GPMLogin nếu chưa chạy
- ✅ Kiểm tra port server (3211) có bị chiếm không
- ✅ Tự động kill process nếu port bị chiếm
- ✅ Kiểm tra Node.js và dependencies
- ✅ Khởi động server

## Cách sử dụng

### Windows Batch (Khuyến nghị)

1. **Double-click vào file `START SERVER FULL.bat`** (file có icon)
2. Hoặc mở Command Prompt và chạy:
   ```cmd
   start-server-full.bat
   ```

### Windows PowerShell

1. Mở PowerShell trong thư mục project
2. Chạy lệnh:
   ```powershell
   .\start-server-full.ps1
   ```

## Cấu hình GPMLogin

Script sẽ tự động tìm GPMLogin trong các thư mục:
- `%ProgramFiles%\GPMLogin\GPMLogin.exe`
- `%ProgramFiles(x86)%\GPMLogin\GPMLogin.exe`
- Thư mục hiện tại (`GPMLogin.exe`, `gpm.exe`)

Nếu không tìm thấy, bạn có thể set biến môi trường:

**Windows Command Prompt:**
```cmd
set GPMLOGIN_EXE_PATH=C:\Program Files\GPMLogin\GPMLogin.exe
```

**PowerShell:**
```powershell
$env:GPMLOGIN_EXE_PATH = "C:\Program Files\GPMLogin\GPMLogin.exe"
```

**Windows (Permanent):**
1. Mở System Properties → Environment Variables
2. Thêm biến `GPMLOGIN_EXE_PATH` với giá trị đường dẫn đến GPMLogin.exe

## Quy trình khởi động

Script sẽ thực hiện theo thứ tự:

1. **Kiểm tra GPMLogin (Port 19995)**
   - Nếu đang chạy: Bỏ qua
   - Nếu chưa chạy: Tìm và khởi động GPMLogin

2. **Kiểm tra Port Server (3211)**
   - Nếu trống: Tiếp tục
   - Nếu bị chiếm: Kill process và tiếp tục

3. **Kiểm tra Node.js**
   - Nếu chưa cài: Thông báo lỗi và dừng
   - Nếu đã cài: Tiếp tục

4. **Kiểm tra Dependencies**
   - Nếu thiếu: Tự động cài đặt `npm install`
   - Nếu đủ: Tiếp tục

5. **Khởi động Server**
   - Chạy `npm run dev:3211`
   - Server sẽ chạy trên http://localhost:3211

## Troubleshooting

### GPMLogin không tìm thấy

**Vấn đề:** Script không tìm thấy GPMLogin executable

**Giải pháp:**
1. Kiểm tra GPMLogin đã được cài đặt chưa
2. Set biến môi trường `GPMLOGIN_EXE_PATH` trỏ đến file GPMLogin.exe
3. Hoặc khởi động GPMLogin thủ công trước khi chạy script

### GPMLogin không khởi động được

**Vấn đề:** Script tìm thấy GPMLogin nhưng không khởi động được

**Giải pháp:**
1. Kiểm tra quyền truy cập file
2. Khởi động GPMLogin thủ công
3. Kiểm tra Windows Firewall/Antivirus có block không

### Port vẫn bị chiếm sau khi kill

**Vấn đề:** Script kill process nhưng port vẫn bị chiếm

**Giải pháp:**
1. Kiểm tra thủ công:
   ```cmd
   netstat -ano | findstr :3211
   ```
2. Kill process thủ công:
   ```cmd
   taskkill /PID <PID> /F
   ```
3. Hoặc restart máy tính

### Lỗi "Node.js not found"

**Giải pháp:**
1. Cài đặt Node.js từ https://nodejs.org/
2. Đảm bảo Node.js có trong PATH
3. Restart terminal sau khi cài đặt

### Lỗi "Dependencies not installed"

**Giải pháp:**
```cmd
npm install
```

## Ports

- **Server Port:** 3211 (có thể thay đổi trong script)
- **GPMLogin API Port:** 19995 (mặc định, có thể thay đổi trong GPMLogin settings)

## Lưu ý

- Script sẽ tự động kill process đang sử dụng port 3211
- GPMLogin cần thời gian để khởi động (5 giây)
- Nếu GPMLogin chưa sẵn sàng, server vẫn khởi động nhưng các tính năng liên quan đến GPMLogin sẽ không hoạt động

