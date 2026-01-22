# Cloudflare Container for Claude Code
FROM node:20-slim

# Install dependencies including build tools for node-pty
RUN apt-get update && apt-get install -y \
    curl \
    git \
    bash \
    ca-certificates \
    python3 \
    make \
    g++ \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install Node packages
RUN npm init -y && npm install ws node-pty

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Create workspace directory
RUN mkdir -p /workspace

# Claude Code configuration is created at runtime by server.js
# This allows dynamic injection of API key and ServiceNow credentials

# Set environment for terminal
ENV SHELL=/bin/bash
ENV TERM=xterm-256color

# Copy server script
COPY server.js /app/server.js

# Expose WebSocket port
EXPOSE 8080

# Start the server
CMD ["node", "/app/server.js"]
