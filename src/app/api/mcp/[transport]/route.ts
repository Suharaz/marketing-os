// MCP HTTP transport mount point.
// Endpoint: POST /api/mcp (Streamable HTTP, stateless + JSON response mode).
// Auth: Bearer token via withMcpAuth — verify against MCP_BEARER_TOKENS_JSON env.
//
// Dùng bởi: in-app AI agent (server-side fetch), Zapier/n8n, external integrations.
// Claude Desktop/Code dùng stdio entry (scripts/mcp-stdio.ts) — không qua route này.

import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerAllTools } from '@/mcp/tools';
import { verifyToken } from '@/mcp/auth';

// Bắt buộc nodejs runtime — pg không chạy được trên Edge.
export const runtime = 'nodejs';
// Vercel Hobby = 10s, Pro = 60s, Enterprise = 900s. Coolify không giới hạn.
export const maxDuration = 60;

// createMcpHandler tạo McpServer mới + cho callback register tools.
const handler = createMcpHandler(
  (server) => {
    registerAllTools(server);
  },
  {},
  {
    basePath: '/api',
    maxDuration: 60,
    verboseLogs: false,
  }
);

// withMcpAuth chặn request không có Bearer hợp lệ → 401.
// Scope 'read' áp dụng cho 10 tools read-only hiện tại.
const authed = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ['read'],
});

export { authed as GET, authed as POST, authed as DELETE };
