import type { Context } from 'hono';
import { createHash } from 'node:crypto';
import { auth } from '../auth';
import { db } from '../db';
import { organizationMembers } from '../db/schema';
import { eq } from 'drizzle-orm';

// Hono Variables contract exposed to route consumers.
export type SessionVariables = {
  user: { id: string; email?: string | null; role?: string | null } | null;
  session: { id: string; activeOrganizationId?: string | null } | null;
  userId: string | null;
  orgId: string | null;
};

type SessionCtx = Context<{ Variables: SessionVariables }>;

// Deterministic UUID v5 (SHA-1, name-based, DNS namespace) so dev-bypass ids
// that aren't valid UUIDs (e.g. 'dev-admin-user', 'super-admin') stay
// type-safe when compared against uuid columns (users.id,
// organization_members.user_id, ...) — they simply match no rows instead of
// crashing Postgres with "invalid input syntax for type uuid".
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DNS_NAMESPACE = Buffer.from('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'hex');

function normalizeDevUserId(raw: string): string {
  if (UUID_RE.test(raw)) return raw;
  const digest = createHash('sha1')
    .update(DNS_NAMESPACE)
    .update(raw, 'utf8')
    .digest();
  digest[6] = (digest[6] & 0x0f) | 0x50; // version 5
  digest[8] = (digest[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = digest.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Replaces src/middleware/auth.ts (Supabase JWT). Auth is now handled by
 * better-auth: cookie sessions are resolved via auth.api.getSession, with an
 * opt-in dev-only x-user-id bypass (AUTH_DEV_BYPASS=1) that is NEVER read in
 * production.
 *
 * Consumer convention: orgId null + list route → empty array; orgId null +
 * detail/mutation route → 401.
 */
export async function sessionMiddleware(c: SessionCtx, next: () => Promise<void>) {
  const isProd = process.env.NODE_ENV === 'production';
  // Explicit opt-in flag: the x-user-id impersonation bypass is OFF unless
  // AUTH_DEV_BYPASS=1 is set AND the environment is non-production.
  const devBypassEnabled = process.env.AUTH_DEV_BYPASS === '1' && !isProd;

  const setAll = (
    userId: string | null,
    user: SessionVariables['user'],
    session: SessionVariables['session'],
    orgId: string | null,
  ) => {
    c.set('userId', userId);
    c.set('user', user);
    c.set('session', session);
    c.set('orgId', orgId);
  };

  let sessionData: { session: { id: string; activeOrganizationId?: string | null }; user: { id: string; email?: string | null; role?: string | null } } | null = null;
  try {
    const res = await auth.api.getSession({ headers: c.req.raw.headers });
    if (res?.session && res?.user) {
      sessionData = {
        session: res.session,
        user: res.user as SessionVariables['user'] & { id: string },
      };
    }
  } catch {
    // Invalid/expired cookie, malformed signature, etc. → treat as no session.
    sessionData = null;
  }

  if (sessionData) {
    setAll(
      sessionData.user.id,
      sessionData.user,
      sessionData.session,
      sessionData.session.activeOrganizationId ?? null,
    );
    await next();
    return;
  }

  // Dev-only bypass: requires AUTH_DEV_BYPASS=1 (explicit opt-in), a
  // non-production environment, the header present AND no Authorization
  // header. Never evaluated in production.
  if (devBypassEnabled) {
    const rawDevUserId = c.req.header('x-user-id');
    if (rawDevUserId && !c.req.header('Authorization')) {
      // Tolerant org resolution: a dev id may not be a real user row (e.g.
      // 'super-admin' for admin routes) → orgId stays null rather than 500ing.
      // Non-UUID ids are normalized to a deterministic UUID so downstream
      // uuid-column comparisons match no rows instead of crashing.
      const devUserId = normalizeDevUserId(rawDevUserId);
      let orgId: string | null = null;
      try {
        const [m] = await db
          .select({ organizationId: organizationMembers.organizationId })
          .from(organizationMembers)
          .where(eq(organizationMembers.userId, devUserId))
          .limit(1);
        orgId = m?.organizationId ?? null;
      } catch {
        orgId = null;
      }
      setAll(devUserId, { id: devUserId }, null, orgId);
      await next();
      return;
    }
  }

  setAll(null, null, null, null);
  await next();
}
