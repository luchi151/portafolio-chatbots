/**
 * One-off migration: enables pgvector and creates the knowledge_base table
 * used by the /demos/support RAG demo.
 * Run with: pnpm tsx src/lib/db/migrate-knowledge-base.ts
 * Idempotent — safe to re-run (IF NOT EXISTS everywhere). Left committed (unlike
 * ad-hoc schema patches applied before) so a fresh Supabase project can be
 * brought up to date by running this script.
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
  await client.unsafe('CREATE EXTENSION IF NOT EXISTS vector;');
  console.log('  pgvector extension ready');

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding VECTOR(512) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  console.log('  knowledge_base table ready');

  console.log('\nMigration complete ✓');
  await client.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
