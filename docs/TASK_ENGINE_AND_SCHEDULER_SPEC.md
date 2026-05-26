````md
# TASK_ENGINE_AND_SCHEDULER_SPEC.md
# Core Task Engine & Scheduler – Dùng chung cho tất cả plugin (Gmail, Outlook, Facebook, X, ...)

## 0. Mục tiêu & Bối cảnh

Dự án đã có:

- Core:
  - `Account`, `Profile`, `Proxy`, `Log`, `ModuleConfig` (Prisma models)
  - `AccountService`, `ProfileService`, `ProxyService`, `ModuleService`, `LogService`
  - `PluginManager` + các `AccountPlugin` (Gmail plugin, ...)

- Modules:
  - `ModuleRegistry` + `ModuleService`
  - `ModuleConfig` (enable/disable + configJson)
  - UI `/modules` để bật/tắt modules

- Gmail plugin:
  - `GmailService` (check/login/care) dùng:
    - `ProfileService` + `BrowserController` + `ModuleService` + `LogService`
  - `createGmailPlugin(...)` đăng ký vào `PluginManager`

Giờ cần xây:

1. **Task Engine (CORE)**:
   - Hàng đợi (queue) cho các task: `check` / `care`
   - Giới hạn **số luồng chạy song song** (`maxConcurrentTasks`)
   - Hỗ trợ **batch** (enqueue nhiều account 1 lần)
   - Cơ chế **priority** (ưu tiên account `error` > `logged_out` > `active`)
   - Dùng chung cho **mọi plugin**, không phụ thuộc Gmail

2. **Scheduler (CORE)**:
   - Định kỳ (“mỗi X phút”) tự tạo batch tasks cho một module (ví dụ: Gmail care mỗi 3h)
   - Dùng được cho các module khác trong tương lai

3. **Config & Settings**:
   - Config global cho Task Engine (vd: `maxConcurrentTasks`)
   - Config schedule cho module (vd: Gmail care mỗi `intervalMin` phút, batch size bao nhiêu)

⚠️ Quan trọng:

- Tất cả logic **queue/concurrency/batch/schedule** nằm trong **CORE**, không nằm trong plugin (Gmail hay plugin khác).
- Plugin chỉ biết xử lý **1 account** với các hàm: `checkAccount`, `careAccount`, `loginAccount`.

---

## 1. Database Schema – Bổ sung

### 1.1. AppConfig – lưu config chung (Task Engine, v.v.)

Thêm vào `schema.prisma`:

