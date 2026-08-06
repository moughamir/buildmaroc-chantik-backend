import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  createdById: uuid('created_by_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (t) => [
  index('note_project_idx').on(t.projectId),
  index('note_created_by_idx').on(t.createdById),
]);
