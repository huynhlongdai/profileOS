Ok, mình làm theo đúng thứ tự bạn yêu cầu:

1. **Hoàn thiện GmailService + GmailPlugin**
2. **Thiết kế & dùng `configJson` để Gmail module có settings riêng**

Mình sẽ viết dạng **spec + skeleton code** để bạn quăng thẳng cho Cursor.

---

## A. Chuẩn hoá cấu hình riêng cho Gmail (configJson)

### 1. Cấu trúc `configJson` cho module `gmail`

Ta sẽ lưu cấu hình trong `ModuleConfig.configJson` (JSON string), với kiểu:

```ts
// src/plugins/gmail/gmailConfig.ts

export type RandomBehaviorLevel = "low" | "medium" | "high";

export interface GmailModuleConfig {
  /** 
   * Khoảng tối thiểu giữa 2 lần care một account (phút).
   * Dùng để tránh spam hành vi.
   */
  minCareIntervalMinutes: number;

  /**
   * Nếu true: khi check thấy logged_out sẽ tự login lại.
   * Nếu false: chỉ báo lỗi, không tự login.
   */
  autoLoginIfLoggedOut: boolean;

  /**
   * Nếu true: bỏ qua care khi account mới được login rất gần.
   */
  skipCareIfRecentlyLoggedInMinutes: number;

  /**
   * Mức độ random behavior (dùng cho nội bộ GmailPageController).
   */
  randomBehaviorLevel: RandomBehaviorLevel;
}
```

### 2. Default + parser

```ts
// src/plugins/gmail/gmailConfig.ts

const DEFAULT_GMAIL_CONFIG: GmailModuleConfig = {
  minCareIntervalMinutes: 120,            // 2 giờ
  autoLoginIfLoggedOut: true,
  skipCareIfRecentlyLoggedInMinutes: 10,  // 10 phút
  randomBehaviorLevel: "medium",
};

export function parseGmailConfig(configJson?: string | null): GmailModuleConfig {
  if (!configJson) return DEFAULT_GMAIL_CONFIG;

  try {
    const parsed = JSON.parse(configJson);
    return {
      minCareIntervalMinutes:
        typeof parsed.minCareIntervalMinutes === "number"
          ? parsed.minCareIntervalMinutes
          : DEFAULT_GMAIL_CONFIG.minCareIntervalMinutes,

      autoLoginIfLoggedOut:
        typeof parsed.autoLoginIfLoggedOut === "boolean"
          ? parsed.autoLoginIfLoggedOut
          : DEFAULT_GMAIL_CONFIG.autoLoginIfLoggedOut,

      skipCareIfRecentlyLoggedInMinutes:
        typeof parsed.skipCareIfRecentlyLoggedInMinutes === "number"
          ? parsed.skipCareIfRecentlyLoggedInMinutes
          : DEFAULT_GMAIL_CONFIG.skipCareIfRecentlyLoggedInMinutes,

      randomBehaviorLevel:
        parsed.randomBehaviorLevel === "low" ||
        parsed.randomBehaviorLevel === "medium" ||
        parsed.randomBehaviorLevel === "high"
          ? parsed.randomBehaviorLevel
          : DEFAULT_GMAIL_CONFIG.randomBehaviorLevel,
    };
  } catch {
    // nếu JSON lỗi → fallback default
    return DEFAULT_GMAIL_CONFIG;
  }
}
```

---

## B. GmailService – spec + implementation skeleton

### 1. Interface & constructor

Ta cần thêm `ModuleService` vào GmailService để đọc config:

