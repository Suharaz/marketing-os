# MCP Server Design Research — `@modelcontextprotocol/sdk` for Next.js 16 Marketing OS

**Date:** 2026-05-19
**Scope:** Read-only MCP server (channels + posts) serving Claude Desktop, Claude Code, in-app AI agent, Zapier/n8n.
**Stack target:** Next.js 16.2.4 (App Router), TypeScript 5, `pg` 8.20, zod 4.4.2, ESM.

---

## TL;DR Recommendation

1. **SDK:** `@modelcontextprotocol/sdk@^1.29.0` (stable v1.x line; v2 is pre-alpha — avoid). Pin major to `1` since v2 will introduce breaking import paths.
2. **HTTP transport:** Use **`mcp-handler`** (Vercel's official Next.js adapter, currently `1.1.0`) instead of raw `StreamableHTTPServerTransport`. It bridges Web `Request`/`Response` ↔ Node `IncomingMessage`/`ServerResponse` which the raw SDK transport requires. Saves you ~200 LOC of adapter glue.
3. **Stdio transport:** Use raw SDK (`StdioServerTransport`) in a thin `bin/mcp-stdio.ts` entry compiled with `tsx`. Shares the same `registerTools(server)` function as the HTTP route.
4. **Auth:** Static **Bearer token** (env-loaded list of allowed tokens) via `withMcpAuth`. OAuth 2.1 is overkill for an internal tool. Skip stdio auth entirely (stdio runs locally, inherits process env).
5. **Layout:** `src/mcp/` for shared registration + tools; `app/api/mcp/[transport]/route.ts` for HTTP entry; `scripts/mcp-stdio.ts` for stdio binary.

---

## 1. SDK Choice

### Version
- Latest stable: **`@modelcontextprotocol/sdk@1.29.0`** (published 2026-03-30, per npm registry).
- v2 lives in `main` branch but README explicitly states *"v1.x remains the recommended version for production use."*
- Release cadence: monthly minors, ~weekly patches → mature, well-maintained.
- Peer dep: `zod ^3.25 || ^4.0` → your `zod@4.4.2` is compatible.

### Imports (v1.x — note `.js` extensions required for ESM)
```ts
import { McpServer }                  from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport }       from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult }        from '@modelcontextprotocol/sdk/types.js';
```

The package `exports` map only exposes `./server`, `./client`, `./validation`, `./experimental`, plus a wildcard `./*` — so deep paths like `/server/mcp.js` go through the wildcard. Always include `.js` extension (TS resolves at compile time, Node ESM requires it at runtime).

### Tool registration signature
```ts
server.registerTool(
  'tool_snake_case_name',
  {
    title: 'Human-readable Title',
    description: 'Concise description; LLM reads this to decide invocation.',
    inputSchema:  { foo: z.string(), limit: z.number().int().default(20) },  // raw object, NOT z.object()
    outputSchema: { items: z.array(z.object({ id: z.string() })) },          // optional but recommended
  },
  async ({ foo, limit }, extra) => {
    const data = await fetchData(foo, limit);
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      structuredContent: data,            // requires outputSchema; clients can parse without re-tokenizing
    };
  },
);
```

**Note:** `inputSchema` / `outputSchema` take a *Zod shape object* (`{ foo: z.string() }`), not `z.object({ foo: z.string() })`. The SDK wraps it internally.

**Sources:**
- npm registry: `npm view @modelcontextprotocol/sdk` (v1.29.0)
- `https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.29.0/docs/server.md`
- `https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.29.0/src/examples/server/jsonResponseStreamableHttp.ts`

---

## 2. Transports

### 2a. Streamable HTTP vs SSE — current state

**Streamable HTTP is the official current transport.** SSE-only transport is formally **deprecated**:
> *"This replaces the HTTP+SSE transport from protocol version 2024-11-05."* — MCP spec 2025-06-18

Streamable HTTP itself *can* use SSE internally for server-initiated streams, but exposes a single endpoint (`POST` + `GET` + `DELETE` on `/mcp`) instead of two separate endpoints. For a read-only server with no server→client notifications, you can also set `enableJsonResponse: true` to skip SSE entirely and return plain JSON responses.

**Modes:**
- **Stateless** (`sessionIdGenerator: undefined`): each request creates a fresh transport+server. Zero session memory. Best for serverless/edge.
- **Stateful** (`sessionIdGenerator: () => randomUUID()`): server tracks `Mcp-Session-Id`. Required if you want server-initiated notifications, resumability via `Last-Event-ID`, or to maintain per-client state.

**Recommendation:** **stateless + JSON response mode** for the marketing OS. Tools are read-only point queries; no notifications, no long-running streams. Matches Next.js serverless model.

### 2b. Sharing one core server with two entry-points

Standard pattern: a single `registerTools(server: McpServer)` function called from both entries.

```
src/mcp/
├── server.ts          # createServer() — builds McpServer + registers everything
├── tools/
│   ├── index.ts       # registerAllTools(server)
│   ├── channels.ts
│   └── posts.ts
└── ...
```

- `app/api/mcp/[transport]/route.ts` → wraps `createServer()` with `mcp-handler`.
- `scripts/mcp-stdio.ts` → instantiates `createServer()` + connects `StdioServerTransport`.

Both paths use the *same* tool definitions. **DRY satisfied.**

### 2c. Mounting inside Next.js 16 App Router

**Problem:** Raw `StreamableHTTPServerTransport.handleRequest(req, res, body)` expects **Node `IncomingMessage` + `ServerResponse`** (Express-shaped). Next.js App Router route handlers receive **Web `Request`** and return **Web `Response`**. There is no built-in `req`/`res` escape hatch in App Router.

**Three options:**

| Option | Effort | Recommendation |
|---|---|---|
| A. `mcp-handler` (Vercel adapter) | ~5 LOC | **CHOSEN** |
| B. Custom Web↔Node bridge | ~150 LOC + edge cases | Reject (DRY/KISS violation) |
| C. Standalone Node HTTP server on separate port | New deploy artifact | Reject (ops cost; OAuth-from-web-app becomes cross-origin) |

**Option A — `mcp-handler`:** Maintained by Vercel, depends directly on `@modelcontextprotocol/sdk`, handles the bridge correctly. Current version `1.1.0` (2026-03-24). Pins SDK to `1.26.0`+ for a security fix.

```ts
// app/api/mcp/[transport]/route.ts
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { registerAllTools } from '@/mcp/tools';

export const runtime = 'nodejs';        // pg requires Node, not Edge
export const maxDuration = 60;          // bump if any tool runs >10s

const verifyToken = async (
  _req: Request,
  bearer?: string,
): Promise<AuthInfo | undefined> => {
  if (!bearer) return undefined;
  const allowed = (process.env.MCP_BEARER_TOKENS ?? '').split(',').filter(Boolean);
  if (!allowed.includes(bearer)) return undefined;
  return { token: bearer, scopes: ['read'], clientId: 'static', extra: {} };
};

const handler = createMcpHandler(
  (server) => registerAllTools(server),
  {},                                   // capabilities
  { basePath: '/api', maxDuration: 60, verboseLogs: false },
);

const authed = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ['read'],
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export { authed as GET, authed as POST, authed as DELETE };
```

Note the path is `app/api/mcp/[transport]/route.ts` — `[transport]` is a dynamic segment that `mcp-handler` uses to route between `/api/mcp` (Streamable HTTP) and `/api/sse` (legacy SSE). For our case we only care about Streamable HTTP.

**Clients connect to:** `https://your-app.com/api/mcp`

**Sources:**
- `https://github.com/vercel/mcp-handler/blob/main/README.md`
- `https://github.com/vercel/mcp-handler/blob/main/docs/AUTHORIZATION.md`
- `https://github.com/vercel/mcp-handler/blob/main/docs/ADVANCED.md`
- MCP transports spec: `https://modelcontextprotocol.io/specification/2025-06-18/basic/transports`

### 2d. Stdio entry-point

```ts
// scripts/mcp-stdio.ts  (run with: tsx scripts/mcp-stdio.ts)
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '@/mcp/server';

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // NEVER console.log to stdout — stdio uses it for MCP messages.
  // Use console.error (stderr) for any logging.
}
main().catch((err) => { console.error(err); process.exit(1); });
```

Claude Desktop config:
```json
{
  "mcpServers": {
    "marketing-os": {
      "command": "npx",
      "args": ["tsx", "F:/Vibe Coding/marketing/app/scripts/mcp-stdio.ts"],
      "env": { "DATABASE_URL": "postgres://..." }
    }
  }
}
```

For Claude Code: same config in `~/.claude/mcp.json` or use `mcp-remote` for HTTP.

---

## 3. Authentication

### MCP spec (2025-06-18) requires OAuth 2.1 for *compliant* remote servers

The spec mandates OAuth 2.1 + RFC 9728 Protected Resource Metadata + RFC 8707 Resource Indicators + PKCE. This is **non-trivial** to implement from scratch — easily a week of work plus an auth server (Keycloak/Auth0/etc.).

**However:** auth is explicitly **OPTIONAL** in the spec. Static Bearer is non-compliant but works for closed-network internal use.

### Recommendation matrix

| Consumer | Auth method | Why |
|---|---|---|
| Claude Desktop / Claude Code (stdio) | none | Process inherits user env; no network exposure |
| In-app AI agent (server-side fetch) | static Bearer (env-loaded) | Same trust boundary as the app |
| Zapier / n8n | static Bearer (env-loaded, per-integration token) | Standard integration pattern; rotateable |
| Future: external 3rd parties | OAuth 2.1 | When you actually need delegated user auth |

**Implementation:** the `verifyToken` callback in §2c above. Store tokens as comma-separated `MCP_BEARER_TOKENS` env var. To support per-client identification, use a JSON env var:
```
MCP_BEARER_TOKENS_JSON='{"tok_zapier_abc":{"clientId":"zapier","scopes":["read"]},"tok_n8n_xyz":{"clientId":"n8n","scopes":["read"]}}'
```

**Trade-off acknowledged:** Static Bearer cannot revoke without redeploy/env-update. If audit/revocation matters, store tokens in DB with `revoked_at`.

**Risk:** static tokens leak via logs / git history. Mitigation: never log auth header; never commit env files; rotate quarterly.

**Sources:**
- MCP authorization spec: `https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization`
- `mcp-handler` AUTHORIZATION.md

---

## 4. Tool Spec Best Practices

### Naming
- **snake_case**, verb-first or noun-first consistent: `list_channels`, `get_channel`, `list_posts`, `get_post`.
- Prefix-namespace if multiple domains: `channels_list`, `posts_get` (improves grep + LLM scoping).
- Avoid generic names (`query`, `get_data`) — LLM can't disambiguate.
- Keep ≤40 chars; some clients truncate.

### Input schema
- **Use zod** (SDK-native; you already depend on it).
- Shape object form (not `z.object()`); SDK wraps it.
- `.describe()` every field — LLM reads descriptions, not field names.
- Conservative defaults: `limit: z.number().int().min(1).max(100).default(20)`.
- Enums explicitly: `status: z.enum(['draft','published','archived'])`.

### Output: structured vs text
- **Return BOTH** `content` (text) and `structuredContent` (JSON, requires `outputSchema`).
- Text is mandatory; structured is for clients that can parse without re-tokenizing the prompt.
- For lists, text is a compact summary; structured holds full records:
  ```ts
  return {
    content: [{ type: 'text', text: `Found ${rows.length} channels. First 3: ${rows.slice(0,3).map(r=>r.name).join(', ')}` }],
    structuredContent: { items: rows, totalCount: rows.length, nextCursor },
  };
  ```
- Errors: `return { isError: true, content: [{ type: 'text', text: 'reason' }] }` — *don't throw*, the LLM needs to see the error.

### Pagination
- Use cursor-based pagination, not offset. Return `nextCursor` (opaque string) in structured content.
- Tool input accepts `cursor?: z.string()`.
- Hard cap `limit` at 100 to prevent context bloat (see §5).

---

## 5. Common Pitfalls (2026)

| Pitfall | Mitigation |
|---|---|
| **Context bloat** — returning 500 rows blows the model's window | Hard-cap `limit`, paginate, return summaries in text and full data in `structuredContent` only when client requests structured output |
| **Oversized tool descriptions** — every tool description is in every prompt | Keep descriptions ≤200 chars; move detail to a `prompts/` resource the LLM can read on-demand |
| **Stdout pollution in stdio** — any `console.log` corrupts the JSON-RPC stream | Use `console.error` only; lint-rule to ban `console.log` in `scripts/mcp-stdio.ts` |
| **Missing cancellation** — long queries block when client disconnects | Pass `extra.signal` (AbortSignal) into `pg` queries; pg 8.x supports `client.query(...)` cancellation via end-of-pool |
| **DNS rebinding** on local servers | `mcp-handler` handles via host validation; if rolling raw, validate `Origin` header (spec requires) |
| **Token passthrough** — forwarding inbound auth to upstream APIs | Forbidden by spec; use a separate service account for DB |
| **Missing `outputSchema`** — clients can't validate, must re-prompt LLM | Always provide; even rough shape helps |
| **Unbounded SQL via tool args** — `WHERE name LIKE $1` with user-supplied `%` is fine, but `ORDER BY $col` is injection | Allowlist sortable columns explicitly via `z.enum(['created_at','name'])` |
| **Time-bomb deps** — SDK v2 pre-alpha will break imports | Pin `^1.29.0`; do NOT use `^` without major lock |
| **Edge runtime trap** — `pg` needs Node.js, not Edge | Explicit `export const runtime = 'nodejs'` in route |
| **No request-level rate limit** — Zapier/n8n loops can DoS your DB | Add Vercel/Cloudflare rate limit, or `express-rate-limit` if self-hosted |
| **Connection pool exhaustion** — each request creates a `Pool` | Use module-level singleton `Pool` (existing pattern in your `src/lib/queries/*` likely already does this) |

---

## 6. Project Layout

Following YAGNI/DRY and matching your existing `src/lib/queries/*` convention:

```
F:/Vibe Coding/marketing/app/
├── app/
│   ├── api/
│   │   └── mcp/
│   │       └── [transport]/
│   │           └── route.ts              # 30 LOC: imports createServer, wraps with mcp-handler+auth
│   └── .well-known/
│       └── oauth-protected-resource/
│           └── route.ts                  # only if doing OAuth; skip for static Bearer
├── src/
│   ├── mcp/
│   │   ├── server.ts                     # createServer() — single source of truth
│   │   ├── auth.ts                       # verifyToken() — bearer validation
│   │   └── tools/
│   │       ├── index.ts                  # registerAllTools(server)
│   │       ├── channels.ts               # list_channels, get_channel
│   │       └── posts.ts                  # list_posts, get_post
│   └── lib/
│       └── queries/                      # EXISTING — tools call these directly
│           ├── channels-list.ts          # already exists
│           └── ...
└── scripts/
    └── mcp-stdio.ts                      # 15 LOC: stdio entry, calls createServer()
```

**Key principles applied:**
- `src/mcp/tools/*.ts` only do **input validation + query orchestration + output shaping**. They DO NOT contain SQL — that lives in `src/lib/queries/*` (existing layer; reuse).
- `src/mcp/server.ts` is transport-agnostic.
- HTTP and stdio entries are thin wrappers (~15-30 LOC each).
- One tool file per domain. Keep each ≤200 LOC per your global rules.

**Estimated total LOC:** ~400 lines for full implementation (4 tools, auth, both entries).

---

## Adoption Risk Assessment

| Component | Maturity | Risk | Notes |
|---|---|---|---|
| `@modelcontextprotocol/sdk@1.29.0` | High — Anthropic-maintained, 18+ months stable, monthly releases | Low | v2 will break, pin major. Patch cadence is good. |
| `mcp-handler@1.1.0` | Medium — Vercel-maintained, 1 year old, used in their template apps | Low-Medium | Smaller surface than SDK; if abandoned, swap-out is ~150 LOC of bridge code. Acceptable. |
| Streamable HTTP transport | High — current spec, widely adopted | Low | SSE-only is deprecated; we're on the right side. |
| Static Bearer auth | High — battle-tested pattern | Low for internal use | Non-compliant with strict MCP spec but matches your use case. |
| zod 4 with SDK | High — SDK officially supports `^4.0` | Low | Already your stack. |

**Worst-case fallback:** If `mcp-handler` breaks on a Next.js upgrade, port to raw SDK + custom Web↔Node bridge using `@hono/node-server`'s `getRequestListener` (a known working pattern). ~1 day of work.

---

## Architectural Fit

- **Existing query layer (`src/lib/queries/*`):** perfect — tools become thin adapters, no SQL duplication. DRY win.
- **`pg` 8.20:** Streamable HTTP runs in `nodejs` runtime, fully compatible.
- **`zod` 4.4.2:** native SDK support; reuse existing schemas where possible.
- **`tsx`:** already a dep, run stdio entry with no build step.
- **Next.js 16 App Router:** `mcp-handler` is built specifically for this. Auth flows through standard route handler middleware patterns.
- **Iron-session (you use it for app auth):** keep separate. MCP uses Bearer; don't mix session cookies.

---

## Unresolved Questions

1. **Tool surface scope** — only "channels + posts" was mentioned. Specifically: do we expose only `list/get` (read-only) or also analytics aggregates (e.g. `get_channel_kpi`, `get_top_performers`)? Affects tool count and output schemas.
2. **Multi-tenancy** — single MCP server per app instance, or per-workspace? Affects whether `verifyToken` needs to scope by workspace_id and whether tools accept `workspace_id` param.
3. **Deployment target** — Vercel, Coolify (per your memory), or both? Affects `maxDuration` limits (Vercel Hobby=10s, Pro=60s, Enterprise=900s) and whether Redis is needed for SSE resumability (not needed for stateless JSON mode).
4. **Token issuance UX** — manual env-var rotation, or admin UI to generate/revoke? Affects whether to add a DB-backed `mcp_tokens` table now or YAGNI it.
5. **Rate limiting** — does the existing app already have a middleware/edge layer for this, or build into MCP route directly?
6. **Pagination cursor format** — opaque base64 of `{id, created_at}` or DB-native? Suggest base64 for client simplicity.

---

**Status:** DONE
**Summary:** Recommend `@modelcontextprotocol/sdk@^1.29.0` + `mcp-handler@^1.1.0` for the HTTP entry inside Next.js App Router at `app/api/mcp/[transport]/route.ts`, with a thin `scripts/mcp-stdio.ts` for Desktop/Code clients sharing a single `src/mcp/server.ts`. Static Bearer auth via `withMcpAuth` is sufficient for internal Zapier/n8n + web-app callers; defer OAuth 2.1 until external 3rd parties materialize.
