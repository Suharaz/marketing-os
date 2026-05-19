# MCP Server — Read-Only Channels + Posts (MVP)

> Designed: 2026-05-19 · Project: Marketing OS (Next.js 16 App Router) · Scope: MVP nhỏ, read-only

## Mục tiêu

Expose marketing data (channels + posts) qua **Model Context Protocol** cho 4 loại consumer:
1. **Claude Desktop** (admin nội bộ — stdio)
2. **Claude Code** (dev workflow — stdio)
3. **AI agent trong web app** (HTTP, server-side fetch)
4. **External integrations** (Zapier/n8n — HTTP với Bearer token)

Một core MCP server, dual transport (stdio + Streamable HTTP), reuse existing query layer.

## Tech stack (đã chốt từ research)

| Component | Choice | Lý do |
|---|---|---|
| MCP SDK | `@modelcontextprotocol/sdk@^1.29.0` | Stable v1.x; pin major (v2 sẽ break imports) |
| HTTP adapter | `mcp-handler@^1.1.0` (Vercel) | Bridge Next.js App Router ↔ raw transport (~5 LOC) |
| Transport HTTP | Streamable HTTP (stateless + JSON) | Spec hiện hành; SSE-only đã deprecated |
| Transport stdio | `StdioServerTransport` (raw SDK) | Native cho Claude Desktop/Code |
| Auth (HTTP) | Static Bearer qua `withMcpAuth` | OAuth 2.1 overkill cho internal tool |
| Auth (stdio) | Không | Local process, inherit env |
| Validation | `zod@4.4.2` (đã có trong stack) | SDK native support |

Reports tham khảo:
- `plans/reports/researcher-260519-1358-mcp-sdk-transports.md`
- `plans/reports/scout-260519-1358-mcp-data-inventory.md`

## Tools MVP (10 tools, read-only)

### Channels domain (2 tools)
| Tool | Underlying query | Status |
|---|---|---|
| `channels_list` | `fetchChannelsList(filter)` | Reuse 100% |
| `channels_get` | `fetchChannel(id)` + redact PII | Reuse + filter |

### Posts domain (3 tools)
| Tool | Underlying query | Status |
|---|---|---|
| `posts_list` | `fetchLibraryPosts(filter)` | Reuse 100%, cursor pagination |
| `posts_get` | **NEW query** `fetchPost(id)` | Cần viết (Phase 02) |
| `posts_top` | `fetchLibraryPosts({sort: 'er'\|'reach', from, to})` | Reuse, enforce limit |

### Analytics domain (5 tools)
| Tool | Underlying query | Status |
|---|---|---|
| `analytics_kpi` | `fetchKpiData(days)` | Reuse 100% — global KPI (reach/ER/conv/revenue/followers, current vs prev) |
| `analytics_trend` | `fetchTrendData(days)` | Reuse 100% — cross-channel daily trend |
| `analytics_top_performers` | `fetchTopPerformers(days, limit)` | Reuse 100% — top team members by engagement |
| `channels_health` | `fetchChannelHealth()` + extended sub-scores | Reuse + extend (project er_score/consistency_score/growth_score/reach_score) |
| `channels_metrics` | **NEW query** `fetchMetricsRange(accountId, days)` | Parameterize từ `fetchMetrics7d` (currently hard-coded 7) |

→ Out of MVP (defer): `alerts_list`, `sync_log_list`, write tools (brief/post schedule).

**Decision:** revenue + financial data expose bình thường (MCP nội bộ admin only — confirmed user).

## Phases

| # | Phase | File | Priority | Effort |
|---|---|---|---|---|
| 01 | Setup deps + project skeleton | [phase-01-setup-deps-and-skeleton.md](phase-01-setup-deps-and-skeleton.md) | High | 0.5d |
| 02 | Core server + 10 tools | [phase-02-core-server-and-tools.md](phase-02-core-server-and-tools.md) | High | 1.5d |
| 03 | HTTP transport + Bearer auth | [phase-03-http-transport-and-auth.md](phase-03-http-transport-and-auth.md) | High | 0.5d |
| 04 | Stdio entry + Claude config docs | [phase-04-stdio-and-client-config.md](phase-04-stdio-and-client-config.md) | Medium | 0.5d |
| 05 | Testing + docs | [phase-05-testing-and-docs.md](phase-05-testing-and-docs.md) | Medium | 0.5d |

**Total effort estimate:** ~3.5 ngày dev (1 người, full focus).

## Key principles

- **DRY**: Tools = thin adapter, SQL ở `src/lib/queries/*` (đã có)
- **YAGNI**: Không OAuth, không multi-tenancy, không write tools — defer until needed
- **KISS**: Stateless HTTP, JSON response mode (không SSE) — bám sát serverless model
- **Security first**: Redact `access_token_encrypted`, `password_hash`, `persona_json`, `details JSONB`, `raw_response` — hardcode allowlist columns trong tool output

## Risk summary

| Risk | Mitigation |
|---|---|
| SDK v2 breaking changes | Pin `^1.29.0` (major lock) |
| `mcp-handler` abandoned | Fallback ~150 LOC bridge với `@hono/node-server` |
| Static token leak | No-log auth header rule, rotate quarterly, document |
| Pool exhaustion từ Zapier loop | Rate limit ở edge layer (Phase 03) |
| Stdout pollution trong stdio | ESLint rule ban `console.log` trong `scripts/mcp-stdio.ts` |

## Unresolved questions (cần user confirm)

1. **Deployment target**: Vercel hay Coolify (đã có trong memory)? Ảnh hưởng `maxDuration` limits.
2. **PII redaction policy**: Có expose `owner.email` (team_member) qua MCP không, hay redact mặc định?
3. **Token issuance**: Quản lý token qua env-var, hay sau này build admin UI?
4. **Rate limiting**: App đã có middleware layer nào chưa, hay build mới?
5. **Pagination cursor format**: Opaque base64 (đề xuất) hay DB-native?

→ Default decisions trong các phase files; user override nếu cần.
