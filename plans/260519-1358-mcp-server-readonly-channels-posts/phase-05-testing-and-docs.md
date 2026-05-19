# Phase 05 — Testing + docs + hardening

## Context Links

- Plan: [plan.md](plan.md)
- Prev: [phase-04-stdio-and-client-config.md](phase-04-stdio-and-client-config.md)
- All research reports trong `plans/reports/`

## Overview

- **Priority**: Medium
- **Status**: Pending (blocked by Phase 03 + 04)
- **Effort**: 0.5 ngày
- **Description**: Smoke + integration tests cho 5 tools, hardening (DB readonly role + rate limit cơ bản), finalize docs.

## Key Insights

- **Test layer rule**: tests cho MCP tool = call qua MCP server instance (in-memory, không spin HTTP), assert response shape. Không cần spin Claude Desktop để test.
- **DB readonly role** là defense-in-depth — dù tool bug, không thể write/delete.
- **Rate limit** nên ở edge layer (Vercel/Cloudflare/nginx) — KHÔNG bake vào route handler để giữ KISS.

## Requirements

### Functional
- Test mỗi tool: happy path + 1 error path
- DB readonly role tạo + tested
- `docs/mcp-server-setup.md` complete + verified
- README app có section "MCP server" link đến doc

### Non-functional
- Test runtime <30s total
- Không phụ thuộc network external (no Claude Desktop trong test)

## Architecture

### Test approach
```
Test file → import { createServer } from '@/mcp/server'
         → mock pg query OR use test DB (seeded)
         → call tools/list, tools/call
         → assert response shape + content
```

**Quyết định**: dùng **test DB seeded** (đã có `db:seed` script) thay vì mock pg. Lý do: queries phức tạp (LATERAL JOIN), mock dễ sai, integration test với real Postgres an toàn hơn.

### DB readonly role
```sql
CREATE ROLE mcp_readonly LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE marketing TO mcp_readonly;
GRANT USAGE ON SCHEMA public TO mcp_readonly;
GRANT SELECT ON
  social_account, social_post,
  post_metric_daily, account_metric_daily,
  channel_health_daily, team_member,
  -- Analytics tools cần thêm 2 tables sau (revenue + conversion expose theo user decision):
  landing_page_conversion, manual_revenue
TO mcp_readonly;
-- KHÔNG grant: api_sync_log (chứa raw FB payload nặng + có thể có token)
```

## Related Code Files

**Create:**
- `src/mcp/__tests__/tools-channels.test.ts` — channels_list, channels_get, channels_health, channels_metrics
- `src/mcp/__tests__/tools-posts.test.ts` — posts_list, posts_get, posts_top
- `src/mcp/__tests__/tools-analytics.test.ts` — analytics_kpi, analytics_trend, analytics_top_performers
- `migrations/0XX-create-mcp-readonly-role.sql` — DB role migration (số next available)
- `docs/mcp-server-setup.md` — finalize (Phase 04 đã viết draft)

**Modify:**
- `README.md` (app) — thêm section "## MCP Server" link đến `docs/mcp-server-setup.md`
- `package.json` — add `"test": "..."` script nếu chưa có (chọn vitest hoặc node:test native)

**Read for context (MUST READ):**
- `scripts/seed-dev-data.ts` — biết test fixture có gì
- `migrations/00X-create-*.sql` — pattern viết migration
- Check `package.json` test stack hiện tại (chưa thấy → đề xuất `vitest` hoặc Node 22 native `node:test`)

## Implementation Steps

### 1. Chọn test framework
- Stack hiện chưa có test runner. Đề xuất **`node:test` native** (Node 20+, không thêm dep) hoặc **`vitest`** (dev exp tốt hơn, ESM-native, type-safe).
- **Quyết định mặc định**: `vitest` — hỗ trợ ESM + TypeScript tốt nhất 2026. Add dep: `npm i -D vitest`.

### 2. Viết test cho 2 tool files
```ts
// src/mcp/__tests__/tools-channels.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createServer } from '../server.js';

describe('channels_list', () => {
  it('returns list of channels with default limit', async () => {
    const server = createServer();
    const tools = await server.listTools();
    expect(tools.tools.some(t => t.name === 'channels_list')).toBe(true);

    const res = await server.callTool('channels_list', { limit: 5 });
    expect(res.structuredContent).toHaveProperty('items');
    expect(Array.isArray(res.structuredContent.items)).toBe(true);
    expect(res.structuredContent.items.length).toBeLessThanOrEqual(5);
  });

  it('rejects invalid platform enum', async () => {
    const server = createServer();
    const res = await server.callTool('channels_list', { platform: 'myspace' });
    expect(res.isError).toBe(true);
  });
});
```

