import { pgTable, uuid, text, timestamp, varchar, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';
import { projects } from './projects';
import { rfiStatusEnum, changeOrderstatusEnum, equipmentStatusEnum } from './enums';

export const rfis = pgTable('rfis', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  rfiNumber: integer('rfi_number').notNull(),
  title: text('title').notNull(),
  question: text('question').notNull(),
  answer: text('answer'),
  status: rfiStatusEnum('status').default('draft').notNull(),
  createdById: uuid('created_by_id').references(() => users.id).notNull(),
  assignedToId: uuid('assigned_to_id').references(() => users.id),
  dueDate: timestamp('due_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('rfi_project_idx').on(t.projectId),
  uniqueIndex('rfi_project_number_idx').on(t.projectId, t.rfiNumber)
]);

export const changeOrders = pgTable('change_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  coNumber: varchar('co_number', { length: 50 }).notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  costImpactCents: integer('cost_impact_cents').default(0).notNull(),
  scheduleImpactDays: integer('schedule_impact_days').default(0).notNull(),
  status: changeOrderstatusEnum('status').default('pending').notNull(),
  requestedById: uuid('requested_by_id').references(() => users.id).notNull(),
  approvedById: uuid('approved_by_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('co_project_idx').on(t.projectId),
  uniqueIndex('co_number_project_idx').on(t.projectId, t.coNumber)
]);

export const equipment = pgTable('equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  currentProjectId: uuid('current_project_id').references(() => projects.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 100 }).notNull(),
  serialNumber: varchar('serial_number', { length: 100 }).unique().notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  status: equipmentStatusEnum('status').default('available').notNull(),
  lastServiceDate: timestamp('last_service_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('equipment_org_idx').on(t.organizationId),
  index('equipment_project_idx').on(t.currentProjectId)
]);

export const blueprintSheets = pgTable('blueprint_sheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  sheetNumber: varchar('sheetNumber', { length: 50 }).notNull(),
  title: text('title').notNull(),
  version: integer('version').default(1).notNull(),
  storagePath: text('storage_path').notNull(),
  uploadedById: uuid('uploaded_by_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('blueprint_project_idx').on(t.projectId),
  uniqueIndex('blueprint_sheet_version_idx').on(t.projectId, t.sheetNumber, t.version)
]);