/**
 * Fase 1 migration: adds the omnichannel thread columns to `conversations`.
 *
 *   customer_id UUID  — anchors every conversation to the demo customer, so a
 *                       call on Asterisk can reconstruct what the same customer
 *                       did on web/WhatsApp (the cross-channel memory).
 *   channel     TEXT  — web | voz | whatsapp | ivr; makes the omnichannel
 *                       dimension queryable.
 *
 * Run with: pnpm tsx src/lib/db/migrate-omnichannel.ts
 * Idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS) — safe to
 * re-run. Left committed (like migrate-knowledge-base.ts) so a fresh Supabase
 * project can be brought up to date. `drizzle-kit push` is broken for this
 * project, so schema changes go through raw SQL like this.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('ERROR: DATABASE_URL is not set.');
  process.exit(1);
}
const client = postgres(url, { prepare: false });

async function migrate() {
  await client.unsafe('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS customer_id UUID;');
  console.log('  conversations.customer_id ready');

  await client.unsafe('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS channel TEXT;');
  console.log('  conversations.channel ready');

  // Index the thread anchor: cross-channel memory filters by customer_id on
  // every agent turn, so this keeps that lookup off a full-table scan.
  await client.unsafe(
    'CREATE INDEX IF NOT EXISTS conversations_customer_idx ON conversations (customer_id);',
  );
  console.log('  conversations_customer_idx ready');

  console.log('\nMigration complete ✓');
  await client.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
