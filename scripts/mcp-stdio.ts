// MCP stdio entry — dùng cho Claude Desktop + Claude Code.
// Run: npm run mcp:stdio
//
// CRITICAL: stdout là kênh JSON-RPC, KHÔNG được console.log.
// Mọi log diagnostic phải đi stderr (console.error).

import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../src/mcp/server';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('[mcp-stdio] DATABASE_URL is required');
    process.exit(1);
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[mcp-stdio] connected; awaiting JSON-RPC on stdin');
}

main().catch((err) => {
  console.error('[mcp-stdio] fatal:', err);
  process.exit(1);
});
