Ok, hay nè, mình sẽ coi “thu thập Candy CoinGecko” như **một module plugin mới**, tương tự Gmail, nhưng làm việc với:

* **accountType = 'coingecko'**
* Trang: `https://www.coingecko.com/en/candy`
* Core vẫn là: **GPM profile + Proxy + Account + BrowserController**, không đụng vào lõi. 

Mình chia thành 3 phần:

1. Định nghĩa module trong hệ Modules (Registry + configJson)
2. `CoinGeckoCandyService` – logic claim Candy
3. `CoinGeckoCandyPlugin` + mở rộng `BrowserController`

---

## 1. Định nghĩa module “CoinGecko Candy” trong hệ Modules

### 1.1. ModuleRegistry

File: `src/core/modules/ModuleRegistry.ts`

```ts
export interface ModuleMeta {
  name: string;
  label: string;
  description: string;
  version: string;
  docsUrl?: string;
}

export const BUILTIN_MODULES: ModuleMeta[] = [
  {
    name: "gmail",
    label: "Gmail Module",
    description: "Tự động check/login/care tài khoản Gmail sử dụng GPM profile + proxy.",
    version: "1.0.0",
  },
  {
    name: "coingecko_candy",
    label: "CoinGecko Candy",
    description: "Tự động claim daily Candy trên CoinGecko cho các tài khoản coingecko.",
    version: "1.0.0",
  },
  // ... các module khác sau này
];
```

> Module này sẽ điều khiển plugin xử lý **accountType: 'coingecko'**.

---

### 1.2. Cấu trúc `configJson` cho module `coingecko_candy`

File: `src/plugins/coingecko/candyConfig.ts`

```ts
export type ClaimScheduleMode = "anytime" | "fixed_window";

export interface CoinGeckoCandyConfig {
  /**
   * Khoảng tối thiểu giữa 2 lần claim (phút).
   * Dùng để tránh spam / trùng lặp.
   */
  minClaimIntervalMinutes: number;

  /**
   * Nếu true, module sẽ tự login nếu phát hiện đang logout.
   */
  autoLoginIfLoggedOut: boolean;

  /**
   * Nếu fixed_window: chỉ claim trong khoảng giờ cho phép, ví dụ 7h–11h sáng.
   */
  claimScheduleMode: ClaimScheduleMode;
  claimStartHour: number;  // 0–23
  claimEndHour: number;    // 0–23

  /**
   * Nếu true: sau khi claim xong sẽ cố gắng xem/hoàn thành một số mission (nếu có).
   */
  tryDoMissions: boolean;
}

const DEFAULT_CONFIG: CoinGeckoCandyConfig = {
  minClaimIntervalMinutes: 60,
  autoLoginIfLoggedOut: true,
  claimScheduleMode: "anytime",
  claimStartHour: 7,
  claimEndHour: 11,
  tryDoMissions: false,
};

export function parseCoinGeckoCandyConfig(
  configJson?: string | null
): CoinGeckoCandyConfig {
  if (!configJson) return DEFAULT_CONFIG;

  try {
    const raw = JSON.parse(configJson);

    return {
      minClaimIntervalMinutes:
        typeof raw.minClaimIntervalMinutes === "number"
          ? raw.minClaimIntervalMinutes
          : DEFAULT_CONFIG.minClaimIntervalMinutes,

      autoLoginIfLoggedOut:
        typeof raw.autoLoginIfLoggedOut === "boolean"
          ? raw.autoLoginIfLoggedOut
          : DEFAULT_CONFIG.autoLoginIfLoggedOut,

      claimScheduleMode:
        raw.claimScheduleMode === "fixed_window" ? "fixed_window" : "anytime",

      claimStartHour:
        typeof raw.claimStartHour === "number"
          ? raw.claimStartHour
          : DEFAULT_CONFIG.claimStartHour,

      claimEndHour:
        typeof raw.claimEndHour === "number"
          ? raw.claimEndHour
          : DEFAULT_CONFIG.claimEndHour,

      tryDoMissions:
        typeof raw.tryDoMissions === "boolean"
          ? raw.tryDoMissions
          : DEFAULT_CONFIG.tryDoMissions,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}
```

> Sau này UI `/modules` có thể có form cho người dùng chỉnh những trường này.

---

## 2. CoinGeckoCandyService – logic thu thập Candy

Module này sẽ:

