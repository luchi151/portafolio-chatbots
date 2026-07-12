import { type NextRequest } from 'next/server';
import { extractBearerToken, verifyDemoToken } from '@/lib/jwt';

export const runtime = 'nodejs';

interface RequestBody {
  conversationId?: string;
  demo?: 'chatbot' | 'voicebot';
  rating?: 'up' | 'down';
}

export async function POST(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    await verifyDemoToken(token);
  } catch {
    return Response.json({ error: 'Token inválido o expirado' }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { conversationId, demo, rating } = body;
  if (!conversationId || (demo !== 'chatbot' && demo !== 'voicebot') || (rating !== 'up' && rating !== 'down')) {
    return Response.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'Base de datos no configurada' }, { status: 503 });
  }

  try {
    const { db } = await import('@/lib/db');
    const { conversations } = await import('@/lib/db/schema');
    const { sql } = await import('drizzle-orm');

    const csat = { rating, ratedAt: new Date().toISOString() };

    // Upsert on the (demoType, sessionId) unique index instead of a manual
    // select-then-branch — this can arrive before, after, or concurrently
    // with logConversation()'s own write to the same row (after() fires
    // close to the `done` event the client uses to reveal this prompt), so
    // the read-merge-write needs to be atomic. The `||` merge only ever
    // touches the `csat` key, so it can't clobber fields the chat route
    // writes concurrently (toolsUsed, sentiments, escalated, ...).
    await db
      .insert(conversations)
      .values({ demoType: demo, sessionId: conversationId, metadata: { csat } })
      .onConflictDoUpdate({
        target: [conversations.demoType, conversations.sessionId],
        set: {
          metadata: sql`coalesce(${conversations.metadata}, '{}'::jsonb) || ${JSON.stringify({ csat })}::jsonb`,
          updatedAt: new Date(),
        },
      });

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[csat] error:', err);
    return Response.json({ error: 'Error al guardar la valoración' }, { status: 500 });
  }
}
