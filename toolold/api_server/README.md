# Gmail Monitor API Server

API server để theo dõi tình trạng Gmail accounts từ xa, deploy trên Vercel.

## Deploy lên Vercel

### Bước 1: Cài đặt Vercel CLI

```bash
npm i -g vercel
```

### Bước 2: Đăng nhập

```bash
vercel login
```

### Bước 3: Deploy

```bash
cd api_server
vercel deploy
```

### Bước 4: Lấy URL

Sau khi deploy, Vercel sẽ cung cấp URL. Cập nhật URL này trong `config.py` của ứng dụng chính:

```python
API_SERVER_URL = "https://your-app.vercel.app"
```

## API Endpoints

### GET /api/index?endpoint=accounts
Lấy danh sách tất cả tài khoản

### GET /api/index?endpoint=status&email={email}
Lấy trạng thái của một tài khoản cụ thể

### GET /api/index?endpoint=stats
Lấy thống kê tổng quan

### GET /api/index?endpoint=logs&email={email}&limit={limit}
Lấy logs của tài khoản

### POST /api/index?endpoint=update
Cập nhật trạng thái tài khoản

Body:
```json
{
  "email": "example@gmail.com",
  "status": "active",
  "lastCheck": "2024-01-01T00:00:00",
  "lastLogin": "2024-01-01T00:00:00",
  "lastCare": "2024-01-01T00:00:00",
  "timestamp": "2024-01-01T00:00:00"
}
```

## Lưu ý

API server hiện tại sử dụng in-memory storage, dữ liệu sẽ mất khi server restart.

Để production, nên:
1. Sử dụng Vercel Postgres
2. Hoặc Supabase
3. Hoặc MongoDB Atlas

## Dashboard

Dashboard web nằm trong `dashboard/index.html`. Có thể:
- Host trên Vercel cùng với API
- Hoặc host riêng trên GitHub Pages, Netlify, etc.

Cập nhật `API_URL` trong `dashboard/index.html` trước khi deploy.

