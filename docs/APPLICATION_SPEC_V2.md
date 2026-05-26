Dưới đây là file **`APPLICATION_SPEC_V2.md`** hoàn chỉnh cho bạn, bạn có thể copy nguyên văn sang Cursor để triển khai:

---

````md
# APPLICATION_SPEC_V2.md
# GPM PROFILE & MULTI-ACCOUNT MANAGER  
## Core + Plugin Architecture (Gmail as First Plugin)

---

## 0. Overview

Ứng dụng này là một hệ thống **quản lý & tự động hóa tài khoản** dựa trên:

- **Core Platform**:
  - Quản lý **GPM profiles**
  - Quản lý **Proxy**
  - Quản lý **Account** (đa loại: Gmail, Outlook, Facebook, X, Shopee, ...)
  - **Dashboard**, **Log**, **Task Queue**

- **Plugin Modules**:
  - Mỗi loại tài khoản (Gmail, Outlook, …) là **một module/plugin** cắm vào Core.
  - Module Gmail là plugin đầu tiên: **check / login / care Gmail** bằng trình duyệt tự động.

Mục tiêu:  
> Core phải **ổn định, rõ ràng, dễ mở rộng**, không phụ thuộc riêng Gmail. Gmail chỉ là 1 trong nhiều module có thể bật/tắt.

---

## 1. Goals & Non-Goals

### 1.1. Goals

1. Quản lý tập trung:
   - Profile GPMLogin (antidetect browser profile)
   - Proxy (list, check, reset, assign)
   - Nhiều loại tài khoản (account_type: `gmail`, `outlook`, `facebook`, `x`, `custom`, ...)

2. Tự động hóa:
   - **Kiểm tra trạng thái** tài khoản (ví dụ Gmail: đang đăng nhập, bị out, lỗi, banned…)
   - **Đăng nhập lại** khi cần thiết
   - **Chăm sóc tài khoản Gmail** bằng hành vi giống người dùng thật (read mail, scroll, search, v.v.)

3. Plugin-friendly Architecture:
   - Dễ thêm module mới: chỉ cần tạo thư mục plugin + đăng ký vào Core.
   - Core không chứa logic đặc thù Gmail/Outlook, chỉ quản lý tài nguyên chung.

4. Monitoring:
   - Dashboard hiển thị tổng quan: accounts, proxies, profiles, jobs, errors.
   - Hệ thống log chi tiết theo account, module, thời gian.

---

### 1.2. Non-Goals

- Không cố gắng trở thành framework automation “tất cả mọi trang web”.
- Không build UI phức tạp (giai đoạn đầu): ưu tiên bảng và action rõ ràng.
- Không xử lý full captcha/2FA phức tạp (chỉ chuẩn bị hook để về sau mở rộng).

---

## 2. System Architecture

### 2.1. High-Level Components

1. **Core Platform**
   - `AccountService`
   - `ProfileService` (GPM core)
   - `ProxyService`
   - `TaskService` (job & queue)
   - `LogService`
   - `DashboardService` (tổng hợp dữ liệu core)

2. **Plugin Layer (Modules)**
   - `GmailModule` (first plugin)
     - `GmailService` (check/login/care)
   - Các module khác (future):
     - `OutlookModule`
     - `FacebookModule`
     - `XModule`
     - `CustomModule`

3. **Integration Layer**
   - `GpmLoginAdapter` (API/CLI của GPMLogin)
   - `ProxyAPIAdapter` (reset IP / check proxy)
   - `BrowserController` (Selenium/Playwright via remote debugging)

4. **Frontend (Web UI)**
   - Pages:
     - Dashboard
     - Accounts
     - Profiles
     - Proxies
     - Modules
     - Logs

---

### 2.2. Suggested Tech Stack (gợi ý, có thể thay đổi)

- **Backend**:
  - Node.js + Express (hoặc Fastify/NestJS)
  - Prisma ORM (PostgreSQL / MySQL / SQLite)
- **Frontend**:
  - React + Tailwind (hoặc Next.js)
- **Automation**:
  - Playwright hoặc Puppeteer (remote debugging tới GPM profile)
- **Database**:
  - PostgreSQL (đề xuất)

> Lưu ý: Spec này **không khóa chặt** tech stack, chỉ gợi ý. Quan trọng là **kết cấu domain & module**.

---

## 3. Domain Model & Database Schema

### 3.1. Entities Overview

