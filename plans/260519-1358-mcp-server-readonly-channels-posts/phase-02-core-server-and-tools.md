# Phase 02 — Core server + 10 tools

## Context Links

- Plan: [plan.md](plan.md)
- Prev: [phase-01-setup-deps-and-skeleton.md](phase-01-setup-deps-and-skeleton.md)
- Scout report: `plans/reports/scout-260519-1358-mcp-data-inventory.md`

## Overview

- **Priority**: High
- **Status**: Pending (blocked by Phase 01)
- **Effort**: 1.5 ngày
- **Description**: Implement `createServer()` + 10 read-only tools (2 channels + 3 posts + 5 analytics). Reuse query layer hiện có, viết 2 query mới (`fetchPost`, `fetchMetricsRange`).

## Key Insights

- **Tools = thin adapter**: chỉ làm input validation (zod) + gọi query + shape output. SQL ở `src/lib/queries/*`.
- **Output = BOTH text + structuredContent**: text là summary ngắn, structured là JSON đầy đủ. Client AI parse structured không cần re-tokenize.
- **`inputSchema` nhận zod shape object** (`{ id: z.string() }`), KHÔNG phải `z.object({...})`.
- **Errors `return { isError: true, content: [...] }`**, KHÔNG throw — LLM cần đọc error message.
- **Pagination cursor opaque base64** — encode `{lastId, lastDate}` để stateless.
- **Redact PII hard-coded** — đừng dynamic, dễ rò rỉ.

## Requirements

### Functional
- 10 tools đăng ký được:
  - Channels: `channels_list`, `channels_get`, `channels_health`, `channels_metrics`
  - Posts: `posts_list`, `posts_get`, `posts_top`
  - Analytics: `analytics_kpi`, `analytics_trend`, `analytics_top_performers`
- Mỗi tool có `description` ≤200 chars, `inputSchema`, `outputSchema`
- Mỗi tool return BOTH `content[]` (text summary) + `structuredContent` (full data)
- Query mới cần viết:
  - `fetchPost(id)` trong `src/lib/queries/post-detail.ts` (cho `posts_get`)
  - `fetchMetricsRange(accountId, days)` trong `src/lib/queries/channel-detail.ts` (cho `channels_metrics`, parameterize `fetchMetrics7d`)
  - `fetchChannelHealthDetail(accountId?)` trong `src/lib/queries/dashboard-channel-health.ts` (cho `channels_health`, project full sub-scores)
- PII redaction: không expose `access_token_encrypted`, `password_hash`, `persona_json`, `details JSONB`, `raw_response`

### Non-functional
- Tool file ≤200 LOC mỗi file
- Limit hard-cap = 100 trên mọi list tool
- Default limit = 20
- Allowlist sortable columns qua `z.enum([...])` (chống SQL injection ở `ORDER BY`)

## Architecture

### Data flow
```
MCP Client → Transport → McpServer → Tool handler
                                          ↓
                                  src/lib/queries/* (existing SQL)
                                          ↓
                                       pg Pool
                                          ↓
                                     Postgres
```

### Tool signature pattern
```ts
server.registerTool(
  'tool_name',
  {
    title: '...',
    description: '...',          // ≤200 chars
    inputSchema:  { ... },       // zod shape (raw object)
    outputSchema: { ... },       // zod shape
  },
  async (input, extra) => {
    // 1. Query (extra.signal → pass to pg cancellation)
    // 2. Redact PII
    // 3. Shape response
    return {
      content: [{ type: 'text', text: summary }],
      structuredContent: { items, nextCursor },
    };
  },
);
```

## Related Code Files

**Create:**
- `src/mcp/server.ts` — `createServer()` factory
- `src/mcp/tools/index.ts` — `registerAllTools(server)`
- `src/mcp/tools/channels.ts` — 4 tools (`channels_list`, `channels_get`, `channels_health`, `channels_metrics`)
- `src/mcp/tools/posts.ts` — 3 tools (`posts_list`, `posts_get`, `posts_top`)
- `src/mcp/tools/analytics.ts` — 3 tools (`analytics_kpi`, `analytics_trend`, `analytics_top_performers`)
- `src/mcp/redact.ts` — `redactChannel(row)`, `redactPost(row)`
- `src/mcp/cursor.ts` — `encodeCursor(obj)`, `decodeCursor(str)` (base64 JSON)
- `src/lib/queries/post-detail.ts` — `fetchPost(id)` query mới

**Modify (extend existing queries):**
- `src/lib/queries/channel-detail.ts` — thêm `fetchMetricsRange(accountId, days)` (generalize `fetchMetrics7d`)
- `src/lib/queries/dashboard-channel-health.ts` — thêm `fetchChannelHealthDetail(accountId?)` project đủ 5 sub-scores

**Modify:** (none — Phase 01 đã tạo stub)

