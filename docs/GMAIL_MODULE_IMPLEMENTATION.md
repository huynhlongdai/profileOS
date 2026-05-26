# Gmail Module Implementation Summary

## ✅ Đã triển khai

### 1. Gmail Config (`src/plugins/gmail/gmailConfig.ts`)

- ✅ Định nghĩa `GmailModuleConfig` interface với các fields:
  - `minCareIntervalMinutes`: Khoảng tối thiểu giữa 2 lần care (phút)
  - `autoLoginIfLoggedOut`: Tự động login khi check thấy logged_out
  - `skipCareIfRecentlyLoggedInMinutes`: Bỏ qua care nếu vừa login gần đây
  - `randomBehaviorLevel`: Mức độ random behavior ('low' | 'medium' | 'high')

- ✅ Default config:
  ```typescript
  {
    minCareIntervalMinutes: 120,        // 2 giờ
    autoLoginIfLoggedOut: true,
    skipCareIfRecentlyLoggedInMinutes: 10,  // 10 phút
    randomBehaviorLevel: 'medium',
  }
  ```

- ✅ `parseGmailConfig()` function: Parse và validate config từ JSON string, fallback về default nếu lỗi

### 2. GmailService Updates (`src/plugins/gmail/GmailService.ts`)

- ✅ Constructor nhận dependencies (ModuleService, LogService, ProfileService, BrowserController)
- ✅ Thêm helper methods:
  - `getConfig()`: Lấy config từ ModuleService
  - `decryptPassword()`: Decrypt password (hiện tại return plaintext, TODO: implement encryption)
  - `minutesDiff()`: Tính khoảng cách giữa 2 dates (phút)

- ✅ `checkAccount()` cập nhật:
  - Đọc config từ ModuleService
  - Áp dụng `autoLoginIfLoggedOut`: nếu `true` thì tự login khi logged_out, nếu `false` thì chỉ set status và log warning

- ✅ `loginAccount()` cập nhật:
  - Sử dụng `decryptPassword()` helper
  - Error handling cải thiện

- ✅ `careAccount()` cập nhật:
  - Kiểm tra `minCareIntervalMinutes`: bỏ qua nếu quá sớm
  - Kiểm tra `skipCareIfRecentlyLoggedInMinutes`: bỏ qua nếu vừa login gần đây
  - Áp dụng `autoLoginIfLoggedOut`: tự login nếu chưa logged_in và config cho phép

### 3. Gmail Plugin Factory (`src/plugins/gmail/gmail_plugin.ts`)

- ✅ Tạo file mới với factory pattern
- ✅ `GmailPluginDeps` interface định nghĩa dependencies
- ✅ `createGmailPlugin()` function: Tạo plugin với dependency injection
- ✅ Plugin implement đầy đủ `AccountPlugin` interface

### 4. API Route (`src/app/api/modules/[name]/config/route.ts`)

- ✅ Tạo route `PATCH /api/modules/[name]/config`
- ✅ Validate và normalize config bằng `parseGmailConfig()`
- ✅ Lưu config vào database qua `ModuleService.updateModuleConfig()`
- ✅ Hiện tại chỉ support module 'gmail', các module khác trả về error

### 5. Plugin Initialization (`src/lib/init-plugins.ts`)

- ✅ Cập nhật để sử dụng factory pattern
- ✅ Tạo dependencies (Prisma, LogService, ProfileService, ModuleService, BrowserController)
- ✅ Tạo Gmail plugin bằng `createGmailPlugin()` với dependencies
- ✅ Đăng ký plugin vào PluginManager

### 6. Backward Compatibility (`src/plugins/gmail/gmail_module.ts`)

- ✅ Cập nhật để sử dụng factory pattern với default dependencies
- ✅ Giữ nguyên export default để code cũ vẫn hoạt động
- ✅ Code cũ import `gmail_module` vẫn hoạt động bình thường

## 📋 Cách sử dụng

### 1. Cập nhật Gmail Module Config

