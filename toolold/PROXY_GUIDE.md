# Hướng dẫn sử dụng Proxy

## Tổng quan

Ứng dụng hỗ trợ tự động gán proxy từ thư viện proxy vào GPMLogin profile khi tạo tài khoản mới.

## Cách thêm Proxy

### 1. Thêm qua file `proxies.txt`

Tạo file `proxies.txt` trong thư mục gốc của ứng dụng:

```
# Format: ip:port hoặc ip:port:username:password
192.168.1.1:8080
192.168.1.2:8080:user:pass
192.168.1.3:3128
http://192.168.1.4:8080
http://username:password@192.168.1.5:8080
socks5://192.168.1.6:1080
```

**Các format hỗ trợ:**
- `ip:port` - Proxy không cần authentication
- `ip:port:username:password` - Proxy có authentication
- `http://ip:port` - Với protocol
- `http://username:password@ip:port` - Với protocol và auth
- `socks5://ip:port` - SOCKS5 proxy

### 2. Thêm qua Dashboard Web

1. Mở Dashboard: http://localhost:5000
2. Click "Thêm tài khoản"
3. Nhập proxy vào ô "Proxy" hoặc click "Chọn từ thư viện"
4. Proxy sẽ được lưu tự động

### 3. Thêm qua API

```bash
POST /api/proxies
Content-Type: application/json

{
  "proxy": "192.168.1.1:8080:user:pass"
}
```

## Tự động gán Proxy

Khi thêm tài khoản mới:

1. **Tự động gán Proxy**: Bật checkbox "Tự động gán Proxy"
   - Ứng dụng sẽ tự động chọn proxy chưa sử dụng từ thư viện
   - Proxy sẽ được gán vào GPMLogin profile

2. **Gán Proxy thủ công**: Tắt checkbox và nhập proxy vào ô
   - Nhập proxy theo format: `ip:port` hoặc `ip:port:user:pass`
   - Proxy sẽ được gán vào profile khi tạo

## Tự động tạo Profile GPMLogin

Khi thêm tài khoản mới:

1. **Tự động tạo Profile**: Bật checkbox "Tự động tạo GPMLogin Profile"
   - Ứng dụng sẽ tự động tạo profile mới trên GPMLogin
   - Tên profile: `Gmail_{username}` (ví dụ: Gmail_john)
   - Profile sẽ được gán proxy nếu có

2. **Sử dụng Profile có sẵn**: Tắt checkbox và chọn profile từ danh sách
   - Click "Lấy danh sách Profiles" để xem danh sách
   - Chọn profile đã có sẵn

## Quản lý Proxy

### Xem danh sách Proxy

```bash
GET /api/proxies
```

### Đánh dấu Proxy đã sử dụng

Proxy sẽ tự động được đánh dấu "đã sử dụng" khi:
- Được gán vào tài khoản
- Được sử dụng để tạo profile

### Proxy chưa sử dụng

Ứng dụng sẽ ưu tiên chọn proxy chưa sử dụng khi tự động gán.

## Lưu ý

1. **Format Proxy**: Đảm bảo proxy đúng format, nếu không sẽ bị bỏ qua
2. **Proxy trùng lặp**: Proxy trùng sẽ không được thêm lại
3. **GPMLogin API**: Đảm bảo GPMLogin đang chạy trước khi tạo profile
4. **Proxy chất lượng**: Sử dụng proxy chất lượng tốt để tránh bị Google phát hiện

## Troubleshooting

### Proxy không được gán

- Kiểm tra format proxy đúng chưa
- Kiểm tra GPMLogin API đang chạy
- Xem logs trong dashboard để biết lỗi cụ thể

### Profile không được tạo

- Kiểm tra GPMLogin đang chạy
- Kiểm tra kết nối API
- Xem logs để biết lỗi

### Proxy bị từ chối

- Kiểm tra proxy còn hoạt động không
- Thử proxy khác
- Kiểm tra firewall/network

