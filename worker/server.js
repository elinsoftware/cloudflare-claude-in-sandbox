const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const fs = require('fs');
const path = require('path');

// Version: 2026-01-21-v6

// Setup Claude Code configuration (called on first WebSocket connection with credentials)
function setupClaudeConfig(apiKey, instance, username, password) {
  const homeDir = process.env.HOME || '/root';
  const claudeDir = path.join(homeDir, '.claude');
  const skillsDir = path.join(claudeDir, 'skills', 'servicenow');

  // Create directories
  fs.mkdirSync(skillsDir, { recursive: true });

  // Create settings.json with API key from env
  const settings = {
    env: {
      ANTHROPIC_API_KEY: apiKey
    },
    permissions: {
      allow: ["Bash", "Read", "Edit", "Write", "Glob", "Grep", "WebFetch", "WebSearch"],
      deny: []
    }
  };
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify(settings, null, 2));

  // Create user preferences to skip onboarding
  fs.writeFileSync(path.join(homeDir, '.claude.json'), JSON.stringify({
    hasCompletedOnboarding: true,
    hasAcknowledgedCostThreshold: true
  }, null, 2));

  // Create ServiceNow skill
  const skillContent = `---
name: servicenow
description: ServiceNow REST API integration. Use when interacting with ServiceNow tables, incidents, or any ServiceNow API calls.
allowed-tools: Bash, WebFetch
---

# ServiceNow API Configuration

You have access to a ServiceNow instance with the following credentials:

- **Instance URL**: https://${instance}.service-now.com
- **Username**: ${username}
- **Password**: ${password}

## Authentication

Use Basic Auth for all API calls:
\`\`\`bash
curl -u "${username}:${password}" "https://${instance}.service-now.com/api/now/table/incident?sysparm_limit=5"
\`\`\`

## Common Endpoints

| Endpoint | Description |
|----------|-------------|
| \`/api/now/table/{table_name}\` | Query any table (incident, sys_user, cmdb_ci, etc.) |
| \`/api/now/table/incident\` | Incidents |
| \`/api/now/table/sys_user\` | Users |
| \`/api/now/table/change_request\` | Change requests |
| \`/api/now/table/sc_request\` | Service catalog requests |

## Query Parameters

- \`sysparm_limit=N\` - Limit results
- \`sysparm_offset=N\` - Pagination offset
- \`sysparm_fields=field1,field2\` - Select specific fields
- \`sysparm_query=active=true^priority=1\` - Filter with encoded query

## Example: Get Open Incidents

\`\`\`bash
curl -u "${username}:${password}" \\
  "https://${instance}.service-now.com/api/now/table/incident?sysparm_query=active=true&sysparm_limit=10&sysparm_fields=number,short_description,priority,state"
\`\`\`

## Example: Create Incident

\`\`\`bash
curl -u "${username}:${password}" \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"short_description":"Test incident","description":"Created via API"}' \\
  "https://${instance}.service-now.com/api/now/table/incident"
\`\`\`

Always use these credentials when making ServiceNow API calls.
`;

  fs.writeFileSync(path.join(skillsDir, 'SKILL.md'), skillContent);

  console.log('Claude Code configuration created:');
  console.log('  API key:', apiKey ? '[SET]' : '[NOT SET]');
  console.log('  ServiceNow instance:', instance || '[EMPTY]');
  console.log('  ServiceNow username:', username || '[EMPTY]');
}

const wss = new WebSocketServer({
  port: 8080,
  perMessageDeflate: false
});
console.log('WebSocket terminal server v5 listening on port 8080');

wss.on('connection', (ws, req) => {
  console.log('Client connected from:', req.socket.remoteAddress);
  console.log('Request headers:', JSON.stringify(req.headers));

  // Parse credentials from custom headers (set by worker when proxying)
  const apiKey = req.headers['x-anthropic-api-key'] || '';
  const instance = req.headers['x-servicenow-instance'] || '';
  const username = req.headers['x-servicenow-username'] || '';
  const password = req.headers['x-servicenow-password'] || '';

  console.log('Credentials from headers:');
  console.log('  apiKey:', apiKey ? '[SET]' : '[NOT SET]');
  console.log('  instance:', instance || '[NOT SET]');
  console.log('  username:', username || '[NOT SET]');
  console.log('  password:', password ? '[SET]' : '[NOT SET]');

  // Setup Claude config with credentials from URL
  setupClaudeConfig(apiKey, instance, username, password);

  // Spawn bash shell that auto-starts claude
  // Using bash allows user to exit claude and still have a shell
  const shell = pty.spawn('/bin/bash', ['-c', 'claude; exec bash'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: '/workspace',
    env: process.env
  });

  // Send shell output to WebSocket (ttyd binary format)
  shell.onData((data) => {
    if (ws.readyState === 1) {
      // ttyd format: type 0 + data (binary)
      const buf = Buffer.alloc(1 + Buffer.byteLength(data));
      buf[0] = 0; // Output type
      buf.write(data, 1);
      ws.send(buf);
    }
  });

  shell.onExit(() => {
    console.log('Shell exited');
    ws.close();
  });

  // Handle WebSocket messages
  ws.on('message', (msg) => {
    const str = msg.toString();
    const type = str[0];
    const data = str.slice(1);

    if (type === '0') {
      // Input
      shell.write(data);
    } else if (type === '1') {
      // Resize
      try {
        const size = JSON.parse(data);
        shell.resize(size.columns, size.rows);
      } catch (e) {
        console.error('Invalid resize:', e);
      }
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    shell.kill();
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    shell.kill();
  });
});
