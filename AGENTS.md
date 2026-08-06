# Backend — Agent Notes

## Stack

Bun + Hono (HTTP) + Drizzle ORM (PostgreSQL) + Supabase (storage/auth) + Zod (validation) + `@hono/zod-validator`.

## Entrypoint & wiring

- `src/index.ts` — Hono app, CORS on `*`, mounts all route groups.
- To add a new route group: create `src/routes/<name>.ts`, export a `Hono` instance, then import and mount it in `src/index.ts` via `app.route('/api/<name>', router)`.

## Route Structure

| Mount Path | Router File | Purpose |
|---|---|---|
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

## Adding an endpoint (pattern)

1. Define a Zod schema in `src/validation/schemas.ts`.
2. Export a `zValidator('json', schema)` middleware from `src/validation/middleware.ts`.
3. Import both in the route file; use the validator as Hono middleware before the handler: `router.post('/path', validateX, async (c) => { ... })`.
4. Access validated body via `c.req.valid('json')`.
5. Re-export the schema and validator from `src/validation/index.ts`.

## Dev

```sh
bun install
bun run dev          # bun run --hot src/index.ts
```

## Required env vars (copy .env.example to .env)

| Variable | Used in |
|---|---|
| `DATABASE_URL` | `src/db/index.ts`, `src/db/migrate.ts`, `drizzle.config.ts` |
| `SUPABASE_URL` | `src/middleware/auth.ts`, `src/routes/spatial.ts`, `src/routes/captures.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/middleware/auth.ts`, `src/routes/spatial.ts`, `src/routes/captures.ts` |
| `PORT` (default 8080) | `src/index.ts` |
| `FRONTEND_DIR` (optional) | `src/index.ts` — path to frontend static files, defaults to `../frontend` relative to backend cwd |

> **Note**: leave `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` empty for local dev — `@supabase/supabase-js`'s `createClient` throws at import on malformed placeholder URLs, and the auth middleware has a dev fallback via the `x-user-id` header when they're unset.

## Architecture: Unified Server

The backend serves both the API (`/api/v1/...`) and the frontend static files from a single Bun server on port 8080. The frontend `server.ts` in `frontend/` is deprecated — the backend serves the frontend.

## DB

- Drizzle ORM with `postgres` driver. Connection in `src/db/index.ts`.
- Schema definitions in `src/db/schema/` (14 files: index, enums, types, views + 10 table modules). `src/db/schema/index.ts` re-exports all tables, enums, and types.
- **Drizzle setup**: `drizzle.config.ts` (schema `./src/db/schema/index.ts`, out `./drizzle`, postgresql, `DATABASE_URL`). Migrations live in `drizzle/` (initial `0000_*.sql` committed).
- **Migration runner**: `src/db/migrate.ts` applies pending migrations from `./drizzle` using the app's `postgres` driver (`drizzle-orm/postgres-js/migrator`). Run with `bun run db:migrate`. CLI `drizzle-kit migrate` is intentionally not used for `db:migrate` so migrations share the app's connection semantics.
- **Scripts**: `db:generate` (drizzle-kit generate → new migration in `drizzle/`), `db:migrate` (bun run `src/db/migrate.ts`), `db:push` (drizzle-kit push — dev-only shortcut, no migration file), `db:seed`.
- **PostGIS**: schema uses `geometry(Point, 4326)` columns + GiST indexes. `CREATE EXTENSION IF NOT EXISTS postgis` is prepended manually to the initial migration (drizzle-kit won't emit it for custom types); a fresh DB needs it before migrating.
- **Seed script**: `src/db/seed.ts` — seeds the database with frontend mock data (3 chantiers, trade catalog, subcontractors, pointage records). Run with `bun run db:seed`.
- **Note**: `hotspots.pitch` and `hotspots.yaw` are `numeric` (not `text`). `pointageRecords.isCompanyTrade` is `integer` (0/1).

## Validation

- All schemas use `zod`. Types inferred via `z.infer<typeof schema>`.
- `@hono/zod-validator` provides `zValidator('json', schema)`, `zValidator('param', schema)`, `zValidator('query', schema)`.
- `validateParam` and `validateQuery` are generic helpers in `src/validation/middleware.ts`.

## Auth Middleware

`src/middleware/auth.ts` implements Supabase JWT verification with a dev fallback via the `x-user-id` header. If Supabase credentials are not configured, the middleware allows requests through with `userId` set from the `x-user-id` header or `null`.

## No test/lint/typecheck/build scripts

`package.json` has the `dev` script plus DB scripts (`db:generate`, `db:migrate`, `db:push`, `db:seed`). Do not assume `bun test`, `bun run lint`, `bun run typecheck`, or `bun run build` exist. Available CLI tools in `node_modules/.bin/`: `drizzle-kit`, `esbuild`, `tsx`.

## Git

This worktree is a git worktree on branch `feature/0.4-drizzle` (repo is `backend/`-rooted via worktrees). Follow the workspace root `AGENTS.md` worktree/git-flow rules: commit with `feat(0.4): ...`, never merge/push from here.

## Cross-cutting

See workspace root `AGENTS.md` for frontend details, port assignments, and workspace-level conventions.