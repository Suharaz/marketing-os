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

# Copy migration files and scripts
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts/run-migrations.cjs ./scripts/run-migrations.cjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/seed-admin.cjs ./scripts/seed-admin.cjs
# hash-password.ts is a dev utility (requires tsx) — not copied to runner image.

# Copy pg module needed at runtime for run-migrations.cjs
# pg is a production dependency — present in standalone/node_modules via Next.js trace,
# but we explicitly copy from prod deps to guarantee availability.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/pg ./node_modules/pg
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/pg-pool ./node_modules/pg-pool
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/pg-protocol ./node_modules/pg-protocol
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/pg-types ./node_modules/pg-types
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/pgpass ./node_modules/pgpass
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/pg-connection-string ./node_modules/pg-connection-string

USER nextjs
EXPOSE 3000

# Use Node 20 built-in fetch — no wget needed in alpine
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:3000').then(r=>process.exit(r.ok||r.status===307||r.status===302?0:1)).catch(()=>process.exit(1))"

# Run migrations + seed admin user, then start the Next.js server.
# All three steps run in-container so DATABASE_URL is available and the
# admin team_member is provisioned from ADMIN_PASSWORD_HASH on first boot.
CMD ["sh", "-c", "node scripts/run-migrations.cjs && node scripts/seed-admin.cjs && node server.js"]
