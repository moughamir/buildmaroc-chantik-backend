# syntax=docker/dockerfile:1

# ---------- Stage 1: build (install dependencies) ----------
FROM oven/bun:1 AS build
WORKDIR /app

# Deterministic install from the committed lockfile
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Bun runs TypeScript directly — no compile step needed.
COPY src/ ./src/

# db:generate is intentionally skipped at build time: migrations are committed
# in drizzle/ and applied externally against the database (bun run db:migrate).
# The drizzle/ folder is excluded from the build context via .dockerignore.

# ---------- Stage 2: runtime ----------
FROM oven/bun:1-slim AS runtime
WORKDIR /app

# curl is required by the docker-compose healthcheck (curl -f /health).
# oven/bun:1-slim is Debian-based, so use apt-get.
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy only what the app needs at runtime
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src

ENV PORT=8080
EXPOSE 8080

CMD ["bun", "run", "src/index.ts"]