* Mỗi **account coingecko** tương ứng một tài khoản CoinGecko
* Dùng **GPM profile** + **proxy** + **BrowserController** → mở `https://www.coingecko.com/en/candy`
* Nếu chưa login → login (nếu được phép bởi config)
* Check xem hôm nay đã claim chưa:

  * Nếu chưa → click claim
  * Ghi lại `lastCandyClaim`, `lastCheck`, log event
  * Có thể đọc số Candy hiện tại để log thêm.

### 2.1. Mở rộng model Account (nếu muốn track riêng Candy)

Nếu trong Prisma bạn muốn track:

```prisma
model Account {
  id        String   @id @default(cuid())
  identifier String
  accountType String   // 'gmail' | 'coingecko' | ...
  // ...
  lastCheck     DateTime?
  lastLogin     DateTime?
  lastCare      DateTime?

  // thêm trường cho CoinGecko Candy (optional)
  lastCandyClaim   DateTime?
  lastCandyAmount  Int?        // tổng candy sau lần claim gần nhất
}
```

*(Phần này tuỳ bạn, không bắt buộc)*

---

### 2.2. CoinGeckoCandyService interface

File: `src/plugins/coingecko/CoinGeckoCandyService.ts`

```ts
import { PrismaClient } from "@prisma/client";
import { ProfileService } from "../../core/services/ProfileService";
import { BrowserController, CoinGeckoCandyPageController } from "../../integrations/BrowserController";
import { LogService } from "../../core/services/LogService";
import { ModuleService } from "../../core/services/ModuleService";
import {
  CoinGeckoCandyConfig,
  parseCoinGeckoCandyConfig,
} from "./candyConfig";

export class CoinGeckoCandyService {
  constructor(
    private prisma: PrismaClient,
    private profileService: ProfileService,
    private browserController: BrowserController,
    private logService: LogService,
    private moduleService: ModuleService
  ) {}

  async claimCandyForAccount(accountId: string): Promise<void> {
    // implement chi tiết bên dưới
  }

  async checkCandyStatus(accountId: string): Promise<void> {
    // optional: chỉ đọc status & log
  }

  // ===== Helpers =====

  private async getConfig(): Promise<CoinGeckoCandyConfig> {
    const mod = await this.moduleService.getModule("coingecko_candy");
    return parseCoinGeckoCandyConfig(mod?.configJson);
  }

  private minutesDiff(a: Date, b: Date): number {
    return Math.abs(a.getTime() - b.getTime()) / 1000 / 60;
  }

  private isWithinClaimWindow(config: CoinGeckoCandyConfig, now: Date): boolean {
    if (config.claimScheduleMode !== "fixed_window") return true;
    const hour = now.getHours();
    if (config.claimStartHour <= config.claimEndHour) {
      return hour >= config.claimStartHour && hour < config.claimEndHour;
    }
    // qua nửa đêm
    return hour >= config.claimStartHour || hour < config.claimEndHour;
  }
}
```

### 2.3. Logic `claimCandyForAccount`

Pseudo-flow:

1. Lấy account từ DB, check `accountType === 'coingecko'`
2. Đọc config
3. Nếu đã claim gần đây < `minClaimIntervalMinutes` → log & return
4. Nếu `claimScheduleMode = fixed_window` mà đang ngoài khung giờ → log & return
5. `ensureProfileForAccount` + `ensureProfileRunning` → host/port
6. BrowserController:

   * `connectByRemoteDebugging`
   * `openCoinGeckoCandyPage`
   * `checkLoginStatus`
7. Nếu cần login:

   * Nếu `autoLoginIfLoggedOut` = true → login
   * Ngược lại → log & return
8. `claimDailyCandy()`:

   * Nếu “already claimed” → log
   * Nếu “claimed successfully” → lấy số Candy hiện tại
9. Update DB: `lastCandyClaim`, `lastCheck`, `lastCandyAmount`
10. Ghi log

Skeleton:

