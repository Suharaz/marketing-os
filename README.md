# Marketing OS — TAKI Group

Internal marketing operations platform.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start Postgres dev database (from repo root)
docker compose -f ../docker-compose.dev.yml up -d

# 3. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env` and fill in real values before running.

## MCP Server

Marketing OS expose read-only data qua **Model Context Protocol** cho Claude Desktop, Claude Code, AI agent in-app, và external tools (Zapier, n8n). 10 tools (4 channels + 3 posts + 3 analytics).

→ Setup guide: [docs/mcp-server-setup.md](docs/mcp-server-setup.md)

```bash
# Stdio entry (cho Claude Desktop / Code)
npm run mcp:stdio

# HTTP endpoint (chạy cùng `npm run dev`)
# POST /api/mcp (yêu cầu Bearer token trong MCP_BEARER_TOKENS_JSON)
```
