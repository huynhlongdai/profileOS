
````md
You are a **Senior Fullstack Engineer + Software Architect**.

Your main task:
- Read and understand the file: `APPLICATION_SPEC_V2.md`
- Based on that spec, **create a complete project skeleton** (backend + frontend) for:
  - Core platform (GPM Profile, Proxy, Account, Logs, Dashboard)
  - Plugin system (Gmail as first plugin)

---

## 1. Context & Goals

I am building an internal tool to manage:
- GPM profiles (antidetect browser profiles)
- Proxies
- Multiple types of accounts (Gmail first, but later: Outlook, Facebook, X, etc.)
- Dashboard & Logs
- A plugin architecture where each account type is handled by a module, starting with **Gmail module**.

The key idea:
> Core = GPM Profile + Proxy + Account + Dashboard + Logs  
> Gmail = a plugin module that uses Core to check, login, and care Gmail accounts.

I already wrote a detailed spec in `APPLICATION_SPEC_V2.md`.  
You must **strictly follow** that spec to design the architecture, folder structure, types, and core logic.

---

## 2. Requirements for Cursor

### 2.1. General

1. Read the file `APPLICATION_SPEC_V2.md` carefully.
2. Design the project using a **clear, modular structure**:
   - `core/` for services and domain logic
   - `plugins/` for modules like Gmail
   - `api/` or `routes/` for HTTP handlers
   - `ui/` or `frontend/` for React pages
3. Prefer **TypeScript** for backend + frontend.
4. Use **Prisma** for ORM, according to the models defined in the spec:
   - `Account`
   - `Proxy`
   - `Profile`
   - `Log`
   - `ModuleStatus`
5. Use **a simple, clean UI** (Tailwind is OK) with basic tables and actions (no need for super fancy design in v1).

---

## 3. Tech Stack (you should implement)

Feel free to adjust if needed, but default to:

- **Backend**:
  - Node.js + TypeScript
  - Next.js API routes (or separate Express server if needed, but Next.js monorepo is preferred for simplicity)
  - Prisma ORM
  - SQLite or PostgreSQL (start with SQLite for dev)

- **Frontend**:
  - Next.js + React + TypeScript
  - Tailwind CSS for styling
  - Basic table components (no heavy UI libraries required in v1)

- **Automation layer (skeleton only)**:
  - Create abstraction for `BrowserController` and `GpmLoginAdapter` (interfaces & dummy implementations)
  - Real Playwright/Puppeteer logic can be added later (for now just placeholders and types)

---

## 4. Project Structure

Create a structure similar to:

```text
/
  prisma/
    schema.prisma

  src/
    core/
      services/
        AccountService.ts
        ProfileService.ts
        ProxyService.ts
        TaskService.ts
        LogService.ts
      plugins/
        PluginManager.ts
        types.ts
    integrations/
      GpmLoginAdapter.ts
      ProxyAPIAdapter.ts
      BrowserController.ts
    plugins/
      gmail/
        gmail_module.ts
        GmailService.ts
        plugin.json

    api/   (if using Next: src/app/api/... or pages/api/...)
      accounts/
      profiles/
      proxies/
      modules/
      logs/

  app/ or src/app/ (Next.js frontend)
    dashboard/
    accounts/
    profiles/
    proxies/
    modules/
    logs/

  package.json
  tsconfig.json
  next.config.js
  .env.example
````

You can adapt paths to Next.js 13+ `/app` router if you want, but keep it **clean and aligned with the spec**.

---

## 5. Backend details

### 5.1. Prisma schema

Generate `prisma/schema.prisma` based on the models from `APPLICATION_SPEC_V2.md`:

* `Account`
* `Proxy`
* `Profile`
* `Log`
* `ModuleStatus`

Stick to fields & types in the spec (id, label, accountType, identifier, status, relations, etc.).

### 5.2. Core Services

In `src/core/services/`, implement **class-based services**:

* `AccountService`
* `ProfileService`
* `ProxyService`
* `TaskService` (skeleton, can be simple in-memory queue)
* `LogService`

They must implement at least the methods described in the spec (list, CRUD, assign, triggerCheck, triggerCare, etc.).

You don't need full complex logic in v1 (for example: real queue implementation can be stubbed), but:

* The function signatures must be correct and ready to be extended.
* Basic CRUD and mapping operations should actually work with Prisma.

### 5.3. PluginManager

In `src/core/plugins/PluginManager.ts`:

* Implement loading of plugins from `src/plugins/*/plugin.json`.
* Implement an interface similar to:

```ts
export interface AccountPlugin {
  name: string;
  supportedTypes: string[]; // e.g. ['gmail']

  checkAccount(accountId: string): Promise<void>;
  careAccount(accountId: string): Promise<void>;
  loginAccount?(accountId: string): Promise<void>;
}
```

* Provide methods:

```ts
getPluginForAccountType(type: string): AccountPlugin | null;
checkAccount(accountId: string): Promise<void>;
careAccount(accountId: string): Promise<void>;
```

### 5.4. Gmail Plugin

In `src/plugins/gmail/`:

* `plugin.json`
* `gmail_module.ts` – exports an object that implements `AccountPlugin`.
* `GmailService.ts` – contains core logic skeleton for:

  * `checkAccount`
  * `login`
  * `care`

For now, implement **dummy behavior** (log steps, update status in DB) without real browser automation, but structure it clearly so we can plug in Playwright/Puppeteer later.

---

## 6. API Layer

Create API endpoints as described in the spec:

### 6.1. Accounts

* `GET /api/accounts`
* `POST /api/accounts`
* `PUT /api/accounts/:id`
* `DELETE /api/accounts/:id`
* `POST /api/accounts/:id/check`
* `POST /api/accounts/:id/care`
* `POST /api/accounts/check-bulk`
* `POST /api/accounts/care-bulk`

### 6.2. Profiles

* `GET /api/profiles`
* `POST /api/profiles/sync`
* `POST /api/profiles/:id/start`
* `POST /api/profiles/:id/stop`
* `PUT /api/profiles/:id/proxy`

### 6.3. Proxies

* `GET /api/proxies`
* `POST /api/proxies`
* `PUT /api/proxies/:id`
* `DELETE /api/proxies/:id`
* `POST /api/proxies/:id/check`
* `POST /api/proxies/:id/reset-ip`

### 6.4. Modules

* `GET /api/modules`

### 6.5. Logs

* `GET /api/logs`

You can implement them as Next.js API routes (e.g. `/app/api/.../route.ts`) or `pages/api/...` depending on the router you choose.

Each API route should:

* Validate input (basic).
* Call the corresponding Service.
* Return JSON with proper error handling.

---

## 7. Frontend (UI) Requirements

Use Next.js + Tailwind to build **simple but clean** pages:

### 7.1. Pages

* `/dashboard`
* `/accounts`
* `/profiles`
* `/proxies`
* `/modules`
* `/logs`

### 7.2. Accounts page

* Table with:

  * Label
  * Account Type
  * Identifier
  * GPM Profile
  * Proxy
  * Status (with colored badge)
  * Last Check
  * Last Care
  * Action buttons:

    * Check
    * Care
* “Add Account” form (modal or separate page).

### 7.3. Profiles page

* List all profiles with:

  * Name
  * Profile UID
  * Proxy
  * Status
  * Last Opened / Last Closed
  * Actions: Start / Stop / Change Proxy.

### 7.4. Proxies page

* List all proxies with:

  * Label
  * Raw Proxy
  * IP After
  * Status
  * Last Check
  * Last Reset
  * Used By (number of accounts)
  * Actions: Check / Reset IP / Edit / Delete.

### 7.5. Modules page

* Show loaded modules from PluginManager:

  * Name
  * Version
  * Description
  * Enabled (true/false).

### 7.6. Logs page

* Filter log by:

  * Account
  * Module
  * Type
  * Date range
* Table:

  * Time
  * Module
  * Type
  * Message
  * Button to expand meta JSON.

---

## 8. Code Quality & Output Format

When generating code:

1. Ensure all imports are correct and consistent.
2. Use TypeScript interfaces/types where appropriate.
3. Add comments in important places:

   * Where real browser automation will be plugged in later.
   * Where GPMLogin / Proxy API integrations will be added.
4. Make sure `npm install`, `npx prisma migrate dev`, and `npm run dev` (or `yarn` equivalent) should work with minimal edits.
5. If something is ambiguous in the spec, choose a **reasonable default** and note it in a comment.

---

## 9. Deliverables

* A ready-to-run monorepo (Next.js app) including:

  * Prisma schema
  * Backend services (core + plugins skeleton)
  * API routes
  * Frontend pages with basic UI
* Clear entry points where:

  * GpmLoginAdapter
  * ProxyAPIAdapter
  * BrowserController
    can be implemented later.

---

Now, please:

1. Parse `APPLICATION_SPEC_V2.md`.
2. Design and scaffold the entire project as described.
3. Show me:

   * The folder structure.
   * Key code files (Prisma schema, core services, plugin manager, Gmail plugin skeleton, main pages).
   * Any important instructions to run the project.

```

---