```ts
// trong CoinGeckoCandyService
async claimCandyForAccount(accountId: string): Promise<void> {
  const account = await this.prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Account not found");
  if (account.accountType !== "coingecko") {
    throw new Error("CoinGeckoCandyService chỉ áp dụng cho accountType = 'coingecko'");
  }

  const config = await this.getConfig();
  const now = new Date();

  // 1) Check interval
  if (account.lastCandyClaim) {
    const diff = this.minutesDiff(now, account.lastCandyClaim);
    if (diff < config.minClaimIntervalMinutes) {
      await this.logService.logInfo("coingecko_candy", "Skip claim: too soon since last claim", {
        accountId,
        minutesSinceLastClaim: diff,
        minClaimIntervalMinutes: config.minClaimIntervalMinutes,
      });
      return;
    }
  }

  // 2) Check time window
  if (!this.isWithinClaimWindow(config, now)) {
    await this.logService.logInfo("coingecko_candy", "Skip claim: outside claim window", {
      accountId,
      hour: now.getHours(),
      mode: config.claimScheduleMode,
      start: config.claimStartHour,
      end: config.claimEndHour,
    });
    return;
  }

  // 3) Profile + Browser
  const profile = await this.profileService.ensureProfileForAccount(account);
  const { host, port } = await this.profileService.ensureProfileRunning(profile.id);

  const session = await this.browserController.connectByRemoteDebugging(host, port);

  try {
    const candyPage: CoinGeckoCandyPageController =
      await this.browserController.openCoinGeckoCandyPage(session);

    const loginStatus = await candyPage.checkLoginStatus();

    if (loginStatus === "logged_out") {
      if (!config.autoLoginIfLoggedOut) {
        await this.logService.logWarning("coingecko_candy", "Account logged out and autoLogin disabled", {
          accountId,
        });
        return;
      }

      // 4) Login (giả sử mật khẩu lưu trong account.passwordEncrypted)
      if (!account.passwordEncrypted) {
        await this.logService.logError("coingecko_candy", "No password for login", { accountId });
        return;
      }
      const password = account.passwordEncrypted; // TODO: decrypt nếu cần

      await this.logService.logInfo("coingecko_candy", "Logging in CoinGecko...", {
        accountId,
        identifier: account.identifier,
      });
      await candyPage.performLogin(account.identifier, password);
    }

    // 5) Claim Candy
    const claimResult = await candyPage.claimDailyCandy();
    // claimResult: { status: 'claimed' | 'already_claimed' | 'error', candyAmount?: number }

    if (claimResult.status === "already_claimed") {
      await this.logService.logInfo("coingecko_candy", "Candy already claimed today", {
        accountId,
      });
      // vẫn có thể update lastCheck
      await this.prisma.account.update({
        where: { id: account.id },
        data: {
          lastCheck: new Date(),
        },
      });
      return;
    }

    if (claimResult.status === "error") {
      await this.logService.logError("coingecko_candy", "Failed to claim candy", {
        accountId,
      });
      return;
    }

    // 6) Optional: làm thêm missions
    if (config.tryDoMissions) {
      await this.logService.logInfo("coingecko_candy", "Trying to do missions", { accountId });
      await candyPage.tryCompleteMissions(); // có thể là no-op nếu không cần
    }

    // 7) Cập nhật DB
    await this.prisma.account.update({
      where: { id: account.id },
      data: {
        lastCandyClaim: new Date(),
        lastCheck: new Date(),
        lastCandyAmount: claimResult.candyAmount ?? account.lastCandyAmount,
      },
    });

    await this.logService.logInfo("coingecko_candy", "Candy claimed successfully", {
      accountId,
      candyAmount: claimResult.candyAmount,
    });
  } finally {
    await session.close();
  }
}
```

---

## 3. Plugin cho module – CoinGeckoCandyPlugin

Module này fit luôn vào `PluginManager` giống Gmail.

### 3.1. AccountPlugin cho CoinGecko

File: `src/plugins/coingecko/coingecko_candy_plugin.ts`

```ts
import { AccountPlugin } from "../../core/plugins/types";
import { CoinGeckoCandyService } from "./CoinGeckoCandyService";
import { PrismaClient } from "@prisma/client";
import { ProfileService } from "../../core/services/ProfileService";
import { BrowserController } from "../../integrations/BrowserController";
import { LogService } from "../../core/services/LogService";
import { ModuleService } from "../../core/services/ModuleService";

export interface CoinGeckoCandyPluginDeps {
  prisma: PrismaClient;
  profileService: ProfileService;
  browserController: BrowserController;
  logService: LogService;
  moduleService: ModuleService;
}

export function createCoinGeckoCandyPlugin(
  deps: CoinGeckoCandyPluginDeps
): AccountPlugin {
  const service = new CoinGeckoCandyService(
    deps.prisma,
    deps.profileService,
    deps.browserController,
    deps.logService,
    deps.moduleService
  );

  return {
    name: "coingecko_candy",
    supportedTypes: ["coingecko"],

    async checkAccount(accountId: string) {
      // Ở đây có thể chỉ đọc status, hoặc tái sử dụng logic claim
      await service.checkCandyStatus(accountId);
    },

    async careAccount(accountId: string) {
      // dùng careAccount như "claim candy"
      await service.claimCandyForAccount(accountId);
    },

    async loginAccount(accountId: string) {
      // nếu muốn có login riêng cho CoinGecko
      // có thể tách ra hàm login trong service, ví dụ service.loginAccount(accountId)
      await service.claimCandyForAccount(accountId); // hoặc no-op
    },
  };
}
```

