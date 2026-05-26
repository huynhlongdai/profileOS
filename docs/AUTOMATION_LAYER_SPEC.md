Hiện bạn đã có:

* `APPLICATION_SPEC_V2.md` – kiến trúc Core + Plugin.
* Prompt cho Cursor – để sinh project: DB, service, API, UI, Gmail plugin skeleton.

👉 Bước tiếp theo để **app chạy thật** là:

1. Có **lớp Automation** (kết nối GPM + điều khiển Chrome).
2. Có **GmailService thật sự** (check/login/care qua trình duyệt).
3. Có **Task worker** chạy bulk job.
4. Hoàn thiện **config & run**.

Trong message này, mình làm cho bạn **Bước 1 + 2** luôn:

* Viết file `AUTOMATION_LAYER_SPEC.md`
* Viết prompt riêng cho Cursor để nó implement phần này trong project hiện tại.

---

## 1️⃣ File `AUTOMATION_LAYER_SPEC.md`

Bạn tạo file mới với đúng nội dung dưới đây:

````md
# AUTONATION_LAYER_SPEC.md
# Automation Layer – GPM, Browser Controller & Gmail Automation

---

## 0. Mục tiêu

Lớp Automation chịu trách nhiệm:

1. Kết nối với **GPMLogin** để:
   - Lấy danh sách profile
   - Start/stop profile
   - Lấy thông tin remote debugging (host, port)

2. Tạo **BrowserController**:
   - Kết nối tới Chrome đang chạy từ profile GPM
   - Mở tab Gmail
   - Thao tác DOM (login, check trạng thái, hành vi “care”)

3. Cho phép **GmailService** sử dụng:
   - `ProfileService` (để mở profile và lấy port)
   - `BrowserController` (để thực hiện automation)
   - Cập nhật DB qua Prisma (status, lastCheck, lastLogin, lastCare)

> Giai đoạn này:  
> - Có thể dùng **Playwright** (ưu tiên) hoặc **Puppeteer**.  
> - Nếu chưa chắc, mặc định dùng Playwright.

---

## 1. Integration: GpmLoginAdapter

### 1.1. Chức năng

`GpmLoginAdapter` là lớp trung gian để giao tiếp với GPMLogin.  
Giả định: GPMLogin expose HTTP API nội bộ (host/local, port cấu hình trong .env).

Mặc định trong `.env`:

```env
GPM_API_BASE_URL=http://127.0.0.1:19995
````

> Nếu API thực tế khác, sau này chỉ sửa chỗ implement, không đổi interface.

### 1.2. Interface

File: `src/integrations/GpmLoginAdapter.ts`

```ts
export interface GpmProfileInfo {
  id: string;         // profileUid
  name: string;
  proxy?: string;
  status?: string;    // optional: running, stopped, ...
}

export interface GpmStartProfileResult {
  profileUid: string;
  success: boolean;
  message?: string;
  remoteDebuggingPort?: number;
  remoteDebuggingHost?: string; // default 127.0.0.1
}

export interface GpmStopProfileResult {
  profileUid: string;
  success: boolean;
  message?: string;
}

export interface GpmLoginAdapter {
  listProfiles(): Promise<GpmProfileInfo[]>;
  startProfile(profileUid: string): Promise<GpmStartProfileResult>;
  stopProfile(profileUid: string): Promise<GpmStopProfileResult>;
}
```

### 1.3. Implementation Skeleton

```ts
import axios from "axios";

const GPM_API_BASE_URL = process.env.GPM_API_BASE_URL || "http://127.0.0.1:19995";

export class HttpGpmLoginAdapter implements GpmLoginAdapter {
  async listProfiles(): Promise<GpmProfileInfo[]> {
    // TODO: call GPM API to list profiles
    // example (pseudo):
    // const res = await axios.get(`${GPM_API_BASE_URL}/profiles`);
    // map res.data to GpmProfileInfo[]
    return [];
  }

  async startProfile(profileUid: string): Promise<GpmStartProfileResult> {
    // TODO: call GPM API to start profile & get remote debugging port
    // example (pseudo):
    // const res = await axios.post(`${GPM_API_BASE_URL}/profiles/${profileUid}/start`);
    // return mapped GpmStartProfileResult
    return {
      profileUid,
      success: false,
      message: "Not implemented",
    };
  }

