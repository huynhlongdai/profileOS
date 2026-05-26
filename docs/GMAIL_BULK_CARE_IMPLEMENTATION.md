# Gmail Bulk Care Implementation Summary

## Tổng quan

Tài liệu này mô tả việc triển khai chức năng bulk care cho plugin Gmail, dựa trên phân tích code cũ (`toolold/gmail_care.py`) và tích hợp vào hệ thống mới.

## Đã hoàn thành

### 1. Logic Care Behavior (GmailCareBehavior.ts)

✅ **Đã triển khai đầy đủ 9 bước care** tương đương code cũ:

1. ✅ Đảm bảo đang ở Gmail inbox
2. ✅ Kiểm tra và đọc email chưa đọc
3. ✅ Tương tác với email (star, archive)
4. ✅ Tìm kiếm email
5. ✅ Duyệt các thư mục (Sent, Drafts, Starred, Important)
6. ✅ Kiểm tra settings (20% khả năng)
7. ✅ Tạo draft email (30% khả năng)
8. ✅ Tìm kiếm Google và mở Gmail (20% khả năng)
9. ✅ Mở các email ngẫu nhiên (1-5 email)
10. ✅ Thực hiện hành động random (scroll, hover, click)

**File:** `src/plugins/gmail/GmailCareBehavior.ts`

### 2. GmailService Integration

✅ **Đã tích hợp đầy đủ:**

- `careAccount()` method thực hiện:
  - Kiểm tra `minCareIntervalMinutes`
  - Kiểm tra `skipCareIfRecentlyLoggedInMinutes`
  - Auto login nếu cần
  - Gọi `GmailCareBehavior.performCare()`
  - **Lấy và lưu cookies sau khi care** ✅ (mới thêm)
  - Cập nhật `lastCare` và `lastCheck`

**File:** `src/plugins/gmail/GmailService.ts`

### 3. Bulk Care Infrastructure

✅ **Hệ thống queue hoàn chỉnh:**

- **API Endpoint:** `POST /api/accounts/care-bulk`
  - Nhận `{ accountIds: string[] }`
  - Gọi `AccountService.bulkCare()`

- **AccountService.bulkCare():**
  - Gọi `TaskService.enqueueCare()`
  - Log thông tin

- **TaskService:**
  - Queue system với in-memory tasks
  - Xử lý theo batch (maxConcurrent = 3)
  - Tự động process queue
  - Error handling với `Promise.allSettled`

**Files:**
- `src/app/api/accounts/care-bulk/route.ts`
- `src/core/services/AccountService.ts`
- `src/core/services/TaskService.ts`

### 4. Cookies Management

✅ **Đã triển khai:**

- Lấy cookies trong `checkAccount()` ✅
- Lấy cookies trong `loginAccount()` ✅
- **Lấy cookies sau khi care** ✅ (mới thêm)
- Lưu cookies vào database qua `AccountService.saveCookies()`

**File:** `src/plugins/gmail/GmailService.ts`

## So sánh với code cũ

### ✅ Điểm tương đồng

1. **Logic care behavior:** 100% tương đương với code cũ
2. **Random probabilities:** Giống nhau (20%, 30%, etc.)
3. **Error handling:** Tương đương, mỗi bước có try-catch riêng
4. **Cookies management:** Đã bổ sung đầy đủ như code cũ

### ✅ Điểm cải thiện

1. **Random behavior level:** Code mới có config `randomBehaviorLevel` (low/medium/high)
2. **Queue system:** Code mới có queue system tốt hơn (dễ mở rộng với BullMQ)
3. **Type safety:** TypeScript đảm bảo type safety
4. **Logging:** Sử dụng LogService thay vì print statements

### ⚠️ Khác biệt (không ảnh hưởng chức năng)

1. **Threading model:**
   - Code cũ: Python ThreadPoolExecutor
   - Code mới: JavaScript Promise.allSettled với async/await

2. **Browser automation:**
   - Code cũ: Selenium WebDriver
   - Code mới: Playwright (hiện đại hơn, nhanh hơn)

## Workflow Bulk Care

```
1. User gọi API: POST /api/accounts/care-bulk
   Body: { accountIds: ["id1", "id2", "id3", ...] }

2. API route → AccountService.bulkCare()

3. AccountService → TaskService.enqueueCare()
   - Tạo task với status 'pending'
   - Tự động trigger processQueue()

4. TaskService.processQueue()
   - Chia accountIds thành batches (max 3/batch)
   - Với mỗi batch:
     - Gọi PluginManager.careAccount() cho từng account
     - Sử dụng Promise.allSettled() để xử lý song song
   - Cập nhật task status: 'processing' → 'completed'

5. PluginManager → GmailPlugin.careAccount()

6. GmailPlugin → GmailService.careAccount()
   - Kiểm tra config (intervals, auto-login)
   - Kết nối browser session
   - Gọi GmailCareBehavior.performCare()
   - Lấy và lưu cookies
   - Cập nhật database

7. Response về client: { success: true, message: "..." }
```

## Cách sử dụng

### 1. Bulk Care qua API

```bash
POST /api/accounts/care-bulk
Content-Type: application/json

{
  "accountIds": ["account-id-1", "account-id-2", "account-id-3"]
}
```

### 2. Single Care qua API

```bash
POST /api/accounts/{id}/care
```

### 3. Programmatic Usage

```typescript
import { AccountService } from '@/core/services/AccountService'

const accountService = new AccountService()
await accountService.bulkCare(['account-id-1', 'account-id-2'])
```

## Configuration

Gmail module config ảnh hưởng đến bulk care:

```typescript
{
  minCareIntervalMinutes: 120,              // Bỏ qua nếu care quá sớm
  autoLoginIfLoggedOut: true,               // Tự động login nếu cần
  skipCareIfRecentlyLoggedInMinutes: 10,    // Bỏ qua nếu vừa login
  randomBehaviorLevel: 'medium'             // Mức độ random
}
```

Cập nhật config:
```bash
PATCH /api/modules/gmail/config
Content-Type: application/json

{
  "minCareIntervalMinutes": 90,
  "randomBehaviorLevel": "high"
}
```

## Notes

1. **Concurrency:** Hiện tại xử lý tối đa 3 accounts đồng thời (có thể config trong TaskService)

2. **Error Handling:** 
   - Lỗi một account không làm dừng các account khác
   - Tất cả lỗi được log qua LogService

3. **Performance:**
   - Queue system đảm bảo không overwhelm hệ thống
   - Cookies được lưu sau mỗi care để maintain session

4. **Không can thiệp vào core:**
   - Tất cả logic care nằm trong plugin Gmail
   - Core chỉ quản lý queue và routing
   - Tuân thủ plugin architecture

## Related Files

- `src/plugins/gmail/GmailCareBehavior.ts` - Care behavior logic
- `src/plugins/gmail/GmailService.ts` - Service integration
- `src/plugins/gmail/gmail_plugin.ts` - Plugin factory
- `src/app/api/accounts/care-bulk/route.ts` - API endpoint
- `src/core/services/TaskService.ts` - Queue system
- `src/core/services/AccountService.ts` - Account operations
- `docs/GMAIL_CARE_COMPARISON.md` - Chi tiết so sánh với code cũ

## Status

✅ **Hoàn thành 100%**

- Logic care behavior: ✅
- Bulk care infrastructure: ✅
- Cookies management: ✅
- Error handling: ✅
- Logging: ✅

**Chức năng bulk care đã sẵn sàng sử dụng!**