```ts
// src/plugins/gmail/GmailService.ts
import { PrismaClient } from "@prisma/client";
import { ProfileService } from "../../core/services/ProfileService";
import { BrowserController } from "../../integrations/BrowserController";
import { LogService } from "../../core/services/LogService";
import { ModuleService } from "../../core/services/ModuleService";
import { parseGmailConfig, GmailModuleConfig } from "./gmailConfig";

export class GmailService {
  constructor(
    private prisma: PrismaClient,
    private profileService: ProfileService,
    private browserController: BrowserController,
    private logService: LogService,
    private moduleService: ModuleService
  ) {}

  async checkAccount(accountId: string): Promise<void> {
    // implement bên dưới
  }

  async loginAccount(accountId: string): Promise<void> {
    // implement bên dưới
  }

  async careAccount(accountId: string): Promise<void> {
    // implement bên dưới
  }

  // -------- helpers --------

  private async getConfig(): Promise<GmailModuleConfig> {
    const mod = await this.moduleService.getModule("gmail");
    return parseGmailConfig(mod?.configJson);
  }

  private decryptPassword(encrypted: string): string {
    // TODO: hiện tại có thể return plaintext, sau này thay bằng decrypt thực sự
    return encrypted;
  }

  private minutesDiff(a: Date, b: Date): number {
    return Math.abs(a.getTime() - b.getTime()) / 1000 / 60;
  }
}
```

---

### 2. Flow: `checkAccount(accountId)`

Logic:

1. Lấy account từ DB, check `accountType = 'gmail'`
2. Đảm bảo có profile GPM: `ensureProfileForAccount`
3. Đảm bảo profile đang chạy: `ensureProfileRunning` → lấy `{ host, port }`
4. Dùng `BrowserController`:

   * `connectByRemoteDebugging(host, port)`
   * `openGmailTab(session)` → `GmailPageController`
   * `checkLoginStatus()`
5. Nếu:

   * `logged_in` → update status, log
   * `logged_out`:

     * Nếu config.autoLoginIfLoggedOut = true → gọi `loginAccount`
     * Nếu false → set status `logged_out`, log warning
   * `unknown` → log warning

Skeleton:

```ts
// trong GmailService
import { GmailPageController } from "../../integrations/BrowserController";

async checkAccount(accountId: string): Promise<void> {
  const account = await this.prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Account not found");
  if (account.accountType !== "gmail") {
    throw new Error(`GmailService only supports gmail accounts`);
  }

  const config = await this.getConfig();

  // 1) ensure profile
  const profile = await this.profileService.ensureProfileForAccount(account);

  // 2) ensure running
  const { host, port } = await this.profileService.ensureProfileRunning(profile.id);

  const session = await this.browserController.connectByRemoteDebugging(host, port);
  try {
    const gmailPage: GmailPageController = await this.browserController.openGmailTab(session);

    const status = await gmailPage.checkLoginStatus();

    if (status === "logged_in") {
      await this.prisma.account.update({
        where: { id: account.id },
        data: {
          status: "active",
          lastCheck: new Date(),
        },
      });

      await this.logService.logInfo("gmail", "Account already logged in", {
        accountId,
        identifier: account.identifier,
      });

      return;
    }

    if (status === "logged_out") {
      if (config.autoLoginIfLoggedOut) {
        await this.logService.logInfo("gmail", "Account logged out, auto-login enabled", {
          accountId,
        });
        await this.loginAccount(accountId);
      } else {
        await this.prisma.account.update({
          where: { id: account.id },
          data: {
            status: "logged_out",
            lastCheck: new Date(),
          },
        });
        await this.logService.logWarning("gmail", "Account logged out, auto-login disabled", {
          accountId,
        });
      }
      return;
    }

    // unknown
    await this.logService.logWarning("gmail", "Unknown login status", {
      accountId,
    });
  } finally {
    await session.close();
  }
}
```

---

### 3. Flow: `loginAccount(accountId)`

Logic:

1. Lấy account, đảm bảo có `passwordEncrypted`
2. Đảm bảo profile & profile running (có thể dùng lại helper như `checkAccount`)
3. Dùng `BrowserController`:

   * `openGmailTab`
   * `performLogin(email, password)`
4. Nếu OK:

   * cập nhật `status='active'`, `lastLogin`, `lastCheck`
5. Nếu lỗi:

   * `status='error'`, log error

Skeleton:

