# Google Sheets Sync – Hướng dẫn cài đặt

## Yêu cầu
- Tài khoản Google
- Google Spreadsheet (tạo mới hoặc dùng sẵn)

---

## Bước 1: Tạo Google Apps Script

1. Mở [Google Spreadsheet](https://sheets.google.com) → tạo sheet mới
2. Vào menu **Extensions → Apps Script**
3. Xóa code mẫu có sẵn
4. Copy toàn bộ nội dung file `Code.gs` và paste vào

## Bước 2: Cấu hình Secret Token

Trong file `Code.gs`, tìm dòng:
```javascript
var SECRET_TOKEN = 'your_secret_token_here';
```
Thay `your_secret_token_here` bằng một chuỗi bí mật của bạn, ví dụ: `gpmtool_sync_2024`

## Bước 3: Deploy Web App

1. Click **Deploy → New deployment**
2. Chọn **Type: Web app**
3. Cài đặt:
   - **Execute as**: Me (your Google account)
   - **Who has access**: Anyone
4. Click **Deploy** → **Authorize access** (đăng nhập Google của bạn)
5. Copy **Web App URL** (dạng: `https://script.google.com/macros/s/AKfycbxxx.../exec`)

## Bước 4: Cấu hình trong GPMTool

1. Mở GPMTool → vào **Settings → Google Sheets**
2. Dán **GAS Web App URL** vừa copy
3. Nhập **Secret Token** (khớp với `SECRET_TOKEN` trong Code.gs)
4. Click **Lưu cài đặt**
5. Click **Sync ngay** để test

## Kết quả

Sau khi sync, Google Spreadsheet sẽ có 2 tab:
- **Accounts**: danh sách tất cả accounts với status, notes, profile, proxy, last login
- **Profiles**: danh sách tất cả profiles với status, browser, proxy, group, last opened

Mỗi tab có format màu tự động:
- 🟢 **Active/Running**: xanh lá
- ⚫ **Idle/Logged out**: xám
- 🟡 **Starting**: vàng
- 🟠 **Stopping/Proxy error**: cam
- 🔴 **Error/Banned**: đỏ

---

## Lưu ý

- Mỗi lần sync sẽ **ghi đè** toàn bộ dữ liệu cũ trong sheet
- Dữ liệu **không chứa mật khẩu hay 2FA secret** (bảo mật)
- Thời gian hiển thị theo múi giờ **Việt Nam (GMT+7)**
- Nếu cần re-deploy (sau khi sửa code), phải tạo **New deployment** (không phải manage existing)
