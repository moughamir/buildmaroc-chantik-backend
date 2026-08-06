import { pgTable, uuid, varchar, boolean, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
import { resourceTypeEnum, permissionActionEnum } from './enums';
import { organizations } from './organizations';
import { users } from './users';

export const customRoles = pgTable('custom_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').references(() => customRoles.id, { onDelete: 'cascade' }).notNull(),
  resource: resourceTypeEnum('resource').notNull(),
  action: permissionActionEnum('action').notNull(),
}, (t) => [
  primaryKey({ columns: [t.roleId, t.resource, t.action] })
]);

export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleId: uuid('role_id').references(() => customRoles.id, { onDelete: 'cascade' }).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.roleId, t.organizationId] }),
]);
