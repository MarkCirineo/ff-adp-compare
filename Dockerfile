# ==================================
# ADP Scout — Production Dockerfile
# ==================================
# Multi-stage build: deps → build → minimal runner
# Produces a standalone Next.js server + sync CLI

# --- Stage 1: Install all dependencies ---
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# --- Stage 2: Build application ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN yarn build

# --- Stage 3: Production runner ---
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# ---- Next.js standalone server ----
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# ---- Prisma schema + migrations ----
COPY --from=builder /app/prisma ./prisma

# ---- Sync CLI source ----
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/package.json ./

# Install CLI runtime deps:
#   tsx    — run TypeScript connector/seed scripts
#   prisma — run migrate deploy in entrypoint
#   fuse.js — player name matching in sync pipeline
RUN npm install --no-save tsx prisma fuse.js

# Copy Prisma client generated during build (must come AFTER npm install
# so it overwrites any version npm might pull in)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# ---- Entrypoint ----
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Set ownership and drop to non-root
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
