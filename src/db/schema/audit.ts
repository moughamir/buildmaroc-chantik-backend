import { pgTable, uuid, text, timestamp, varchar, jsonb, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(), 
  entityType: varchar('entity_type', { length: 50 }).notNull(), 
  entityId: uuid('entity_id').notNull(),
  payload: jsonb('payload'),
  clientGuid: uuid('client_guid'), 
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('audit_org_idx').on(t.organizationId),
  index('audit_client_guid_idx').on(t.clientGuid) 
]);