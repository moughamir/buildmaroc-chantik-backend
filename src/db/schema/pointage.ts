import { pgTable, uuid, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const tradeCatalog = pgTable('trade_catalog', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  icon: text('icon'),
  description: text('description'),
}, (t) => [
  index('trade_catalog_name_idx').on(t.name),
]);

export const subcontractors = pgTable('subcontractors', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  company: text('company').notNull(),
  specialty: text('specialty').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('subcontractor_project_idx').on(t.projectId),
]);

export const pointageRecords = pgTable('pointage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  tradeId: uuid('trade_id').references(() => tradeCatalog.id),
  count: integer('count').default(0).notNull(),
  isCompanyTrade: integer('is_company_trade').notNull(),
  subcontractorId: uuid('subcontractor_id').references(() => subcontractors.id, { onDelete: 'set null' }),
  isValidated: boolean('is_validated').default(false).notNull(),
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (t) => [
  index('pointage_project_date_idx').on(t.projectId, t.date),
  index('pointage_subcontractor_idx').on(t.subcontractorId),
]);
