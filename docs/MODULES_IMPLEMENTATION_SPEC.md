# Modules Implementation Specification

## 📋 Tổng quan

Hệ thống Modules cho phép quản lý và bật/tắt các plugin modules (Gmail, Outlook, Facebook, X, ...) một cách linh hoạt. Module bị tắt sẽ không được PluginManager sử dụng, giúp kiểm soát các tính năng automation.

## 🏗️ Kiến trúc

```
┌─────────────────────────────────────────────────────────┐
│                    ModuleRegistry                       │
│  (Danh sách built-in modules: Gmail, Outlook, ...)    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   ModuleService                        │
│  - listModules()                                       │
│  - getModule(name)                                     │
│  - setModuleEnabled(name, enabled)                     │
│  - updateModuleConfig(name, configJson)               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              ModuleConfig (Database)                   │
│  - name: string (unique)                               │
│  - enabled: boolean                                    │
│  - configJson: string?                                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 PluginManager                          │
│  - isModuleEnabled(moduleName)                         │
│  - getPluginForAccountType(type)                       │
│  - checkAccount() / careAccount()                      │
└─────────────────────────────────────────────────────────┘
```

## 📊 Database Schema

### ModuleConfig Model

```prisma
model ModuleConfig {
  id         String   @id @default(cuid())
  name       String   @unique           // 'gmail', 'outlook', ...
  enabled    Boolean  @default(true)
  configJson String?  // lưu config riêng nếu cần
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Migration**: `20251204172411_add_module_config`

**Lưu ý**: 
- Mỗi module có một record duy nhất trong database (unique constraint trên `name`)
- Mặc định `enabled = true` nếu chưa có record trong DB
- `configJson` có thể lưu cấu hình riêng cho từng module (JSON string)

## 🔧 Core Components

### 1. ModuleRegistry (`src/core/modules/ModuleRegistry.ts`)

Định nghĩa danh sách built-in modules trong code:

```typescript
export interface ModuleMeta {
  name: string        // 'gmail'
  label: string       // 'Gmail Module'
  description: string
  version: string
  docsUrl?: string
}

export const BUILTIN_MODULES: ModuleMeta[] = [
  {
    name: "gmail",
    label: "Gmail Module",
    description: "Tự động check/login/care tài khoản Gmail sử dụng GPM profile + proxy.",
    version: "1.0.0",
  },
  // Có thể thêm modules khác:
  // - outlook
  // - facebook
  // - x (twitter)
]
```

**Đặc điểm**:
- Hard-coded trong code, không thể thay đổi từ UI
- Merge với config từ database để tạo `ModuleView`
- Mỗi module phải có `name` unique

### 2. ModuleService (`src/core/services/ModuleService.ts`)

Service quản lý module configs, merge giữa Registry và Database:

```typescript
export interface ModuleView extends ModuleMeta {
  enabled: boolean
  configJson?: string | null
}

export class ModuleService {
  /**
   * Lấy danh sách tất cả modules
   * Merge BUILTIN_MODULES với ModuleConfig từ DB
   */
  async listModules(): Promise<ModuleView[]>

  /**
   * Lấy thông tin một module cụ thể
   */
  async getModule(name: string): Promise<ModuleView | null>

  /**
   * Bật/tắt module
   * Tạo hoặc cập nhật record trong DB
   */
  async setModuleEnabled(name: string, enabled: boolean): Promise<ModuleView>

  /**
   * Cập nhật config JSON cho module
   */
  async updateModuleConfig(name: string, configJson: string | null): Promise<ModuleView>
}
```

**Logic**:
- `listModules()`: Lấy tất cả `BUILTIN_MODULES`, merge với config từ DB
- Nếu module chưa có trong DB → `enabled = true` (mặc định)
- Nếu module có trong DB → dùng `enabled` từ DB

### 3. PluginManager Integration (`src/core/plugins/PluginManager.ts`)

PluginManager được cập nhật để kiểm tra module enabled state:

```typescript
export class PluginManager {
  private moduleService: ModuleService

