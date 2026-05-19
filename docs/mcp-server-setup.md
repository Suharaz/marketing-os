# MCP Server — Setup Guide

> Read-only Model Context Protocol server expose marketing data (channels + posts + analytics) cho Claude Desktop, Claude Code, AI agent in-app, và external integrations (Zapier/n8n).

## Tổng quan

**MCP (Model Context Protocol)** là protocol chuẩn của Anthropic giúp LLM/AI agent kết nối với data sources và tools bên ngoài — giống USB-C cho AI.

Server này expose **10 tools read-only**:

| Domain | Tools |
|---|---|
| Channels | `channels_list`, `channels_get`, `channels_health`, `channels_metrics` |
| Posts | `posts_list`, `posts_get`, `posts_top` |
| Analytics | `analytics_kpi`, `analytics_trend`, `analytics_top_performers` |

## Kiến trúc

```
Claude Desktop / Code   ──stdio──→  scripts/mcp-stdio.ts
In-app AI agent        ──HTTP───→  /api/mcp (Bearer token)
Zapier / n8n           ──HTTP───→  /api/mcp (Bearer token)
                                       │
                                       ▼
                                createServer() (src/mcp/server.ts)
                                       │
                                       ▼
                                src/lib/queries/* → Postgres
```

---

## Setup cho Claude Desktop

### Windows

1. Mở file config:
   ```
   %APPDATA%\Claude\claude_desktop_config.json
   ```
   (Tạo mới nếu chưa có)

2. Thêm cấu hình:
   ```json
   {
     "mcpServers": {
       "marketing-os": {
         "command": "npx",
         "args": [
           "tsx",
           "F:/Vibe Coding/marketing/app/scripts/mcp-stdio.ts"
         ],
         "env": {
           "DATABASE_URL": "postgresql://marketing:devpass@localhost:5433/marketing_os"
         }
       }
     }
   }
   ```

3. Restart Claude Desktop (`Quit` + mở lại — không chỉ close window).

4. Verify: hover icon ⚒ (tools) ở thanh chat → thấy `marketing-os` với 10 tools.

### macOS

File config: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "marketing-os": {
      "command": "npx",
      "args": ["tsx", "/path/to/marketing/app/scripts/mcp-stdio.ts"],
      "env": {
        "DATABASE_URL": "postgresql://..."
      }
    }
  }
}
```

### Linux

File config: `~/.config/Claude/claude_desktop_config.json` (giống Mac format).

---

## Setup cho Claude Code

### Cách 1: CLI

```bash
claude mcp add marketing-os \
  --command "npx" \
  --args "tsx,F:/Vibe Coding/marketing/app/scripts/mcp-stdio.ts" \
  --env "DATABASE_URL=postgresql://..."
```

### Cách 2: Edit file config

File: `~/.claude/mcp.json` — giống format Claude Desktop.

### Verify
```bash
claude mcp list
# Expected output:
# marketing-os    npx tsx /path/to/scripts/mcp-stdio.ts
```

---

## Setup HTTP transport (cho web app, Zapier, n8n)

### 1. Sinh Bearer token

```bash
# Sinh 16 byte random hex
openssl rand -hex 16
# Output ví dụ: 7f3d8b2e9c1a4d6f8e0b2c4a6d8e0f1a
```

Prefix theo client để dễ audit: `tok_<env>_<client>_<random>`.

### 2. Thêm vào `.env`

```env
MCP_BEARER_TOKENS_JSON='{"tok_prod_zapier_7f3d8b2e":{"clientId":"zapier","scopes":["read"]},"tok_prod_n8n_9c1a4d6f":{"clientId":"n8n","scopes":["read"]}}'
```

**Format:**
- Key = token string (dùng nguyên trong Authorization header)
- Value.clientId = label cho audit log
- Value.scopes = quyền hạn (hiện tại chỉ có `read`)

### 3. Test với curl

```bash
# Unauth → 401
curl -X POST http://localhost:3000/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Authed → 200 + tools
curl -X POST http://localhost:3000/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer tok_prod_zapier_7f3d8b2e' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### 4. Tích hợp Zapier / n8n

- **Endpoint**: `https://your-domain.com/api/mcp`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- **Body**: MCP JSON-RPC payload (xem MCP spec)

n8n có node MCP chính thức — paste URL + token là dùng được.

---

## Available Tools — Reference

### Channels

#### `channels_list`
Liệt kê các kênh với filters.

**Input:**
```ts
{
  platform?: 'facebook' | 'tiktok' | 'youtube' | 'instagram' | 'threads' | 'zalo',
  status?: 'active' | 'token_expired' | 'disconnected',
  sort?: 'name' | 'health' | 'followers',
  limit?: number // 1-100, default 20
}
```

**Use case:** *"Liệt kê 10 kênh Facebook đang active"*

#### `channels_get`
Chi tiết 1 kênh theo UUID.

**Input:** `{ id: uuid }`

**Use case:** *"Show me details of channel be14c477-..."*

#### `channels_health`
Health scores với 4 sub-scores (ER/consistency/growth/reach) + so sánh tuần trước.

**Input:** `{ accountId?: uuid }` (omit = all)

**Use case:** *"Kênh nào health tụt nhiều vs tuần trước?"*

#### `channels_metrics`
Per-day metrics 1 kênh trong N ngày (7/14/30/90), exclude hôm nay.

**Input:** `{ accountId: uuid, days?: '7'|'14'|'30'|'90' }`

**Use case:** *"Reach của TAKI Food 30 ngày qua"*

### Posts

#### `posts_list`
Liệt kê posts với filters + cursor pagination.

