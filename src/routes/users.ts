import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { users, userPreferences, userSecurityLogs } from '../db/schema';
import {
  userProfileUpdateSchema,
  userPreferencesUpdateSchema,
  userSelectSchema,
  userPreferenceSelectSchema,
  userSecurityLogSelectSchema,
} from '../validation/schemas';
import type { UserProfileUpdateInput, UserPreferencesUpdateInput } from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';
import type { SessionVariables } from '../middleware/session';

// Mounted at /api/v1/users.
// L6e: OpenAPIHono + createRoute pattern with the shared 400 validation shape.
export const usersApp = new OpenAPIHono<{ Variables: SessionVariables }>({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const meGetRoute = createRoute({
  method: 'get',
  path: '/me',
  responses: {
    200: {
      description: 'Current user profile',
      content: { 'application/json': { schema: userSelectSchema } },
    },
    401: { description: 'Authentication required' },
    404: { description: 'User not found' },
  },
});

usersApp.openapi(meGetRoute, async (c) => {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'Authentication required' }, 401);
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json(user);
});

const mePatchRoute = createRoute({
  method: 'patch',
  path: '/me',
  request: {
    body: { content: { 'application/json': { schema: userProfileUpdateSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'User profile updated',
      content: { 'application/json': { schema: userSelectSchema } },
    },
    401: { description: 'Authentication required' },
    404: { description: 'User not found' },
  },
});

usersApp.openapi(mePatchRoute, async (c) => {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'Authentication required' }, 401);
  const input = c.req.valid('json') as UserProfileUpdateInput;
  const [user] = await db.update(users)
    .set(input)
    .where(eq(users.id, userId))
    .returning();

  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json(user);
});

const mePreferencesGetRoute = createRoute({
  method: 'get',
  path: '/me/preferences',
  responses: {
    200: {
      description: 'Current user preferences',
      content: { 'application/json': { schema: userPreferenceSelectSchema } },
    },
    401: { description: 'Authentication required' },
    404: { description: 'Preferences not found' },
  },
});

usersApp.openapi(mePreferencesGetRoute, async (c) => {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'Authentication required' }, 401);
  const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  if (!prefs) return c.json({ error: 'Preferences not found' }, 404);
  return c.json(prefs);
});

const mePreferencesPatchRoute = createRoute({
  method: 'patch',
  path: '/me/preferences',
  request: {
    body: { content: { 'application/json': { schema: userPreferencesUpdateSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'User preferences updated (or created when missing)',
      content: { 'application/json': { schema: userPreferenceSelectSchema } },
    },
    401: { description: 'Authentication required' },
  },
});

usersApp.openapi(mePreferencesPatchRoute, async (c) => {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'Authentication required' }, 401);
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

const meSecurityLogsGetRoute = createRoute({
  method: 'get',
  path: '/me/security-logs',
  responses: {
    200: {
      description: 'Security logs for the current user',
      content: { 'application/json': { schema: z.array(userSecurityLogSelectSchema) } },
    },
    401: { description: 'Authentication required' },
  },
});

usersApp.openapi(meSecurityLogsGetRoute, async (c) => {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'Authentication required' }, 401);
  const logs = await db.select().from(userSecurityLogs).where(eq(userSecurityLogs.userId, userId));
  return c.json(logs);
});
