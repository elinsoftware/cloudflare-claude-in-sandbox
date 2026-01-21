# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-page React application enabling users to interact with Claude Code running in a Cloudflare Sandbox container, with ServiceNow integration capabilities.

## Commands

```bash
# Development (runs frontend + worker concurrently)
npm run dev

# Individual services
npm run dev:frontend    # Vite dev server (HMR)
npm run dev:worker      # Wrangler local dev

# Build & Deploy
npm run build           # Build frontend
npm run deploy          # Deploy worker to Cloudflare
npm run typecheck       # TypeScript check (worker only)

# Linting (frontend only)
cd frontend && npm run lint
```

## Architecture

Three-tier distributed system:

```
Browser (React) → Cloudflare Worker (Durable Objects) → Container (Claude Code CLI)
```

**Data flow:**
1. User enters ServiceNow credentials in React form
2. Frontend POSTs to `/api/connect`
3. Worker creates container via Durable Object with credentials as env vars
4. Container starts WebSocket server (ttyd protocol)
5. Frontend connects via WebSocket for terminal I/O
6. Claude Code CLI runs in container with ServiceNow access

## Key Technical Details

**ttyd Protocol** - Binary WebSocket messages:
- Client sends: `"0" + input` (terminal input), `"1" + JSON.stringify({columns, rows})` (resize)
- Server sends: `Buffer([0]) + data` (terminal output)

**Worker Endpoints:**
- `POST /api/connect` - Create/reconnect session, returns sessionId + wsUrl
- `WebSocket /api/terminal/:sessionId` - Proxied terminal connection
- `POST /api/disconnect` - Stop container
- `GET /health` - Health check

**Container:** Node 20 + node-pty + ws + Claude Code CLI global install

## Project Structure

```
frontend/           # React SPA (Vite, Tailwind, xterm.js)
  src/
    App.tsx         # Main state management
    components/
      ConnectForm   # Credentials form, localStorage persistence
      Terminal      # xterm.js + ttyd protocol handling
      StatusBar     # Connection indicator

worker/             # Cloudflare Worker
  src/index.ts      # Request handler + ClaudeContainer Durable Object
  server.js         # Container's WebSocket server (copied into Docker)
  Dockerfile        # Container image
  wrangler.jsonc    # Durable Object + Container config
```

## Important Notes

- Credentials stored in localStorage (frontend) and passed to container via env vars
- Sessions identified by UUID, allow reconnection via sessionId
- Container auto-sleeps after 10 minutes idle
- Dev proxy: frontend at :5173 proxies `/api` to worker at :8787
- No test suite currently configured
