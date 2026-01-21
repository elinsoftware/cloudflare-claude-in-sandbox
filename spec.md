# Claude Code in Cloudflare Sandbox - Specification

## Overview

Single-page React application enabling users to interact with Claude Code running in a Cloudflare Sandbox container, with ServiceNow integration capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ServiceNow Instance                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              React App (Vite + Tailwind)              │  │
│  │  ┌─────────────┐    ┌──────────────────────────────┐  │  │
│  │  │ Connect Form│    │    xterm.js Terminal         │  │  │
│  │  │ - Instance  │    │    (WebSocket connection)    │  │  │
│  │  │ - Username  │    │                              │  │  │
│  │  │ - Password  │    │                              │  │  │
│  │  └─────────────┘    └──────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker                         │
│  - Manages sandbox lifecycle                                 │
│  - Proxies WebSocket connections                            │
│  - Passes ServiceNow credentials to sandbox                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ getSandbox() / wsConnect()
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Cloudflare Sandbox Container                 │
│  - Ubuntu 22.04 LTS base                                    │
│  - Claude Code CLI installed                                │
│  - Uses ServiceNow Table API directly (no MCP needed)       │
│  - Receives credentials via environment variables           │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Frontend
- **Framework**: React 18+
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Terminal**: xterm.js via `react-xtermjs` wrapper
- **WebSocket**: Native WebSocket API

### Backend
- **Runtime**: Cloudflare Workers
- **Container**: Cloudflare Sandbox SDK
- **Base Image**: `cloudflare/sandbox:0.3.3` (or latest)

### Container Environment
- Ubuntu 22.04 LTS
- Node.js 20 LTS
- Claude Code CLI (npm install -g @anthropic-ai/claude-code)
- Claude Code uses ServiceNow Table API directly (no MCP server needed)

## Components

### 1. Frontend - React Application

#### 1.1 Connect Form
- Instance URL input (e.g., `dev12345.service-now.com`)
- Username input
- Password input (masked)
- Connect button
- Validation: all fields required

#### 1.2 Terminal Component
- xterm.js terminal embedded in page
- Full terminal emulation (colors, cursor, scrollback)
- Responsive sizing (fills available space)
- WebSocket connection to Cloudflare Worker
- Auto-reconnect on disconnect

#### 1.3 State Management
- Connection status (disconnected, connecting, connected)
- Session ID for sandbox instance
- Error handling and display

### 2. Backend - Cloudflare Worker

#### 2.1 Endpoints

**POST /api/connect**
```typescript
Request: {
  instance: string;    // ServiceNow instance URL
  username: string;
  password: string;
}
Response: {
  sessionId: string;   // Unique sandbox session ID
  wsUrl: string;       // WebSocket URL for terminal
}
```

**WebSocket /api/terminal/:sessionId**
- Bidirectional terminal I/O
- Proxies to sandbox container

**POST /api/disconnect**
```typescript
Request: { sessionId: string }
Response: { success: boolean }
```

#### 2.2 Sandbox Management
- Create sandbox with unique session ID
- Set environment variables:
  - `SERVICENOW_INSTANCE`
  - `SERVICENOW_USERNAME`
  - `SERVICENOW_PASSWORD`
  - `ANTHROPIC_API_KEY` (from Worker secrets)
- Start Claude Code CLI process
- Proxy terminal I/O via WebSocket
- Handle cleanup on disconnect

### 3. Container - Sandbox Configuration

#### 3.1 Dockerfile
```dockerfile
FROM docker.io/cloudflare/sandbox:0.3.3

# Install Claude Code
RUN npm install -g @anthropic-ai/claude-code
```

#### 3.2 Startup Script
- Start Claude Code CLI with ServiceNow credentials available as env vars
- Claude Code will use ServiceNow Table API directly for queries
- Connect to terminal WebSocket

## User Flow

1. User opens React app (embedded as ServiceNow Widget)
2. User enters ServiceNow credentials in form (instance, username, password)
3. User clicks "Connect"
4. Frontend calls POST /api/connect
5. Worker creates sandbox with credentials as env vars
6. Worker starts Claude Code in sandbox
7. Worker returns WebSocket URL
8. Frontend connects xterm.js to WebSocket
9. User sees Claude Code terminal, can start chatting
10. Claude Code uses ServiceNow Table API directly to query/interact with instance
11. User clicks "Disconnect" or closes browser
12. Worker destroys sandbox, cleans up resources

## Security Considerations

- Credentials transmitted over HTTPS only
- Credentials stored only in sandbox env vars (not logged)
- Sandbox isolated per session
- Sandbox auto-destroys after inactivity (10 min default)
- CORS configured for ServiceNow domain only
- Rate limiting on connect endpoint

## Project Structure

```
cloudflare-claude-in-sandbox/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ConnectForm.tsx
│   │   │   ├── Terminal.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   └── useTerminal.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── worker/
│   ├── src/
│   │   ├── index.ts
│   │   ├── sandbox.ts
│   │   └── websocket.ts
│   ├── Dockerfile
│   ├── wrangler.jsonc
│   └── package.json
├── spec.md
└── README.md
```

## Development Phases

### Phase 1: Basic Infrastructure
- Set up Vite + React + Tailwind frontend
- Set up Cloudflare Worker with Sandbox SDK
- Basic "Hello World" container spin-up

### Phase 2: Terminal Integration
- Integrate xterm.js in frontend
- Implement WebSocket proxy in Worker
- Connect terminal to sandbox shell

### Phase 3: Claude Code Integration
- Install Claude Code in container
- Configure Anthropic API key
- Test basic Claude Code interaction

### Phase 4: ServiceNow Integration
- Add credential form to frontend
- Pass credentials to sandbox as env vars
- Test Claude Code using ServiceNow Table API

### Phase 5: Polish & Production
- Error handling and reconnection
- Loading states and UX improvements
- Security hardening
- Documentation

## Configuration

### Environment Variables (Worker)
- `ANTHROPIC_API_KEY`: Claude API key (secret)

### Environment Variables (Sandbox)
- `SERVICENOW_INSTANCE`: From user input
- `SERVICENOW_USERNAME`: From user input
- `SERVICENOW_PASSWORD`: From user input
- `ANTHROPIC_API_KEY`: Passed from Worker

## API Reference

### Cloudflare Sandbox SDK (Key Methods)
```typescript
// Get/create sandbox instance
const sandbox = getSandbox(env.Sandbox, sessionId, {
  sleepAfter: '10m',
});

// Set environment variables
await sandbox.setEnvVars({
  SERVICENOW_INSTANCE: instance,
  SERVICENOW_USERNAME: username,
  SERVICENOW_PASSWORD: password,
  ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
});

// Execute command
const result = await sandbox.exec('claude');

// WebSocket connection
return await sandbox.wsConnect(request, 8080);

// Cleanup
await sandbox.destroy();
```

---

## Decisions Made

- **Hosting**: ServiceNow Widget (embedded in ServiceNow UI)
- **ServiceNow Integration**: Claude Code uses Table API directly (no MCP server)
- **Authentication**: Username/Password (basic auth)

## Remaining Questions

1. **Session Persistence**: Should sessions persist between browser refreshes? Or always start fresh?
2. **Multiple Sessions**: Allow multiple concurrent sessions per user?
3. **ServiceNow Permissions**: Which tables/APIs will Claude Code need access to?
