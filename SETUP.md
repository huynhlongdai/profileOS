# Setup Guide

## Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **GPMLogin** - [Download](https://gpmloginapp.com/)
3. **Playwright browsers** - Will be installed via npm script

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Playwright Browsers

```bash
npx playwright install chromium
```

### 3. Setup Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="file:./dev.db"

# GPMLogin API
GPMLOGIN_API_URL="http://127.0.0.1:19995"
GPMLOGIN_API_VERSION="v3"

# Proxy API Server (optional)
PROXY_API_SERVER_URL="http://192.168.1.41"

# App
NODE_ENV="development"
```

### 4. Initialize Database

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push
```

### 5. Start GPMLogin

1. Open GPMLogin application
2. Ensure API is running (default: `http://127.0.0.1:19995`)
3. Verify API is accessible by visiting the URL in browser

### 6. Start Development Server

```bash
npm run dev
```

### 7. Access Application

Open browser and navigate to: `http://localhost:3000`

## Verification

1. **Health Check**: Visit `http://localhost:3000/api/health` - should return `{"status":"ok"}`

2. **Initialize Plugins**: Plugins are auto-initialized, but you can manually trigger:
   ```bash
   curl http://localhost:3000/api/init
   ```

3. **Sync Profiles**: In the Profiles page, click "Sync from GPMLogin" to import profiles

## Troubleshooting

### GPMLogin Connection Issues

- Ensure GPMLogin is running
- Check API URL in `.env` matches GPMLogin settings
- Verify firewall/antivirus isn't blocking connection

### Playwright Issues

- Run `npx playwright install chromium` again
- Check Node.js version (requires 18+)

### Database Issues

- Delete `dev.db` and run `npm run db:push` again
- Check file permissions for database file

### Port Already in Use

- Change port in `package.json` scripts or use `PORT=3001 npm run dev`

## Next Steps

1. Create your first account
2. Assign a profile to the account
3. Test check/care functionality
4. Monitor logs for any issues

