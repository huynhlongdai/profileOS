# Ứng dụng Quản lý Gmail với GPMLogin

Ứng dụng giúp quản lý và giám sát nhiều tài khoản Gmail, phát hiện khi tài khoản bị đăng xuất hoặc xóa. Tích hợp với GPMLogin browser để quản lý nhiều profile trình duyệt và tự động chăm sóc tài khoản để tránh bị die.

## ✨ Tính năng

- ✅ **Quản lý nhiều tài khoản Gmail** - Thêm, xóa, theo dõi nhiều tài khoản
- ✅ **Tích hợp GPMLogin API** - Quản lý profiles trình duyệt qua API
- ✅ **Tự động kiểm tra trạng thái** - Kiểm tra định kỳ tài khoản có bị đăng xuất không
- ✅ **Tự động đăng nhập lại** - Tự động đăng nhập khi phát hiện bị đăng xuất
- ✅ **Chăm sóc tài khoản tự động** - Đọc email, tương tác, tìm kiếm để giữ tài khoản hoạt động
- ✅ **Tự động tạo GPMLogin Profile** - Tự động tạo profile mới khi thêm email
- ✅ **Tự động gán Proxy** - Tự động gán proxy từ thư viện vào profile
- ✅ **Quản lý Proxy** - Quản lý thư viện proxy từ file hoặc database
- ✅ **Ghi log chi tiết** - Lưu lại tất cả các sự kiện
- ✅ **Giao diện đồ họa** - Dễ sử dụng với Tkinter
- ✅ **Dashboard web** - Xem tình trạng từ xa qua Vercel
- ✅ **API Server** - Đồng bộ dữ liệu lên cloud

## 📋 Yêu cầu

- Python 3.8+
- GPMLogin browser đã cài đặt và đang chạy
- Chrome/Chromium browser
- Node.js 18+ (cho API server trên Vercel)

## 🚀 Cài đặt

### 1. Cài đặt Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Cài đặt GPMLogin

