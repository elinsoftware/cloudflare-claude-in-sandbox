import { Container } from "@cloudflare/containers";

const TTYD_PORT = 8080;

interface Env {
  ClaudeContainer: DurableObjectNamespace<ClaudeContainer>;
}

// Custom Container class for Claude Code sandbox
export class ClaudeContainer extends Container<Env> {
  defaultPort = TTYD_PORT;
  sleepAfter = "10m"; // Auto-sleep after 10 minutes of inactivity

  // Environment variables will be set dynamically per session
  envVars: Record<string, string> = {};

  override onStart() {
    console.log("[Container] Started", {
      timestamp: new Date().toISOString(),
      port: this.defaultPort,
    });
  }

  override onStop(): void {
    console.log("[Container] Stopped", {
      timestamp: new Date().toISOString(),
    });
  }

  override onError(error: unknown) {
    console.error("[Container] Error", {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
}

function generateSessionId(): string {
  return crypto.randomUUID();
}

function corsHeaders(origin?: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Upgrade",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || undefined;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // POST /api/connect - Create a new sandbox session or reconnect to existing
    if (url.pathname === "/api/connect" && request.method === "POST") {
      try {
        const body = (await request.json()) as {
          instance?: string;
          username?: string;
          password?: string;
          anthropicApiKey?: string;
          sessionId?: string; // Optional: reconnect to existing session
        };

        // If sessionId provided, try to reconnect
        if (body.sessionId) {
          console.log("Reconnecting to existing session:", body.sessionId);
          const id = env.ClaudeContainer.idFromName(body.sessionId);
          const container = env.ClaudeContainer.get(id);

          // Check if container is running
          const state = await container.getState();
          console.log("Container state:", state.status);

          if (state.status !== "running" && state.status !== "healthy") {
            return Response.json(
              { error: `Container is not running (status: ${state.status}). Create a new session.` },
              { status: 400, headers: corsHeaders(origin) }
            );
          }

          const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
          const wsUrl = `${wsProtocol}//${url.host}/api/terminal/${body.sessionId}`;
          return Response.json({ sessionId: body.sessionId, wsUrl }, { headers: corsHeaders(origin) });
        }

        // Create new session
        if (!body.instance || !body.username || !body.password || !body.anthropicApiKey) {
          return Response.json(
            { error: "Missing required fields: instance, username, password, anthropicApiKey" },
            { status: 400, headers: corsHeaders(origin) }
          );
        }

        const sessionId = generateSessionId();
        console.log("Creating sandbox session:", sessionId);

        // Get the container instance using session ID
        const id = env.ClaudeContainer.idFromName(sessionId);
        const container = env.ClaudeContainer.get(id);

        // Start container with environment variables and wait for ttyd port
        console.log("Starting container with ttyd on port", TTYD_PORT);
        await container.startAndWaitForPorts({
          ports: [TTYD_PORT],
          startOptions: {
            envVars: {
              SERVICENOW_INSTANCE: body.instance,
              SERVICENOW_USERNAME: body.username,
              SERVICENOW_PASSWORD: body.password,
              ANTHROPIC_API_KEY: body.anthropicApiKey,
              CLAUDE_CODE_SKIP_UPDATE_CHECK: "1",
              TERM: "xterm-256color",
            },
          },
        });

        console.log("Container started, ttyd ready!");

        // Return the WebSocket URL for terminal connection
        const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${url.host}/api/terminal/${sessionId}`;

        return Response.json({ sessionId, wsUrl }, { headers: corsHeaders(origin) });
      } catch (error) {
        console.error("Connect error:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        return Response.json(
          { error: `Failed to create session: ${errorMsg}` },
          { status: 500, headers: corsHeaders(origin) }
        );
      }
    }

    // WebSocket /api/terminal/:sessionId - Terminal WebSocket connection
    if (url.pathname.startsWith("/api/terminal/")) {
      const sessionId = url.pathname.split("/").pop();

      if (!sessionId) {
        return new Response("Missing session ID", { status: 400 });
      }

      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }

      console.log("WebSocket request for session:", sessionId);

      // Get the container instance
      const id = env.ClaudeContainer.idFromName(sessionId);
      const container = env.ClaudeContainer.get(id);

      try {
        // Connect to WebSocket inside container
        const containerWsUrl = `http://container.internal/ws`;
        console.log("Connecting to container WebSocket:", containerWsUrl);

        const containerResp = await container.fetch(containerWsUrl, {
          headers: {
            Upgrade: "websocket",
          },
        });

        console.log("Container response status:", containerResp.status);
        console.log("Container response headers:", JSON.stringify(Object.fromEntries(containerResp.headers.entries())));

        const containerWs = containerResp.webSocket;
        if (!containerWs) {
          throw new Error("Container didn't accept WebSocket connection");
        }

        // Accept the container WebSocket
        containerWs.accept();
        console.log("Container WebSocket accepted");

        // Create WebSocket pair for client connection
        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);

        // Accept the server side
        server.accept();

        // Forward messages from client to container
        server.addEventListener("message", (event) => {
          if (containerWs.readyState === WebSocket.READY_STATE_OPEN) {
            containerWs.send(event.data);
          }
        });

        server.addEventListener("close", (event) => {
          console.log("Client WebSocket closed, code:", event.code);
          containerWs.close();
        });

        server.addEventListener("error", (event) => {
          console.error("Client WebSocket error:", event);
          containerWs.close();
        });

        // Forward messages from container to client
        containerWs.addEventListener("message", (event) => {
          if (server.readyState === WebSocket.READY_STATE_OPEN) {
            server.send(event.data);
          }
        });

        containerWs.addEventListener("close", (event) => {
          console.log("Container WebSocket closed, code:", event.code);
          server.close();
        });

        containerWs.addEventListener("error", (event) => {
          console.error("Container WebSocket error:", event);
          server.close();
        });

        return new Response(null, {
          status: 101,
          webSocket: client,
        });
      } catch (error) {
        console.error("WebSocket connection error:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        return new Response(`Failed to connect: ${errorMsg}`, { status: 500 });
      }
    }

    // POST /api/disconnect - Destroy a sandbox session
    if (url.pathname === "/api/disconnect" && request.method === "POST") {
      try {
        const body = (await request.json()) as { sessionId?: string };

        if (!body.sessionId) {
          return Response.json(
            { error: "Missing sessionId" },
            { status: 400, headers: corsHeaders(origin) }
          );
        }

        const id = env.ClaudeContainer.idFromName(body.sessionId);
        const container = env.ClaudeContainer.get(id);
        await container.stop();

        return Response.json({ success: true }, { headers: corsHeaders(origin) });
      } catch (error) {
        console.error("Disconnect error:", error);
        return Response.json(
          { error: "Failed to disconnect" },
          { status: 500, headers: corsHeaders(origin) }
        );
      }
    }

    // Health check
    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    return new Response("Not Found", { status: 404 });
  },
};