(Tương tự cho posts tools.)

### 3. Setup test DB
- Reuse `db:reset` script (drop + migrate + seed)
- Test config: `DATABASE_URL=postgres://...marketing_test`
- Document trong `docs/mcp-server-setup.md` section "Testing"

### 4. Viết migration `migrations/0XX-create-mcp-readonly-role.sql`
- Check số migration tiếp theo (xem thư mục migrations)
- Role + grants như "Architecture" section trên
- Document password generation (env var hoặc generate khi setup, không commit)

### 5. Finalize `docs/mcp-server-setup.md`
Sections cần có:
1. Overview (MCP là gì + server này expose gì)
2. Architecture diagram (đơn giản, có thể ASCII)
3. Setup HTTP (env var, deploy, Bearer token rotation)
4. Setup Claude Desktop (Windows/Mac/Linux)
5. Setup Claude Code
6. Available tools (5 tools, signature + ví dụ)
7. Security (DB readonly role, token rotation, audit log)
8. Troubleshooting
9. Roadmap (future tools: health, trend, alerts)

### 6. Update `README.md` (app)
Thêm 1 section:
```md
## MCP Server

Marketing OS expose read-only data qua Model Context Protocol để integrate với Claude Desktop, Claude Code, và external tools (Zapier, n8n).

→ Setup: [docs/mcp-server-setup.md](docs/mcp-server-setup.md)
```

### 7. Rate limit (defer hoặc minimal)
**Quyết định MVP**: skip rate limit trong code. Dependency:
- Nếu deploy Vercel: dùng Vercel Edge Config rate limit hoặc `@vercel/edge-rate-limit` (thêm Phase 06)
- Nếu deploy Coolify: nginx `limit_req` config ở reverse proxy
- Document trong setup doc, không bake vào route

### 8. Final test pass
```bash
npm run test            # vitest run
npx tsc --noEmit
npm run build
npm run lint
```

## Todo List

- [ ] Quyết định test framework (default: vitest)
- [ ] Setup test DB + script `db:reset:test`
- [ ] `src/mcp/__tests__/tools-channels.test.ts` (≥4 test cases)
- [ ] `src/mcp/__tests__/tools-posts.test.ts` (≥3 test cases)
- [ ] `src/mcp/__tests__/tools-analytics.test.ts` (≥3 test cases)
- [ ] `migrations/0XX-create-mcp-readonly-role.sql`
- [ ] Apply migration trên dev DB + test connect với role mới
- [ ] Finalize `docs/mcp-server-setup.md` (9 sections)
- [ ] Update `README.md` thêm section MCP Server
- [ ] All checks pass: test, tsc, build, lint
- [ ] Commit + push (sau khi user review)

## Success Criteria

- 10 tools đều có ≥1 happy path + 1 error path test, all pass
- DB role `mcp_readonly` tạo được, connect OK, `INSERT` reject
- `docs/mcp-server-setup.md` đủ self-serve (admin/dev mới setup được không cần hỏi)
- Test suite chạy ≤30s
- 0 TypeScript error, 0 lint error

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Test DB không có data → test fail "no channels found" | `beforeAll` chạy `db:seed`; assert `>= 0` thay vì `> 0` ở vài chỗ |
| `vitest` dep conflict | Pin `^1.x` stable; nếu conflict, fallback `node:test` |
| Readonly role thiếu permission cho future tool | Migration include `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO mcp_readonly` để table mới tự grant |
| Forgot rate limit → DoS | Document explicit trong setup doc; mark "TODO Phase 06" |

## Security Considerations

- **DB readonly role**: hardcoded grant list = explicit allowlist. Future table sẽ KHÔNG tự expose trừ khi update migration → safe default.
- **Test password**: tạo role bằng `gen_random_uuid()` hoặc env `MCP_READONLY_PASSWORD`. KHÔNG hardcode.
- **Audit log review**: sau 1 tuần dùng, review log → xem tool nào được call nhiều, tool nào không → decide deprecate.

## Next Steps (Future, ngoài MVP)

- Phase 06 (future): Rate limit chính thức (Vercel KV / Redis)
- Phase 07 (future): Tools mở rộng — `channels_health`, `channel_metrics_trend`, `alerts_list`
- Phase 08 (future): OAuth 2.1 nếu cần expose cho 3rd-party
- Phase 09 (future): Write tools (`brief_create`, `post_schedule`) — cần scope `write` + audit log riêng
