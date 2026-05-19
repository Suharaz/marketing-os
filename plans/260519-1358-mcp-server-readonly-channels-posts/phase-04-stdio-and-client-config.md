# Phase 04 — Stdio entry + Claude Desktop/Code config

## Context Links

- Plan: [plan.md](plan.md)
- Prev: [phase-03-http-transport-and-auth.md](phase-03-http-transport-and-auth.md)
- Research §2d: `plans/reports/researcher-260519-1358-mcp-sdk-transports.md`

## Overview

- **Priority**: Medium (HTTP đã đủ cover web app + Zapier/n8n; stdio cho Claude Desktop/Code)
- **Status**: Pending (blocked by Phase 02)
- **Effort**: 0.5 ngày
- **Description**: Implement `scripts/mcp-stdio.ts` (stdio entry) + viết doc setup cho Claude Desktop + Claude Code.

## Key Insights

- **Stdout là kênh JSON-RPC** — bất kỳ `console.log` nào sẽ phá protocol. Chỉ dùng `console.error` (stderr).
- **Stdio không cần auth** — process inherit env của user, không có network exposure.
- **`tsx` chạy direct TypeScript** — không cần build step, Phase 01 đã add `tsx` script.
- **Claude Code v2.x** hỗ trợ MCP qua `~/.claude/mcp.json` hoặc `claude mcp add` CLI.
- **Cross-platform paths**: Windows dùng `C:/...` hoặc escape `\\`, Mac/Linux dùng absolute path.

## Requirements

### Functional
- `npm run mcp:stdio` chạy được không lỗi
- Claude Desktop config cho phép discover 5 tools
- Claude Code config tương tự
- Process exit code 1 nếu DATABASE_URL không có

### Non-functional
- Stdio entry file ≤50 LOC
- Startup time <500ms (cold)
- Không log nhạy cảm ra stderr

## Architecture

```
Claude Desktop / Code
       ↓
   spawn process (stdio)
       ↓
scripts/mcp-stdio.ts
       ↓
createServer() — Phase 02 factory
       ↓
StdioServerTransport
       ↓
Postgres (via pg Pool, env DATABASE_URL)
```

**Critical:** Cả process **không phải web server** — chỉ là 1 Node process đọc stdin / ghi stdout. Pool sẽ idle release sau timeout (xem `pg` config).

## Related Code Files

**Create:**
- `scripts/mcp-stdio.ts` — stdio entry (~30 LOC)
- `docs/mcp-server-setup.md` — user-facing doc (admin/dev setup Claude Desktop + Code)

**Modify:**
- `src/mcp/server.ts` — verify `createServer()` không phụ thuộc Next.js runtime (chỉ pg + pure functions)
- `.env.example` — note rằng stdio đọc cùng `.env` qua `dotenv`

**Read for context (MUST READ):**
- `src/lib/db.ts` — kiểm tra pg Pool có lazy-init không (nếu eager, sẽ connect ngay khi import → cần handle DATABASE_URL missing)
- `scripts/seed-dev-data.ts` — pattern script đã có (xem cách load `.env` với `tsx`)

## Implementation Steps

### 1. Implement `scripts/mcp-stdio.ts`
```ts
#!/usr/bin/env -S tsx
import 'dotenv/config';  // load .env cho local run; Claude config pass env trực tiếp cũng OK
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../src/mcp/server.js';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('[mcp-stdio] DATABASE_URL is required');
    process.exit(1);
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[mcp-stdio] connected, awaiting JSON-RPC on stdin');
}

main().catch((err) => {
  console.error('[mcp-stdio] fatal:', err);
  process.exit(1);
});
```

**Lưu ý quan trọng:**
- Import path dùng relative + `.js` extension (ESM)
- `dotenv/config` chỉ load nếu file `.env` tồn tại — không lỗi khi Claude pass env trực tiếp
- Mọi log dùng `console.error` (stderr)

### 2. Test thủ công
```bash
# Set DATABASE_URL trong .env hoặc shell
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npm run mcp:stdio
# Expected: stderr "connected", stdout JSON-RPC response with 5 tools
```

### 3. Viết `docs/mcp-server-setup.md`