  /**
   * Kiểm tra module có enabled không
   */
  async isModuleEnabled(moduleName: string): Promise<boolean>

  /**
   * Get plugin cho account type (sync - không check enabled)
   */
  getPluginForAccountTypeSync(type: string): AccountPlugin | null

  /**
   * Get plugin cho account type (async - check enabled)
   * Chỉ trả về plugin nếu module tương ứng đang enabled
   */
  async getPluginForAccountType(type: string): Promise<AccountPlugin | null>

  /**
   * Check account - chỉ chạy nếu module enabled
   */
  async checkAccount(accountId: string): Promise<void>

  /**
   * Care account - chỉ chạy nếu module enabled
   */
  async careAccount(accountId: string): Promise<void>
}
```

**Workflow**:
1. `checkAccount()` / `careAccount()` được gọi
2. Lấy account từ DB để biết `accountType`
3. Gọi `getPluginForAccountType(accountType)` → kiểm tra module enabled
4. Nếu module disabled → throw error: "No enabled plugin found for account type: [type]"
5. Nếu module enabled → trả về plugin và thực thi

## 🌐 API Endpoints

### GET `/api/modules`

Lấy danh sách tất cả modules.

**Response**:
```json
{
  "success": true,
  "modules": [
    {
      "name": "gmail",
      "label": "Gmail Module",
      "description": "Tự động check/login/care tài khoản Gmail...",
      "version": "1.0.0",
      "enabled": true,
      "configJson": null
    }
  ]
}
```

### PATCH `/api/modules`

Cập nhật enabled state cho module.

**Request Body**:
```json
{
  "name": "gmail",
  "enabled": false
}
```

**Response**:
```json
{
  "success": true,
  "module": {
    "name": "gmail",
    "label": "Gmail Module",
    "description": "...",
    "version": "1.0.0",
    "enabled": false,
    "configJson": null
  }
}
```

### PATCH `/api/modules/[name]`

Cập nhật enabled state cho module cụ thể.

**Request Body**:
```json
{
  "enabled": true
}
```

**Response**: Tương tự PATCH `/api/modules`

## 🎨 UI Components

### Modules Page (`src/app/modules/page.tsx`)

Trang quản lý modules với các tính năng:

1. **Hiển thị danh sách modules**:
   - Module name (label)
   - Description
   - Version
   - Enabled/Disabled status với toggle button

2. **Toggle enabled/disabled**:
   - Click button để bật/tắt
   - Optimistic update (UI cập nhật ngay, rollback nếu lỗi)
   - Toast notification khi thành công/thất bại

3. **Auto-refresh**: Tự động refresh mỗi 60 giây

**UI Features**:
- Table layout với Tailwind CSS
- Toggle button với màu sắc:
  - Enabled: Green (`bg-green-600`)
  - Disabled: Gray (`bg-gray-300`)
- Loading state khi fetch data
- Error handling với toast notifications

## 🔄 Workflow & Use Cases

### Use Case 1: Bật/Tắt Module

1. User truy cập `/modules`
2. Click toggle button cho module "Gmail"
3. Frontend gọi `PATCH /api/modules/gmail` với `{ enabled: false }`
4. `ModuleService.setModuleEnabled()` cập nhật DB
5. UI cập nhật ngay (optimistic update)
6. Toast notification hiển thị

**Kết quả**:
- Module Gmail bị tắt
- Các account Gmail không thể check/care (PluginManager sẽ throw error)

### Use Case 2: Check Account với Module Disabled

1. User click "Check" cho account Gmail
2. `AccountService.triggerCheck()` được gọi
3. `PluginManager.checkAccount()` được gọi
4. `PluginManager.getPluginForAccountType('gmail')` kiểm tra module enabled
5. Nếu disabled → throw error: "No enabled plugin found for account type: gmail"
6. Frontend hiển thị error message

### Use Case 3: Module Enabled by Default

1. Module mới được thêm vào `ModuleRegistry`
2. Chưa có record trong `ModuleConfig` table
3. `ModuleService.listModules()` trả về `enabled: true` (mặc định)
4. Module hoạt động bình thường

## 📝 Implementation Details

### File Structure

```
src/
├── core/
│   ├── modules/
│   │   └── ModuleRegistry.ts          # Built-in modules definition
│   ├── services/
│   │   └── ModuleService.ts          # Module management service
│   └── plugins/
│       └── PluginManager.ts           # Updated with module checking
├── app/
│   ├── api/
│   │   └── modules/
│   │       ├── route.ts               # GET, PATCH /api/modules
│   │       └── [name]/
│   │           └── route.ts          # PATCH /api/modules/:name
│   └── modules/
│       └── page.tsx                   # Modules management UI
└── prisma/
    └── schema.prisma                  # ModuleConfig model
