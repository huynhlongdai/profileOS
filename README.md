# GPM Profile & Multi-Account Manager

Core + Plugin Architecture - Gmail as First Plugin

## 📋 Overview

This is a complete rewrite of the GPM Tool using **Next.js + TypeScript + Prisma** with a **Core + Plugin architecture**. The system manages:

- **GPM Profiles** (antidetect browser profiles)
- **Proxies** (check, reset, assign)
- **Multiple Account Types** (Gmail first, extensible to Outlook, Facebook, X, etc.)
- **Dashboard & Logs**
- **Plugin System** (each account type is a plugin module)

## 🏗️ Architecture

```
Core Platform
├── AccountService
├── ProfileService (GPM core)
├── ProxyService
├── TaskService (job & queue)
└── LogService

Plugin Layer
├── GmailModule (first plugin)
│   └── GmailService (check/login/care)
└── [Future: OutlookModule, FacebookModule, ...]

Integration Layer
├── GpmLoginAdapter (API/CLI của GPMLogin)
├── ProxyAPIAdapter (reset IP / check proxy)
└── BrowserController (Playwright/Puppeteer via remote debugging)
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- GPMLogin installed and running (API at `http://127.0.0.1:19995`)

### Installation

1. **Install dependencies:**

```bash
npm install
```

2. **Setup environment variables:**

Create a `.env` file in the root directory:

```env
DATABASE_URL="file:./dev.db"
GPMLOGIN_API_URL="http://127.0.0.1:19995"
GPMLOGIN_API_VERSION="v3"
PROXY_API_SERVER_URL="http://192.168.1.41"
```

3. **Initialize database:**

```bash
npx prisma generate
npx prisma db push
```

4. **Initialize plugins (optional - auto-initialized on first API call):**

```bash
# Plugins are auto-initialized via middleware, but you can manually trigger:
curl http://localhost:3000/api/init
```

5. **Start development server:**

```bash
npm run dev
```

6. **Open browser:**

Navigate to `http://localhost:3000`

## 📁 Project Structure

```
/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/                # API routes
│   │   │   ├── accounts/
│   │   │   ├── profiles/
│   │   │   ├── proxies/
│   │   │   ├── modules/
│   │   │   └── logs/
│   │   ├── dashboard/          # Dashboard page
│   │   ├── accounts/           # Accounts page
│   │   ├── profiles/           # Profiles page
│   │   ├── proxies/            # Proxies page
│   │   ├── modules/            # Modules page
│   │   └── logs/               # Logs page
│   ├── core/
│   │   ├── services/           # Core services
│   │   │   ├── AccountService.ts
│   │   │   ├── ProfileService.ts
│   │   │   ├── ProxyService.ts
│   │   │   ├── TaskService.ts
│   │   │   └── LogService.ts
│   │   └── plugins/
│   │       ├── PluginManager.ts
│   │       └── types.ts
│   ├── integrations/           # Integration adapters
│   │   ├── GpmLoginAdapter.ts
│   │   ├── ProxyAPIAdapter.ts
│   │   └── BrowserController.ts
│   ├── plugins/                # Plugin modules
│   │   └── gmail/
│   │       ├── plugin.json
│   │       ├── gmail_module.ts
│   │       └── GmailService.ts
│   └── lib/
│       ├── prisma.ts
│       └── init-plugins.ts
├── package.json
├── tsconfig.json
└── next.config.js
```

## 🔌 Plugin System

### Adding a New Plugin

1. Create plugin directory: `src/plugins/[plugin-name]/`
2. Create `plugin.json`:
```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Plugin description",
  "entry": "plugin_module.ts",
  "enabled": true
}
```

3. Implement `AccountPlugin` interface:
```typescript
import type { AccountPlugin } from '@/core/plugins/types'

class MyPlugin implements AccountPlugin {
  name = 'my-plugin'
  supportedTypes = ['my-account-type']
  
  async checkAccount(accountId: string): Promise<void> {
    // Implementation
  }
  
  async careAccount(accountId: string): Promise<void> {
    // Implementation
  }
}
```

