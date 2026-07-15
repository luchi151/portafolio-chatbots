import { cosineDistance } from 'drizzle-orm';
import { db } from '@/lib/db';
import { knowledgeBase } from '@/lib/db/schema';
import { embedQuery } from './embeddings';

export interface RetrievedChunk {
  id: string;
  title: string;
  content: string;
  similarity: number;
}

const DEFAULT_K = 4;
// No formula derives this — tune against real questions once the KB is seeded.
// Below this, a match is noise (off-topic question) rather than relevant context.
export const MIN_SIMILARITY = 0.4;

export async function retrieve(query: string, k = DEFAULT_K): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(query);
  const distance = cosineDistance(knowledgeBase.embedding, queryEmbedding);

  const rows = await db
    .select({
      id: knowledgeBase.id,
      title: knowledgeBase.title,
      content: knowledgeBase.content,
      distance,
    })
    .from(knowledgeBase)
    .orderBy(distance)
    .limit(k);

  return rows
    .map((r) => ({ id: r.id, title: r.title, content: r.content, similarity: 1 - Number(r.distance) }))
    .filter((r) => r.similarity >= MIN_SIMILARITY);
}
