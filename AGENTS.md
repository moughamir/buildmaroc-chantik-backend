# Backend — Agent Notes

## Stack

Bun + Hono (`OpenAPIHono` from `@hono/zod-openapi`) + **better-auth** + Drizzle ORM (PostgreSQL) + Supabase (storage URLs only) + Zod (validation) + `@hono/zod-validator` + `@hono/swagger-ui`.

## Entrypoint & wiring

- `src/index.ts` — `OpenAPIHono` app. Mounts `/api/auth/*` (better-auth) first, then all `/api/v1/*` route groups behind `sessionMiddleware`, then `adminGuard` for `/api/v1/admin`. Serves client frontend + admin console static files with SPA fallback and dev-mode meta injection.
- Mount order matters: better-auth handlers are mounted before the session middleware; admin routes are mounted with the guard applied.
- To add a new route group: create `src/routes/<name>.ts`, export a `Hono` instance, then import and mount it in `src/index.ts` via `app.route('/api/<name>', router)` (chain `.route()` calls so the `AppType` accumulates).
- **`export type AppType = typeof app`** — consumed by the admin frontend's typed Hono RPC client (`hc` from `hono/client`).
- **OpenAPI/Swagger**: `@hono/zod-openapi` route helpers drive the spec; UI at `/api/v1/docs`, JSON at `/api/v1/doc`. Route handlers with `.openapi()` add operations; plain `Hono` instances also mount fine but don't contribute to the spec.
- CORS: `localhost:8080` + `localhost:5173`, `credentials: true`. Correlation middleware adds a request ID.

## Route Structure

| Mount Path | Router File | Purpose |
|---|---|---|
| `/api/auth/*` | `src/auth.ts` | better-auth handlers (email/password + organization) |
| `/api/v1/organizations` | `src/routes/organizations.ts` | Orgs, teams, members, RBAC, billing, org-scoped projects/crews/equipment |
| `/api/v1/projects` | `src/routes/projects.ts` | Project CRUD, zones, health, attendance, daily logs, RFIs, change orders, blueprints |
| `/api/v1/users` | `src/routes/users.ts` | User profile, preferences, security logs |
| `/api/v1/invitations` | `src/routes/invitations.ts` | Invitation acceptance |
| `/api/v1/crews` | `src/routes/crews.ts` | Crew member assignment |
| `/api/v1/sync` | `src/routes/sync.ts` | Offline-first batch sync |
| `/api/v1/captures` | `src/routes/captures.ts` | Supabase upload URLs |
| `/api/v1` | `src/routes/spatial.ts` | Zones, capture points, panoramas, hotspots |
| `/api/v1` | `src/routes/attendance.ts` | Clock-in / clock-out |
| `/api/v1` | `src/routes/construction-root.ts` | RFI/CO/equipment updates (root-level) |
| `/api/v1` | `src/routes/pointage.ts` | Pointage records, trade catalog, subcontractors |
| `/api/v1/projects/:projectId/notes` | `src/routes/notes.ts` | Project notes CRUD |
| `/api/v1/admin` | `src/routes/admin.ts` | Super-admin console API (guarded) |

## Adding an endpoint (pattern)

1. Define a Zod schema in `src/validation/schemas.ts`.
2. Export a `zValidator('json', schema)` middleware from `src/validation/middleware.ts`.
3. Import both in the route file; use the validator as Hono middleware before the handler: `router.post('/path', validateX, async (c) => { ... })`.
4. Access validated body via `c.req.valid('json')`.
5. Re-export the schema and validator from `src/validation/index.ts`.
6. Central error handling: `src/validation/error-handlers.ts` maps thrown Zod/HTTP errors to JSON responses.

## Dev

```sh
bun install
cp .env.example .env   # then set DATABASE_URL, BETTER_AUTH_SECRET, BASE_URL
bun run dev            # bun run --hot src/index.ts
```

Two-server frontend dev: run Vite (`cd frontend && bun run dev`, port 5173, `/api` proxied to 8080) alongside. Single-server serving requires the frontend built (`FRONTEND_DIR=../frontend/dist`).

Typecheck: `bunx tsc --noEmit` (currently passes, 0 errors). No tests, no linter, no build script — `package.json` has `dev` + DB scripts only.

## Required env vars (copy .env.example to .env)

