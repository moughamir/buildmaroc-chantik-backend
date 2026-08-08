import type { Context } from 'hono';
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

/**
 * Replaces src/middleware/auth.ts (Supabase JWT). Auth is now handled by
 * better-auth: cookie sessions are resolved via auth.api.getSession, with a
 * dev-only x-user-id bypass that is NEVER read in production.
 *
 * Consumer convention: orgId null + list route → empty array; orgId null +
 * detail/mutation route → 401.
 */
export async function sessionMiddleware(c: SessionCtx, next: () => Promise<void>) {
  const isProd = process.env.NODE_ENV === 'production';

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

  // Dev-only bypass: hard-gated to non-production, header present AND no
  // Authorization header. Never evaluated in production.
  if (!isProd) {
    const devUserId = c.req.header('x-user-id');
    if (devUserId && !c.req.header('Authorization')) {
      // Tolerant org resolution: a dev id may not be a real user row (e.g.
      // 'super-admin' for admin routes) → orgId stays null rather than 500ing.
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
