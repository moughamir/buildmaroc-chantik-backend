import type { Context } from 'hono';
import type { SessionVariables } from './session';

type AdminCtx = Context<{ Variables: SessionVariables }>;

/**
 * Platform-admin guard, applied to /api/v1/admin/* only.
 * - dev: x-user-id === 'super-admin' allows (mirrors the session middleware bypass).
 * - prod: only a real session whose user.role === 'super-admin' allows.
 * Everything else → 403.
 */
export async function adminGuard(c: AdminCtx, next: () => Promise<void>) {
  const user = c.get('user');
  const isProd = process.env.NODE_ENV === 'production';
  const devBypass = !isProd && c.req.header('x-user-id') === 'super-admin';

  if (devBypass || user?.role === 'super-admin') {
    await next();
    return;
  }

  return c.json({ error: 'Forbidden' }, 403);
}
