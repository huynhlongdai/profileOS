Ok, ngon rồi, vậy coi như **Core (Accounts / Proxies / Profiles)** của bạn đã chạy, giờ mình build nốt **Modules** để:

* Hiển thị danh sách module (Gmail, sau này Outlook, Facebook, X,…)
* Bật/tắt module (enable/disable)
* Liên kết với `PluginManager` để chỉ chạy những module đang bật
* Có UI riêng `/modules` để quản lý

Mình sẽ chia thành 4 phần:

1. Khái niệm “Modules” rõ ràng
2. Thiết kế DB & service cho Modules
3. Cập nhật `PluginManager` để đọc trạng thái module
4. API + UI trang Modules

Mình giả định bạn đang dùng **Next.js + Prisma + TS** như spec trước. Nếu khác, bạn chỉ cần chỉnh lại syntax chút là được.

---

## 1. “Modules” là gì trong app của bạn?

Trong kiến trúc mình với bạn đã thống nhất:

* **Plugin** = đoạn code xử lý một loại tài khoản, ví dụ:

  * `GmailPlugin` (check/login/care Gmail)
  * Sau này: `OutlookPlugin`, `FacebookPlugin`, `XPlugin`,…

* **Module** = “thực thể quản lý” cho plugin:

  * Có `name`, `description`, `version`
  * Có trạng thái `enabled` (đang bật / tắt)
  * Có thể lưu thêm config riêng (JSON)

→ Vậy Modules page sẽ:

* Đọc danh sách built-in modules (Gmail, …)
* Merge với **config trong DB** (enabled, config…)
* Cho phép toggle bật/tắt từng module.

---

## 2. Database & Service cho Modules

### 2.1. Prisma model

Thêm model này vào `schema.prisma`:

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

Chạy:

```bash
npx prisma migrate dev -n add_module_config
```

---

### 2.2. ModuleRegistry – danh sách module “cứng” trong code

File: `src/core/modules/ModuleRegistry.ts`

```ts
export interface ModuleMeta {
  name: string;        // 'gmail'
  label: string;       // 'Gmail Module'
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
  // sau này thêm:
  // {
  //   name: "outlook",
  //   label: "Outlook Module",
  //   description: "Tự động check/login/care Outlook.",
  //   version: "1.0.0",
  // },
];
```

---

### 2.3. ModuleService – làm việc với ModuleConfig + Registry

File: `src/core/services/ModuleService.ts`

```ts
import { PrismaClient, ModuleConfig } from "@prisma/client";
import { BUILTIN_MODULES, ModuleMeta } from "../modules/ModuleRegistry";

export interface ModuleView extends ModuleMeta {
  enabled: boolean;
  configJson?: string | null;
}

export class ModuleService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Lấy danh sách module: merge giữa BUILTIN_MODULES và ModuleConfig trong DB
   */
  async listModules(): Promise<ModuleView[]> {
    const configs = await this.prisma.moduleConfig.findMany();
    const configMap = new Map<string, ModuleConfig>();
    configs.forEach((c) => configMap.set(c.name, c));

    return BUILTIN_MODULES.map((meta) => {
      const cfg = configMap.get(meta.name);
      return {
        ...meta,
        enabled: cfg ? cfg.enabled : true, // mặc định enabled nếu chưa có record
        configJson: cfg?.configJson ?? null,
      };
    });
  }

  /**
   * Bật/tắt module
   */
  async setModuleEnabled(name: string, enabled: boolean): Promise<ModuleView> {
    const meta = BUILTIN_MODULES.find((m) => m.name === name);
    if (!meta) {
      throw new Error(`Unknown module: ${name}`);
    }

    const cfg = await this.prisma.moduleConfig.upsert({
      where: { name },
      update: { enabled },
      create: {
        name,
        enabled,
      },
    });

    return {
      ...meta,
      enabled: cfg.enabled,
      configJson: cfg.configJson,
    };
  }

  /**
   * Lấy thông tin 1 module
   */
  async getModule(name: string): Promise<ModuleView | null> {
    const meta = BUILTIN_MODULES.find((m) => m.name === name);
    if (!meta) return null;

    const cfg = await this.prisma.moduleConfig.findUnique({
      where: { name },
    });

    return {
      ...meta,
      enabled: cfg?.enabled ?? true,
      configJson: cfg?.configJson ?? null,
    };
  }

  /**
   * Lưu config JSON (tuỳ bạn sử dụng)
   */
  async updateModuleConfig(name: string, configJson: string | null): Promise<ModuleView> {
    const meta = BUILTIN_MODULES.find((m) => m.name === name);
    if (!meta) throw new Error(`Unknown module: ${name}`);

    const cfg = await this.prisma.moduleConfig.upsert({
      where: { name },
      update: { configJson },
      create: { name, enabled: true, configJson },
    });

    return {
      ...meta,
      enabled: cfg.enabled,
      configJson: cfg.configJson,
    };
  }
}
```

---

## 3. Cập nhật PluginManager để dùng trạng thái Modules

Hiện tại `PluginManager` của mình kiểu:

```ts
export class PluginManager {
  private plugins: AccountPlugin[] = [];

  registerPlugin(plugin: AccountPlugin) { ... }

  getPluginForAccountType(type: string): AccountPlugin | null { ... }

  async checkAccount(accountId: string, accountType: string): Promise<void> { ... }
}
```

Giờ ta cho nó **biết module nào đang enabled** bằng cách inject `ModuleService`.

File: `src/core/plugins/PluginManager.ts`

