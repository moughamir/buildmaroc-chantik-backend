import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { db } from '../db';
import { crewMembers } from '../db/schema';
import { crewMemberSchema, crewMemberSelectSchema } from '../validation/schemas';
import type { CrewMemberInput } from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';
import type { SessionVariables } from '../middleware/session';
import { requireCrewInOrg } from '../middleware/tenant';

// Mounted at /api/v1/crews.
// L6e: OpenAPIHono + createRoute pattern with the shared 400 validation shape.
export const crewsApp = new OpenAPIHono<{ Variables: SessionVariables }>({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const crewMemberCreateRoute = createRoute({
  method: 'post',
  path: '/{crewId}/members',
  tags: ['crews'],
  request: {
    params: z.object({ crewId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: crewMemberSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Crew member assigned',
      content: { 'application/json': { schema: crewMemberSelectSchema } },
    },
  },
});

crewsApp.openapi(crewMemberCreateRoute, async (c) => {
  const crewId = c.req.param('crewId');
  const denied = await requireCrewInOrg(c, crewId);
  if (denied) return denied;
  const input = c.req.valid('json') as CrewMemberInput;
  const [member] = await db.insert(crewMembers).values({
    crewId,
    userId: input.userId,
  }).returning();

  return c.json(member, 201);
});
