import { pgTable, uuid, text, numeric, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: text('document_id').unique().notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  debtAmount: numeric('debt_amount', { precision: 10, scale: 2 }).notNull(),
  debtStatus: text('debt_status').default('active'),
  lastContactDate: timestamp('last_contact_date', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  demoType: text('demo_type').notNull(),
  sessionId: text('session_id'),
  userId: uuid('user_id'),
  messages: jsonb('messages').default(sql`'[]'::jsonb`),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  fileUrl: text('file_url').notNull(),
  parsedContent: text('parsed_content'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const demoSessions = pgTable('demo_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent'),
  requestsCount: integer('requests_count').default(1),
  lastRequestAt: timestamp('last_request_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey(),
  securityQuestion: text('security_question'),
  securityAnswerHash: text('security_answer_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
