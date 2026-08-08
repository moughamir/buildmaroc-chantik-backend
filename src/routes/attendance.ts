import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { attendanceLogs } from '../db/schema';
import {
  attendanceClockInSchema,
  attendanceClockOutSchema,
  attendanceLogSelectSchema,
} from '../validation/schemas';
import type { AttendanceClockInInput, AttendanceClockOutInput } from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';

// Mounted at /api/v1.
// L6e: OpenAPIHono + createRoute pattern with the shared 400 validation shape.
export const attendanceApp = new OpenAPIHono({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const clockInRoute = createRoute({
  method: 'post',
  path: '/attendance/clock-in',
  request: {
    body: { content: { 'application/json': { schema: attendanceClockInSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Attendance log created (clocked in)',
      content: { 'application/json': { schema: attendanceLogSelectSchema } },
    },
  },
});

attendanceApp.openapi(clockInRoute, async (c) => {
  const input = c.req.valid('json') as AttendanceClockInInput;
  const [log] = await db.insert(attendanceLogs).values({
    organizationId: input.organizationId,
    userId: input.userId,
    projectId: input.projectId,
    clockInAt: input.clockInAt ? new Date(input.clockInAt) : new Date(),
    clockInLocation: input.clockInLocation,
    clockInMethod: input.clockInMethod || 'gps_geofence',
  }).returning();

  return c.json(log, 201);
});

const clockOutRoute = createRoute({
  method: 'post',
  path: '/attendance/clock-out',
  request: {
    body: { content: { 'application/json': { schema: attendanceClockOutSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Attendance log updated (clocked out)',
      content: { 'application/json': { schema: attendanceLogSelectSchema } },
    },
    400: {
      description: 'Already clocked out',
    },
    404: {
      description: 'Attendance log not found',
    },
  },
});

attendanceApp.openapi(clockOutRoute, async (c) => {
  const input = c.req.valid('json') as AttendanceClockOutInput;
  const [log] = await db.select().from(attendanceLogs).where(eq(attendanceLogs.id, input.id)).limit(1);
  if (!log) return c.json({ error: 'Attendance log not found' }, 404);
  if (log.clockOutAt) return c.json({ error: 'Already clocked out' }, 400);

  const clockOutAt = input.clockOutAt ? new Date(input.clockOutAt) : new Date();
  const clockInAt = new Date(log.clockInAt);
  const totalHours = Math.round((clockOutAt.getTime() - clockInAt.getTime()) / (1000 * 60 * 60) * 100) / 100;

  const [updated] = await db.update(attendanceLogs)
    .set({
      clockOutAt,
      clockOutLocation: input.clockOutLocation,
      totalHours,
      status: 'clocked_out',
    })
    .where(eq(attendanceLogs.id, input.id))
    .returning();

  return c.json(updated);
});
