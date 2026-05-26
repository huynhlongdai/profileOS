# ProfileOS Local Agent

Local agent service that runs on the machine with GPMLogin + Tailscale.
It polls tasks from the Vercel-hosted ProfileOS dashboard and executes them locally.

## Architecture

```
┌─────────────────────────────────┐
│   Vercel (ProfileOS Dashboard)   │
│   Supabase PostgreSQL (DB)       │
│   API: /api/agent/*              │
└──────────────┬──────────────────┘
               │ HTTPS (poll tasks)
               │
┌──────────────▼──────────────────┐
│   Local Machine (This Agent)     │
│   - Tailscale VPN connected      │
│   - GPMLogin running             │
│   - Playwright for automation    │
│   - Polls /api/agent/tasks       │
│   - Reports results back         │
└─────────────────────────────────┘
```

## Setup

1. Install Node.js 18+ on local machine
2. Install Tailscale and connect to your network
3. Install GPMLogin and start it
4. Configure environment:

```bash
cp .env.example .env
# Edit .env with your values:
# PROFILEOS_URL=https://your-app.vercel.app
# AGENT_SECRET=your-shared-secret
# GPMLOGIN_API_URL=http://127.0.0.1:19995
```

5. Install and run:

```bash
npm install
npm start
```

## How It Works

1. Agent polls `GET /api/agent/tasks` every 5 seconds
2. When a task is found, agent marks it as `running`
3. Agent executes the task (start profile, run automation, etc.)
4. Agent reports result back via `PATCH /api/agent/tasks/:id`
5. Dashboard shows real-time task status
