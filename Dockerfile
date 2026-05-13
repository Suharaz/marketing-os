# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
# Separate full install for build
FROM node:20-alpine AS deps-full
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps-full /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -u 1001 -S nextjs -G nodejs

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Next.js 16 standalone tracer drops anything only reachable via
# instrumentation (server.js never imports it). Patch three gaps:
#
#   1. .next/server  → restores instrumentation.js + the chunks it requires
#      (verified missing: _127p5s9.*, [externals]__12lt8e3.*,
#      [root-of-the-server]__0mjggad.*).
#   2. .next/node_modules  → Turbopack content-hashed package copies
#      (e.g. node-cron-850d997d12dc4759) that the runtime resolves via
#      ESM specifier lookup. Standalone keeps the pg-* copy but drops
#      node-cron-* because no HTTP route imports node-cron directly.
#   3. node_modules overlay (further down) → real packages for runtime.
#
# COPY merges directories; standalone-traced files are byte-identical, so
# the overlay is a no-op for them and only ADDS the dropped files.
COPY --from=builder --chown=nextjs:nodejs /app/.next/server ./.next/server
COPY --from=builder --chown=nextjs:nodejs /app/.next/node_modules ./.next/node_modules

# Copy migration files and scripts
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts/run-migrations.cjs ./scripts/run-migrations.cjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/seed-admin.cjs ./scripts/seed-admin.cjs
# hash-password.ts is a dev utility (requires tsx) — not copied to runner image.

# Overlay the full prod node_modules tree on top of standalone. Next's
# tracer-built node_modules only includes packages reachable from the HTTP
# request graph; cron-only deps (node-cron, bcryptjs, zod, iron-session,
# date-fns) and the migration runner's pg are dropped, even though they are
# declared production deps. The overlay is a no-op for files standalone
# already has — identical builds produce identical bytes — but it restores
# every missing package. Slightly larger image vs. listing each package
# by name, much less brittle as deps grow.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs
EXPOSE 3000

# Use Node 20 built-in fetch — no wget needed in alpine
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:3000').then(r=>process.exit(r.ok||r.status===307||r.status===302?0:1)).catch(()=>process.exit(1))"

# Run migrations + seed admin user, then start the Next.js server. The
# standalone tracer's gap is patched above by force-copying .next/server,
# so Next's own auto-loader will find instrumentation.js and call register()
# at boot — no wrapper needed.
CMD ["sh", "-c", "node scripts/run-migrations.cjs && node scripts/seed-admin.cjs && node server.js"]
