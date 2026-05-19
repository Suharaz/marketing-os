# Phase 03 — HTTP transport + Bearer auth

## Context Links

- Plan: [plan.md](plan.md)
- Prev: [phase-02-core-server-and-tools.md](phase-02-core-server-and-tools.md)
- Research §2c, §3: `plans/reports/researcher-260519-1358-mcp-sdk-transports.md`

## Overview

- **Priority**: High
- **Status**: Pending (blocked by Phase 02)
- **Effort**: 0.5 ngày
- **Description**: Mount MCP HTTP transport vào Next.js App Router tại `app/api/mcp/[transport]/route.ts`, bọc bằng `withMcpAuth` (Bearer token).

## Key Insights

- **Stateless + JSON response mode** — không SSE, không session memory. Khớp serverless model của Next.js.
- **`runtime = 'nodejs'`** bắt buộc — `pg` không chạy trên Edge runtime.
- **Auth qua env var** `MCP_BEARER_TOKENS` (comma-separated). KHÔNG hardcode token.
- **`maxDuration = 60`** — Vercel Hobby chỉ 10s, Pro 60s, Enterprise 900s. Coolify không giới hạn (full Node).
- **Origin/Host validation** — `mcp-handler` lo cho DNS rebinding; nếu rolling raw thì phải tự handle.

## Requirements

### Functional
- Endpoint `POST /api/mcp` accept MCP JSON-RPC request
- Verify Bearer token; reject 401 nếu invalid
- Trả structured response (JSON) cho mọi tool call
- Hỗ trợ `GET /api/mcp` (capability discovery) và `DELETE /api/mcp` (session terminate — no-op trong stateless)
- Log mỗi request: `clientId`, `tool name`, `duration`, `status` — KHÔNG log token, KHÔNG log full payload

### Non-functional
- Route file ≤200 LOC
- Auth latency <5ms (env-loaded set lookup)
- Rate limit: defer Phase 05 hoặc dựa vào edge layer hiện có

## Architecture

### Request flow
```
Client (Zapier/n8n/in-app) 
  → POST https://app/api/mcp 
  → Next.js middleware (nếu có)
  → app/api/mcp/[transport]/route.ts
  → withMcpAuth (verify Bearer)
  → mcp-handler (StreamableHTTPServerTransport stateless)
  → createServer() — Phase 02 factory
  → Tool handler → query → response
```

### Auth model
```
verifyToken(req, bearer) → AuthInfo | undefined
  - undefined → 401 Unauthorized
  - AuthInfo  → request proceeds, server.auth = info
```

`AuthInfo.clientId` = label cho audit log (vd `zapier`, `n8n`, `in-app`).

## Related Code Files

**Create:**
- `app/api/mcp/[transport]/route.ts` — HTTP entry (~50 LOC)
- `src/mcp/auth.ts` — implement `verifyToken(req, bearer)` (~40 LOC)
- `src/mcp/logger.ts` — minimal logger `logRequest({ clientId, tool, durationMs, status })` (~20 LOC)

**Modify:**
- `.env.example` — finalize format `MCP_BEARER_TOKENS_JSON='{"tok_xxx":{"clientId":"zapier","scopes":["read"]}}'`
- `next.config.ts` — nếu cần whitelist origin (CORS) cho Zapier/n8n

**Read for context (MUST READ):**
- `next.config.ts` — xem có custom middleware/headers nào
- `src/middleware.ts` (nếu có) — verify không conflict với MCP route
- `app/api/.../route.ts` (1 file API route bất kỳ) — quen pattern App Router của project

## Implementation Steps

### 1. Implement `src/mcp/auth.ts`
```ts
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

interface TokenConfig { clientId: string; scopes: string[]; }

let cache: Map<string, TokenConfig> | null = null;

function loadTokens(): Map<string, TokenConfig> {
  if (cache) return cache;
  const raw = process.env.MCP_BEARER_TOKENS_JSON;
  if (!raw) return new Map();
  try {
    const obj = JSON.parse(raw) as Record<string, TokenConfig>;
    cache = new Map(Object.entries(obj));
    return cache;
  } catch {
    console.error('[mcp/auth] Invalid MCP_BEARER_TOKENS_JSON; auth disabled');
    return new Map();
  }
}

export async function verifyToken(
  _req: Request,
  bearer?: string,
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
```

**Decision:** dùng JSON format từ đầu để có `clientId` cho log. Đơn giản hơn việc parse comma-separated rồi thêm cột sau.