1. Tải GPMLogin từ [https://gpmloginapp.com](https://gpmloginapp.com)
2. Cài đặt và khởi động GPMLogin
3. Đảm bảo GPMLogin API đang chạy tại `http://127.0.0.1:19995`

### 3. Cấu hình

Tạo file `.env` (tùy chọn):

```env
GPMLOGIN_API_URL=http://127.0.0.1:19995
API_SERVER_URL=https://your-app.vercel.app
SYNC_TO_SERVER=true
ALERT_EMAIL=your-email@example.com
```

Hoặc chỉnh sửa trực tiếp trong `config.py`.

## 💻 Sử dụng

### Chạy ứng dụng chính (Giao diện Tkinter)

```bash
python main.py
```

### Chạy Dashboard Web (Khuyến nghị)

```bash
python dashboard_server.py
```

Sau đó mở trình duyệt và truy cập: **http://localhost:5000**

Dashboard web có nhiều tính năng hơn và dễ sử dụng hơn:
- ✅ Giao diện đẹp, hiện đại
- ✅ Responsive (dùng được trên mobile)
- ✅ Auto-refresh mỗi 30 giây
- ✅ Quản lý tài khoản trực quan
- ✅ Xem logs chi tiết
- ✅ Truy cập từ xa trong mạng local

Xem chi tiết: [DASHBOARD_README.md](DASHBOARD_README.md)

### Thêm tài khoản

1. Nhập email và password
2. **Tự động tạo Profile** (mặc định bật):
   - Ứng dụng tự động tạo GPMLogin profile mới
   - Tên profile: `Gmail_{username}`
3. **Tự động gán Proxy** (mặc định bật):
   - Tự động chọn proxy chưa sử dụng từ thư viện
   - Hoặc nhập proxy thủ công: `ip:port` hoặc `ip:port:user:pass`
4. Click "Thêm tài khoản"

**Lưu ý**: 
- Tạo file `proxies.txt` để thêm danh sách proxy (xem `proxies.txt.example`)
- Xem chi tiết: [PROXY_GUIDE.md](PROXY_GUIDE.md)

### Kiểm tra tài khoản

- **Kiểm tra tất cả**: Click "Kiểm tra tất cả" để kiểm tra tất cả tài khoản
- **Kiểm tra đã chọn**: Chọn tài khoản và click "Kiểm tra đã chọn"
- **Tự động**: Ứng dụng tự động kiểm tra mỗi giờ (có thể thay đổi trong `config.py`)

### Chăm sóc tài khoản

- Click "Chăm sóc đã chọn" để thực hiện các hành động chăm sóc:
  - Đọc email mới
  - Tương tác với email (star, archive)
  - Tìm kiếm email
  - Duyệt các thư mục
  - Tạo draft email

Ứng dụng tự động chăm sóc tài khoản sau mỗi lần kiểm tra thành công (tối thiểu 6 giờ giữa các lần).

## 🌐 Deploy API Server lên Vercel

### Bước 1: Chuẩn bị

1. Cài đặt Vercel CLI:
```bash
npm i -g vercel
```

2. Đăng nhập Vercel:
```bash
vercel login
```

### Bước 2: Deploy

1. Vào thư mục api_server:
```bash
cd api_server
```

2. Deploy:
```bash
vercel deploy
```

3. Lấy URL và cập nhật trong `config.py`:
```python
API_SERVER_URL = "https://your-app.vercel.app"
```

### Bước 3: Sử dụng Dashboard

1. Upload `api_server/dashboard/index.html` lên Vercel hoặc host riêng
2. Cập nhật `API_URL` trong `dashboard/index.html` thành URL Vercel của bạn
3. Truy cập dashboard để xem tình trạng từ xa

### Lưu ý về Database

API server hiện tại sử dụng in-memory storage (mất dữ liệu khi restart). Để production:

1. Sử dụng **Vercel Postgres**:
   - Tạo Postgres database trên Vercel
   - Cập nhật connection string trong `api_server/api/index.js`

2. Hoặc sử dụng **Supabase**:
   - Tạo project trên Supabase
   - Sử dụng Supabase client trong API

## 📁 Cấu trúc dự án

```
Gmail/
├── requirements.txt          # Python dependencies
├── config.py                 # Cấu hình
├── database.py               # Quản lý SQLite database
├── gpmlogin_manager.py       # Quản lý GPMLogin API
├── gmail_care.py             # Chăm sóc tài khoản Gmail
├── gmail_monitor.py          # Giám sát tài khoản
├── main.py                   # Giao diện chính
├── gmail_accounts.db         # SQLite database (tự động tạo)
├── api_server/               # API server cho Vercel
│   ├── package.json
│   ├── vercel.json
│   ├── api/
│   │   ├── index.js          # API chính
│   │   └── status.js          # Endpoint status
│   └── dashboard/
│       └── index.html         # Dashboard web
└── README.md
```

## 🔧 Cấu hình nâng cao

### Thay đổi khoảng thời gian kiểm tra

Trong `config.py`:
```python
CHECK_INTERVAL_MINUTES = 60  # Kiểm tra mỗi 60 phút
```

### Thay đổi khoảng thời gian chăm sóc

```python
CARE_INTERVAL_HOURS = 24  # Chăm sóc mỗi 24 giờ
MIN_CARE_INTERVAL_HOURS = 6  # Tối thiểu 6 giờ giữa các lần
```

### Tắt/bật chăm sóc tự động

```python
CARE_ENABLED = True  # True để bật, False để tắt
```

## 📊 GPMLogin API

Ứng dụng sử dụng GPMLogin API theo tài liệu: [https://docs.gpmloginapp.com/api-document](https://docs.gpmloginapp.com/api-document)

### Các endpoint được sử dụng:

- `GET /api/v3/profiles` - Lấy danh sách profiles
- `GET /api/v3/profiles/{id}` - Lấy thông tin profile
- `GET /api/v3/profiles/start/{id}` - Mở profile
- `GET /api/v3/profiles/stop/{id}` - Đóng profile
- `POST /api/v3/profiles` - Tạo profile mới

## ⚠️ Lưu ý quan trọng

1. **Tuân thủ chính sách Google**: Đảm bảo các hoạt động tự động không vi phạm điều khoản dịch vụ của Google

2. **Bảo mật**: 
   - Không chia sẻ file `.env` hoặc `config.py` chứa thông tin nhạy cảm
   - Sử dụng proxy cho mỗi profile để tăng bảo mật
   - Mã hóa password trong database (có thể mở rộng)

3. **GPMLogin**: 
   - Đảm bảo GPMLogin đang chạy trước khi sử dụng ứng dụng
   - API URL mặc định: `http://127.0.0.1:19995`

4. **Database**: 
   - SQLite database được tạo tự động tại `gmail_accounts.db`
   - Backup database thường xuyên

5. **ChromeDriver**: 
   - Selenium sẽ tự động tải ChromeDriver nếu cần
   - Hoặc cài đặt thủ công và chỉ định đường dẫn

## 🐛 Xử lý lỗi thường gặp

### Lỗi kết nối GPMLogin API

- Kiểm tra GPMLogin đang chạy
- Kiểm tra API URL trong `config.py`
- Kiểm tra firewall/antivirus

### Lỗi đăng nhập Gmail

- Kiểm tra email/password đúng
- Có thể cần xác thực 2FA
- Google có thể yêu cầu xác minh

### Lỗi Selenium/ChromeDriver

- Cập nhật Chrome browser
- Cài đặt ChromeDriver thủ công
- Kiểm tra version compatibility

## 📝 License

MIT License

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Vui lòng tạo issue hoặc pull request.

## 📞 Hỗ trợ

Nếu gặp vấn đề, vui lòng tạo issue trên GitHub hoặc liên hệ qua email.

---

**Chúc bạn sử dụng ứng dụng hiệu quả!** 🚀

