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
    const { and, eq } = await import('drizzle-orm');

    const csat = { rating, ratedAt: new Date().toISOString() };

    const existing = await db
      .select({ id: conversations.id, metadata: conversations.metadata })
      .from(conversations)
      .where(and(eq(conversations.demoType, demo), eq(conversations.sessionId, conversationId)))
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      const prevMeta = (row.metadata as Record<string, unknown>) ?? {};
      await db
        .update(conversations)
        .set({ metadata: { ...prevMeta, csat }, updatedAt: new Date() })
        .where(eq(conversations.id, row.id));
    } else {
      // Puede llegar antes de que logConversation() persista la primera fila
      // (después() se dispara casi al mismo tiempo que el evento `done` al cliente).
      await db.insert(conversations).values({
        demoType: demo,
        sessionId: conversationId,
        metadata: { csat },
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[csat] error:', err);
    return Response.json({ error: 'Error al guardar la valoración' }, { status: 500 });
  }
}