- `Account`        → đại diện một tài khoản đăng nhập (Gmail, Outlook, Facebook, …)
- `Proxy`          → thông tin proxy
- `Profile`        → profile GPMLogin
- `Log`            → log hành động
- `ModuleStatus`   → trạng thái plugin per account
- (Optional) `Task` / `Job` → lưu job chạy nền

---

### 3.2. accounts

```ts
model Account {
  id                 String   @id @default(cuid())
  label              String   // "Gmail chính", "Backup 01", ...
  accountType        String   // 'gmail' | 'outlook' | 'facebook' | 'x' | 'custom' ...
  identifier         String   // Gmail: email, FB: username/id
  passwordEncrypted  String?  // optional, mã hóa
  gpmloginProfileId  String?  // liên kết với bảng profiles
  proxyId            String?  // liên kết proxies.id

  status             String   // 'active' | 'logged_out' | 'error' | 'banned' | 'proxy_error'
  autoChangeProxy    Boolean  @default(false)

  lastCheck          DateTime?
  lastLogin          DateTime?
  lastCare           DateTime?

  notes              String?

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  proxy              Proxy?   @relation(fields: [proxyId], references: [id])
  profile            Profile? @relation(fields: [gpmloginProfileId], references: [id])
  logs               Log[]
  moduleStatuses     ModuleStatus[]
}
````

---

### 3.3. proxies

```ts
model Proxy {
  id               String   @id @default(cuid())
  label            String   // "Proxy 01", "VN Node 1", ...
  rawProxy         String   // host:port:user:pass hoặc format khác
  ipBefore         String?  // IP khi add
  ipAfter          String?  // IP sau reset gần nhất
  status           String   // 'active' | 'dead' | 'checking' | 'error'
  lastCheck        DateTime?
  lastReset        DateTime?

  accounts         Account[]
  profiles         Profile[]

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

---

### 3.4. profiles (GPM profiles)

```ts
model Profile {
  id                   String   @id @default(cuid())
  name                 String   // Tên hiển thị
  profileUid           String   // UID trong GPMLogin
  proxyId              String?
  status               String   // 'idle' | 'starting' | 'running' | 'stopping' | 'error'
  remoteDebuggingPort  Int?     // port remote debugging hiện tại

  lastOpened           DateTime?
  lastClosed           DateTime?

  proxy                Proxy?   @relation(fields: [proxyId], references: [id])
  accounts             Account[]
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

---

### 3.5. logs

```ts
model Log {
  id          String   @id @default(cuid())
  accountId   String?
  module      String   // 'core' | 'gmail' | 'outlook' | ...
  type        String   // 'info' | 'warning' | 'error'
  message     String
  metaJson    String?  // JSON string: { "step": "login", ... }

  account     Account? @relation(fields: [accountId], references: [id])
  createdAt   DateTime @default(now())
}
```

---

### 3.6. module_status

```ts
model ModuleStatus {
  id          String   @id @default(cuid())
  accountId   String
  module      String   // 'gmail', 'outlook', ...
  status      String   // 'idle' | 'running' | 'error' | 'disabled'
  lastRun     DateTime?
  detailJson  String?  // JSON string chứa detail (error, stats, ...)

  account     Account  @relation(fields: [accountId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## 4. Core Services

### 4.1. AccountService

**Trách nhiệm:**

* Tạo / sửa / xóa account.
* Gán account ↔ profile ↔ proxy.
* Trigger check / care cho account thông qua plugin tương ứng.

**Các hàm chính (pseudo):**

```ts
class AccountService {
  listAccounts(filter): Promise<Account[]>
  getAccount(id): Promise<Account>

  createAccount(payload): Promise<Account>
  updateAccount(id, payload): Promise<Account>
  deleteAccount(id): Promise<void>

  assignProxy(accountId, proxyId): Promise<void>
  assignProfile(accountId, profileId): Promise<void>

  triggerCheck(accountId): Promise<void>    // gọi PluginManager
  triggerCare(accountId): Promise<void>     // gọi PluginManager

  bulkCheck(accountIds: string[]): Promise<void>
  bulkCare(accountIds: string[]): Promise<void>
}
```

---

### 4.2. ProfileService (GPM Core)

**Trách nhiệm:**

* Quản lý mapping giữa DB Profile và GPMLogin.
* Mở/đóng profile.
* Cập nhật trạng thái profile.
* Lấy `remoteDebuggingPort` để BrowserController dùng.

```ts
class ProfileService {
  syncProfilesFromGpm(): Promise<void>

  listProfiles(filter): Promise<Profile[]>
  getProfile(id): Promise<Profile>

  startProfile(id): Promise<Profile>       // gọi GpmLoginAdapter.start()
  stopProfile(id): Promise<Profile>        // gọi GpmLoginAdapter.stop()

  changeProfileProxy(profileId, proxyId): Promise<void>

  getRemoteDebugInfo(profileId): Promise<{ host: string; port: number }>
}
```

---

### 4.3. ProxyService

**Trách nhiệm:**

* CRUD proxy.
* Kiểm tra proxy theo yêu cầu.
* Reset IP qua Proxy API.
* Chọn proxy phù hợp cho account/profile.

```ts
class ProxyService {
  listProxies(filter): Promise<Proxy[]>
  createProxy(payload): Promise<Proxy>
  updateProxy(id, payload): Promise<Proxy>
  deleteProxy(id): Promise<void>

  checkProxy(id): Promise<CheckResult>
  resetProxyIp(id): Promise<void>

  assignProxyToAccount(proxyId, accountId): Promise<void>
  assignProxyToProfile(proxyId, profileId): Promise<void>

  autoPickProxyForAccount(accountId): Promise<void>
}
```

---

### 4.4. TaskService

**Trách nhiệm:**

* Quản lý các job nội bộ: bulk check, bulk care, scheduled jobs.
* Có thể dùng:

  * simple in-memory queue
  * hoặc thư viện như BullMQ nếu dùng Redis.

```ts
class TaskService {
  enqueueCheck(accountIds: string[]): Promise<void>
  enqueueCare(accountIds: string[]): Promise<void>

  processQueue(): Promise<void> // chạy nền, worker
}
```

---

### 4.5. LogService

**Trách nhiệm:**

* Ghi log chuẩn.
* Cho phép filter log theo nhiều tiêu chí.

```ts
class LogService {
  logInfo(module, message, meta?): Promise<void>
  logError(module, message, meta?): Promise<void>

  listLogs(filter): Promise<Log[]>
}
```

---

## 5. Plugin Architecture

### 5.1. Plugin Structure

Thư mục:

```
/plugins
  /gmail
    gmail_module.ts
    gmail_service.ts
    plugin.json
  /outlook
    ...
```

`plugin.json` (ví dụ cho Gmail):

```json
{
  "name": "gmail",
  "version": "1.0.0",
  "description": "Gmail automation module (check, login, care)",
  "entry": "gmail_module.ts"
}
```

---

### 5.2. Plugin Interface (pseudo)

```ts
interface AccountPlugin {
  name: string; // 'gmail'
  supportedTypes: string[]; // ['gmail']

  checkAccount(account: Account): Promise<void>;
  login(account: Account): Promise<void>;
  care(account: Account): Promise<void>;
}
```

---

### 5.3. PluginManager

**Trách nhiệm:**

* Load plugin từ thư mục `/plugins`.
* Chọn plugin phù hợp theo `account.accountType`.
* Gọi `checkAccount`, `login`, `care` tương ứng.

```ts
class PluginManager {
  loadPlugins(): void                 // scan /plugins, đọc plugin.json, import entry
  getPluginForAccountType(type: string): AccountPlugin | null

  async checkAccount(account: Account): Promise<void> {
    const plugin = this.getPluginForAccountType(account.accountType)
    if (!plugin) throw new Error("No plugin for account type")
    await plugin.checkAccount(account)
  }

  async careAccount(account: Account): Promise<void> {
    const plugin = this.getPluginForAccountType(account.accountType)
    if (!plugin) throw new Error("No plugin for account type")
    await plugin.care(account)
  }
}
```

---

## 6. Gmail Module (First Plugin)

### 6.1. GmailService Responsibilities

* Mở profile GPM tương ứng (qua ProfileService).
* Điều khiển trình duyệt (BrowserController) để:

  * Kiểm tra trạng thái đăng nhập.
  * Đăng nhập nếu cần.
  * Thực hiện hành vi “care” (chăm sóc).

---

### 6.2. Logic `checkAccount`

Pseudo flow:

1. Từ `Account` → lấy `profileId`.
2. Gọi `ProfileService.startProfile(profileId)`.
3. Lấy `remoteDebuggingPort`.
4. Dùng `BrowserController.connect(host, port)` mở tab Gmail.
5. Kiểm tra:

   * Nếu đang đăng nhập → cập nhật `status = 'active'`, `lastCheck = now()`.
   * Nếu không đăng nhập → gọi `login(account)`.

---

### 6.3. Logic `login`

* Nhập email & password (nếu cần).
* Xử lý step-by-step:

  * Điền email → Next
  * Điền password → Next
  * Chờ redirect & load Gmail inbox.
* Ghi log từng bước.
* Cập nhật:

  * `status = 'active'`
  * `lastLogin = now()`

---

### 6.4. Logic `care`

* Pre-condition:

  * account.status = 'active'
  * không care nếu `lastCare` quá gần (tôn trọng MIN_INTERVAL)
* Hành vi mô phỏng:

  * Mở 3–7 email random.
  * Scroll inbox.
  * Click vào label khác (Sent, Spam, Promotions).
  * Tạo 1 draft (không gửi).
  * Thời gian trễ random (sleep 2–7s giữa các action).
* Sau khi complete:

  * Cập nhật `lastCare = now()`.
  * Ghi log `type = 'info', module = 'gmail', message = 'care_success'`.

---

## 7. API Design

### 7.1. Accounts API

#### GET `/api/accounts`

* Query params: `status`, `type`, `search`, `page`, `limit`
* Response: danh sách account + info proxy/profile

#### POST `/api/accounts`

Body:

```json
{
  "label": "Gmail chính",
  "accountType": "gmail",
  "identifier": "example@gmail.com",
  "password": "optional-plain-or-encrypted",
  "autoChangeProxy": true,
  "notes": "..."
}
```

#### PUT `/api/accounts/:id`

* Update label, notes, autoChangeProxy, proxyId, profileId.

#### DELETE `/api/accounts/:id`

* Soft delete hoặc hard delete tùy ý (đề xuất soft delete thông qua cờ `isDeleted` nếu cần).

#### POST `/api/accounts/:id/check`

* Trigger plugin check cho 1 account.

#### POST `/api/accounts/:id/care`

* Trigger plugin care cho 1 account.

#### POST `/api/accounts/check-bulk`

Body:

```json
{ "accountIds": ["id1", "id2", "id3"] }
```

#### POST `/api/accounts/care-bulk`

Tương tự check-bulk.

---

### 7.2. Profiles API

#### GET `/api/profiles`

* Return danh sách profile sync từ GPM.

#### POST `/api/profiles/sync`

* Thực hiện sync từ GPM → DB.

#### POST `/api/profiles/:id/start`

* Gọi `ProfileService.startProfile`.

#### POST `/api/profiles/:id/stop`

* Gọi `ProfileService.stopProfile`.

#### PUT `/api/profiles/:id/proxy`

Body:

```json
{ "proxyId": "proxy-id" }
```

---

### 7.3. Proxies API

#### GET `/api/proxies`

* List proxies.

#### POST `/api/proxies`

Body:

```json
{
  "label": "Proxy VN 01",
  "rawProxy": "host:port:user:pass"
}
```

#### PUT `/api/proxies/:id`

* Update label, rawProxy, etc.

#### DELETE `/api/proxies/:id`

* Xóa proxy.

#### POST `/api/proxies/:id/check`

* Check proxy alive/dead.

#### POST `/api/proxies/:id/reset-ip`

* Gọi ProxyAPIAdapter để reset IP.

---

### 7.4. Modules API

#### GET `/api/modules`

* Trả về các module đã load:

```json
[
  { "name": "gmail", "version": "1.0.0", "enabled": true }
]
```

#### POST `/api/modules/:moduleName/run`

* Chạy action custom theo module (tuỳ implement, có thể dùng sau).

---

### 7.5. Logs API

#### GET `/api/logs`

Query params:

* `accountId`
* `module`
* `type`
* `from`
* `to`
* `page`, `limit`

---

## 8. Frontend / UI Spec

### 8.1. Sidebar

* Dashboard
* Accounts
* Profiles
* Proxies
* Modules
* Logs

---

### 8.2. Dashboard Page

Hiển thị:

* Tổng số account

  * Active
  * Logged_out
  * Error
  * Banned
* Tổng số proxy

  * Active
  * Dead
* Profile đang chạy / tổng profile
* Job đang xử lý
* Biểu đồ nhỏ (line/bar) số lượt check/care 24h gần nhất

---

### 8.3. Accounts Page

**Table columns:**

* Checkbox
* Label
* Account Type
* Identifier
* GPM Profile
* Proxy
* Status (badge màu)
* Last Check
* Last Care
* Actions

**Actions:**

* Button “Check”
* Button “Care”
* Dropdown “Bulk” cho các account đã chọn:

  * Bulk Check
  * Bulk Care

Form “Add/Edit Account”:

* Label
* Account Type (select)
* Identifier
* Password (optional)
* Auto change proxy (checkbox)
* Notes
* Proxy (dropdown hoặc auto-assign)
* Profile (dropdown hoặc auto-create)

---

### 8.4. Profiles Page

**Table:**

* Name
* Profile UID
* Proxy
* Status
* Last Opened
* Last Closed
* Actions:

  * Start
  * Stop
  * Change Proxy

---

### 8.5. Proxies Page

**Table:**

* Label
* Raw Proxy
* IP After
* Status
* Last Check
* Last Reset
* Used By (số account/profile đang dùng)
* Actions:

  * Check
  * Reset IP
  * Edit
  * Delete

---

### 8.6. Modules Page

* Danh sách các module:

  * Name
  * Version
  * Description
  * Status (enabled/disabled)
* (Optional) Cho phép enable/disable plugin.

---

### 8.7. Logs Page

* Filter:

  * Account
  * Module
  * Type
  * Date range
* Table:

  * Time
  * Module
  * Type
  * Message
  * View meta (expand JSON)

---

## 9. Main Flows

### 9.1. Flow: Thêm Account Gmail mới

1. User vào **Accounts → Add Account**.
2. Chọn:

   * `accountType = 'gmail'`
   * `identifier = email`
   * Mật khẩu (nếu lưu)
3. Core:

   * Nếu chưa có profile:

     * Tự tạo / map profile GPM (tuỳ thiết kế)
   * Auto assign proxy (nếu bật auto).
4. Account được lưu DB.
5. User có thể click “Check” ngay.

---

### 9.2. Flow: Check Một Account

1. User click “Check” trên một account Gmail.
2. `AccountService.triggerCheck(accountId)`:

   * Lấy account từ DB.
   * Gọi `PluginManager.checkAccount(account)`.
3. `PluginManager`:

   * Tìm plugin Gmail.
   * Gọi `GmailPlugin.checkAccount(account)`.
4. `GmailPlugin.checkAccount`:

   * Dùng `ProfileService.startProfile`.
   * Dùng `BrowserController` & remote debugging.
   * Kiểm tra Gmail login.
   * Cập nhật `Account.status` + `lastCheck`.
   * Ghi log.

---

### 9.3. Flow: Care Một Account

Tương tự `Check`, chỉ khác:

* Gọi `GmailPlugin.care(account)`.
* Thực hiện chuỗi hành vi giả lập.
* Cập nhật `lastCare`.

---

## 10. Non-Functional Requirements

* **Logging chi tiết**:

  * Mọi bước quan trọng: start profile, open tab, login, care, error.
* **Retry & Error handling**:

  * Nếu profile start lỗi → cho phép retry N lần.
  * Nếu proxy lỗi → update `status = 'proxy_error'`, đề xuất đổi proxy.
* **Extensibility**:

  * Thêm plugin mới không phải sửa Core.
  * Chỉ cần:

    * Tạo thư mục `/plugins/[moduleName]`
    * Implement interface `AccountPlugin`
    * Khai báo `plugin.json`.

---

## 11. Roadmap Gợi Ý

* **Phase 1**:

  * Core Platform: Accounts, Profiles, Proxies, Logs (UI + API).
  * GmailPlugin: check + login cơ bản.
* **Phase 2**:

  * Gmail care behavior.
  * Bulk tasks + job queue.
* **Phase 3**:

  * Thêm module mới (ví dụ: Outlook hoặc X).
* **Phase 4**:

  * Tối ưu UI/UX, phân quyền user, multi-tenant (nếu làm SaaS).

---

## 12. Kết luận

Bản SPEC V2 này:

* Tách rõ **CORE** (GPM profile, proxy, account, log, dashboard) và **PLUGIN** (Gmail).
* Giúp ứng dụng:

  * Đỡ rối, dễ đọc, dễ code.
  * Dễ mở rộng module mới sau này.
  * Phù hợp cho kiến trúc “ứng dụng nền tảng + plugin”.

> Yêu cầu Cursor:
>
> * Dựa trên SPEC này, hãy sinh ra cấu trúc project (backend + frontend)
> * Tạo các model, service skeleton, API route, và UI cơ bản cho: Accounts, Profiles, Proxies, Logs, Module list.
> * Implement GmailPlugin skeleton với các hàm `checkAccount`, `login`, `care` (chưa cần behavior quá chi tiết ở bước đầu).

```

---