```ts
async loginAccount(accountId: string): Promise<void> {
  const account = await this.prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Account not found");
  if (account.accountType !== "gmail") throw new Error("Not a gmail account");

  if (!account.passwordEncrypted) {
    await this.logService.logError("gmail", "No password stored for login", { accountId });
    return;
  }

  const password = this.decryptPassword(account.passwordEncrypted);

  const profile = await this.profileService.ensureProfileForAccount(account);
  const { host, port } = await this.profileService.ensureProfileRunning(profile.id);

  const session = await this.browserController.connectByRemoteDebugging(host, port);

  try {
    const gmailPage = await this.browserController.openGmailTab(session);
    await gmailPage.performLogin(account.identifier, password);

    await this.prisma.account.update({
      where: { id: account.id },
      data: {
        status: "active",
        lastLogin: new Date(),
        lastCheck: new Date(),
      },
    });

    await this.logService.logInfo("gmail", "Login success", {
      accountId,
      identifier: account.identifier,
    });
  } catch (err) {
    await this.prisma.account.update({
      where: { id: account.id },
      data: {
        status: "error",
      },
    });
    await this.logService.logError("gmail", "Login failed", {
      accountId,
      identifier: account.identifier,
      error: String(err),
    });
    throw err;
  } finally {
    await session.close();
  }
}
```

---

### 4. Flow: `careAccount(accountId)` (dùng configJson)

Logic:

1. Lấy account
2. Lấy config:

   * `minCareIntervalMinutes`
   * `skipCareIfRecentlyLoggedInMinutes`
3. Nếu `lastCare` gần hơn `minCareIntervalMinutes` → bỏ qua, log & return
4. Đảm bảo profile running
5. Dùng `BrowserController`:

   * checkLoginStatus
   * nếu không logged_in:

     * nếu `autoLoginIfLoggedOut` thì gọi `loginAccount`
     * ngược lại log + return
6. Gọi `gmailPage.performCareBehavior()` (hành vi mô phỏng)
7. Cập nhật `lastCare`, `lastCheck`
8. Log

Skeleton:

```ts
async careAccount(accountId: string): Promise<void> {
  const account = await this.prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Account not found");
  if (account.accountType !== "gmail") throw new Error("Not a gmail account");

  const config = await this.getConfig();
  const now = new Date();

  if (account.lastCare) {
    const diff = this.minutesDiff(now, account.lastCare);
    if (diff < config.minCareIntervalMinutes) {
      await this.logService.logInfo("gmail", "Skip care: too soon since last care", {
        accountId,
        minutesSinceLastCare: diff,
        minCareIntervalMinutes: config.minCareIntervalMinutes,
      });
      return;
    }
  }

  if (account.lastLogin) {
    const diffLogin = this.minutesDiff(now, account.lastLogin);
    if (diffLogin < config.skipCareIfRecentlyLoggedInMinutes) {
      await this.logService.logInfo("gmail", "Skip care: recently logged in", {
        accountId,
        minutesSinceLastLogin: diffLogin,
        skipCareIfRecentlyLoggedInMinutes:
          config.skipCareIfRecentlyLoggedInMinutes,
      });
      return;
    }
  }

  const profile = await this.profileService.ensureProfileForAccount(account);
  const { host, port } = await this.profileService.ensureProfileRunning(profile.id);

  const session = await this.browserController.connectByRemoteDebugging(host, port);
  try {
    const gmailPage = await this.browserController.openGmailTab(session);
    const status = await gmailPage.checkLoginStatus();

    if (status !== "logged_in") {
      if (config.autoLoginIfLoggedOut) {
        await this.logService.logInfo("gmail", "Care: account not logged in, auto logging in", {
          accountId,
        });
        await this.loginAccount(accountId);
      } else {
        await this.logService.logWarning("gmail", "Care: account not logged in and autoLogin disabled", {
          accountId,
        });
        return;
      }
    }

    // ở đây BrowserController có thể dùng config.randomBehaviorLevel nội bộ,
    // nếu cần bạn có thể truyền config vào constructor controller sau này
    await gmailPage.performCareBehavior();

    await this.prisma.account.update({
      where: { id: account.id },
      data: {
        lastCare: new Date(),
        lastCheck: new Date(),
      },
    });

    await this.logService.logInfo("gmail", "Care done", {
      accountId,
      identifier: account.identifier,
    });
  } finally {
    await session.close();
  }
}
```

---

