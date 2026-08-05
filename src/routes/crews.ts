import { Hono } from 'hono';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { crewMembers } from '../db/schema';
import { validateCrewMember } from '../validation/middleware';
import type { CrewMemberInput } from '../validation/schemas';

export const crewsRouter = new Hono();

crewsRouter.post('/:crewId/members', validateCrewMember, async (c) => {
  const crewId = c.req.param('crewId');
  const input = c.req.valid('json') as CrewMemberInput;
  const [member] = await db.insert(crewMembers).values({
    crewId,
    userId: input.userId,
  }).returning();

  return c.json(member, 201);
});