```ts
import { AccountPlugin } from "./types";
import { ModuleService } from "../services/ModuleService";

export class PluginManager {
  private plugins: AccountPlugin[] = [];
  private moduleService: ModuleService;

  constructor(moduleService: ModuleService) {
    this.moduleService = moduleService;
  }

  registerPlugin(plugin: AccountPlugin) {
    this.plugins.push(plugin);
  }

  async isModuleEnabled(moduleName: string): Promise<boolean> {
    const mod = await this.moduleService.getModule(moduleName);
    return mod ? mod.enabled : true; // default: true nếu chưa config
  }

  getPluginForAccountTypeSync(accountType: string): AccountPlugin | null {
    return this.plugins.find((p) => p.supportedTypes.includes(accountType)) || null;
  }

  async getPluginForAccountType(accountType: string): Promise<AccountPlugin | null> {
    const plugin = this.getPluginForAccountTypeSync(accountType);
    if (!plugin) return null;

    const enabled = await this.isModuleEnabled(plugin.name);
    if (!enabled) return null;

    return plugin;
  }

  async checkAccount(accountId: string, accountType: string): Promise<void> {
    const plugin = await this.getPluginForAccountType(accountType);
    if (!plugin) {
      throw new Error(`No enabled plugin for account type ${accountType}`);
    }
    await plugin.checkAccount(accountId);
  }

  async careAccount(accountId: string, accountType: string): Promise<void> {
    const plugin = await this.getPluginForAccountType(accountType);
    if (!plugin) {
      throw new Error(`No enabled plugin for account type ${accountType}`);
    }
    await plugin.careAccount(accountId);
  }
}
```

> Như vậy:
>
> * Module Gmail có thể **registered** nhưng nếu user tắt nó trên UI, `PluginManager` sẽ không dùng nữa.

Đừng quên update chỗ bootstrap core (nơi bạn khởi tạo Service):

```ts
// src/core/bootstrap.ts (ví dụ)
const prisma = new PrismaClient();
const moduleService = new ModuleService(prisma);
const pluginManager = new PluginManager(moduleService);

pluginManager.registerPlugin(GmailPlugin);

// rồi mới tạo AccountService, v.v.
```

---

## 4. API + UI cho trang Modules

### 4.1. API routes

Giả sử bạn dùng Next.js app router, tạo:

#### `src/app/api/modules/route.ts` (GET, PATCH cho list)

```ts
import { NextRequest, NextResponse } from "next/server";
import { core } from "@/core/bootstrap"; // chỗ export accountService,..., moduleService

// GET /api/modules
export async function GET() {
  const modules = await core.moduleService.listModules();
  return NextResponse.json(modules);
}

// PATCH /api/modules
// Body: { name: string, enabled: boolean }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { name, enabled } = body;

  if (!name || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const mod = await core.moduleService.setModuleEnabled(name, enabled);
  return NextResponse.json(mod);
}
```

Nếu bạn thích REST kiểu `/api/modules/[name]`, có thể tách route:

```ts
// src/app/api/modules/[name]/route.ts
export async function PATCH(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  const { enabled } = await req.json();
  const mod = await core.moduleService.setModuleEnabled(params.name, !!enabled);
  return NextResponse.json(mod);
}
```

---

### 4.2. UI: trang `/modules`

Giả sử bạn dùng `src/app/modules/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface ModuleView {
  name: string;
  label: string;
  description: string;
  version: string;
  enabled: boolean;
}

export default function ModulesPage() {
  const [modules, setModules] = useState<ModuleView[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchModules = async () => {
    setLoading(true);
    const res = await fetch("/api/modules");
    const data = await res.json();
    setModules(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchModules();
  }, []);

  const toggleModule = async (mod: ModuleView) => {
    const newEnabled = !mod.enabled;
    setModules((prev) =>
      prev.map((m) =>
        m.name === mod.name ? { ...m, enabled: newEnabled } : m
      )
    );

    await fetch(`/api/modules/${mod.name}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: newEnabled }),
    });
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold mb-4">Modules</h1>

      {loading ? (
        <div>Đang tải modules...</div>
      ) : (
        <table className="min-w-full border border-gray-700 text-sm">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-3 py-2 text-left">Module</th>
              <th className="px-3 py-2 text-left">Mô tả</th>
              <th className="px-3 py-2 text-left">Version</th>
              <th className="px-3 py-2 text-center">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((mod) => (
              <tr key={mod.name} className="border-t border-gray-700">
                <td className="px-3 py-2 font-medium">{mod.label}</td>
                <td className="px-3 py-2 text-gray-300">
                  {mod.description}
                </td>
                <td className="px-3 py-2">{mod.version}</td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => toggleModule(mod)}
                    className={`px-3 py-1 rounded text-xs font-semibold ${
                      mod.enabled
                        ? "bg-green-600 hover:bg-green-500"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    {mod.enabled ? "Enabled" : "Disabled"}
                  </button>
                </td>
              </tr>
            ))}

            {modules.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-400">
                  Chưa có module nào được khai báo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

---

## Tóm lại: để hoàn thiện Modules bạn cần

1. **Thêm model `ModuleConfig`** trong Prisma.
2. Tạo **`ModuleRegistry`** mô tả danh sách module built-in (hiện chỉ có Gmail).
3. Tạo **`ModuleService`** để:

   * `listModules()`
   * `setModuleEnabled(name, enabled)`
   * `getModule(name)`
4. Sửa **`PluginManager`**:

   * Inject `ModuleService`
   * Chỉ trả plugin nếu module tương ứng đang enabled.
5. Tạo **API `/api/modules`** (+ `/api/modules/[name]`)
6. Tạo **UI `/modules`** để xem + toggle.