## C. GmailPlugin – wiring dependencies + dùng ModuleService

### 1. Định nghĩa plugin dưới dạng factory

Thay vì plugin tự new Prisma/Service, tốt nhất là dùng **factory** để inject từ bootstrap:

```ts
// src/plugins/gmail/gmail_plugin.ts
import { AccountPlugin } from "../../core/plugins/types";
import { GmailService } from "./GmailService";
import { PrismaClient } from "@prisma/client";
import { ProfileService } from "../../core/services/ProfileService";
import { BrowserController } from "../../integrations/BrowserController";
import { LogService } from "../../core/services/LogService";
import { ModuleService } from "../../core/services/ModuleService";

export interface GmailPluginDeps {
  prisma: PrismaClient;
  profileService: ProfileService;
  browserController: BrowserController;
  logService: LogService;
  moduleService: ModuleService;
}

export function createGmailPlugin(deps: GmailPluginDeps): AccountPlugin {
  const gmailService = new GmailService(
    deps.prisma,
    deps.profileService,
    deps.browserController,
    deps.logService,
    deps.moduleService
  );

  return {
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
}
```

### 2. Đăng ký plugin trong bootstrap

```ts
// src/core/bootstrap.ts (ví dụ)
import { PrismaClient } from "@prisma/client";
import { ModuleService } from "./services/ModuleService";
import { PluginManager } from "./plugins/PluginManager";
import { createGmailPlugin } from "../plugins/gmail/gmail_plugin";
import { ProfileService } from "./services/ProfileService";
import { ProxyService } from "./services/ProxyService";
import { LogService } from "./services/LogService";
import { HttpGpmLoginAdapter } from "../integrations/GpmLoginAdapter";
import { PlaywrightBrowserController } from "../integrations/BrowserController";
import { ProxyAPIAdapterImpl } from "../integrations/ProxyAPIAdapter";
import { AccountService } from "./services/AccountService";
import { TaskService } from "./services/TaskService";

const prisma = new PrismaClient();
const logService = new LogService(prisma);

const moduleService = new ModuleService(prisma);
const proxyApi = new ProxyAPIAdapterImpl();
const proxyService = new ProxyService(prisma, proxyApi, logService);
const gpmAdapter = new HttpGpmLoginAdapter();
const profileService = new ProfileService(prisma, gpmAdapter, proxyService, logService);

const browserController = new PlaywrightBrowserController();

const pluginManager = new PluginManager(moduleService);

const gmailPlugin = createGmailPlugin({
  prisma,
  profileService,
  browserController,
  logService,
  moduleService,
});

pluginManager.registerPlugin(gmailPlugin);

const accountService = new AccountService(
  prisma,
  pluginManager,
  proxyService,
  profileService,
  logService
);

const taskService = new TaskService(accountService);

export const core = {
  prisma,
  logService,
  moduleService,
  proxyService,
  profileService,
  pluginManager,
  gmailPlugin,
  accountService,
  taskService,
};
```

---

## D. Dùng `configJson` trong UI (Gmail settings riêng)

Bước 2 bạn nói là “Thiết kế & dùng configJson để Module Gmail có settings riêng” → mình đề xuất:

### 1. API config riêng cho từng module

Thêm route:

`PATCH /api/modules/[name]/config`

Body cho Gmail:

```json
{
  "minCareIntervalMinutes": 90,
  "autoLoginIfLoggedOut": true,
  "skipCareIfRecentlyLoggedInMinutes": 15,
  "randomBehaviorLevel": "high"
}
```

Route:

```ts
// src/app/api/modules/[name]/config/route.ts
import { NextRequest, NextResponse } from "next/server";
import { core } from "@/core/bootstrap";
import { parseGmailConfig } from "@/plugins/gmail/gmailConfig";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  const name = params.name;
  const body = await req.json();

  // Hiện tại ta chỉ define rõ spec cho gmail
  if (name === "gmail") {
    // validate sơ
    const cfg = parseGmailConfig(JSON.stringify(body)); // parse để apply default/validate
    const json = JSON.stringify(cfg);
    const mod = await core.moduleService.updateModuleConfig(name, json);
    return NextResponse.json({ success: true, module: mod });
  }

  return NextResponse.json(
    { success: false, error: "Config for this module is not implemented yet" },
    { status: 400 }
  );
}
```

