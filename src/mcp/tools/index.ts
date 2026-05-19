// Tool registry — aggregate tất cả MCP tool domain vào 1 entry point.
// createServer() trong ../server.ts gọi registerAllTools(server) duy nhất.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerChannelTools } from './channels';
import { registerPostTools } from './posts';
import { registerAnalyticsTools } from './analytics';

export function registerAllTools(server: McpServer): void {
  registerChannelTools(server);
  registerPostTools(server);
  registerAnalyticsTools(server);
}
