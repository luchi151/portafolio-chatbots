import { after, type NextRequest } from 'next/server';
import { extractBearerToken, verifyDemoToken } from '@/lib/jwt';
import { retrieve, type RetrievedChunk } from '@/lib/rag/retrieve';
import { VoyageConfigError } from '@/lib/rag/embeddings';

export const runtime = 'nodejs';
export const maxDuration = 30;

const BASE_PROMPT = `Eres un asistente de soporte de una entidad financiera colombiana. Respondes preguntas generales sobre políticas de cobranza, pagos e intereses usando ÚNICAMENTE el CONTEXTO recuperado que se te entrega abajo.

Reglas estrictas:
- Responde solo con base en el CONTEXTO. No inventes cifras, plazos ni políticas que no estén ahí.
- Si el CONTEXTO no contiene información suficiente para responder, dilo explícitamente ("No tengo información sobre eso") y sugiere contactar a un asesor humano — no improvises una respuesta.
- Tono profesional y directo. Máximo 3-4 oraciones por respuesta.
- Este es un ambiente demo — los datos son ficticios y solo para demostración técnica.`;

interface HistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  message: string;
  history?: HistoryItem[];
  conversationId?: string;
}

type LLMMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type StreamEvent =
  | { type: 'status'; text: string }
  | { type: 'sources'; sources: RetrievedChunk[] }
  | { type: 'text'; text: string }
  | { type: 'done'; conversationId: string };

// ─── Conversation logging ───────────────────────────────────────────────────
// Simplified sibling of logConversation() in /api/chat/route.ts — same upsert
// pattern (onConflictDoUpdate over the (demoType, sessionId) unique index,
// jsonb `||` merge so concurrent writers can't clobber each other), but this
// demo has no tools/escalation/sentiment, so the metadata shape is smaller.
async function logSupportConversation(
  conversationId: string,
  userMessage: string,
  assistantText: string,
  sources: RetrievedChunk[],
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
    const sourceTitles = sources.map((s) => s.title);

    await db
      .insert(conversations)
      .values({
        demoType: 'support',
        sessionId: conversationId,
        messages: newTurn,
        metadata: { event: 'message_sent', sourcesUsed: sourceTitles },
      })
      .onConflictDoUpdate({
        target: [conversations.demoType, conversations.sessionId],
        set: {
          messages: sql`coalesce(${conversations.messages}, '[]'::jsonb) || ${JSON.stringify(newTurn)}::jsonb`,
          metadata: sql`
            coalesce(${conversations.metadata}, '{}'::jsonb) || jsonb_build_object(
              'event', 'message_sent',
              'sourcesUsed', coalesce(${conversations.metadata}->'sourcesUsed', '[]'::jsonb) || ${JSON.stringify(sourceTitles)}::jsonb
            )
          `,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.error('[support-chat] log error:', err);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

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

  const { message, history = [], conversationId } = body;
  if (!message?.trim()) {
    return Response.json({ error: 'Mensaje requerido' }, { status: 400 });
  }

  const newConversationId = conversationId ?? crypto.randomUUID();

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!process.env.VOYAGE_API_KEY) {
    return buildStream((emit) => {
      emit({ type: 'text', text: '⚠️ Demo no configurada: agrega VOYAGE_API_KEY en .env.local.' });
    }, newConversationId);
  }
  if (!deepseekKey && !groqKey) {
    return buildStream((emit) => {
      emit({ type: 'text', text: '⚠️ Demo no configurada: agrega DEEPSEEK_API_KEY o GROQ_API_KEY en .env.local.' });
    }, newConversationId);
  }

  const provider = deepseekKey
    ? { url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', key: deepseekKey }
    : { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.1-70b-versatile', key: groqKey! };

  return buildStream(async (emit) => {
    emit({ type: 'status', text: 'Buscando en la base de conocimiento...' });

    let sources: RetrievedChunk[];
    try {
      sources = await retrieve(message.trim());
    } catch (err) {
      emit({
        type: 'text',
        text:
          err instanceof VoyageConfigError
            ? '⚠️ Demo no configurada: agrega VOYAGE_API_KEY en .env.local.'
            : 'No se pudo consultar la base de conocimiento.',
      });
      return;
    }
    emit({ type: 'sources', sources });

    const context =
      sources.length > 0
        ? sources.map((s) => `### ${s.title}\n${s.content}`).join('\n\n')
        : '(sin resultados relevantes en la base de conocimiento)';

    const messages: LLMMessage[] = [
      { role: 'system', content: `${BASE_PROMPT}\n\nCONTEXTO RECUPERADO:\n${context}` },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message.trim() },
    ];

    emit({ type: 'status', text: 'Generando respuesta...' });

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` };
    const step2Res = await fetch(provider.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: provider.model, temperature: 0.2, max_tokens: 400, messages, stream: true }),
    });

    if (!step2Res.ok) {
      emit({ type: 'text', text: 'Error al generar la respuesta.' });
      return;
    }

    const reader = step2Res.body!.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let assistantText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const chunk = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> };
          const text = chunk.choices?.[0]?.delta?.content;
          if (text) {
            emit({ type: 'text', text });
            assistantText += text;
          }
        } catch {
          /* ignore malformed chunks */
        }
      }
    }

    after(() => logSupportConversation(newConversationId, message.trim(), assistantText, sources));
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
      const emit = (evt: StreamEvent) => ctrl.enqueue(enc.encode('data: ' + JSON.stringify(evt) + '\n\n'));

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