### 3.2. Đăng ký trong bootstrap

Trong `src/core/bootstrap.ts` (hoặc nơi bạn khởi tạo core):

```ts
import { createCoinGeckoCandyPlugin } from "../plugins/coingecko/coingecko_candy_plugin";

// ... sau khi tạo prisma, moduleService, profileService, browserController, logService, pluginManager

const coingeckoCandyPlugin = createCoinGeckoCandyPlugin({
  prisma,
  profileService,
  browserController,
  logService,
  moduleService,
});

pluginManager.registerPlugin(coingeckoCandyPlugin);
```

Như vậy:

* Account có `accountType = 'coingecko'`
* Khi bạn bấm **Care** account đó:

  * `AccountService.triggerCare → PluginManager → coingecko_candy plugin → CoinGeckoCandyService.claimCandyForAccount`
* Module `coingecko_candy` có thể bật/tắt ở `/modules`:

  * Nếu tắt → plugin không được gọi.

---

## 4. Mở rộng BrowserController cho CoinGecko Candy

Bạn cần thêm interface cho trang Coingecko:

File: `src/integrations/BrowserController.ts`

```ts
export interface CoinGeckoCandyPageController {
  /**
   * Đảm bảo đã ở trang Candy: https://www.coingecko.com/en/candy
   * (Nếu chưa thì tự navigate).
   */
  goToCandyPage(): Promise<void>;

  /**
   * Kiểm tra đã login hay chưa.
   * 'logged_in' | 'logged_out' | 'unknown'
   */
  checkLoginStatus(): Promise<"logged_in" | "logged_out" | "unknown">;

  /**
   * Thực hiện login, giả định form login của CoinGecko:
   * email + password, có thể phải handle trường hợp captcha = nhờ người dùng.
   */
  performLogin(email: string, password: string): Promise<void>;

  /**
   * Thực hiện claim daily Candy.
   * Trả về trạng thái claim và (nếu được) số Candy mới.
   */
  claimDailyCandy(): Promise<{
    status: "claimed" | "already_claimed" | "error";
    candyAmount?: number;
  }>;

  /**
   * Optional: thử làm một số mission đơn giản (nếu muốn).
   */
  tryCompleteMissions(): Promise<void>;
}
```

Trong `PlaywrightBrowserController` hay implementation bạn đang dùng, chỉ cần implement thêm method:

```ts
export class PlaywrightBrowserController implements BrowserController {
  // ...

  async openCoinGeckoCandyPage(
    session: BrowserSession
  ): Promise<CoinGeckoCandyPageController> {
    // TODO: mở tab mới hoặc dùng tab hiện có, navigate tới https://www.coingecko.com/en/candy
    // và return 1 object implement CoinGeckoCandyPageController
  }
}
```

Còn phần selectors cụ thể (button “Claim”, text “You’ve already claimed”, v.v.) bạn có thể để Cursor/Playwright handle sau.

---

## 5. Bạn dùng cái này thế nào?

* Thêm account mới:

  * `accountType = 'coingecko'`
  * `identifier = email dùng cho CoinGecko`
  * `passwordEncrypted` = mật khẩu (mã hoá nếu có)
  * Gán profile GPM & proxy bình thường.
* Vào `/modules`:

  * Đảm bảo module `CoinGecko Candy` đang **Enabled**
  * (optional) Mở Settings để chỉnh `minClaimInterval`, timeframe, `tryDoMissions`.
* Vào **Accounts**:

  * Chọn account `coingecko` → bấm **Care** (hoặc bulk care)
  * Hệ thống sẽ:

    * Mở profile GPM → Chrome
    * Mở trang Candy
    * Login nếu cần
    * Claim Candy
    * Ghi log + update `lastCandyClaim`.

Nếu bạn muốn bước tiếp, mình có thể:

* Viết luôn **route `/api/modules/coingecko_candy/config` + UI settings** cho module này,
  hoặc
* Đi sâu hơn vào **Playwright selectors & flow login/claim Candy** (tách ra file riêng).
