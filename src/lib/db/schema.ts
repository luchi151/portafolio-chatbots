import { pgTable, uuid, text, numeric, timestamp, jsonb, integer, uniqueIndex, vector } from 'drizzle-orm/pg-core';
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

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    demoType: text('demo_type').notNull(),
    sessionId: text('session_id'),
    userId: uuid('user_id'),
    // Omnichannel thread anchor: the authenticated demo customer this
    // conversation belongs to (null for `demo-` tokens with no real customer).
    // Lets us reconstruct "everything this customer did across every channel".
    customerId: uuid('customer_id'),
    // Which channel this conversation came in on: web | voz | whatsapp | ivr.
    // Makes the omnichannel story queryable and drives the cross-channel memory
    // block injected into the agent.
    channel: text('channel'),
    messages: jsonb('messages').default(sql`'[]'::jsonb`),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // One row per (demoType, sessionId): chat/csat writers upsert on this
    // constraint instead of a manual select-then-insert/update, which closes
    // the race where two concurrent writers (e.g. a chat turn and a CSAT
    // rating landing at the same time) both miss each other's row and each
    // insert a duplicate. Postgres treats NULL session_id as distinct across
    // rows, so db_query rows (which never set sessionId) are unaffected.
    uniqueIndex('conversations_demo_session_idx').on(table.demoType, table.sessionId),
  ],
);

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

// FAQ/policy entries for the RAG support-chat demo. Each row is already a
// right-sized "chunk" — no chunking pipeline, entries are authored as
// standalone Q&A/policy snippets. Embedding dimension (512) must match the
// output_dimension requested from Voyage AI in src/lib/rag/embeddings.ts.
export const knowledgeBase = pgTable('knowledge_base', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 512 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey(),
  securityQuestion: text('security_question'),
  securityAnswerHash: text('security_answer_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
