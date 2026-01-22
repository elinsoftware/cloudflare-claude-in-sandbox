# Claude Code in Cloudflare Containers - Specification

## Overview

Single-page React application for interacting with Claude Code running in Cloudflare Containers, with ServiceNow integration.

## Architecture

```
Browser (React/xterm.js) → Cloudflare Worker → Durable Object → Container (Claude CLI)
```

**Data Flow:**
1. User opens React app (standalone or embedded in ServiceNow)
2. User enters credentials (Worker URL, ServiceNow instance, username, password, Anthropic API key)
3. Frontend POSTs to `/api/connect`
4. Worker creates ClaudeContainer Durable Object, stores credentials in DO storage
5. Container starts with server.js (WebSocket server + node-pty)
6. Worker returns WebSocket URL
7. Frontend connects xterm.js via WebSocket
8. Worker proxies WebSocket to container, passing credentials via headers
9. server.js configures Claude Code with credentials, spawns CLI
10. User interacts with Claude Code terminal

## Tech Stack

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite + vite-plugin-singlefile (outputs single index.html)
- **Styling**: Tailwind CSS
- **Terminal**: xterm.js
- **Storage**: localStorage for credential persistence

### Backend
- **Runtime**: Cloudflare Workers
- **State**: Durable Objects (ClaudeContainer extends Container)
- **Compute**: Cloudflare Containers

### Container
- **Base Image**: node:20-slim
- **Terminal**: node-pty + ws (WebSocket server)
- **Claude**: Native installer (curl https://claude.ai/install.sh)
- **Utilities**: git, curl, jq, bash

## Components

### 1. Frontend

#### ConnectForm
- Worker URL input
- ServiceNow instance input (auto-detects from hostname)
- Username/password inputs
- Anthropic API key input
- Session ID (for reconnection)
- All fields persist to localStorage

#### Terminal
- xterm.js with ttyd protocol handling
- Auto-resize on window change
- Disconnect button overlay

#### StatusBar
- Connection status indicator
- Worker URL and instance display
- Logged-in user display

### 2. Worker (`worker/src/index.ts`)

#### ClaudeContainer (Durable Object)
```typescript
class ClaudeContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "5m";
  enableInternet = true;

  async storeCredentials(credentials: StoredCredentials): Promise<void>
  async getCredentials(): Promise<StoredCredentials | null>
}
```

#### Endpoints

**POST /api/connect**
```typescript
Request: {
  instance: string;
  username: string;
  password: string;
  anthropicApiKey: string;
  sessionId?: string;  // Optional: reconnect to existing
}
Response: {
  sessionId: string;
  wsUrl: string;
}
```

**WebSocket /api/terminal/:sessionId**
- Proxies WebSocket between frontend and container
- Passes credentials to container via headers:
  - `X-ServiceNow-Instance`
  - `X-ServiceNow-Username`
  - `X-ServiceNow-Password`
  - `X-Anthropic-Api-Key`

**POST /api/disconnect**
```typescript
Request: { sessionId: string }
Response: { success: boolean }
```

**GET /health**
- Returns `{ status: "ok" }`

### 3. Container (`worker/server.js`)

WebSocket server on port 8080 implementing ttyd protocol:

**On Connection:**
1. Parse credentials from request headers
2. Create Claude Code config files:
   - `~/.claude/settings.json` (API key, permissions, env vars)
   - `~/.claude/CLAUDE.md` (ServiceNow credential usage instructions)
   - `~/.claude/skills/servicenow/SKILL.md` (ServiceNow API reference)
   - `~/.claude.json` (skip onboarding)
3. Set environment variables
4. Spawn bash with `claude; exec bash`

**Protocol:**
- Client sends: `"0" + input`, `"1" + JSON.stringify({columns, rows})`
- Server sends: `Buffer([0]) + data`

## Project Structure

```
cloudflare-claude-in-sandbox/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── assets/hero.png
│   │   ├── components/
│   │   │   ├── ConnectForm.tsx
│   │   │   ├── Terminal.tsx
│   │   │   └── StatusBar.tsx
│   │   └── utils/storage.ts
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── worker/
│   ├── src/index.ts
│   ├── server.js
│   ├── Dockerfile
│   ├── wrangler.jsonc
│   └── package.json
├── assets/
├── CLAUDE.md
├── SPEC.md
├── README.md
└── package.json
```

## Security

- Credentials transmitted over HTTPS only
- Credentials stored in Durable Object storage (not logged)
- Credentials passed to container via headers (not URL)
- Container isolated per session
- Container auto-sleeps after 5 minutes idle
- CORS headers allow configurable origins

## Configuration

### Frontend (localStorage)
- `workerUrl`: Cloudflare Worker URL
- `instance`: ServiceNow instance hostname
- `username`: ServiceNow username
- `password`: ServiceNow password
- `anthropicApiKey`: Anthropic API key
- `sessionId`: Session UUID for reconnection

### Container (env vars set by server.js)
- `ANTHROPIC_API_KEY`
- `SERVICENOW_INSTANCE`
- `SERVICENOW_USERNAME`
- `SERVICENOW_PASSWORD`

## Deployment

```bash
# Deploy worker to Cloudflare (required - Containers don't run locally)
npm run deploy

# Build frontend for ServiceNow deployment
npm run build  # outputs frontend/dist/index.html
```

Frontend can be deployed to ServiceNow using the update set or served standalone.
