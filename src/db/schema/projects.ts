import { pgTable, uuid, text, timestamp, varchar, index, jsonb, primaryKey, numeric, integer } from 'drizzle-orm/pg-core';
import { projectStatusEnum, projectRoleEnum, hotspotStatusEnum, operationalStatusEnum } from './enums';
import { geometryPoint } from './types';
import { organizations } from './organizations';
import { users } from './users';

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  code: varchar('code', { length: 50 }),
  region: varchar('region', { length: 100 }).notNull(),
  coordinates: geometryPoint('coordinates'),
  status: projectStatusEnum('status').default('planning').notNull(),
  managerUserId: uuid('manager_user_id').references(() => users.id),
  budgetCents: integer('budget_cents'),
  spentProgress: integer('spent_progress'),
  surfaceSqm: numeric('surface_sqm'),
  workersCount: integer('workers_count'),
  startDate: timestamp('start_date', { withTimezone: true }),
  expectedEndDate: timestamp('expected_end_date', { withTimezone: true }),
  complianceScore: numeric('compliance_score'),
  scheduleDeltaDays: integer('schedule_delta_days'),
  operationalStatus: operationalStatusEnum('operational_status').default('en_cours'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('project_org_id_idx').on(t.organizationId),
  index('project_coordinates_gist_idx').using('gist', t.coordinates),
]);

export const projectMembers = pgTable('project_members', {
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  projectRole: projectRoleEnum('project_role').notNull(),
}, (t) => [
  primaryKey({ columns: [t.projectId, t.userId] }),
  index('pm_user_idx').on(t.userId)
]);

export const zones = pgTable('zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(), 
  level: varchar('level', { length: 50 }),
}, (t) => [
  index('zone_project_idx').on(t.projectId)
]);

export const capturePoints = pgTable('capture_points', {
  id: uuid('id').primaryKey().defaultRandom(),
  zoneId: uuid('zone_id').references(() => zones.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  coordinates: geometryPoint('coordinates'),
}, (t) => [
  index('cp_zone_idx').on(t.zoneId),
  index('cp_coordinates_gist_idx').using('gist', t.coordinates)
]);

export const panoramas = pgTable('panoramas', {
  id: uuid('id').primaryKey().defaultRandom(),
  capturePointId: uuid('capture_point_id').references(() => capturePoints.id, { onDelete: 'cascade' }).notNull(),
  storagePath: text('storage_path').notNull(), 
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
  uploadedById: uuid('uploaded_by_id').references(() => users.id),
  metadata: jsonb('metadata'), 
}, (t) => [
  index('panorama_cp_idx').on(t.capturePointId)
]);

export const hotspots = pgTable('hotspots', {
  id: uuid('id').primaryKey().defaultRandom(),
  panoramaId: uuid('panorama_id').references(() => panoramas.id, { onDelete: 'cascade' }).notNull(),
  createdById: uuid('created_by_id').references(() => users.id),
  pitch: numeric('pitch').notNull(),
  yaw: numeric('yaw').notNull(),   
  title: text('title').notNull(),
  description: text('description'),
  status: hotspotStatusEnum('status').default('pending').notNull(), 
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()), 
}, (t) => [
  index('hotspot_panorama_idx').on(t.panoramaId)
]);