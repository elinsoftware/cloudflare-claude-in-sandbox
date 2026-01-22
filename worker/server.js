const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const fs = require('fs');
const path = require('path');

// Version: 2026-01-22-v10

// Setup Claude Code configuration (called on first WebSocket connection with credentials)
function setupClaudeConfig(apiKey, instance, username, password) {
  const homeDir = process.env.HOME || '/root';
  const claudeDir = path.join(homeDir, '.claude');
  const skillsDir = path.join(claudeDir, 'skills', 'servicenow');

  // Create directories
  fs.mkdirSync(skillsDir, { recursive: true });

  // Normalize instance - strip https:// or http:// prefix if present
  const normalizedInstance = instance.replace(/^https?:\/\//, '');

  // Set environment variables for ServiceNow credentials (so they don't appear in command output)
  process.env.ANTHROPIC_API_KEY = apiKey;
  process.env.SERVICENOW_INSTANCE = normalizedInstance;
  process.env.SERVICENOW_USERNAME = username;
  process.env.SERVICENOW_PASSWORD = password;

  // Create settings.json with API key
  const settings = {
    env: {
      ANTHROPIC_API_KEY: apiKey,
      SERVICENOW_INSTANCE: normalizedInstance,
      SERVICENOW_USERNAME: username,
      SERVICENOW_PASSWORD: password
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

  // Create CLAUDE.md with instructions to use environment variables
  const claudeMdContent = `# ServiceNow Claude Code Environment

## IMPORTANT: Credential Security

**NEVER hardcode credentials in commands.** Always use environment variables:

- \`$SERVICENOW_INSTANCE\` - ServiceNow instance hostname (e.g., dev12345.service-now.com)
- \`$SERVICENOW_USERNAME\` - Username for API calls
- \`$SERVICENOW_PASSWORD\` - Password for API calls

Example:
\`\`\`bash
curl -s -u "$SERVICENOW_USERNAME:$SERVICENOW_PASSWORD" \\
  "https://$SERVICENOW_INSTANCE/api/now/table/incident?sysparm_limit=5"
\`\`\`

This prevents credentials from being displayed in the terminal output.
`;
  fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), claudeMdContent);

  // Create comprehensive ServiceNow skill
  const skillContent = `---
name: servicenow
description: ServiceNow Table API integration. Use for all ServiceNow CRUD operations on tables like incident, sys_user, change_request, cmdb_ci, etc.
allowed-tools: Bash, WebFetch
---

# ServiceNow Table API Reference

## Authentication

**ALWAYS use environment variables for credentials to prevent them from being displayed:**

\`\`\`bash
curl -s -u "$SERVICENOW_USERNAME:$SERVICENOW_PASSWORD" \\
  -H "Accept: application/json" \\
  "https://$SERVICENOW_INSTANCE/api/now/table/{table_name}"
\`\`\`

## Base URL Pattern

\`https://$SERVICENOW_INSTANCE/api/now/table/{table_name}\`

## Common Tables

| Table | Description |
|-------|-------------|
| \`incident\` | IT incidents |
| \`sys_user\` | Users |
| \`sys_user_group\` | User groups |
| \`change_request\` | Change requests |
| \`problem\` | Problems |
| \`sc_request\` | Service catalog requests |
| \`sc_req_item\` | Requested items |
| \`cmdb_ci\` | Configuration items |
| \`cmdb_ci_server\` | Servers |
| \`kb_knowledge\` | Knowledge articles |
| \`task\` | Tasks (parent of many tables) |
| \`sc_cat_item\` | Catalog items |
| \`sys_attachment\` | Attachments |

---

## HTTP Methods

### GET - Retrieve Records

**Get all records (with limit):**
\`\`\`bash
curl -s -u "$SERVICENOW_USERNAME:$SERVICENOW_PASSWORD" \\
  -H "Accept: application/json" \\
  "https://$SERVICENOW_INSTANCE/api/now/table/incident?sysparm_limit=10"
\`\`\`

**Get single record by sys_id:**
\`\`\`bash
curl -s -u "$SERVICENOW_USERNAME:$SERVICENOW_PASSWORD" \\
  -H "Accept: application/json" \\
  "https://$SERVICENOW_INSTANCE/api/now/table/incident/{sys_id}"
\`\`\`

### POST - Create Record

\`\`\`bash
curl -s -u "$SERVICENOW_USERNAME:$SERVICENOW_PASSWORD" \\
  -H "Accept: application/json" \\
  -H "Content-Type: application/json" \\
  -X POST \\
  -d '{"short_description":"New incident","urgency":"2","impact":"2"}' \\
  "https://$SERVICENOW_INSTANCE/api/now/table/incident"
\`\`\`

### PUT - Update Record (replace all fields)

\`\`\`bash
curl -s -u "$SERVICENOW_USERNAME:$SERVICENOW_PASSWORD" \\
  -H "Accept: application/json" \\
  -H "Content-Type: application/json" \\
  -X PUT \\
  -d '{"short_description":"Updated description","urgency":"1"}' \\
  "https://$SERVICENOW_INSTANCE/api/now/table/incident/{sys_id}"
\`\`\`

### PATCH - Update Record (partial update)

\`\`\`bash
curl -s -u "$SERVICENOW_USERNAME:$SERVICENOW_PASSWORD" \\
  -H "Accept: application/json" \\
  -H "Content-Type: application/json" \\
  -X PATCH \\
  -d '{"state":"6","close_notes":"Resolved via API"}' \\
  "https://$SERVICENOW_INSTANCE/api/now/table/incident/{sys_id}"
\`\`\`

### DELETE - Delete Record

\`\`\`bash
curl -s -u "$SERVICENOW_USERNAME:$SERVICENOW_PASSWORD" \\
  -X DELETE \\
  "https://$SERVICENOW_INSTANCE/api/now/table/incident/{sys_id}"
\`\`\`

---

## Query Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| \`sysparm_query\` | Encoded query string | \`active=true^priority=1\` |
| \`sysparm_fields\` | Comma-separated field list | \`number,short_description,state\` |
| \`sysparm_limit\` | Max records to return | \`100\` |
| \`sysparm_offset\` | Starting record index | \`0\` |
| \`sysparm_display_value\` | Return display values | \`true\`, \`false\`, \`all\` |
| \`sysparm_exclude_reference_link\` | Exclude reference links | \`true\` |
| \`sysparm_suppress_pagination_header\` | Hide pagination header | \`true\` |
| \`sysparm_view\` | UI view to use | \`mobile\`, \`desktop\` |

---

## Query Syntax (sysparm_query)

### Operators

| Operator | Description | Example |
|----------|-------------|---------|
| \`=\` | Equals | \`active=true\` |
| \`!=\` | Not equals | \`state!=7\` |
| \`^\` | AND | \`active=true^priority=1\` |
| \`^OR\` | OR | \`priority=1^ORpriority=2\` |
| \`^NQ\` | New query (complex OR) | \`state=1^NQstate=2\` |
| \`LIKE\` | Contains | \`short_descriptionLIKEnetwork\` |
| \`STARTSWITH\` | Starts with | \`numberSTARTSWITHINC\` |
| \`ENDSWITH\` | Ends with | \`numberENDSWITH001\` |
| \`IN\` | In list | \`stateIN1,2,3\` |
| \`NOTIN\` | Not in list | \`stateNOTIN6,7\` |
| \`ISEMPTY\` | Is empty | \`assigned_toISEMPTY\` |
| \`ISNOTEMPTY\` | Is not empty | \`assigned_toISNOTEMPTY\` |
| \`<\` | Less than | \`priority<3\` |
| \`>\` | Greater than | \`priority>1\` |
| \`<=\` | Less than or equal | \`priority<=2\` |
| \`>=\` | Greater than or equal | \`priority>=2\` |
| \`BETWEEN\` | Between values | \`priorityBETWEEN1@3\` |
| \`ORDERBY\` | Sort ascending | \`^ORDERBYnumber\` |
| \`ORDERBYDESC\` | Sort descending | \`^ORDERBYDESCsys_created_on\` |

### Date Queries

| Operator | Description | Example |
|----------|-------------|---------|
| \`javascript:gs.daysAgo(N)\` | N days ago | \`sys_created_on>=javascript:gs.daysAgo(7)\` |
| \`javascript:gs.beginningOfLastMonth()\` | Start of last month | \`opened_at>=javascript:gs.beginningOfLastMonth()\` |
| \`javascript:gs.endOfLastMonth()\` | End of last month | \`opened_at<=javascript:gs.endOfLastMonth()\` |

---

## Common Examples

### Get open high-priority incidents
\`\`\`bash
curl -s -u "$SERVICENOW_USERNAME:$SERVICENOW_PASSWORD" \\
  -H "Accept: application/json" \\
  "https://$SERVICENOW_INSTANCE/api/now/table/incident?sysparm_query=active=true^priority<=2&sysparm_fields=number,short_description,priority,assigned_to&sysparm_limit=20"
\`\`\`

### Get incidents created in last 7 days
\`\`\`bash
curl -s -u "$SERVICENOW_USERNAME:$SERVICENOW_PASSWORD" \\
  -H "Accept: application/json" \\
  "https://$SERVICENOW_INSTANCE/api/now/table/incident?sysparm_query=sys_created_on>=javascript:gs.daysAgo(7)&sysparm_limit=50"
\`\`\`

### Search incidents by keyword
\`\`\`bash
curl -s -u "$SERVICENOW_USERNAME:$SERVICENOW_PASSWORD" \\
  -H "Accept: application/json" \\
  "https://$SERVICENOW_INSTANCE/api/now/table/incident?sysparm_query=short_descriptionLIKEpassword^ORdescriptionLIKEpassword&sysparm_limit=20"
\`\`\`

### Get user by username
\`\`\`bash
curl -s -u "$SERVICENOW_USERNAME:$SERVICENOW_PASSWORD" \\
  -H "Accept: application/json" \\
  "https://$SERVICENOW_INSTANCE/api/now/table/sys_user?sysparm_query=user_name=admin&sysparm_fields=sys_id,name,email,user_name"
\`\`\`

### Create incident
\`\`\`bash
curl -s -u "$SERVICENOW_USERNAME:$SERVICENOW_PASSWORD" \\
  -H "Accept: application/json" \\
  -H "Content-Type: application/json" \\
  -X POST \\
  -d '{
    "short_description": "Application error on login page",
    "description": "Users receiving 500 error when attempting to login",
    "urgency": "2",
    "impact": "2",
    "category": "software",
    "subcategory": "application"
  }' \\
  "https://$SERVICENOW_INSTANCE/api/now/table/incident"
\`\`\`

### Resolve incident
\`\`\`bash
curl -s -u "$SERVICENOW_USERNAME:$SERVICENOW_PASSWORD" \\
  -H "Accept: application/json" \\
  -H "Content-Type: application/json" \\
  -X PATCH \\
  -d '{
    "state": "6",
    "close_code": "Solved (Permanently)",
    "close_notes": "Issue resolved by restarting the application server"
  }' \\
  "https://$SERVICENOW_INSTANCE/api/now/table/incident/{sys_id}"
\`\`\`

### Get incident count (stats API)
\`\`\`bash
curl -s -u "$SERVICENOW_USERNAME:$SERVICENOW_PASSWORD" \\
  -H "Accept: application/json" \\
  "https://$SERVICENOW_INSTANCE/api/now/stats/incident?sysparm_count=true&sysparm_query=active=true"
\`\`\`

---

## Response Format

Responses are JSON with a \`result\` key:

**Single record:**
\`\`\`json
{
  "result": {
    "sys_id": "...",
    "number": "INC0010001",
    "short_description": "..."
  }
}
\`\`\`

**Multiple records:**
\`\`\`json
{
  "result": [
    {"sys_id": "...", "number": "INC0010001", ...},
    {"sys_id": "...", "number": "INC0010002", ...}
  ]
}
\`\`\`

---

## Incident States

| State | Value | Description |
|-------|-------|-------------|
| New | 1 | Newly created |
| In Progress | 2 | Being worked on |
| On Hold | 3 | Waiting |
| Resolved | 6 | Fixed, awaiting confirmation |
| Closed | 7 | Completed |
| Canceled | 8 | Canceled |

## Incident Priority (calculated from Impact + Urgency)

| Priority | Value |
|----------|-------|
| Critical | 1 |
| High | 2 |
| Moderate | 3 |
| Low | 4 |
| Planning | 5 |

---

## Tips

1. **Always use \`sysparm_fields\`** to limit response size
2. **Use \`sysparm_display_value=true\`** to get readable values instead of sys_ids
3. **Paginate large results** with \`sysparm_limit\` and \`sysparm_offset\`
4. **Use \`-s\` flag with curl** to suppress progress output
5. **Do NOT pipe curl output to jq** - single-value jq output may not display correctly in this environment. Instead, return raw JSON and parse the response yourself
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
