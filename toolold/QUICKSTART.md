# Hướng dẫn nhanh

## Bước 1: Cài đặt

```bash
# Cài đặt Python dependencies
pip install -r requirements.txt
```

## Bước 2: Khởi động GPMLogin

1. Mở GPMLogin browser
2. Đảm bảo API đang chạy tại `http://127.0.0.1:19995`

## Bước 3: Chạy ứng dụng

```bash
python main.py
```

## Bước 4: Thêm tài khoản

1. Nhập email và password
2. (Tùy chọn) Click "Lấy danh sách Profiles" để chọn GPMLogin profile
3. Click "Thêm tài khoản"

## Bước 5: Kiểm tra tài khoản

- Click "Kiểm tra tất cả" để kiểm tra ngay
- Hoặc đợi tự động kiểm tra (mỗi giờ)

## Tính năng chăm sóc tự động

Ứng dụng sẽ tự động:
- Đọc email mới
- Tương tác với email (star, archive)
- Tìm kiếm email
- Duyệt các thư mục
- Tạo draft email

Sau mỗi lần kiểm tra thành công, nếu đã đủ thời gian (mặc định 6 giờ), sẽ tự động chăm sóc.

## Deploy API Server (Tùy chọn)

Nếu muốn xem tình trạng từ xa:

```bash
cd api_server
npm install -g vercel
vercel login
vercel deploy
```

Sau đó cập nhật URL trong `config.py`:
```python
API_SERVER_URL = "https://your-app.vercel.app"
```

## Lưu ý

- Đảm bảo GPMLogin đang chạy trước khi sử dụng
- Tuân thủ chính sách của Google
- Backup database thường xuyên (`gmail_accounts.db`)