> Ý: dùng `parseGmailConfig` như một bộ validate + normalize.

### 2. UI: Gmail settings

Trên `/modules`, với dòng Gmail, bạn có thể thêm nút **“Settings”** mở modal:

* Form fields:

  * `minCareIntervalMinutes` (number)
  * `autoLoginIfLoggedOut` (checkbox)
  * `skipCareIfRecentlyLoggedInMinutes` (number)
  * `randomBehaviorLevel` (select: low/medium/high)
* Submit → gọi `PATCH /api/modules/gmail/config` với JSON như trên.

GmailService sẽ tự động đọc config mới thông qua `ModuleService.getModule('gmail')`.

---

## E. Gợi ý prompt cho Cursor để implement phần này

Bạn có thể dùng prompt ngắn như:

```md
Hãy đọc các file spec sau trong project:

- APPLICATION_SPEC_V2.md
- AUTOMATION_LAYER_SPEC.md
- MODULES_DETAIL_SPEC.md
- MODULES Implementation Specification (Modules Implementation Specification của tôi)

Mục tiêu: Hoàn thiện GmailService + GmailPlugin và dùng ModuleConfig.configJson để cấu hình behavior riêng cho Gmail.

Các việc cần làm:

1. Tạo file `src/plugins/gmail/gmailConfig.ts` với:
   - type `GmailModuleConfig`
   - default config
   - hàm `parseGmailConfig(configJson?: string | null): GmailModuleConfig`

2. Cập nhật/implement file `src/plugins/gmail/GmailService.ts`:
   - Constructor: nhận thêm `ModuleService`
   - Hàm `checkAccount(accountId)`, `loginAccount(accountId)`, `careAccount(accountId)` theo đúng flow mà spec mô tả:
     - Sử dụng ProfileService, BrowserController, LogService, Prisma
     - Đọc cấu hình thông qua `ModuleService.getModule("gmail")` + `parseGmailConfig`
     - Áp dụng các rule:
       - `autoLoginIfLoggedOut`
       - `minCareIntervalMinutes`
       - `skipCareIfRecentlyLoggedInMinutes`
     - Cập nhật trường `status`, `lastCheck`, `lastLogin`, `lastCare` trong bảng Account

3. Tạo file `src/plugins/gmail/gmail_plugin.ts` với factory `createGmailPlugin(deps)` như trong spec, trả về `AccountPlugin` dùng GmailService.

4. Cập nhật `src/core/bootstrap.ts` (hoặc file bootstrap hiện tại) để:
   - Khởi tạo ModuleService
   - Khởi tạo PluginManager với ModuleService
   - Khởi tạo ProfileService, ProxyService, LogService, BrowserController
   - Khởi tạo GmailPlugin bằng `createGmailPlugin(...)`
   - `pluginManager.registerPlugin(gmailPlugin)`
   - Khởi tạo AccountService, TaskService
   - Export object `core` dùng cho API routes.

5. (Optional nhưng ưu tiên): Tạo route `PATCH /api/modules/[name]/config` để:
   - Với name = 'gmail':
     - Validate body bằng `parseGmailConfig`
     - Gọi `ModuleService.updateModuleConfig("gmail", JSON.stringify(configNormalized))`
   - Trả về module đã update.

Giữ nguyên kiến trúc CORE + PLUGIN hiện tại, không đổi tên model Prisma, không phá vỡ contract của các service đã có. Chỉ thêm và hoàn thiện GmailService, GmailPlugin và config Gmail.
```

---

Tới đây:

* **GmailService + GmailPlugin** đã có spec khá chi tiết để Cursor code.
* `configJson` cho module Gmail đã có kiểu rõ ràng + flow đọc/ghi + API + gợi ý UI.

Nếu bạn muốn bước tiếp nữa, mình có thể đi vào **chi tiết Playwright selectors cho Gmail** (form login, check login trạng thái, behavior mở mail/scroll, v.v.) để GmailPageController cũng “full skill” luôn.