  async stopProfile(profileUid: string): Promise<GpmStopProfileResult> {
    // TODO: call GPM API to stop profile
    return {
      profileUid,
      success: false,
      message: "Not implemented",
    };
  }
}
```

> Ghi chú:
>
> * Tạm thời có thể trả fake data trong dev.
> * Khi có API docs chính thức của GPMLogin, chỉ cần chỉnh phần axios call.

---

## 2. Automation: BrowserController

### 2.1. Chức năng

`BrowserController` dùng để:

* Kết nối tới Chrome từ profile GPM (remote debugging).
* Mở tab Gmail (hoặc URL bất kỳ).
* Thực hiện:

  * Kiểm tra trạng thái đăng nhập Gmail.
  * Đăng nhập (nhập email/password).
  * Hành vi “care” (mở mail, scroll, đổi tab, ...).

### 2.2. Interface

File: `src/integrations/BrowserController.ts`

```ts
export interface BrowserSession {
  close(): Promise<void>;
}

export interface GmailPageController {
  checkLoginStatus(): Promise<"logged_in" | "logged_out" | "unknown">;
  performLogin(email: string, password: string): Promise<void>;
  performCareBehavior(): Promise<void>;
}

export interface BrowserController {
  connectByRemoteDebugging(host: string, port: number): Promise<BrowserSession>;
  openGmailTab(session: BrowserSession): Promise<GmailPageController>;
}
```

### 2.3. Playwright-based Skeleton

Nếu dùng Playwright:

```ts
import { chromium, Browser, Page } from "playwright";

class PlaywrightBrowserSession implements BrowserSession {
  constructor(private browser: Browser) {}

  async close(): Promise<void> {
    await this.browser.close();
  }
}

class PlaywrightGmailPageController implements GmailPageController {
  constructor(private page: Page) {}

  async checkLoginStatus(): Promise<"logged_in" | "logged_out" | "unknown"> {
    // TODO:
    // - Kiểm tra presence của một số selector đặc trưng
    // - Ví dụ: span chứa text "Inbox" hoặc icon Gmail
    // - Nếu thấy màn hình login => "logged_out"
    return "unknown";
  }

  async performLogin(email: string, password: string): Promise<void> {
    // TODO: selector Gmail login form
    // 1. goto gmail.com (nếu cần)
    // 2. điền email
    // 3. click Next
    // 4. điền password
    // 5. click Next
    // 6. chờ vào inbox
  }

  async performCareBehavior(): Promise<void> {
    // TODO:
    // - Mở một vài email
    // - Scroll inbox
    // - Đổi label (Sent, Spam,...)
    // - Mỗi bước sleep random 2-7s
  }
}

export class PlaywrightBrowserController implements BrowserController {
  async connectByRemoteDebugging(host: string, port: number): Promise<BrowserSession> {
    // TODO:
    // - Dùng chromium.connectOverCDP(`http://${host}:${port}`)
    // - Trả về BrowserSession
    throw new Error("Not implemented");
  }

  async openGmailTab(session: BrowserSession): Promise<GmailPageController> {
    // TODO:
    // - Từ session (browser), tạo page mới hoặc lấy page hiện có
    // - goto 'https://mail.google.com/'
    // - Trả về PlaywrightGmailPageController
    throw new Error("Not implemented");
  }
}
```

> Giai đoạn 1: chỉ cần skeleton + vài log console, sau đó mới refine selector & behavior.

---

## 3. GmailService – Implementation Detail

File: `src/plugins/gmail/GmailService.ts`

### 3.1. Phụ thuộc

`GmailService` sẽ dùng:

* `PrismaClient` để đọc/ghi `Account`, `Profile`.
* `ProfileService` để:

  * start profile
  * lấy remote debugging info
* `BrowserController` để:

  * connect Chrome
  * mở Gmail
  * gọi logic check/login/care
* `LogService` để ghi log.

### 3.2. Interface nội bộ

```ts
export class GmailService {
  constructor(
    private prisma: PrismaClient,
    private profileService: ProfileService,
    private browserController: BrowserController,
    private logService: LogService
  ) {}

