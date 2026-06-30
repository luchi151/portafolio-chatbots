import { type NextRequest } from 'next/server';

export const runtime = 'nodejs';

type DemoType = 'chatbot' | 'voicebot' | 'db_query';

interface AnalyticsEvent {
  event: string;
  demo: DemoType;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  let body: AnalyticsEvent;
  try {
    body = (await req.json()) as AnalyticsEvent;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const { event, demo, sessionId, metadata } = body;
  if (!event || !demo) return Response.json({ ok: false }, { status: 400 });

  // Fire-and-forget DB write — don't block the response
  if (process.env.DATABASE_URL) {
    writeEvent(event, demo, sessionId, metadata).catch((err) => {
      console.error('[analytics] write error:', err);
    });
  }

  return Response.json({ ok: true });
}

async function writeEvent(
  event: string,
  demo: DemoType,
  sessionId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { db } = await import('@/lib/db');
  const { conversations } = await import('@/lib/db/schema');

  await db.insert(conversations).values({
    demoType: demo,
    sessionId: sessionId ?? null,
    messages: [],
    metadata: { event, ...metadata } as Record<string, unknown>,
  });
}
