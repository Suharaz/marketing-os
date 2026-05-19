// Bearer token verification cho HTTP transport.
// Token format trong env: MCP_BEARER_TOKENS_JSON='{"tok_xxx":{"clientId":"name","scopes":["read"]}}'
// Stdio transport KHÔNG dùng auth (local process inherit user env).

import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

interface TokenConfig {
  clientId: string;
  scopes: string[];
}

// Cache lazy-init: load 1 lần khi gọi đầu, reuse sau đó. Re-deploy = reset.
let tokenCache: Map<string, TokenConfig> | null = null;

function loadTokens(): Map<string, TokenConfig> {
  if (tokenCache) return tokenCache;
  const raw = process.env.MCP_BEARER_TOKENS_JSON;
  if (!raw) {
    tokenCache = new Map();
    return tokenCache;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, TokenConfig>;
    tokenCache = new Map(Object.entries(parsed));
    return tokenCache;
  } catch (err) {
    console.error('[mcp/auth] Invalid MCP_BEARER_TOKENS_JSON; rejecting all requests.', err);
    tokenCache = new Map();
    return tokenCache;
  }
}

/**
 * Verify Bearer token → AuthInfo cho mcp-handler.
 * `undefined` return = 401 Unauthorized (per withMcpAuth spec).
 */
export async function verifyToken(
  _req: Request,
  bearer?: string
): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;
  const cfg = loadTokens().get(bearer);
  if (!cfg) return undefined;
  return {
    token: bearer,
    clientId: cfg.clientId,
    scopes: cfg.scopes,
    extra: {},
  };
}