4. Register in `src/lib/init-plugins.ts`:
```typescript
import myPlugin from '@/plugins/my-plugin/plugin_module'
pluginManager.registerPlugin(myPlugin)
```

## 📡 API Endpoints

### Accounts
- `GET /api/accounts` - List accounts
- `POST /api/accounts` - Create account
- `GET /api/accounts/:id` - Get account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account
- `POST /api/accounts/:id/check` - Check account
- `POST /api/accounts/:id/care` - Care account
- `POST /api/accounts/check-bulk` - Bulk check
- `POST /api/accounts/care-bulk` - Bulk care

### Profiles
- `GET /api/profiles` - List profiles
- `POST /api/profiles/sync` - Sync from GPMLogin
- `POST /api/profiles/:id/start` - Start profile
- `POST /api/profiles/:id/stop` - Stop profile
- `PUT /api/profiles/:id/proxy` - Change proxy

### Proxies
- `GET /api/proxies` - List proxies
- `POST /api/proxies` - Create proxy
- `PUT /api/proxies/:id` - Update proxy
- `DELETE /api/proxies/:id` - Delete proxy
- `POST /api/proxies/:id/check` - Check proxy
- `POST /api/proxies/:id/reset-ip` - Reset IP

### Modules
- `GET /api/modules` - List loaded modules

### Logs
- `GET /api/logs` - List logs

### Stats
- `GET /api/stats` - Get dashboard statistics

## 🛠️ Development

### Database Commands

```bash
# Generate Prisma Client
npx prisma generate

# Push schema changes
npx prisma db push

# Open Prisma Studio
npx prisma studio
```

### Code Structure

- **Core Services**: Business logic, database operations
- **Plugin System**: Extensible account type handlers
- **Integration Layer**: External API adapters (skeleton for now)
- **API Routes**: Next.js API handlers
- **Frontend Pages**: React components with Tailwind CSS

## 📝 Implementation Status

### ✅ Completed
- [x] Project structure
- [x] Prisma schema
- [x] Core services (fully implemented)
- [x] Plugin system
- [x] Gmail plugin (fully implemented)
- [x] API routes (all endpoints)
- [x] Frontend pages (basic UI)
- [x] GPMLogin API integration (`GpmLoginAdapter`)
- [x] Proxy API integration (`ProxyAPIAdapter`)
- [x] Browser automation (`BrowserController` with Playwright)
- [x] Gmail check/login/care logic

### 🚧 Future Enhancements
- [ ] Add authentication/authorization
- [ ] Add form modals for Create/Edit operations
- [ ] Improve error handling and validation
- [ ] Add real-time updates (WebSocket or polling)
- [ ] Add unit tests
- [ ] Add E2E tests
- [ ] Improve Gmail selectors (more robust)
- [ ] Add cookie management/storage
- [ ] Add 2FA handling

## 🔗 References

- **GPMLogin API**: https://docs.gpmloginapp.com/api-document
- **Next.js**: https://nextjs.org/docs
- **Prisma**: https://www.prisma.io/docs
- **Tailwind CSS**: https://tailwindcss.com/docs

## 📄 License

MIT License

---

## ⚠️ Important Notes

1. **Playwright Installation**: After `npm install`, you need to install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```

2. **GPMLogin**: Ensure GPMLogin is running and API is accessible at `http://127.0.0.1:19995`

3. **Proxy API**: Configure `PROXY_API_SERVER_URL` in `.env` if using proxy reset functionality

4. **Gmail Selectors**: Gmail UI changes frequently. The selectors in `GmailService` may need updates if Gmail changes their interface.

5. **2FA**: Currently, 2FA requires manual intervention. Future versions may support automated 2FA handling.

6. **Cookies**: Cookies are retrieved but not stored in database yet. This can be added if needed.

---

**Status**: Core functionality is implemented. The system is ready for testing and can be extended with additional features.

