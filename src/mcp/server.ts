// MCP server factory — shared core dùng cho cả stdio (scripts/mcp-stdio.ts)
// và HTTP transport (app/api/mcp/[transport]/route.ts).
//
// Triết lý: createServer() chỉ làm 1 việc — tạo McpServer + register tools.
// Mọi SQL ở src/lib/queries/*. Mọi PII redact ở src/mcp/redact.ts.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from './tools';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'marketing-os-mcp',
    version: '0.1.0',
  });
  registerAllTools(server);
  return server;
}
