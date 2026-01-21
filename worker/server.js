const { WebSocketServer } = require('ws');
const pty = require('node-pty');

// Version: 2026-01-21-v2
const wss = new WebSocketServer({
  port: 8080,
  perMessageDeflate: false
});
console.log('WebSocket terminal server v2 listening on port 8080');

wss.on('connection', (ws, req) => {
  console.log('Client connected from:', req.socket.remoteAddress);
  console.log('Headers:', JSON.stringify(req.headers));

  // Spawn a bash shell
  const shell = pty.spawn('/bin/bash', [], {
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
