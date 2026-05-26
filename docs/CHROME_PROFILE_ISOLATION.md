# Chrome Profile Isolation

## Vấn đề

Khi có nhiều Chrome instances đang chạy, việc tạo hoặc mở Chrome profile mới có thể gặp xung đột do:

1. **Chrome Singleton Pattern**: Chrome thường chỉ cho phép một instance duy nhất với cùng một user data directory
2. **Lock Files**: Chrome tạo các lock files (`SingletonLock`, `SingletonSocket`, `SingletonCookie`) để ngăn nhiều instances cùng dùng một profile
3. **Background Services**: Các Chrome instances có thể chia sẻ background services (sync, metrics, etc.) gây xung đột

## Giải pháp đã triển khai

### 1. User Data Directory độc lập

Mỗi Chrome profile được tạo với một user data directory riêng biệt, đảm bảo hoàn toàn cô lập:

```typescript
// Profile path format: {sanitized_name}_{timestamp}
// Ví dụ: MyProfile_1766167280898
const profilePath = path.join(userDataDir, `${sanitizedName}_${timestamp}`)
```

### 2. Chrome Flags để tránh xung đột

Khi start Chrome, sử dụng các flags sau để đảm bảo mỗi instance chạy độc lập:

- `--user-data-dir`: Mỗi profile có directory riêng
- `--disable-sync`: Tắt Chrome sync để tránh xung đột
- `--disable-background-networking`: Tắt background networking
- `--disable-background-timer-throttling`: Tắt background timers
- `--metrics-recording-only`: Chỉ record metrics, không gửi
- `--password-store=basic`: Dùng basic password store
- `--disable-features=TranslateUI`: Tắt các features có thể gây xung đột

### 3. Xử lý Lock Files

Trước khi start Chrome, kiểm tra và xóa các lock files còn sót lại từ instance trước (nếu có):

```typescript
// Lock files to check:
// - SingletonLock
// - SingletonSocket  
// - SingletonCookie
```

### 4. Process Isolation

Mỗi Chrome instance được spawn như một process độc lập với PID riêng, được quản lý riêng biệt.

## Kết quả

- ✅ Mỗi Chrome profile chạy hoàn toàn độc lập
- ✅ Không bị ảnh hưởng bởi các Chrome instances khác đang chạy
- ✅ Có thể mở nhiều Chrome profiles đồng thời
- ✅ Mỗi profile có settings, cookies, và data riêng biệt

## Lưu ý

1. **Memory Usage**: Mỗi Chrome instance tiêu tốn RAM đáng kể (khoảng 200-500MB mỗi instance)
2. **CPU Usage**: Nhiều Chrome instances có thể làm tăng CPU usage
3. **Port Conflicts**: Mỗi instance cần một remote debugging port riêng (9222-9299)
4. **File System**: Mỗi profile chiếm ít nhất 50-100MB dung lượng ổ cứng

## Troubleshooting

### Nếu Chrome không mở được:

1. Kiểm tra xem có lock files không:
   ```powershell
   dir "C:\Users\<User>\AppData\Local\Google\Chrome\User Data\Profile_*" -Recurse -Filter "*Lock*"
   ```

2. Kill tất cả Chrome processes và thử lại:
   ```powershell
   taskkill /IM chrome.exe /F
   ```

3. Kiểm tra remote debugging port có bị chiếm không:
   ```powershell
   netstat -ano | findstr ":92"
   ```

### Nếu profile bị conflict:

1. Đảm bảo mỗi profile có `--user-data-dir` khác nhau
2. Đảm bảo mỗi profile có `--remote-debugging-port` khác nhau
3. Kiểm tra trong database xem `profilePath` là unique