### 2. Implement `app/api/mcp/[transport]/route.ts`
```ts
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { createServer } from '@/mcp/server';
import { verifyToken } from '@/mcp/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    // mcp-handler tạo McpServer riêng → register tools lại
    const core = createServer();
    // Hoặc nếu mcp-handler nhận sẵn server instance, dùng pattern khác
    // (xem mcp-handler README; có thể cần dùng `server.tool(...)` API trực tiếp)
  },
  {},
  { basePath: '/api', maxDuration: 60, verboseLogs: false },
);

const authed = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ['read'],
});

export { authed as GET, authed as POST, authed as DELETE };
```

**Verify API:** Đọc lại `node_modules/mcp-handler/dist/...` để xác định:
- `createMcpHandler` callback nhận `server` chưa register hay đã register?
- Có pass `McpServer` instance được không?

Nếu callback nhận server trống, refactor `createServer()` thành `registerAllTools(server)` factory cho dễ tái sử dụng.

### 3. Implement `src/mcp/logger.ts`
Minimal — chỉ `console.log` JSON line. Đủ cho MVP. Production có thể swap sang structured logger sau:
```ts
export function logRequest(data: {
  clientId: string;
  tool: string;
  durationMs: number;
  status: 'ok' | 'error';
}) {
  console.log(JSON.stringify({ ts: Date.now(), kind: 'mcp.tool.call', ...data }));
}
```

KHÔNG log: `token`, `bearer`, full input/output payload.

### 4. Wire logger vào tool handler (optional, lift to Phase 02)
Cách dễ nhất: wrap mỗi tool handler bằng `withLogging(toolName, handler)`. Defer nếu không cần ngay.

### 5. Test thủ công với `curl`
```bash
# Trong .env: MCP_BEARER_TOKENS_JSON='{"tok_dev_123":{"clientId":"dev","scopes":["read"]}}'
npm run dev

# Unauth → 401
curl -X POST http://localhost:3000/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# With Bearer → 200 + tools
curl -X POST http://localhost:3000/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer tok_dev_123' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### 6. Verify build
```bash
npx tsc --noEmit
npm run build
```

## Todo List

- [ ] Đọc `next.config.ts` + `src/middleware.ts` (nếu có)
- [ ] Đọc `node_modules/mcp-handler` README để confirm callback signature
- [ ] Implement `src/mcp/auth.ts`
- [ ] Implement `app/api/mcp/[transport]/route.ts`
- [ ] Implement `src/mcp/logger.ts`
- [ ] Update `.env.example` với format JSON
- [ ] Test curl: unauth 401, authed 200
- [ ] Test curl tool call: `tools/call` → response đúng shape
- [ ] `npm run build` pass

## Success Criteria

- `POST /api/mcp` không có Bearer → HTTP 401
- `POST /api/mcp` với Bearer hợp lệ + `method: "tools/list"` → 5 tools
- `POST /api/mcp` với Bearer + `method: "tools/call"` + valid args → kết quả query
- Token sai → 401
- Log dòng JSON cho mỗi tool call (không chứa token)

## Risk Assessment

| Risk | Mitigation |
|---|---|
| `mcp-handler` callback API khác research giả định | Đọc README + source trước khi viết route |
| Vercel `maxDuration` 10s (Hobby) → tool slow timeout | Đo p95 query → tune `LIMIT`, hoặc upgrade plan |
| Pool exhaustion từ Zapier loop | Phase 05 thêm rate limit; tạm thời monitor connection count |
| CORS chặn in-app fetch | In-app fetch là server-side (cùng origin) → no CORS issue. Zapier/n8n gọi server-to-server → no CORS issue. |
| Token leak qua log | `logRequest()` không nhận `token` field — interface enforce |

## Security Considerations

- **Token storage**: env var, không DB (MVP). Defer DB nếu cần revoke.
- **Token format**: prefix `tok_` + 32-char random (giúp grep audit). Sinh bằng `openssl rand -hex 16`.
- **No token in logs**: structured log function chỉ accept whitelist field.
- **Auth required**: `required: true` trong `withMcpAuth` — không có Bearer = 401, không phải proceed without auth.
- **Scope check**: tất cả tool yêu cầu scope `read`. Nếu sau này thêm write tool, dùng scope `write` riêng.
- **DB account**: Phase này dùng app's DB user (full access). **TODO Phase 05**: tạo `mcp_readonly` role với `SELECT` only trên whitelist tables.

## Next Steps

→ Phase 04: stdio entry + Claude Desktop/Code config docs.
