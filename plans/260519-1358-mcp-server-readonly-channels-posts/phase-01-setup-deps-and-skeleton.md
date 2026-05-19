# Phase 01 — Setup deps + project skeleton

## Context Links

- Plan overview: [plan.md](plan.md)
- Research report: `plans/reports/researcher-260519-1358-mcp-sdk-transports.md`

## Overview

- **Priority**: High (blocker cho mọi phase sau)
- **Status**: Pending
- **Effort**: 0.5 ngày
- **Description**: Cài deps, dựng folder skeleton, set ESLint rule, viết stub files để các phase sau cắm vào.

## Key Insights

- SDK pin **major** (`^1.29.0` không phải `^1` rộng) vì v2 pre-alpha sẽ break import paths
- `mcp-handler@^1.1.0` bridge Web Request ↔ Node IncomingMessage (Next.js App Router yêu cầu)
- Cần ESLint rule **ban `console.log` trong stdio entry** — stdout là kênh JSON-RPC, log sẽ phá protocol

## Requirements

### Functional
- Skeleton compile được (TypeScript `tsc --noEmit` pass)
- Deps cài đúng version, không conflict với `zod@4.4.2` / `pg@8.20`

### Non-functional
- File size: mỗi file ≤200 LOC (per global rule)
- Tuân thủ ESM convention (`.js` extension trong import từ SDK)

## Architecture

```
src/mcp/
├── server.ts                # createServer() — TODO trong Phase 02
├── auth.ts                  # verifyToken() — TODO trong Phase 03
├── redact.ts                # PII redaction helpers — TODO trong Phase 02
└── tools/
    ├── index.ts             # registerAllTools(server) — TODO trong Phase 02
    ├── channels.ts          # channels_list, channels_get — TODO Phase 02
    └── posts.ts             # posts_list, posts_get, posts_top — TODO Phase 02

app/api/mcp/[transport]/
└── route.ts                 # HTTP entry — TODO trong Phase 03

scripts/
└── mcp-stdio.ts             # stdio entry — TODO trong Phase 04
```

## Related Code Files

**Create:**
- `src/mcp/server.ts` (stub, `export function createServer() { /* phase 02 */ }`)
- `src/mcp/tools/index.ts` (stub)
- `src/mcp/auth.ts` (stub)
- `src/mcp/redact.ts` (stub)
- `src/mcp/README.md` (link tới plan)

**Modify:**
- `package.json` (add deps + scripts)
- `eslint.config.mjs` hoặc `.eslintrc.*` (rule no-console cho `scripts/mcp-stdio.ts`)
- `.env.example` (`MCP_BEARER_TOKENS=...` placeholder)
- `tsconfig.json` (verify `moduleResolution: "bundler"` hỗ trợ deep imports SDK)

**Read for context (MUST READ trước khi sửa):**
- `package.json` — verify deps tránh duplicate
- `tsconfig.json` — kiểm tra `module` + `moduleResolution`
- `src/lib/queries/channels-list.ts` — quen pattern query layer
- `src/lib/queries/library-posts.ts` — quen pattern cursor pagination

## Implementation Steps

### 1. Install dependencies
```bash
cd "F:/Vibe Coding/marketing/app"
npm install @modelcontextprotocol/sdk@^1.29.0 mcp-handler@^1.1.0
```

Verify trong `package.json` — pin với `^` ở minor level (KHÔNG dùng `latest`).

### 2. Add npm scripts to `package.json`
```json
{
  "scripts": {
    "mcp:stdio": "tsx scripts/mcp-stdio.ts",
    "mcp:dev": "next dev"
  }
}
```
HTTP transport tự nhiên chạy chung với `next dev` (route mounted vào App Router).

### 3. Create folder skeleton
- Tạo `src/mcp/` + 4 file stub trên
- Tạo `app/api/mcp/[transport]/route.ts` stub (return 501 Not Implemented)
- Tạo `scripts/mcp-stdio.ts` stub (chỉ `console.error('stub')` + `process.exit(1)`)

### 4. Add ESLint rule (KHÔNG dùng console.log trong stdio entry)
Trong `eslint.config.mjs`, thêm override:
```js
{
  files: ['scripts/mcp-stdio.ts'],
  rules: {
    'no-console': ['error', { allow: ['error'] }],
  },
}
```

### 5. Add env placeholder
```bash
# .env.example
MCP_BEARER_TOKENS=        # comma-separated tokens, vd: tok_zapier_xxx,tok_n8n_yyy
```

### 6. Verify build
```bash
npx tsc --noEmit
npm run lint
```

## Todo List

- [ ] Read `package.json` + `tsconfig.json` + 2 query files
- [ ] `npm install @modelcontextprotocol/sdk@^1.29.0 mcp-handler@^1.1.0`
- [ ] Add npm scripts `mcp:stdio`
- [ ] Create folder skeleton + stub files
- [ ] Add ESLint override cho stdio entry
- [ ] Add `MCP_BEARER_TOKENS` to `.env.example`
- [ ] `npx tsc --noEmit` pass
- [ ] `npm run lint` pass

## Success Criteria

- `npx tsc --noEmit` exit 0
- `npm run lint` exit 0
- Folder structure khớp với "Architecture" section
- `.env.example` có `MCP_BEARER_TOKENS` (giá trị trống)

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| `mcp-handler` peer dep conflict với SDK version | Low | Check `mcp-handler` package.json peer range trước install |
| ESLint config syntax khác (flat vs legacy) | Medium | Đọc `eslint.config.mjs` hiện tại trước khi sửa |
| `tsconfig` không support `.js` imports từ SDK | Low | Stack đã có Next.js → moduleResolution thường là `bundler` hoặc `nodenext`, cả 2 đều OK |

## Security Considerations

- `.env.example` **KHÔNG** chứa real token
- `MCP_BEARER_TOKENS` phải được add vào `.gitignore` whitelist không bị commit (`.env` đã ignore mặc định, verify)

## Next Steps

→ Phase 02: implement `createServer()` + 5 tools.
