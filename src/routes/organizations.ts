import { Hono } from 'hono';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import {
  organizations,
  organizationMembers,
  organizationInvitations,
  teams,
  teamMembers,
  users,
} from '../db/schema';
import {
  validateOrganization,
  validateUpdateOrganization,
  validateInvitationAccept,
  validateTeamCreate,
  validateTeamMemberAssign,
} from '../validation/middleware';
import type { OrganizationInput, UpdateOrganizationInput, InvitationAcceptInput, TeamCreateInput, TeamMemberAssignInput } from '../validation/schemas';

export const organizationsRouter = new Hono();

organizationsRouter.get('/', async (c) => {
  const userId = c.req.header('x-user-id') || '';
  const result = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      billingEmail: organizations.billingEmail,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .innerJoin(organizationMembers, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, userId));

  return c.json(result);
});

organizationsRouter.post('/', validateOrganization, async (c) => {
  const input = c.req.valid('json') as OrganizationInput;
  const [org] = await db.insert(organizations).values({
    name: input.name,
    slug: input.slug,
    billingEmail: input.billingEmail,
  }).returning();

  return c.json(org, 201);
});

organizationsRouter.get('/:orgId', async (c) => {
  const orgId = c.req.param('orgId');
  const org = await db.select().from(organizations).where(eq(organizations.id, orgId)).get();
  if (!org) return c.json({ error: 'Organization not found' }, 404);
  return c.json(org);
});

organizationsRouter.patch('/:orgId', validateUpdateOrganization, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as UpdateOrganizationInput;
  const [org] = await db.update(organizations)
    .set(input)
    .where(eq(organizations.id, orgId))
    .returning();

  if (!org) return c.json({ error: 'Organization not found' }, 404);
  return c.json(org);
});

organizationsRouter.delete('/:orgId', async (c) => {
  const orgId = c.req.param('orgId');
  const [org] = await db.delete(organizations).where(eq(organizations.id, orgId)).returning();
  if (!org) return c.json({ error: 'Organization not found' }, 404);
  return c.json({ deleted: true });
});

organizationsRouter.get('/:orgId/members', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db
    .select({
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      joinedAt: organizationMembers.joinedAt,
      email: users.email,
      fullName: users.fullName,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, orgId));

  return c.json(result);
});

organizationsRouter.post('/:orgId/invitations', validateOrganizationInvitation, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json');
  const token = crypto.randomUUID();
  const [invitation] = await db.insert(organizationInvitations).values({
    organizationId: orgId,
    email: input.email,
    role: input.role || 'member',
    token,
    status: 'pending',
    invitedById: input.invitedById,
    expiresAt: new Date(input.expiresAt),
  }).returning();

  return c.json(invitation, 201);
});

organizationsRouter.post('/invitations/accept', validateInvitationAccept, async (c) => {
  const input = c.req.valid('json') as InvitationAcceptInput;
  const [invitation] = await db
    .update(organizationInvitations)
    .set({ status: 'accepted' })
    .where(eq(organizationInvitations.token, input.token))
    .returning();

  if (!invitation) return c.json({ error: 'Invalid or expired invitation' }, 400);

  await db.insert(organizationMembers).values({
    organizationId: invitation.organizationId,
    userId: input.userId,
    role: invitation.role,
  });

  return c.json({ accepted: true });
});

organizationsRouter.delete('/:orgId/members/:userId', async (c) => {
  const orgId = c.req.param('orgId');
  const userId = c.req.param('userId');
  const [removed] = await db
    .delete(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, orgId),
      eq(organizationMembers.userId, userId),
    ))
    .returning();

  if (!removed) return c.json({ error: 'Member not found' }, 404);
  return c.json({ removed: true });
});

organizationsRouter.get('/:orgId/teams', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db.select().from(teams).where(eq(teams.organizationId, orgId));
  return c.json(result);
});

organizationsRouter.post('/:orgId/teams', validateTeamCreate, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as TeamCreateInput;
  const [team] = await db.insert(teams).values({
    organizationId: orgId,
    name: input.name,
  }).returning();

  return c.json(team, 201);
});

organizationsRouter.post('/:orgId/teams/:teamId/members', validateTeamMemberAssign, async (c) => {
  const orgId = c.req.param('orgId');
  const teamId = c.req.param('teamId');
  const input = c.req.valid('json') as TeamMemberAssignInput;
  const [member] = await db.insert(teamMembers).values({
    teamId,
    userId: input.userId,
  }).returning();

  return c.json(member, 201);
});