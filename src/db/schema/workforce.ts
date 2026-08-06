import { pgTable, uuid, text, timestamp, varchar, integer, boolean, primaryKey, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';
import { projects } from './projects';
import { shiftStatusEnum, attendanceMethodEnum } from './enums';
import { geometryPoint } from './types';

export const workCrews = pgTable('work_crews', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 100 }).notNull(),
  trade: varchar('trade', { length: 50 }).notNull(),
  teamLeadId: uuid('team_lead_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('work_crew_org_idx').on(t.organizationId),
  index('work_crew_lead_idx').on(t.teamLeadId),
  index('work_crew_project_idx').on(t.projectId)
]);

export const crewMembers = pgTable('crew_members', {
  crewId: uuid('crew_id').references(() => workCrews.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.crewId, t.userId] }),
  index('crew_member_user_idx').on(t.userId)
]);

export const attendanceLogs = pgTable('attendance_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  clockInAt: timestamp('clock_in_at', { withTimezone: true }).notNull(),
  clockInLocation: geometryPoint('clock_in_location'),
  clockInMethod: attendanceMethodEnum('clock_in_method').default('gps_geofence').notNull(),
  clockOutAt: timestamp('clock_out_at', { withTimezone: true }),
  clockOutLocation: geometryPoint('clock_out_location'),
  status: shiftStatusEnum('status').default('clocked_in').notNull(),
  totalHours: integer('total_hours'),
  isFlagged: boolean('is_flagged').default(false).notNull(),
  flagReason: text('flag_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('attendance_org_idx').on(t.organizationId),
  index('attendance_user_idx').on(t.userId),
  index('attendance_project_idx').on(t.projectId),
  index('attendance_location_gist_idx').using('gist', t.clockInLocation)
]);

export const siteDailyLogs = pgTable('site_daily_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  submittedById: uuid('submitted_by_id').references(() => users.id).notNull(),
  logDate: timestamp('log_date', { withTimezone: true }).notNull(),
  weatherConditions: varchar('weather_conditions', { length: 100 }),
  workSummary: text('work_summary').notNull(),
  safetyIncidentsReported: boolean('safety_incidents_reported').default(false).notNull(),
  incidentDetails: text('incident_details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('site_log_project_idx').on(t.projectId),
  index('site_log_date_idx').on(t.logDate)
]);