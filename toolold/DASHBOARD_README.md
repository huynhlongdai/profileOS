# Dashboard Web Local

Dashboard web để quản lý tài khoản Gmail một cách tiện lợi qua trình duyệt.

## 🚀 Khởi động Dashboard

### Cách 1: Chạy riêng Dashboard

```bash
python dashboard_server.py
```

Sau đó mở trình duyệt và truy cập: **http://localhost:5000**

### Cách 2: Chạy cùng với ứng dụng Tkinter

Bạn có thể chạy cả hai cùng lúc:
- Terminal 1: `python main.py` (Giao diện Tkinter)
- Terminal 2: `python dashboard_server.py` (Dashboard web)

Cả hai sẽ sử dụng chung database `gmail_accounts.db`.

## ✨ Tính năng Dashboard

### 1. Xem thống kê
- Tổng số tài khoản
- Số tài khoản đang hoạt động
- Số tài khoản bị đăng xuất
- Số tài khoản lỗi

### 2. Quản lý tài khoản
- **Thêm tài khoản**: Click nút "➕ Thêm tài khoản"
- **Xem danh sách**: Tự động hiển thị trong bảng
- **Kiểm tra**: Click icon 🔍 hoặc chọn nhiều và click "Kiểm tra tất cả"
- **Chăm sóc**: Click icon 💚 hoặc chọn nhiều và click "Chăm sóc đã chọn"
- **Xem logs**: Click icon 📋 để xem logs chi tiết
- **Xóa**: Click icon 🗑️ để xóa tài khoản

### 3. Tích hợp GPMLogin
- Click "Lấy danh sách" khi thêm tài khoản
- Chọn profile từ danh sách GPMLogin profiles

### 4. Auto-refresh
- Dashboard tự động làm mới dữ liệu mỗi 30 giây
- Hoặc click nút "🔄 Làm mới" để refresh ngay

## 📱 Truy cập từ xa (trong mạng local)

Dashboard chạy trên `0.0.0.0:5000`, có thể truy cập từ các thiết bị khác trong cùng mạng:

1. Tìm địa chỉ IP của máy:
   - Windows: `ipconfig` → tìm IPv4 Address
   - Mac/Linux: `ifconfig` hoặc `ip addr`

2. Truy cập từ thiết bị khác:
   ```
   http://[IP_ADDRESS]:5000
   ```
   Ví dụ: `http://192.168.1.100:5000`

## 🎨 Giao diện

- **Responsive**: Tự động điều chỉnh trên mobile/tablet
- **Modern UI**: Giao diện đẹp, dễ sử dụng
- **Real-time**: Cập nhật dữ liệu real-time
- **Notifications**: Thông báo khi thao tác thành công/lỗi

## 🔧 API Endpoints

Dashboard sử dụng các API endpoints:

- `GET /api/accounts` - Lấy danh sách tài khoản
- `POST /api/accounts` - Thêm tài khoản
- `DELETE /api/accounts/<id>` - Xóa tài khoản
- `POST /api/accounts/<id>/check` - Kiểm tra tài khoản
- `POST /api/accounts/check-all` - Kiểm tra tất cả
- `POST /api/accounts/<id>/care` - Chăm sóc tài khoản
- `GET /api/logs/<id>` - Lấy logs
- `GET /api/stats` - Lấy thống kê
- `GET /api/gpmlogin/profiles` - Lấy danh sách GPMLogin profiles

## ⚠️ Lưu ý

1. **Bảo mật**: Dashboard chạy local, không có authentication. Nếu truy cập từ xa, nên thêm firewall hoặc authentication.

2. **Port**: Mặc định port 5000. Nếu bị chiếm, có thể đổi trong `dashboard_server.py`:
   ```python
   app.run(host='0.0.0.0', port=5000)  # Đổi port ở đây
   ```

3. **Database**: Dashboard và Tkinter app dùng chung database, có thể chạy song song.

4. **GPMLogin**: Đảm bảo GPMLogin đang chạy và API accessible trước khi sử dụng tính năng liên quan.

## 🐛 Xử lý lỗi

### Lỗi "Address already in use"
Port 5000 đã bị sử dụng. Đổi port hoặc đóng ứng dụng đang dùng port đó.

### Lỗi kết nối GPMLogin
- Kiểm tra GPMLogin đang chạy
- Kiểm tra API URL trong `config.py`

### Dashboard không load
- Kiểm tra console browser (F12) để xem lỗi
- Kiểm tra terminal để xem lỗi server

## 💡 Tips

1. **Bookmark**: Bookmark dashboard để truy cập nhanh
2. **Mobile**: Dashboard responsive, có thể dùng trên mobile
3. **Multiple tabs**: Có thể mở nhiều tab để theo dõi nhiều thứ cùng lúc
4. **Auto-refresh**: Để tab mở, dashboard sẽ tự động refresh

---

**Chúc bạn sử dụng dashboard hiệu quả!** 🎉

