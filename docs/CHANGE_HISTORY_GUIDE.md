# Hướng dẫn sử dụng Change History (Lịch sử thay đổi)

## Tổng quan

Tính năng Change History tự động ghi lại tất cả các thay đổi của Account và Profile, bao gồm:
- Thay đổi password
- Thay đổi profile
- Thay đổi proxy
- Thay đổi status
- Thay đổi notes
- Thay đổi 2FA
- Và các thay đổi khác

## Cách xem lịch sử thay đổi

### Cho Account:

1. Mở trang **Accounts**
2. Click vào nút **"Sửa"** hoặc double-click vào một account để mở **Account Detail Modal**
3. Scroll xuống phần **"History"**
4. Click vào tab **"Change History"** (bên cạnh tab "Logs")
5. Bạn sẽ thấy danh sách tất cả các thay đổi của account đó

### Cho Profile:

(Tính năng tương tự sẽ được thêm vào Profile Detail Modal)

## Tính năng

### Xem lịch sử

- Mỗi bản ghi hiển thị:
  - **Loại thay đổi**: Password, Profile, Proxy, Status, Notes, 2FA, etc.
  - **Mô tả**: Mô tả chi tiết về thay đổi
  - **Giá trị cũ và mới**: Hiển thị giá trị trước và sau khi thay đổi
  - **Thời gian**: Ngày và giờ thay đổi
  - **Người thay đổi**: System hoặc user ID

### Xóa lịch sử

1. **Xóa một bản ghi cụ thể**:
   - Click vào icon 🗑️ bên cạnh bản ghi muốn xóa
   - Xác nhận xóa

2. **Xóa tất cả lịch sử**:
   - Click vào nút **"Xóa tất cả"** ở góc trên bên phải
   - Xác nhận xóa

## Các loại thay đổi được ghi lại

### Account:
- `password` - Thay đổi mật khẩu
- `identifier` - Thay đổi email/username
- `profile` - Thay đổi profile được gán
- `proxy` - Thay đổi proxy
- `status` - Thay đổi trạng thái (active, logged_out, error, etc.)
- `notes` - Thay đổi ghi chú
- `2fa` - Thay đổi 2FA secret key
- `login_method` - Thay đổi phương thức đăng nhập
- `label` - Thay đổi nhãn

### Profile:
- `name` - Thay đổi tên profile
- `proxy` - Thay đổi proxy
- `status` - Thay đổi trạng thái (idle, running, error, etc.)
- `group` - Thay đổi group
- `auto_reset_ip` - Thay đổi cài đặt auto reset IP

## Lưu ý bảo mật

- **Password và 2FA secret** được hiển thị dưới dạng `[REDACTED]` để bảo mật
- Chỉ hiển thị thông tin cần thiết, không hiển thị giá trị nhạy cảm

## API Endpoints

### Account Change History:

- `GET /api/accounts/:id/change-history` - Lấy lịch sử thay đổi
  - Query params: `limit`, `offset`, `changeType`
- `DELETE /api/accounts/:id/change-history` - Xóa lịch sử (có filter)
- `DELETE /api/accounts/:id/change-history/:historyId` - Xóa một bản ghi cụ thể

### Profile Change History:

- `GET /api/profiles/:id/change-history` - Lấy lịch sử thay đổi
- `DELETE /api/profiles/:id/change-history` - Xóa lịch sử
- `DELETE /api/profiles/:id/change-history/:historyId` - Xóa một bản ghi cụ thể

## Troubleshooting

### Không thấy lịch sử thay đổi

1. **Kiểm tra xem có thay đổi nào chưa**:
   - Thử cập nhật account (đổi password, notes, etc.)
   - Sau đó kiểm tra lại tab "Change History"

2. **Kiểm tra database**:
   ```bash
   node scripts/check-change-history.js
   ```

3. **Kiểm tra API**:
   - Mở browser console (F12)
   - Xem có lỗi khi fetch change history không

### Lịch sử không được ghi lại

1. **Kiểm tra xem tính năng có được bật**:
   - Tính năng tự động ghi lại khi update account/profile
   - Không cần cấu hình thêm

2. **Kiểm tra logs**:
   - Xem server logs có lỗi gì không
   - ChangeHistoryService sẽ log lỗi nhưng không throw để không ảnh hưởng flow chính

## Test

Để test tính năng:

1. Mở một account trong Account Detail Modal
2. Click vào tab "Change History"
3. Nếu chưa có lịch sử, thử cập nhật account (đổi password, notes, etc.)
4. Refresh modal và kiểm tra lại tab "Change History"
5. Bạn sẽ thấy các thay đổi vừa thực hiện

