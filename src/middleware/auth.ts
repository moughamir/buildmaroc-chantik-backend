import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import type { Context } from 'hono';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

export async function authMiddleware(c: Context, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  const devUserId = c.req.header('x-user-id');

  if (!authHeader && devUserId) {
    c.set('userId', devUserId);
    c.set('user', { id: devUserId, email: null });
    await next();
    return;
  }

  if (!authHeader?.startsWith('Bearer ')) {
    c.set('userId', null);
    c.set('user', null);
    await next();
    return;
  }

  if (!supabase) {
    c.set('userId', null);
    c.set('user', null);
    await next();
    return;
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    c.set('userId', null);
    c.set('user', null);
    await next();
    return;
  }

  c.set('userId', user.id);
  c.set('user', user);
  await next();
}
