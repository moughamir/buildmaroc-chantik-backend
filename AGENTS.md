# Backend — Agent Notes

## Stack

Bun + Hono (HTTP) + Drizzle ORM (PostgreSQL) + Supabase (storage/auth) + Zod (validation) + `@hono/zod-validator`.

## Entrypoint & wiring

- `src/index.ts` — Hono app, CORS on `*`, mounts `syncRouter` at `/api/sync` and `capturesRouter` at `/api/captures`.
- To add a new route group: create `src/routes/<name>.ts`, export a `Hono` instance, then import and mount it in `src/index.ts` via `app.route('/api/<name>', router)`.

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

## Required env vars (no .env.example committed)

| Variable | Used in |
|---|---|
| `DATABASE_URL` | `src/db/index.ts` |
| `SUPABASE_URL` | `src/routes/captures.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/routes/captures.ts` |
| `PORT` (default 8080) | `src/index.ts` |

**Port collision**: frontend dev server also uses 8080. When both are needed, run backend on a different port: `PORT=8081 bun run dev`.

## DB

- Drizzle ORM with `postgres` driver. Connection in `src/db/index.ts`.
- Schema definitions in `src/db/schema/` (12 files). `src/db/schema/index.ts` re-exports all tables, enums, and types.
- `src/db/migrate.ts` is an empty stub. `drizzle-kit` is installed but no config or migration script exists.

## Validation

- All schemas use `zod`. Types inferred via `z.infer<typeof schema>`.
- `@hono/zod-validator` provides `zValidator('json', schema)`, `zValidator('param', schema)`, `zValidator('query', schema)`.
- `validateParam` and `validateQuery` are generic helpers in `src/validation/middleware.ts`.

## Empty stubs (do not assume implemented)

- `src/middleware/auth.ts` — empty file
- `src/routes/index.ts` — empty file
- `src/routes/projects.ts` — empty file
- `src/db/migrate.ts` — empty file

## No test/lint/typecheck/build scripts

`package.json` has only the `dev` script. Do not assume `bun test`, `bun run lint`, `bun run typecheck`, or `bun run build` exist. Available CLI tools in `node_modules/.bin/`: `drizzle-kit`, `esbuild`, `tsx`.

## Not a git repo

`backend/` is not a git repository (no commits, untracked source). Do not rely on git from this directory.

## Cross-cutting

See workspace root `AGENTS.md` for frontend details, port assignments, and workspace-level conventions.