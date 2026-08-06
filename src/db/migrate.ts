import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

// Migration runner: applies pending migrations from ./drizzle using the same
// `postgres` driver as the app. Run with `bun run db:migrate`.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    'DATABASE_URL is not set. Copy .env.example to .env and fill in your Supabase database URL, then retry.'
  );
  process.exit(1);
}

const migrationClient = postgres(databaseUrl, { max: 1 });
const db = drizzle(migrationClient);

try {
  await migrate(db, { migrationsFolder: path.join(import.meta.dir, '..', '..', 'drizzle') });
  console.log('✅ Migrations applied');
} catch (err) {
  console.error('❌ Migration failed. Check DATABASE_URL / DB reachability.');
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await migrationClient.end();
}