| Variable | Used in |
|---|---|
| `DATABASE_URL` | `src/db/index.ts`, `src/db/migrate.ts`, `drizzle.config.ts` |
| `BETTER_AUTH_SECRET` | `src/auth.ts` — better-auth secret (session signing) |
| `BASE_URL` (default `http://localhost:8080`) | `src/auth.ts` — better-auth base URL / cookie domain |
| `SUPABASE_URL` | `src/routes/spatial.ts`, `src/routes/captures.ts` (storage URLs) |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/routes/spatial.ts`, `src/routes/captures.ts` |
| `PORT` (default 8080) | `src/index.ts` |
| `FRONTEND_DIR` | `src/index.ts` — client static files; defaults to `../frontend/dist` (the BUILT output — the React source tree can't be served raw; run `bun run build` in `frontend/` first) |
| `ADMIN_FRONTEND_DIR` (optional) | `src/index.ts` — admin console static files, defaults to `../admin-frontend/dist`; served at `/admin/*` |

> **Note**: leave `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` empty for local dev — `@supabase/supabase-js`'s `createClient` throws at import on malformed placeholder URLs (spatial/captures only; auth no longer uses Supabase).

## Architecture: Unified Server

The backend serves the API (`/api/v1/...`, `/api/auth/*`, `/api/v1/docs` Swagger UI), the admin console (`/admin/*` from `admin-frontend/dist`), and the client SPA (from `FRONTEND_DIR`) on a single Bun server on port 8080, with SPA fallback and dev-mode meta injection for the client `index.html`.

## DB

- Drizzle ORM with `postgres` driver. Connection in `src/db/index.ts`.
- Schema definitions in `src/db/schema/` (14 files: index, enums, types, views + 10 table modules). `src/db/schema/index.ts` re-exports all tables, enums, and types. Auth tables (`sessions`, `accounts`) live in `src/db/schema/auth.ts` and are re-exported too.
- **Drizzle setup**: `drizzle.config.ts` (schema `./src/db/schema/index.ts`, out `./drizzle`, postgresql, `DATABASE_URL`). Migrations live in `drizzle/`: initial `0000_*.sql` + `0001_colorful_black_tom.sql` (better-auth tables).
- **Migration runner**: `src/db/migrate.ts` applies pending migrations from `./drizzle` using the app's `postgres` driver (`drizzle-orm/postgres-js/migrator`). Run with `bun run db:migrate`. CLI `drizzle-kit migrate` is intentionally not used for `db:migrate` so migrations share the app's connection semantics.
- **Scripts**: `db:generate` (drizzle-kit generate → new migration in `drizzle/`), `db:migrate` (bun run `src/db/migrate.ts`), `db:push` (drizzle-kit push — dev-only shortcut, no migration file), `db:seed`.
- **PostGIS**: schema uses `geometry(Point, 4326)` columns + GiST indexes. `CREATE EXTENSION IF NOT EXISTS postgis` is prepended manually to the initial migration (drizzle-kit won't emit it for custom types); a fresh DB needs it before migrating.
- **Seed script**: `src/db/seed.ts` — seeds the database from frontend mock data (3 chantiers, trade catalog, subcontractors, pointage records). **It imports `frontend/src/data/*` (mockChantiers, pointageMockData, tradeCatalog) and `frontend/src/types`** — keep those files compatible when editing either side. Run with `bun run db:seed`.
- **Note**: `hotspots.pitch` and `hotspots.yaw` are `numeric` (not `text`). `pointageRecords.isCompanyTrade` is `integer` (0/1).

## Validation

- All schemas use `zod`. Types inferred via `z.infer<typeof schema>`.
- `@hono/zod-validator` provides `zValidator('json', schema)`, `zValidator('param', schema)`, `zValidator('query', schema)`.
- `validateParam` and `validateQuery` are generic helpers in `src/validation/middleware.ts`.

## Auth & Middleware

- **better-auth** (`src/auth.ts`): email/password + organization plugin; Drizzle adapter (`usePlural: true`). Gotchas:
  - `modelName: 'organizationMember'` must stay **singular** — `usePlural` appends the `s`.
  - `generateId` is custom (uuid) because `users.id` has **no DB default**.
  - Cookie prefix `chantik`, 7-day sessions, secure cookies in production, `trustedOrigins` includes 5173 (Vite dev). A `session.create` hook sets the member's `activeOrganizationId`.
- **`sessionMiddleware`** (`src/middleware/session.ts`, replaces the deleted `middleware/auth.ts`): resolves the session via `auth.api.getSession` and sets `user`, `session`, `userId`, `orgId` (active org). Dev bypass: `x-user-id` header is honored **only when `NODE_ENV !== 'production'` AND no `Authorization` header** — never in prod.
  - Convention: `orgId` null on a list route → return `[]`; `orgId` null on a detail/mutation route → 401.
- **`adminGuard`** (`src/middleware/admin.ts`): `/api/v1/admin/*` only. Dev: `x-user-id: 'super-admin'` passes. Prod: session `user.role === 'super-admin'`. Else 403.

## Git

This worktree is a git worktree on branch `develop` (repo is `backend/`-rooted via worktrees). Follow the workspace root `AGENTS.md` worktree/git-flow rules: commit with `feat(0.x): ...` / `fix(0.x): ...`, never merge/push from here.

## Cross-cutting

See workspace root `AGENTS.md` for the three packages (backend, client frontend, admin console), port assignments, and workspace-level conventions.