```prisma
model AppConfig {
  id        String   @id @default(cuid())
  key       String   @unique
  valueJson String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
````

Ví dụ dữ liệu:

* `key = "taskEngine"`, `valueJson = {"maxConcurrentTasks":3}`

---

### 1.2. ModuleSchedule – lịch chạy cho từng module

Dùng cho scheduler để lên lịch chạy `check`/`care` theo module:

```prisma
model ModuleSchedule {
  id          String   @id @default(cuid())
  moduleName  String   // 'gmail', 'outlook', ...
  type        String   // 'check' | 'care'
  intervalMin Int      // mỗi bao nhiêu phút thì chạy
  enabled     Boolean  @default(true)
  lastRunAt   DateTime?
  nextRunAt   DateTime?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Ghi chú:

* Dùng `intervalMin` (đơn giản, tránh dùng cron phức tạp).
* `nextRunAt` = thời điểm tiếp theo scheduler sẽ chạy job đó.
* Một module có thể có nhiều schedule (vd: 1 schedule check, 1 schedule care).

---

## 2. Core Types & Interfaces

Các type dùng cho Task Engine thuộc CORE, đặt tại `src/core/task/types.ts`.

```ts
// src/core/task/types.ts

export type TaskType = "check" | "care";

export interface TaskItem {
  id: string;
  type: TaskType;
  accountId: string;
  createdAt: Date;
  priority: number; // số càng lớn càng ưu tiên
}

export interface TaskEngineConfig {
  maxConcurrentTasks: number; // Số tasks được phép chạy song song
}
```

---

## 3. AppConfigService – quản lý config chung

**File**: `src/core/services/AppConfigService.ts`

```ts
import { PrismaClient } from "@prisma/client";
import { TaskEngineConfig } from "../task/types";

export class AppConfigService {
  constructor(private prisma: PrismaClient) {}

  async getRawConfig(key: string): Promise<string | null> {
    const cfg = await this.prisma.appConfig.findUnique({
      where: { key },
    });
    return cfg?.valueJson ?? null;
  }

  async setRawConfig(key: string, valueJson: string): Promise<void> {
    await this.prisma.appConfig.upsert({
      where: { key },
      update: { valueJson },
      create: { key, valueJson },
    });
  }

  // ==== Task Engine Config ====

  async getTaskEngineConfig(): Promise<TaskEngineConfig> {
    const raw = await this.getRawConfig("taskEngine");
    if (!raw) {
      // default config
      return { maxConcurrentTasks: 3 };
    }
    try {
      const parsed = JSON.parse(raw);
      return {
        maxConcurrentTasks:
          typeof parsed.maxConcurrentTasks === "number" &&
          parsed.maxConcurrentTasks > 0
            ? parsed.maxConcurrentTasks
            : 3,
      };
    } catch {
      return { maxConcurrentTasks: 3 };
    }
  }

  async setTaskEngineConfig(config: TaskEngineConfig): Promise<void> {
    const valueJson = JSON.stringify(config);
    await this.setRawConfig("taskEngine", valueJson);
  }
}
```

> Sau này có thể mở rộng AppConfig cho các config khác.

---

## 4. TaskService – Core Task Engine (Queue + Concurrency + Priority)

**File**: `src/core/services/TaskService.ts`

### 4.1. Yêu cầu

* Lưu queue trong bộ nhớ (in-memory) giai đoạn đầu.
* Task là đơn vị xử lý một account:

  * `type: 'check' | 'care'`
  * `accountId`
* Chỉ cho phép **tối đa `maxConcurrentTasks`** chạy song song.
* Hỗ trợ:

  * `enqueueCheck(accountIds: string[], options?)`
  * `enqueueCare(accountIds: string[], options?)`
* Có chỉnh priority dựa theo trạng thái account (error > logged_out > active), nhưng logic ưu tiên có thể đặt trong API khi enqueue.

### 4.2. Interface & skeleton

```ts
// src/core/services/TaskService.ts

import { TaskItem, TaskType, TaskEngineConfig } from "../task/types";
import { AccountService } from "./AccountService";
import { AppConfigService } from "./AppConfigService";
import { LogService } from "./LogService";

interface EnqueueOptions {
  priority?: number;
}

export class TaskService {
  private queue: TaskItem[] = [];
  private processing = false;
  private runningCount = 0;
  private config: TaskEngineConfig = {
    maxConcurrentTasks: 3,
  };

  constructor(
    private accountService: AccountService,
    private appConfigService: AppConfigService,
    private logService: LogService
  ) {
    // Load config async, không blocking constructor
    this.loadConfig().catch((err) => {
      console.error("Failed to load task engine config:", err);
    });
  }

  private async loadConfig() {
    this.config = await this.appConfigService.getTaskEngineConfig();
  }

  // ========= Public API ==========

  async enqueueCheck(
    accountIds: string[],
    options?: EnqueueOptions
  ): Promise<void> {
    this.enqueueMany("check", accountIds, options);
  }

  async enqueueCare(
    accountIds: string[],
    options?: EnqueueOptions
  ): Promise<void> {
    this.enqueueMany("care", accountIds, options);
  }

  // ========= Internal Helpers ==========

  private enqueueMany(
    type: TaskType,
    accountIds: string[],
    options?: EnqueueOptions
  ) {
    const now = new Date();
    const priority = options?.priority ?? 0;

    for (const accountId of accountIds) {
      const item: TaskItem = {
        id: `${now.getTime()}_${accountId}_${type}_${Math.random()
          .toString(36)
          .slice(2)}`,
        type,
        accountId,
        createdAt: now,
        priority,
      };
      this.queue.push(item);
    }

    this.sortQueue();
    this.processQueue().catch((err) =>
      console.error("TaskService processQueue error:", err)
    );
  }

  /**
   * Sắp xếp queue: priority cao trước, cùng priority thì createdAt cũ trước.
   * Ưu tiên account đẩy vào sớm hơn.
   */
  private sortQueue() {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // priority lớn hơn → đứng trước
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  /**
   * Vòng lặp xử lý queue với giới hạn concurrency.
   * - Không block event loop (chỉ xử lý từng "đợt" nhỏ).
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (
        this.queue.length > 0 &&
        this.runningCount < this.config.maxConcurrentTasks
      ) {
        const task = this.queue.shift();
        if (!task) break;

        this.runningCount += 1;

        this.runTask(task)
          .catch((err) => {
            console.error("Task error:", err);
          })
          .finally(() => {
            this.runningCount -= 1;
            // Khi 1 task xong, nếu còn task trong queue thì gọi tiếp processQueue
            if (this.queue.length > 0) {
              this.processQueue().catch((err) =>
                console.error("TaskService processQueue error:", err)
              );
            } else {
              this.processing = false;
            }
          });
      }

      if (this.queue.length === 0) {
        this.processing = false;
      }
    } catch (err) {
      this.processing = false;
      throw err;
    }
  }

  /**
   * Thực thi 1 task đơn lẻ:
   * - check: gọi AccountService.triggerCheck
   * - care: gọi AccountService.triggerCare
   */
  private async runTask(task: TaskItem): Promise<void> {
    try {
      await this.logService.logInfo("task", "Run task", {
        taskId: task.id,
        type: task.type,
        accountId: task.accountId,
      });

      if (task.type === "check") {
        await this.accountService.triggerCheck(task.accountId);
      } else {
        await this.accountService.triggerCare(task.accountId);
      }
    } catch (err) {
      await this.logService.logError("task", "Task failed", {
        taskId: task.id,
        type: task.type,
        accountId: task.accountId,
        error: String(err),
      });
      throw err;
    }
  }
}
```

> `TaskService` không biết plugin nào đang xử lý; nó chỉ gọi `AccountService`, còn `AccountService` + `PluginManager` sẽ route tới plugin tương ứng (Gmail, Outlook, ...).

---

## 5. SchedulerService – Lên lịch tự động

**File**: `src/core/services/SchedulerService.ts`

### 5.1. Yêu cầu

* Chạy 1 vòng lặp (tick) mỗi X giây (ví dụ: 60s).
* Mỗi tick:

  * Tìm `ModuleSchedule` nào đã đến `nextRunAt`.
  * Với mỗi schedule:

    * Gọi hàm tương ứng, ví dụ:

      * Nếu `moduleName = 'gmail'` & `type = 'care'`:

        * Lấy danh sách account Gmail cần care.
        * Enqueue vào `TaskService.enqueueCare`.
    * Update `lastRunAt`, `nextRunAt = now + intervalMin`.

### 5.2. Skeleton

```ts
// src/core/services/SchedulerService.ts

import { PrismaClient } from "@prisma/client";
import { TaskService } from "./TaskService";
import { LogService } from "./LogService";

export class SchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private readonly tickIntervalMs = 60_000; // 1 phút

  constructor(
    private prisma: PrismaClient,
    private taskService: TaskService,
    private logService: LogService
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((err) =>
        console.error("Scheduler tick error:", err)
      );
    }, this.tickIntervalMs);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    const now = new Date();

    const schedules = await this.prisma.moduleSchedule.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now },
      },
    });

    if (schedules.length === 0) return;

    for (const sch of schedules) {
      try {
        await this.handleSchedule(sch);
        await this.prisma.moduleSchedule.update({
          where: { id: sch.id },
          data: {
            lastRunAt: now,
            nextRunAt: new Date(
              now.getTime() + sch.intervalMin * 60_000
            ),
          },
        });
      } catch (err) {
        await this.logService.logError("scheduler", "Schedule failed", {
          scheduleId: sch.id,
          moduleName: sch.moduleName,
          type: sch.type,
          error: String(err),
        });
      }
    }
  }

  /**
   * Xử lý 1 schedule cụ thể:
   * - Hiện tại chỉ implement cho moduleName = 'gmail', type = 'care' | 'check'.
   * - Sau này có thể mở rộng thêm cho module khác.
   */
  private async handleSchedule(sch: {
    id: string;
    moduleName: string;
    type: string;
    intervalMin: number;
  }) {
    if (sch.moduleName === "gmail") {
      if (sch.type === "care") {
        await this.enqueueGmailCareBatch();
      } else if (sch.type === "check") {
        await this.enqueueGmailCheckBatch();
      }
      // sau này có thể thêm loại khác nếu cần
      return;
    }

    // TODO: schedules cho module khác (outlook, facebook, ...)
    await this.logService.logInfo(
      "scheduler",
      "Schedule found but no handler implemented",
      {
        scheduleId: sch.id,
        moduleName: sch.moduleName,
        type: sch.type,
      }
    );
  }

  /**
   * Lấy danh sách account Gmail cần care và đẩy vào TaskService.
   * Rule gợi ý:
   *  - Lọc accountType = 'gmail'
   *  - Sort theo lastCare asc (lâu chưa care hơn thì ưu tiên)
   *  - take: batch size (có thể cấu hình sau; tạm thời hard-code 200)
   */
  private async enqueueGmailCareBatch() {
    const accounts = await this.prisma.account.findMany({
      where: { accountType: "gmail" },
      orderBy: {
        lastCare: "asc",
      },
      take: 200,
    });

    const ids = accounts.map((a) => a.id);
    if (ids.length === 0) return;

    await this.logService.logInfo(
      "scheduler",
      "Enqueue gmail care batch",
      {
        count: ids.length,
      }
    );

    await this.taskService.enqueueCare(ids);
  }

  private async enqueueGmailCheckBatch() {
    const accounts = await this.prisma.account.findMany({
      where: { accountType: "gmail" },
      orderBy: {
        lastCheck: "asc",
      },
      take: 200,
    });

    const ids = accounts.map((a) => a.id);
    if (ids.length === 0) return;

    await this.logService.logInfo(
      "scheduler",
      "Enqueue gmail check batch",
      {
        count: ids.length,
      }
    );

    await this.taskService.enqueueCheck(ids);
  }
}
```

> Batch size (`take: 200`) hiện đang hard-code, có thể sau này chuyển vào `gmail` module config hoặc AppConfig.

---

## 6. Tích hợp với Core (bootstrap)

Trong file bootstrap (ví dụ `src/core/bootstrap.ts`), bổ sung:

* `AppConfigService`
* `TaskService`
* `SchedulerService`

```ts
// src/core/bootstrap.ts (pseudo – chỉnh lại import cho đúng)

import { PrismaClient } from "@prisma/client";
import { AppConfigService } from "./services/AppConfigService";
import { LogService } from "./services/LogService";
import { ProxyService } from "./services/ProxyService";
import { ProfileService } from "./services/ProfileService";
import { ModuleService } from "./services/ModuleService";
import { PluginManager } from "./plugins/PluginManager";
import { createGmailPlugin } from "../plugins/gmail/gmail_plugin";
import { AccountService } from "./services/AccountService";
import { TaskService } from "./services/TaskService";
import { SchedulerService } from "./services/SchedulerService";
import { HttpGpmLoginAdapter } from "../integrations/GpmLoginAdapter";
import { PlaywrightBrowserController } from "../integrations/BrowserController";
import { ProxyAPIAdapterImpl } from "../integrations/ProxyAPIAdapter";

const prisma = new PrismaClient();
const logService = new LogService(prisma);
const appConfigService = new AppConfigService(prisma);

const moduleService = new ModuleService(prisma);
const proxyApi = new ProxyAPIAdapterImpl();
const proxyService = new ProxyService(prisma, proxyApi, logService);
const gpmAdapter = new HttpGpmLoginAdapter();
const profileService = new ProfileService(
  prisma,
  gpmAdapter,
  proxyService,
  logService
);

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

const taskService = new TaskService(
  accountService,
  appConfigService,
  logService
);

const schedulerService = new SchedulerService(
  prisma,
  taskService,
  logService
);

// Khởi động scheduler
schedulerService.start();

export const core = {
  prisma,
  logService,
  appConfigService,
  moduleService,
  proxyService,
  profileService,
  pluginManager,
  gmailPlugin,
  accountService,
  taskService,
  schedulerService,
};
```

---

## 7. API sử dụng TaskService (Bulk check/care)

Ví dụ cho bulk từ UI Accounts:

### 7.1. Bulk Care

`POST /api/accounts/care-bulk`

```ts
// src/app/api/accounts/care-bulk/route.ts

import { NextRequest, NextResponse } from "next/server";
import { core } from "@/core/bootstrap";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const accountIds: string[] = body.accountIds || [];

  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    return NextResponse.json(
      { success: false, error: "accountIds is required" },
      { status: 400 }
    );
  }

  // Ở đây có thể tính priority theo status nếu muốn.
  // Đơn giản: priority = 0. Nâng cao: query status account rồi assign priority khác nhau.
  await core.taskService.enqueueCare(accountIds);

  return NextResponse.json({
    success: true,
    count: accountIds.length,
  });
}
```

### 7.2. Bulk Check

`POST /api/accounts/check-bulk`

```ts
// src/app/api/accounts/check-bulk/route.ts

import { NextRequest, NextResponse } from "next/server";
import { core } from "@/core/bootstrap";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const accountIds: string[] = body.accountIds || [];

  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    return NextResponse.json(
      { success: false, error: "accountIds is required" },
      { status: 400 }
    );
  }

  await core.taskService.enqueueCheck(accountIds);

  return NextResponse.json({
    success: true,
    count: accountIds.length,
  });
}
```

---

## 8. Config UI (tùy chọn – gợi ý)

Sau khi TaskEngine & Scheduler hoạt động, có thể tạo page `/settings/automation`:

* **Task Engine**:

  * Input: `maxConcurrentTasks` (1–10)
  * Gọi API: `PATCH /api/settings/task-engine` → dùng `AppConfigService.setTaskEngineConfig`

* **Gmail Schedule**:

  * Input:

    * `intervalMin` (vd: 180 phút)
    * `type`: `care` / `check`
  * Gọi API update `ModuleSchedule` tương ứng.

---

## 9. Nguyên tắc kiến trúc quan trọng

* **TaskService** và **SchedulerService** là **CORE**, dùng được cho tất cả plugins.

* Plugin (Gmail, Outlook, Facebook, …) **không biết**:

  * queue
  * concurrency
  * batch
  * schedule

* Plugin chỉ implement:

```ts
interface AccountPlugin {
  name: string;
  supportedTypes: string[];

  checkAccount(accountId: string): Promise<void>;
  careAccount(accountId: string): Promise<void>;
  loginAccount?(accountId: string): Promise<void>;
}
```

* `AccountService` + `PluginManager` là cầu nối:

  * `TaskService` → `AccountService.triggerCheck/triggerCare` → `PluginManager` → Plugin phù hợp.

---

## 10. Yêu cầu cho Cursor khi implement

Khi dùng file spec này trong Cursor, hãy tuân thủ:

1. **Không phá vỡ kiến trúc hiện tại** (APPLICATION_SPEC_V2, MODULES spec, Gmail spec).
2. Chỉ:

   * Thêm models: `AppConfig`, `ModuleSchedule`
   * Tạo mới:

     * `AppConfigService`
     * `TaskService`
     * `SchedulerService`
     * `core/task/types.ts`
   * Cập nhật file bootstrap để khởi tạo các service trên.
3. Không refactor lớn, không đổi tên model Prisma, không sửa mạnh vào `AccountService`, `PluginManager`, `ModuleService` trừ khi thật cần thiết để tích hợp (và phải giữ backward compatibility).
4. Toàn bộ logic concurrency, batch, schedule phải nằm trong Core Services, không nhét vào plugin Gmail.

Nếu có chỗ chưa rõ, hãy chọn phương án **đơn giản, dễ mở rộng** và ghi comment trong code để người dùng biết.

```

--- 