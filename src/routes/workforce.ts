import { Hono } from 'hono';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import {
  workCrews,
  crewMembers,
  attendanceLogs,
  siteDailyLogs,
  users,
} from '../db/schema';
import {
  validateWorkCrew,
  validateCrewMember,
  validateSiteDailyLog,
} from '../validation/middleware';
import type { WorkCrewInput, CrewMemberInput, SiteDailyLogInput } from '../validation/schemas';

export const workforceRouter = new Hono();

workforceRouter.get('/:orgId/crews', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db
    .select({
      id: workCrews.id,
      name: workCrews.name,
      trade: workCrews.trade,
      teamLeadId: workCrews.teamLeadId,
      projectId: workCrews.projectId,
      createdAt: workCrews.createdAt,
      leadName: users.fullName,
    })
    .from(workCrews)
    .leftJoin(users, eq(users.id, workCrews.teamLeadId))
    .where(eq(workCrews.organizationId, orgId));

  return c.json(result);
});

workforceRouter.post('/:orgId/crews', validateWorkCrew, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as WorkCrewInput;
  const [crew] = await db.insert(workCrews).values({
    organizationId: orgId,
    projectId: input.projectId,
    name: input.name,
    trade: input.trade,
    teamLeadId: input.teamLeadId,
  }).returning();

  return c.json(crew, 201);
});

workforceRouter.post('/crews/:crewId/members', validateCrewMember, async (c) => {
  const crewId = c.req.param('crewId');
  const input = c.req.valid('json') as CrewMemberInput;
  const [member] = await db.insert(crewMembers).values({
    crewId,
    userId: input.userId,
  }).returning();

  return c.json(member, 201);
});

workforceRouter.get('/:projectId/attendance', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await db
    .select({
      id: attendanceLogs.id,
      userId: attendanceLogs.userId,
      clockInAt: attendanceLogs.clockInAt,
      clockOutAt: attendanceLogs.clockOutAt,
      totalHours: attendanceLogs.totalHours,
      isFlagged: attendanceLogs.isFlagged,
      flagReason: attendanceLogs.flagReason,
      status: attendanceLogs.status,
    })
    .from(attendanceLogs)
    .where(eq(attendanceLogs.projectId, projectId))
    .all();

  return c.json(result);
});

workforceRouter.post('/:projectId/daily-logs', validateSiteDailyLog, async (c) => {
  const projectId = c.req.param('projectId');
  const input = c.req.valid('json') as SiteDailyLogInput;
  const [log] = await db.insert(siteDailyLogs).values({
    projectId,
    submittedById: input.submittedById,
    logDate: new Date(input.logDate),
    weatherConditions: input.weatherConditions,
    workSummary: input.workSummary,
    safetyIncidentsReported: input.safetyIncidentsReported || false,
    incidentDetails: input.incidentDetails,
  }).returning();

  return c.json(log, 201);
});

workforceRouter.get('/:projectId/daily-logs', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await db.select().from(siteDailyLogs).where(eq(siteDailyLogs.projectId, projectId)).all();
  return c.json(result);
});