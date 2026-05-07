# Marketing OS — TAKI Group

Internal marketing operations platform.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start Postgres dev database (from repo root)
docker compose -f ../docker-compose.dev.yml up -d

# 3. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env` and fill in real values before running.
