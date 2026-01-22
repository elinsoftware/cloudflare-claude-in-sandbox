# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Overview

React SPA for interacting with Claude Code in Cloudflare Containers, with ServiceNow integration.

## Commands

```bash
npm run dev:frontend    # Vite dev server (port 5173)
npm run build           # Build frontend (single index.html output)
npm run deploy          # Deploy worker to Cloudflare
npm run typecheck       # TypeScript check (worker)
```

Note: `npm run dev:worker` not useful - Containers only work when deployed.

## Architecture

```
Browser (React/xterm.js) → Worker (Durable Object) → Container (node-pty + Claude CLI)
```

**Flow:**
1. Frontend POSTs credentials to `/api/connect`
2. Worker creates ClaudeContainer Durable Object, stores credentials
3. Container starts with server.js (WebSocket + node-pty)
4. Worker proxies WebSocket, passes credentials via headers
5. server.js configures Claude Code with credentials, spawns CLI

## Key Details

**Container:** `node:20-slim` base, Claude CLI via native installer, server.js runs WebSocket server on port 8080.

**ttyd Protocol:**
- Client: `"0" + input`, `"1" + JSON.stringify({columns, rows})`
- Server: `Buffer([0]) + data`

**Credentials:** Stored in Durable Object storage, passed to container via custom headers on WebSocket upgrade.

**Endpoints:**
- `POST /api/connect` - Create/reconnect session
- `WS /api/terminal/:sessionId` - Terminal I/O
- `POST /api/disconnect` - Stop container

## Project Structure

```
frontend/src/
  App.tsx              # State management
  components/
    ConnectForm.tsx    # Credentials form (localStorage persistence)
    Terminal.tsx       # xterm.js + ttyd protocol
    StatusBar.tsx      # Connection indicator
  utils/storage.ts     # LocalStorage helpers

worker/
  src/index.ts         # Worker + ClaudeContainer Durable Object
  server.js            # Container WebSocket server (node-pty)
  Dockerfile           # node:20-slim + Claude CLI
```

## Notes

- Container auto-sleeps after 5 minutes idle
- Sessions persist by sessionId (UUID)
- Frontend builds to single index.html via vite-plugin-singlefile
- No test suite