Cấu trúc:
- **Overview**: MCP là gì, server này expose gì
- **Setup cho Claude Desktop** (config JSON example, đường dẫn file config theo OS)
- **Setup cho Claude Code** (`claude mcp add` command + JSON example)
- **Setup HTTP** (cho dev, dùng `mcp-remote` package để proxy stdio↔HTTP nếu Desktop chưa support remote MCP)
- **Available tools** (5 tools với mô tả 1 dòng)
- **Troubleshooting** (common errors)

#### Claude Desktop config (Windows)
File: `%APPDATA%\Claude\claude_desktop_config.json`
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
        "DATABASE_URL": "postgres://user:pass@localhost:5432/marketing"
      }
    }
  }
}
```

#### Claude Desktop config (macOS/Linux)
File: `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) hoặc `~/.config/Claude/claude_desktop_config.json` (Linux)
```json
{
  "mcpServers": {
    "marketing-os": {
      "command": "npx",
      "args": ["tsx", "/path/to/marketing/app/scripts/mcp-stdio.ts"],
      "env": { "DATABASE_URL": "postgres://..." }
    }
  }
}
```

#### Claude Code config
```bash
claude mcp add marketing-os \
  --command "npx" \
  --args "tsx,F:/Vibe Coding/marketing/app/scripts/mcp-stdio.ts" \
  --env "DATABASE_URL=postgres://..."
```

Hoặc edit `~/.claude/mcp.json` trực tiếp (cùng format Claude Desktop).

#### Verify trong Claude Desktop
- Restart Claude Desktop
- Hover icon ⚒ (tools) → thấy `marketing-os` với 5 tools
- Test prompt: "List 3 channels with highest engagement rate"

### 4. Verify build
```bash
npx tsc --noEmit
npm run mcp:stdio < /dev/null  # Test exit handling (Linux/Mac)
# Windows: echo. | npm run mcp:stdio
```

## Todo List

- [ ] Đọc `src/lib/db.ts` (pool init pattern) + `scripts/seed-dev-data.ts` (env load pattern)
- [ ] Implement `scripts/mcp-stdio.ts`
- [ ] Test manual: `echo '{...}' | npm run mcp:stdio` trả về tools list
- [ ] Viết `docs/mcp-server-setup.md` (full setup guide)
- [ ] Config Claude Desktop trên dev machine + verify hover icon
- [ ] Config Claude Code + verify `claude mcp list`
- [ ] Test 1 tool call thật từ Claude Desktop (vd "List active Facebook channels")

## Success Criteria

- `npm run mcp:stdio` start không lỗi, tự terminate khi stdin closed
- Claude Desktop hover icon ⚒ thấy `marketing-os` + 5 tools
- Tool call từ Claude Desktop trả về data thật từ DB
- Không có `console.log` (chỉ `console.error`) trong `scripts/mcp-stdio.ts`
- `docs/mcp-server-setup.md` đủ chi tiết để 1 admin mới setup được trong 10 phút

## Risk Assessment

| Risk | Mitigation |
|---|---|
| `tsx` không tìm thấy trong `PATH` của Claude Desktop | Hướng dẫn dùng absolute path `node_modules/.bin/tsx` hoặc `npx` |
| Windows path có space (`F:/Vibe Coding/...`) | Test, escape nếu cần; document rõ trong setup guide |
| `console.log` vô tình trong code path (vd từ pg) | ESLint rule Phase 01 + grep `console.log` trước commit |
| Pool không close → process hang | StdioServerTransport tự terminate khi stdin EOF; pool idle timeout handle phần còn lại |
| Claude Desktop version cũ không support `env` field | Document min version, suggest update |

## Security Considerations

- **DATABASE_URL trong config file**: file config Claude Desktop ở user home → có ACL bảo vệ; vẫn note user về risk lưu password plaintext
- **Suggest dùng riêng DB user readonly** (sẽ làm trong Phase 05): tạo `mcp_readonly` role, grant `SELECT` chỉ trên whitelist tables, dùng URL riêng trong Claude config
- **Không commit `claude_desktop_config.json`** vào repo (nếu để trong project)

## Next Steps

→ Phase 05: Testing + docs final + DB readonly role + rate limit (optional).