**Input:**
```ts
{
  accountId?: uuid,
  platform?: enum,
  type?: 'photo'|'video'|'reel'|'status'|'link'|'album'|'sticker'|'share',
  from?: 'YYYY-MM-DD',
  to?: 'YYYY-MM-DD',
  tag?: string,
  sort?: 'recent'|'er'|'reach',
  cursor?: string,
  query?: string  // full-text search
}
```

**Use case:** *"Tất cả video tháng 4 trên channel X, sort theo reach"*

#### `posts_get`
Chi tiết 1 post + latest metric snapshot.

**Input:** `{ id: uuid }`

#### `posts_top`
Top posts theo metric trong date range.

**Input:**
```ts
{
  from: 'YYYY-MM-DD',
  to: 'YYYY-MM-DD',
  metric: 'engagement_rate' | 'reach',
  accountId?: uuid,
  limit?: number  // 1-20, default 5
}
```

**Use case:** *"Top 5 posts có reach cao nhất tuần qua"*

### Analytics

#### `analytics_kpi`
Global KPI snapshot N ngày vs prior N ngày.

**Input:** `{ days?: '7'|'14'|'30'|'90' }`

**Output:** reach, avgEr, conversions, revenue, totalFollowers (current + prev).

**Use case:** *"KPI tuần này so với tuần trước"*

#### `analytics_trend`
Daily trend cross-channel.

**Input:** `{ days?: number(7-90) }`

**Use case:** *"Vẽ trend reach 30 ngày"*

#### `analytics_top_performers`
Top team members theo engagement.

**Input:** `{ days?: number(7-90), limit?: number(1-20) }`

**Use case:** *"5 team member top engagement tháng này"*

---

## Sample prompts (sau khi setup Claude Desktop)

- *"Tình hình reach tuần này thế nào?"* → gọi `analytics_kpi({ days: '7' })`
- *"Liệt kê các kênh Facebook đang active"* → `channels_list({ platform: 'facebook', status: 'active' })`
- *"Top 5 post engagement cao nhất tuần qua"* → `posts_top({ from, to, metric: 'engagement_rate', limit: 5 })`
- *"Kênh nào health tụt nhiều?"* → `channels_health()` rồi filter `priorHealthScore - healthScore`

---

## Security

### Tokens

- **Sinh strong tokens**: `openssl rand -hex 16` (KHÔNG dùng password kiểu cũ)
- **Prefix theo client**: dễ audit + grep trong log
- **Rotate quarterly**: update `MCP_BEARER_TOKENS_JSON` + redeploy
- **NEVER commit** token vào git — `.env` đã ignore mặc định
- **NEVER log** Authorization header

### DB access

Hiện tại MCP server dùng cùng DB user với app. **Khuyến nghị** (defer Phase 05): tạo role `mcp_readonly`:

```sql
CREATE ROLE mcp_readonly LOGIN PASSWORD '<generated>';
GRANT CONNECT ON DATABASE marketing_os TO mcp_readonly;
GRANT USAGE ON SCHEMA public TO mcp_readonly;
GRANT SELECT ON
  social_account, social_post,
  post_metric_daily, account_metric_daily,
  channel_health_daily, team_member,
  landing_page_conversion, manual_revenue
TO mcp_readonly;
-- KHÔNG grant: api_sync_log (chứa raw FB API payload + có thể có token)
```

Sau đó dùng URL riêng `postgres://mcp_readonly:...` trong `DATABASE_URL` của MCP entry.

### PII Redaction

Server đã hardcode redact:
- `social_account.access_token_encrypted` (OAuth token)
- `social_account.persona_json` (free-form, có thể chứa secret)
- `team_member.password_hash`
- `api_sync_log.details` (raw FB payload nặng)
- `landing_page_conversion.raw_response` (lead PII)

Owner email **được expose** (decision 2026-05-19 — MCP nội bộ admin).

---

## Troubleshooting

### Claude Desktop không thấy tools

1. Verify config file đúng path + JSON hợp lệ (jsonlint.com)
2. Restart Claude Desktop **hoàn toàn** (Quit, không chỉ close)
3. Check stderr log: `~/Library/Logs/Claude/mcp-server-marketing-os.log` (Mac)
4. Test stdio thủ công:
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npm run mcp:stdio
   ```

### "DATABASE_URL is required"

- Set trong `env` của config file (Claude Desktop) hoặc `.env` (CLI test)
- Check connection: `psql $DATABASE_URL -c 'SELECT 1'`

### HTTP 401 mặc dù có token

- Check `MCP_BEARER_TOKENS_JSON` env var được load (restart Next.js)
- Verify token match exact (no whitespace, đúng case)
- Header phải là `Authorization: Bearer <token>` (chú ý space)

### Tool call trả `isError: true`

- Read `content[0].text` để biết lý do
- Common: UUID invalid format, date không phải `YYYY-MM-DD`, record not found

### Stdio entry log lẫn vào response

- Stdout là JSON-RPC kênh; **KHÔNG được** `console.log` ở stdio code path
- Mọi log phải `console.error` (stderr)

---

## Roadmap

### Phase 05 (future, defer)
- DB readonly role (`mcp_readonly`)
- Unit tests cho 10 tools (vitest)
- Rate limit ở edge layer

### Phase 06+ (future ý tưởng)
- Thêm tools: `alerts_list`, `sync_log_list`, `channels_metrics_with_today`
- OAuth 2.1 nếu expose external 3rd-party
- Write tools (`brief_create`, `post_schedule`) — cần scope `write` + audit log riêng

---

## Tham khảo

- MCP spec: https://modelcontextprotocol.io/specification/2025-06-18
- TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- mcp-handler (Vercel adapter): https://github.com/vercel/mcp-handler
- Plan gốc: `plans/260519-1358-mcp-server-readonly-channels-posts/plan.md`