**Read for context (MUST READ):**
- `src/lib/queries/channels-list.ts` — pattern + `ChannelListItem` interface
- `src/lib/queries/channel-detail.ts` — `fetchChannel`, `fetchRecentPosts`, `fetchMetrics7d` pattern
- `src/lib/queries/library-posts.ts` — pattern cursor pagination + filter
- `src/lib/queries/library-stats.ts` — quen filter shape
- `src/lib/queries/dashboard-kpi.ts` — `fetchKpiData(days)` shape + current/prev pattern
- `src/lib/queries/dashboard-trend.ts` — `fetchTrendData(days)` shape
- `src/lib/queries/dashboard-channel-health.ts` — `fetchChannelHealth()` + cần extend
- `src/lib/queries/dashboard-top-performers.ts` — `fetchTopPerformers(days, limit)`
- `src/lib/library/build-posts-query.ts` — query builder hiện có
- `src/lib/library/parse-filter-params.ts` — parse pattern
- `src/lib/db.ts` (hoặc tương đương) — pg Pool singleton pattern
- 1 file migration: `migrations/003-create-post-and-metric-tables.sql` để hiểu schema post

## Implementation Steps

### 1. Implement `src/mcp/server.ts`
```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from './tools/index.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'marketing-os-mcp',
    version: '0.1.0',
  });
  registerAllTools(server);
  return server;
}
```

### 2. Implement `src/mcp/cursor.ts` (~30 LOC)
- `encodeCursor(obj) → base64url(JSON.stringify(obj))`
- `decodeCursor(str) → JSON.parse(base64url-decode(str))` — try/catch, return `null` if invalid

### 3. Implement `src/mcp/redact.ts` (~50 LOC)
- `redactChannel(channel)` — strip `access_token_encrypted`, `persona_json`, optional strip `owner.email`
- `redactPost(post)` — pass-through (post hiện không có PII), keep structure for future
- Hardcoded allowlist columns return

### 4. Implement `src/lib/queries/post-detail.ts` (~80 LOC)
```ts
export interface PostDetail {
  id: string;
  accountId: string;
  externalId: string | null;
  content: string;
  mediaUrl: string | null;
  postType: string;
  publishedAt: string;
  permalink: string | null;
  campaignTag: string | null;
  // Latest metric snapshot
  reactions: number;
  comments: number;
  shares: number;
  reach: number | null;
  impressions: number | null;
  engagementRate: number | null;
}

export async function fetchPost(id: string): Promise<PostDetail | null> {
  // SELECT sp.*, latest pmd via LATERAL JOIN ORDER BY pmd.date DESC LIMIT 1
}
```

### 5. Implement `src/mcp/tools/channels.ts` (~150 LOC)

**`channels_list`:**
- Input: `{ platform?: enum, status?: enum, sort?: enum, limit?: number(1-100, default 20) }`
- Output: `{ items: ChannelListItem[], totalCount }`
- Reuse `fetchChannelsList(filter)` → apply `.slice(0, limit)` → redact

**`channels_get`:**
- Input: `{ id: z.string().uuid() }`
- Output: `{ channel: ChannelDetail }` (sau redact)
- Reuse `fetchChannel(id)` → `redactChannel()` → return
- Error path: id not found → `{ isError: true, content: [{ type: 'text', text: 'Channel not found' }] }`

### 6. Implement `src/mcp/tools/posts.ts` (~200 LOC, gần limit — sẵn sàng split)

**`posts_list`:**
- Input: `{ accountId?: uuid, platform?: enum, from?: ISO date, to?: ISO date, type?: enum, sort?: enum('recent','er','reach'), cursor?: string, limit?: number(1-50, default 24) }`
- Output: `{ items: Post[], nextCursor: string | null }`
- Reuse `fetchLibraryPosts(filter)` — đã có sẵn cursor pagination

**`posts_get`:**
- Input: `{ id: uuid }`
- Output: `{ post: PostDetail }`
- Gọi query mới `fetchPost(id)` (step 4)

**`posts_top`:**
- Input: `{ from: ISO date, to: ISO date, metric: z.enum(['engagement_rate','reach']), accountId?: uuid, limit?: number(1-20, default 5) }`
- Output: `{ items: Post[] }`
- Reuse `fetchLibraryPosts({sort: metric === 'engagement_rate' ? 'er' : 'reach', from, to, accountId, limit})`

### 7. Extend `src/lib/queries/channel-detail.ts` — `fetchMetricsRange`
Generalize `fetchMetrics7d`:
```ts
export async function fetchMetricsRange(
  accountId: string,
  days: number,  // validated 1-90 ở tool layer
): Promise<ChannelMetricDay[]> {
  // Same query as fetchMetrics7d but with INTERVAL '$1 days' instead of '7 days'
}
```
Giữ `fetchMetrics7d` cho backwards compat (1 dòng wrap: `return fetchMetricsRange(id, 7)`).

### 8. Extend `src/lib/queries/dashboard-channel-health.ts` — `fetchChannelHealthDetail`
Project đủ 5 sub-scores từ `channel_health_daily`:
```ts
export interface ChannelHealthDetail {
  accountId: string;
  channelName: string;
  date: string;
  healthScore: number;
  erScore: number;
  consistencyScore: number;
  growthScore: number;
  reachScore: number;
  // Prior week comparison
  priorHealthScore: number | null;
}

export async function fetchChannelHealthDetail(
  accountId?: string,  // omit = all channels
): Promise<ChannelHealthDetail[]> { ... }
```

