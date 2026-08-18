import { pgTable, uuid, text, timestamp, varchar, jsonb, index, uniqueIndex, unique, primaryKey } from 'drizzle-orm/pg-core';
import { orgRoleEnum, inviteStatusEnum } from './enums';
import { users } from './users';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  billingEmail: text('billing_email'),
  logo: text('logo'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('org_slug_idx').on(t.slug),
]);

export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: orgRoleEnum('role').notNull().default('member'),
  createdAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('organization_members_organization_id_user_id_unique').on(t.organizationId, t.userId),
  index('org_member_user_idx').on(t.userId),
]);

export const organizationInvitations = pgTable('organization_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  email: text('email').notNull(),
  role: orgRoleEnum('role').notNull().default('member'),
  token: text('token').notNull().unique(), 
  status: inviteStatusEnum('status').default('pending').notNull(),
  invitedById: uuid('invited_by_id').references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('invite_org_idx').on(t.organizationId),
  uniqueIndex('invite_email_org_idx').on(t.email, t.organizationId)
]);

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('team_org_idx').on(t.organizationId),
]);

export const teamMembers = pgTable('team_members', {
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.teamId, t.userId] }),
]);