```

### Database Migration

**Migration File**: `prisma/migrations/20251204172411_add_module_config/migration.sql`

```sql
CREATE TABLE "ModuleConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "configJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "ModuleConfig_name_key" ON "ModuleConfig"("name");
```

### Error Handling

1. **Module không tồn tại**:
   - `ModuleService.setModuleEnabled()` throw: "Unknown module: [name]"
   - API trả về 500 với error message

2. **Module disabled khi check/care**:
   - `PluginManager` throw: "No enabled plugin found for account type: [type]"
   - Frontend hiển thị error toast

3. **Database errors**:
   - Prisma errors được catch và trả về generic error message
   - Logging chi tiết trong console

## 🔐 Security & Validation

1. **Input Validation**:
   - `name` phải là string, không rỗng
   - `enabled` phải là boolean
   - Module name phải tồn tại trong `BUILTIN_MODULES`

2. **Database Constraints**:
   - `name` unique constraint
   - Không thể tạo module không có trong Registry

3. **Error Messages**:
   - Không expose internal errors
   - Generic error messages cho client

## 🚀 Future Enhancements

1. **Module Config UI**:
   - Form để chỉnh sửa `configJson` cho từng module
   - Validate JSON format

2. **Module Dependencies**:
   - Module A phụ thuộc Module B
   - Không thể tắt Module B nếu Module A đang enabled

3. **Module Statistics**:
   - Số lượng accounts sử dụng module
   - Last check/care time
   - Success/failure rates

4. **Module Versioning**:
   - Kiểm tra version compatibility
   - Auto-update module config khi version thay đổi

5. **Module Permissions**:
   - Role-based access control
   - Chỉ admin mới có thể bật/tắt modules

## 📊 Testing Checklist

- [x] ModuleRegistry có danh sách built-in modules
- [x] ModuleService merge Registry với DB config
- [x] ModuleService.setModuleEnabled() tạo/update record
- [x] PluginManager kiểm tra module enabled state
- [x] PluginManager throw error khi module disabled
- [x] API GET /api/modules trả về danh sách modules
- [x] API PATCH /api/modules cập nhật enabled state
- [x] UI hiển thị danh sách modules
- [x] UI toggle enabled/disabled hoạt động
- [x] Optimistic update và error handling
- [x] Database migration tạo bảng ModuleConfig
- [x] Default enabled = true cho module chưa có config

## 📚 Related Documentation

- [MODULES-DOC.md](./MODULES-DOC.md) - Original specification
- [APPLICATION_SPEC_V2.md](./APPLICATION_SPEC_V2.md) - Overall application spec
- [AUTOMATION_LAYER_SPEC.md](./AUTOMATION_LAYER_SPEC.md) - Plugin system spec

## 🎯 Summary

Hệ thống Modules đã được triển khai đầy đủ với:
- ✅ Database schema (ModuleConfig)
- ✅ ModuleRegistry với built-in modules
- ✅ ModuleService quản lý configs
- ✅ PluginManager integration
- ✅ API endpoints (GET, PATCH)
- ✅ UI page với toggle functionality
- ✅ Error handling và validation
- ✅ Optimistic updates
- ✅ Default enabled state

Hệ thống sẵn sàng sử dụng và có thể mở rộng thêm modules mới (Outlook, Facebook, X, ...) trong tương lai.

