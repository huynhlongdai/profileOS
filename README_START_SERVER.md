# Hướng dẫn khởi động GPM Tool Server

## Cách khởi động nhanh (Khuyến nghị)

### Windows

**Double-click vào một trong các file sau:**

1. **`start-server.bat`** - File batch script (khuyến nghị)
2. **`start-server.cmd`** - File command script (tương tự)

Hoặc **double-click vào `START SERVER.bat`** nếu có.

### Tính năng tự động

Script sẽ tự động:

1. ✅ **Kiểm tra port 3211** - Xem port có đang được sử dụng không
2. ✅ **Tự động kill process** - Nếu port bị chiếm, tự động kill process đó
3. ✅ **Kiểm tra Node.js** - Xác nhận Node.js đã được cài đặt
4. ✅ **Kiểm tra dependencies** - Tự động cài đặt nếu thiếu
5. ✅ **Khởi động server** - Chạy server trên port 3211

## Cách sử dụng

1. **Double-click** vào `start-server.bat` hoặc `start-server.cmd`
2. Đợi script chạy (tự động kiểm tra và khởi động)
3. Mở browser và vào: **http://localhost:3211**

## Dừng server

- Nhấn **Ctrl+C** trong cửa sổ command prompt
- Hoặc đóng cửa sổ command prompt

## Troubleshooting

### Port vẫn bị chiếm

Nếu script không thể tự động kill process, bạn có thể làm thủ công:

```cmd
REM Tìm process đang dùng port
netstat -ano | findstr :3211

REM Kill process (thay <PID> bằng PID thực tế)
taskkill /PID <PID> /F
```

### Lỗi "Node.js not found"

Đảm bảo Node.js đã được cài đặt:
- Tải từ: https://nodejs.org/
- Cài đặt và restart máy tính
- Kiểm tra: `node --version` trong Command Prompt

### Lỗi "Dependencies not installed"

Script sẽ tự động cài đặt, nhưng nếu lỗi:
```cmd
npm install
```

### Lỗi khi chạy script

Nếu gặp lỗi encoding (ký tự lạ), thử:
1. Mở Command Prompt
2. Chạy: `chcp 65001`
3. Chạy lại script

## Các file khác

- `start.ps1` - PowerShell script (nâng cao hơn, có xác nhận)
- `start.bat` - Batch script gốc (có nhiều tính năng hơn)

## Lưu ý

- Server sẽ chạy trên port **3211** mặc định
- Để thay đổi port, sửa biến `PORT` trong script hoặc dùng `npm run dev -p <PORT>`
- Script sẽ tự động kill process nếu port bị chiếm (không hỏi xác nhận)