### 9. Implement `src/mcp/tools/analytics.ts` (~180 LOC — gần limit, sẵn sàng split nếu vượt)

**`analytics_kpi`:**
- Input: `{ days?: z.enum(['7','14','30','90']).default('7') }`
- Output: `{ current: KpiSnapshot, previous: KpiSnapshot, delta: KpiDelta }`
- Reuse `fetchKpiData(Number(days))` 100%, return as-is

**`analytics_trend`:**
- Input: `{ days?: z.number().int().min(7).max(90).default(30) }`
- Output: `{ items: TrendDataPoint[], totalDays: number }`
- Reuse `fetchTrendData(days)` 100%
- Pitfall: 90 days × ~10 fields ≈ 6KB JSON → vẫn OK với context budget, nhưng add note ở `description`

**`analytics_top_performers`:**
- Input: `{ days?: 7-90 default 30, limit?: 1-20 default 5 }`
- Output: `{ items: TopPerformerRow[] }`
- Reuse `fetchTopPerformers(days, limit)` 100%

### 10. Implement extra channel tools in `src/mcp/tools/channels.ts`

**`channels_health`:**
- Input: `{ accountId?: z.string().uuid() }`  // omit = all channels
- Output: `{ items: ChannelHealthDetail[] }`
- Gọi `fetchChannelHealthDetail(accountId)` (step 8)

**`channels_metrics`:**
- Input: `{ accountId: z.string().uuid(), days?: z.enum(['7','14','30','90']).default('7') }`
- Output: `{ items: ChannelMetricDay[], accountId: string, days: number }`
- Gọi `fetchMetricsRange(accountId, Number(days))` (step 7)

### 11. Implement `src/mcp/tools/index.ts`
```ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerChannelTools } from './channels.js';
import { registerPostTools } from './posts.js';
import { registerAnalyticsTools } from './analytics.js';

export function registerAllTools(server: McpServer) {
  registerChannelTools(server);
  registerPostTools(server);
  registerAnalyticsTools(server);
}
```

### 12. Compile + smoke test
```bash
npx tsc --noEmit
```

Smoke test bằng cách import `createServer()` trong một test file ad-hoc, list tools:
```ts
const s = createServer();
console.log(await s.listTools()); // verify 10 tools registered
```

## Todo List

- [ ] Read 11 context files trong "Related Code Files"
- [ ] `src/mcp/server.ts` — `createServer()`
- [ ] `src/mcp/cursor.ts` — encode/decode base64 cursor
- [ ] `src/mcp/redact.ts` — `redactChannel`, `redactPost`
- [ ] `src/lib/queries/post-detail.ts` — `fetchPost(id)` query mới
- [ ] `src/lib/queries/channel-detail.ts` — thêm `fetchMetricsRange(accountId, days)`
- [ ] `src/lib/queries/dashboard-channel-health.ts` — thêm `fetchChannelHealthDetail(accountId?)`
- [ ] `src/mcp/tools/channels.ts` — 4 tools (list, get, health, metrics)
- [ ] `src/mcp/tools/posts.ts` — 3 tools (list, get, top)
- [ ] `src/mcp/tools/analytics.ts` — 3 tools (kpi, trend, top_performers)
- [ ] `src/mcp/tools/index.ts` — `registerAllTools()`
- [ ] `npx tsc --noEmit` pass
- [ ] Smoke test list tools (count = 10)

## Success Criteria

- 10 tools đăng ký + lấy được qua `server.listTools()`
- Mỗi tool có `description`, `inputSchema`, `outputSchema`
- TypeScript compile sạch
- Reuse 8/10 query function trực tiếp; 2 query mới + 2 query extend
- Không hardcode SQL trong `src/mcp/tools/*` — toàn bộ SQL ở `src/lib/queries/*`
- PII fields KHÔNG xuất hiện trong output của bất kỳ tool nào
- `fetchMetricsRange(id, 7)` trả kết quả identical với `fetchMetrics7d(id)` (backwards compat test)

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Tool description > 200 chars | ESLint custom rule hoặc unit test check length |
| Output payload quá lớn (1000 row) | Hard limit 100 ở zod, default 20 |
| `fetchPost` query mới sai logic LATERAL JOIN | Copy pattern từ `fetchRecentPosts` trong `channel-detail.ts` |
| Forgot redact `persona_json` | Allowlist columns (return chỉ field whitelist), KHÔNG blacklist |
| Cursor injection (giả mạo cursor) | Validate decoded object shape; chỉ dùng trong WHERE pagination, không trong `ORDER BY` |

## Security Considerations

- Allowlist sortable columns qua `z.enum(['recent','er','reach'])` — KHÔNG accept arbitrary column name
- Redact bằng cách **allowlist columns to return** (not blacklist) — an toàn hơn
- `fetchPost` query SELECT explicit columns, KHÔNG `SELECT *`
- Pass `extra.signal` (AbortSignal) vào pg query để cancel khi client disconnect

## Next Steps

→ Phase 03: HTTP transport + Bearer auth (mount tại `app/api/mcp/[transport]/route.ts`).