**API Request:**
```bash
PATCH /api/modules/gmail/config
Content-Type: application/json

{
  "minCareIntervalMinutes": 90,
  "autoLoginIfLoggedOut": true,
  "skipCareIfRecentlyLoggedInMinutes": 15,
  "randomBehaviorLevel": "high"
}
```

**Response:**
```json
{
  "success": true,
  "module": {
    "name": "gmail",
    "label": "Gmail Module",
    "description": "...",
    "version": "1.0.0",
    "enabled": true,
    "configJson": "{\"minCareIntervalMinutes\":90,...}"
  }
}
```

### 2. GmailService tự động đọc config

Khi `checkAccount()`, `loginAccount()`, hoặc `careAccount()` được gọi:
- GmailService tự động gọi `getConfig()` để lấy config từ ModuleService
- Config được parse và validate
- Các rule được áp dụng:
  - `autoLoginIfLoggedOut`: Tự động login khi check thấy logged_out
  - `minCareIntervalMinutes`: Bỏ qua care nếu quá sớm
  - `skipCareIfRecentlyLoggedInMinutes`: Bỏ qua care nếu vừa login gần đây

### 3. Factory Pattern Usage

**Trong init-plugins.ts:**
```typescript
const gmailPlugin = createGmailPlugin({
  prisma,
  profileService: new ProfileService(),
  browserController: new PlaywrightBrowserController(),
  logService: new LogService(),
  moduleService: new ModuleService(),
})

pluginManager.registerPlugin(gmailPlugin)
```

## 🔄 Workflow

### Check Account Flow

1. `checkAccount(accountId)` được gọi
2. Lấy config từ ModuleService
3. Check login status
4. Nếu `logged_out`:
   - Nếu `config.autoLoginIfLoggedOut === true` → gọi `loginAccount()`
   - Nếu `false` → set status `logged_out`, log warning

### Care Account Flow

1. `careAccount(accountId)` được gọi
2. Lấy config từ ModuleService
3. Kiểm tra `minCareIntervalMinutes`:
   - Nếu `lastCare` quá gần → bỏ qua, log info
4. Kiểm tra `skipCareIfRecentlyLoggedInMinutes`:
   - Nếu `lastLogin` quá gần → bỏ qua, log info
5. Check login status
6. Nếu không `logged_in`:
   - Nếu `config.autoLoginIfLoggedOut === true` → gọi `loginAccount()`
   - Nếu `false` → log warning, return
7. Thực hiện care behavior
8. Cập nhật `lastCare`, `lastCheck`

## 📝 Notes

1. **Password Encryption**: Hiện tại `decryptPassword()` chỉ return plaintext. Cần implement encryption thực sự trong tương lai.

2. **Random Behavior Level**: Config `randomBehaviorLevel` được lưu nhưng chưa được sử dụng trong `GmailPageController`. Có thể truyền vào controller sau này.

3. **Backward Compatibility**: File `gmail_module.ts` vẫn được giữ để đảm bảo code cũ vẫn hoạt động. Code mới nên sử dụng `gmail_plugin.ts` với factory pattern.

4. **Default Config**: Nếu module chưa có config trong database, sẽ sử dụng default config từ `gmailConfig.ts`.

## 🚀 Next Steps (Optional)

1. **UI Settings Page**: Tạo form trong `/modules` page để chỉnh sửa Gmail config
2. **Password Encryption**: Implement encryption/decryption cho password
3. **Random Behavior**: Sử dụng `randomBehaviorLevel` trong `GmailPageController`
4. **Config Validation UI**: Validate config trước khi submit
5. **Config History**: Lưu lịch sử thay đổi config (nếu cần)

## 📚 Related Files

- `src/plugins/gmail/gmailConfig.ts` - Config interface và parser
- `src/plugins/gmail/GmailService.ts` - Service implementation
- `src/plugins/gmail/gmail_plugin.ts` - Factory pattern plugin
- `src/plugins/gmail/gmail_module.ts` - Legacy export (backward compatibility)
- `src/app/api/modules/[name]/config/route.ts` - API route cho config
- `src/lib/init-plugins.ts` - Plugin initialization
- `docs/GMAIL-MODULES.md` - Original specification

