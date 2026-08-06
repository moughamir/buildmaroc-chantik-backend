import { Hono } from 'hono';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { users, userPreferences, userSecurityLogs } from '../db/schema';
import {
  validateUserProfileUpdate,
  validateUserPreferencesUpdate,
} from '../validation/middleware';
import type { UserProfileUpdateInput, UserPreferencesUpdateInput } from '../validation/schemas';

export const usersRouter = new Hono();

usersRouter.get('/me', async (c) => {
  const userId = c.req.header('x-user-id') || '';
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json(user);
});

usersRouter.patch('/me', validateUserProfileUpdate, async (c) => {
  const userId = c.req.header('x-user-id') || '';
  const input = c.req.valid('json') as UserProfileUpdateInput;
  const [user] = await db.update(users)
    .set(input)
    .where(eq(users.id, userId))
    .returning();

  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json(user);
});

usersRouter.get('/me/preferences', async (c) => {
  const userId = c.req.header('x-user-id') || '';
  const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  if (!prefs) return c.json({ error: 'Preferences not found' }, 404);
  return c.json(prefs);
});

usersRouter.patch('/me/preferences', validateUserPreferencesUpdate, async (c) => {
  const userId = c.req.header('x-user-id') || '';
  const input = c.req.valid('json') as UserPreferencesUpdateInput;
  const [prefs] = await db.update(userPreferences)
    .set(input)
    .where(eq(userPreferences.userId, userId))
    .returning();

  if (!prefs) {
    const [inserted] = await db.insert(userPreferences).values({
      userId,
      ...input,
    }).returning();
    return c.json(inserted);
  }

  return c.json(prefs);
});

usersRouter.get('/me/security-logs', async (c) => {
  const userId = c.req.header('x-user-id') || '';
  const logs = await db.select().from(userSecurityLogs).where(eq(userSecurityLogs.userId, userId));
  return c.json(logs);
});