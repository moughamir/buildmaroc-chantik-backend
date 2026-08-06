import { Hono } from 'hono';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { attendanceLogs } from '../db/schema';
import {
  validateAttendanceClockIn,
  validateAttendanceClockOut,
} from '../validation/middleware';
import type { AttendanceClockInInput, AttendanceClockOutInput } from '../validation/schemas';

export const attendanceRouter = new Hono();

attendanceRouter.post('/attendance/clock-in', validateAttendanceClockIn, async (c) => {
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

attendanceRouter.post('/attendance/clock-out', validateAttendanceClockOut, async (c) => {
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