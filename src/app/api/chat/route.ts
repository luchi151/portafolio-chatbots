import { after, type NextRequest } from 'next/server';
import { extractBearerToken, verifyDemoToken } from '@/lib/jwt';
import { notifyEscalation } from '@/lib/notifications/escalation';
import {
  runCollectionsAgent,
  selectProvider,
  type AgentEvent,
  type CustomerData,
  type HistoryItem,
  type Sentiment,
} from '@/lib/agents/collections-agent';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestBody {
  message: string;
  history?: HistoryItem[];
  conversationId?: string;
  demo?: 'chatbot' | 'voicebot';
}

// SSE frames = the agent's own events plus a transport-only `done` frame that
// hands the conversationId back to the browser so it can keep the thread alive.
type StreamEvent = AgentEvent | { type: 'done'; conversationId: string };

// ─── Conversation logging ───────────────────────────────────────────────────

async function logConversation(
  demo: 'chatbot' | 'voicebot',
  conversationId: string,
  customerId: string | null,
  channel: string,
  userMessage: string,
  assistantText: string,
  toolsUsed: string[],
  hasCustomer: boolean,
  escalated: boolean,
  escalationReason: string | null,
  escalationTicketId: string | null,
  sentiment: Sentiment,
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const { db } = await import('@/lib/db');
    const { conversations } = await import('@/lib/db/schema');
    const { sql } = await import('drizzle-orm');

    const newTurn = [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantText },
    ];

    // All turns of one session share `conversationId` — accumulate them onto a
    // single row instead of one row per turn, so the dashboard/table reflects
    // full conversations rather than disconnected message pairs. Upserting on
    // the (demoType, sessionId) unique index makes the read-merge-write atomic,
    // so it can't race with another writer (e.g. /api/csat) touching the same
    // row and end up creating a duplicate. The metadata expression merges over
    // the existing row with `||` rather than replacing it outright, so it can't
    // silently drop keys (like `csat`) that another writer already set.
    await db
      .insert(conversations)
      .values({
        demoType: demo,
        sessionId: conversationId,
        customerId,
        channel,
        messages: newTurn,
        metadata: {
          event: 'message_sent',
          toolsUsed,
          hasCustomer,
          escalated,
          escalationReason,
          escalationTicketId,
          sentiments: [sentiment],
        },
      })
      .onConflictDoUpdate({
        target: [conversations.demoType, conversations.sessionId],
        set: {
          // Keep the first value seen for the session — customerId/channel are
          // stable per session, so coalesce avoids nulling them out on a later
          // turn that happened to arrive without one.
          customerId: sql`coalesce(${conversations.customerId}, ${customerId})`,
          channel: sql`coalesce(${conversations.channel}, ${channel})`,
          messages: sql`coalesce(${conversations.messages}, '[]'::jsonb) || ${JSON.stringify(newTurn)}::jsonb`,
          metadata: sql`
            coalesce(${conversations.metadata}, '{}'::jsonb) || jsonb_build_object(
              'event', 'message_sent',
              'toolsUsed', coalesce(${conversations.metadata}->'toolsUsed', '[]'::jsonb) || ${JSON.stringify(toolsUsed)}::jsonb,
              'hasCustomer', coalesce((${conversations.metadata}->>'hasCustomer')::boolean, false) OR ${hasCustomer},
              'escalated', coalesce((${conversations.metadata}->>'escalated')::boolean, false) OR ${escalated},
              'escalationReason', CASE WHEN ${escalated} THEN ${escalationReason} ELSE (${conversations.metadata}->>'escalationReason') END,
              'escalationTicketId', CASE WHEN ${escalated} THEN ${escalationTicketId} ELSE (${conversations.metadata}->>'escalationTicketId') END,
              'sentiments', coalesce(${conversations.metadata}->'sentiments', '[]'::jsonb) || ${JSON.stringify([sentiment])}::jsonb
            )
          `,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.error('[chat] log error:', err);
  }
}

// ─── Customer loading ─────────────────────────────────────────────────────────

async function loadCustomer(customerId: string): Promise<CustomerData | null> {
  if (!customerId || customerId.startsWith('demo-') || !process.env.DATABASE_URL) return null;
  try {
    const { db } = await import('@/lib/db');
    const { customers } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    if (rows.length === 0) return null;
    const c = rows[0];
    return {
      name: c.name,
      debtAmount: Number(c.debtAmount),
      debtStatus: c.debtStatus ?? 'active',
      lastContactDate: c.lastContactDate
        ? new Date(c.lastContactDate).toLocaleDateString('es-CO')
        : null,
      notes: c.notes ?? null,
    };
  } catch {
    // DB unavailable — continue without customer data
    return null;
  }
}

// ─── Cross-channel memory ─────────────────────────────────────────────────────

const CHANNEL_LABEL: Record<string, string> = {
  web: 'chat web',
  voz: 'llamada de voz',
  whatsapp: 'WhatsApp',
  ivr: 'IVR telefónico',
};

function relativeTime(date: Date): string {
  const mins = Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000));
  if (mins < 60) return `hace ~${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `hace ~${hrs} h`;
  return `hace ~${Math.round(hrs / 24)} d`;
}

function truncate(s: string, n = 140): string {
  const t = s.trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

/**
 * Build the cross-channel memory block: the last turn of this customer's most
 * recent conversations on *other* sessions/channels, formatted compactly for
 * the system prompt. This is what makes the omnichannel continuity real — a
 * voice call can reference a plan the customer was just discussing on web.
 * Returns null when there's nothing to carry over.
 */
async function loadCrossChannelMemory(
  customerId: string,
  currentSessionId: string,
): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { db } = await import('@/lib/db');
    const { conversations } = await import('@/lib/db/schema');
    const { and, eq, ne, desc } = await import('drizzle-orm');

    const rows = await db
      .select({
        channel: conversations.channel,
        messages: conversations.messages,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(and(eq(conversations.customerId, customerId), ne(conversations.sessionId, currentSessionId)))
      .orderBy(desc(conversations.updatedAt))
      .limit(3);

    const lines: string[] = [];
    for (const row of rows) {
      const msgs = Array.isArray(row.messages)
        ? (row.messages as Array<{ role: string; content: string }>)
        : [];
      const lastUser = [...msgs].reverse().find((m) => m.role === 'user')?.content;
      const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')?.content;
      if (!lastUser && !lastAssistant) continue;

      const label = CHANNEL_LABEL[row.channel ?? ''] ?? row.channel ?? 'otro canal';
      const when = row.updatedAt ? relativeTime(new Date(row.updatedAt)) : 'recientemente';
      const parts: string[] = [];
      if (lastUser) parts.push(`Cliente: "${truncate(lastUser)}"`);
      if (lastAssistant) parts.push(`Agente: "${truncate(lastAssistant)}"`);
      lines.push(`- [${label}, ${when}] ${parts.join(' | ')}`);
    }

    return lines.length > 0 ? lines.join('\n') : null;
  } catch {
    // DB unavailable / query error — degrade to no cross-channel memory
    return null;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  let customerId = '';
  try {
    ({ customerId } = await verifyDemoToken(token));
  } catch {
    return Response.json({ error: 'Token inválido o expirado' }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { message, history = [], conversationId, demo = 'chatbot' } = body;
  if (!message?.trim()) {
    return Response.json({ error: 'Mensaje requerido' }, { status: 400 });
  }

  const newConversationId = conversationId ?? crypto.randomUUID();
  // Channel this turn came in on. In Fase 1 it's derived from the demo; the
  // Fase 3 channel switcher will set it explicitly (whatsapp/ivr/...).
  const channel = demo === 'voicebot' ? 'voz' : 'web';
  // Only real customers (UUID subjects) anchor an omnichannel thread — `demo-`
  // tokens have no customer row, so they get no cross-channel memory.
  const realCustomerId = customerId && !customerId.startsWith('demo-') ? customerId : null;

  const [customer, priorContext] = await Promise.all([
    loadCustomer(customerId),
    realCustomerId ? loadCrossChannelMemory(realCustomerId, newConversationId) : Promise.resolve(null),
  ]);

  const provider = selectProvider();
  if (!provider) {
    return buildStream((emit) => {
      emit({ type: 'text', text: '⚠️ Demo no configurada: agrega DEEPSEEK_API_KEY o GROQ_API_KEY en .env.local.' });
    }, newConversationId);
  }

  return buildStream(async (emit) => {
    const result = await runCollectionsAgent({
      provider,
      message: message.trim(),
      history,
      customer,
      priorContext,
      emit,
    });

    // result is null when the turn failed before producing a usable answer —
    // nothing worth persisting or notifying about.
    if (!result) return;

    after(() =>
      Promise.allSettled([
        logConversation(
          demo,
          newConversationId,
          realCustomerId,
          channel,
          message.trim(),
          result.assistantText,
          result.toolsUsed,
          !!customer,
          result.escalated,
          result.escalationReason,
          result.escalationTicketId,
          result.sentiment,
        ),
        result.escalated
          ? notifyEscalation(
              demo,
              newConversationId,
              result.escalationReason ?? 'No especificado',
              customer?.name ?? null,
              result.escalationTicketId,
            )
          : Promise.resolve(),
      ]),
    );
  }, newConversationId);
}

// ─── Stream builder ───────────────────────────────────────────────────────────

function buildStream(
  run: (emit: (evt: StreamEvent) => void) => void | Promise<void>,
  conversationId: string,
): Response {
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctrl) {
      const emit = (evt: StreamEvent) =>
        ctrl.enqueue(enc.encode('data: ' + JSON.stringify(evt) + '\n\n'));

      try {
        await run(emit);
      } catch {
        emit({ type: 'text', text: 'Error al procesar la solicitud.' });
      } finally {
        emit({ type: 'done', conversationId });
        ctrl.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