  checkAccount(accountId: string): Promise<void>;
  careAccount(accountId: string): Promise<void>;
  loginAccount(accountId: string): Promise<void>;
}
```

### 3.3. Flow: checkAccount

Pseudo:

```ts
async checkAccount(accountId: string): Promise<void> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Account not found");
  if (account.accountType !== "gmail") throw new Error("Not a gmail account");

  // 1) Lấy profile
  const profile = await profileService.ensureProfileForAccount(account);
  // ensureProfileForAccount: nếu chưa có profileId thì map/tạo, nếu có thì lấy.

  // 2) Start profile qua GpmLoginAdapter (bên trong profileService)
  const { host, port } = await profileService.ensureProfileRunning(profile.id);

  // 3) Connect Browser
  const session = await browserController.connectByRemoteDebugging(host, port);
  try {
    const gmailPage = await browserController.openGmailTab(session);

    const status = await gmailPage.checkLoginStatus();

    if (status === "logged_in") {
      // update DB
      await prisma.account.update({
        where: { id: account.id },
        data: {
          status: "active",
          lastCheck: new Date(),
        },
      });
      await logService.logInfo("gmail", `Account ${account.identifier} already logged in`, { accountId });
      return;
    }

    if (status === "logged_out") {
      await this.loginAccount(accountId);
      return;
    }

    // unknown
    await logService.logWarning("gmail", "Unknown login status", { accountId });
  } finally {
    await session.close();
  }
}
```

### 3.4. Flow: loginAccount

```ts
async loginAccount(accountId: string): Promise<void> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Account not found");

  if (!account.passwordEncrypted) {
    await logService.logError("gmail", "No password stored for login", { accountId });
    return;
  }

  // giải mã mật khẩu nếu bạn dùng encryption riêng (tạm thời có thể plaintext)
  const password = account.passwordEncrypted; // TODO: decrypt

  const profile = await profileService.ensureProfileForAccount(account);
  const { host, port } = await profileService.ensureProfileRunning(profile.id);

  const session = await browserController.connectByRemoteDebugging(host, port);
  try {
    const gmailPage = await browserController.openGmailTab(session);

    await gmailPage.performLogin(account.identifier, password);

    await prisma.account.update({
      where: { id: account.id },
      data: {
        status: "active",
        lastLogin: new Date(),
        lastCheck: new Date(),
      },
    });

    await logService.logInfo("gmail", `Login success for ${account.identifier}`, { accountId });
  } catch (err) {
    await prisma.account.update({
      where: { id: account.id },
      data: {
        status: "error",
      },
    });
    await logService.logError("gmail", `Login failed for ${account.identifier}`, {
      accountId,
      error: `${err}`,
    });
    throw err;
  } finally {
    await session.close();
  }
}
```

### 3.5. Flow: careAccount

```ts
async careAccount(accountId: string): Promise<void> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Account not found");

  // optional: check interval lastCare

  const profile = await profileService.ensureProfileForAccount(account);
  const { host, port } = await profileService.ensureProfileRunning(profile.id);

  const session = await browserController.connectByRemoteDebugging(host, port);
  try {
    const gmailPage = await browserController.openGmailTab(session);

    const status = await gmailPage.checkLoginStatus();
    if (status !== "logged_in") {
      await this.loginAccount(accountId);
    }

    await gmailPage.performCareBehavior();

    await prisma.account.update({
      where: { id: account.id },
      data: {
        lastCare: new Date(),
        lastCheck: new Date(),
      },
    });

    await logService.logInfo("gmail", `Care done for ${account.identifier}`, { accountId });
  } finally {
    await session.close();
  }
}
```

---

## 4. Plugin: gmail_module.ts

`gmail_module.ts` sẽ wrap `GmailService` thành `AccountPlugin` để PluginManager dùng.

```ts
import { AccountPlugin } from "../../core/plugins/types";
import { GmailService } from "./GmailService";
import { prisma } from "../../core/db"; // hoặc đường dẫn bạn đang dùng
import { ProfileService } from "../../core/services/ProfileService";
import { PlaywrightBrowserController } from "../../integrations/BrowserController";
import { LogService } from "../../core/services/LogService";

const gmailService = new GmailService(
  prisma,
  new ProfileService(/* ... */),
  new PlaywrightBrowserController(),
  new LogService(prisma)
);

export const GmailPlugin: AccountPlugin = {
  name: "gmail",
  supportedTypes: ["gmail"],

  async checkAccount(accountId: string) {
    await gmailService.checkAccount(accountId);
  },

  async careAccount(accountId: string) {
    await gmailService.careAccount(accountId);
  },

  async loginAccount(accountId: string) {
    await gmailService.loginAccount(accountId);
  },
};
```

---

## 5. Ghi chú triển khai

* Giai đoạn đầu: cho phép `GmailService` chỉ log console + update DB, chưa cần behavior quá phức tạp.
* Khi đã verify kết nối GPM + Playwright hoạt động:

  * Bổ sung selector cụ thể cho Gmail.
  * Bổ sung hành vi care chi tiết & randomization.
* Tuyệt đối không để mật khẩu lộ log.
* Sau này có thể thêm:

  * Encryption cho password.
  * Retry cơ chế nếu connect thất bại.
  * Timeout logic cho từng step.

````

