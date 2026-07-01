import { type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const BASE_PROMPT = `Eres un agente de cobranza Inteligente de una entidad financiera colombiana. Tu única función es gestionar información sobre deudas y planes de pago.

Reglas estrictas:
- Saluda al cliente por su nombre si está disponible, y usa un tono profesional y directo.
- Responde ÚNICAMENTE sobre: saldo de deuda, estado de cuenta, cuotas, fechas de pago y opciones de acuerdo o refinanciación.
- Si el cliente pregunta algo ajeno a su deuda o pagos, responde exactamente: "Disculpa, solo puedo asistirte con información sobre tu deuda y opciones de pago."
- Tono profesional y directo. Sin frases de relleno, saludos exagerados ni despedidas elaboradas.
- Máximo 2-4 oraciones por respuesta, salvo que el cliente solicite un detalle específico como un desglose de cuotas.
- Usa SIEMPRE los datos del cliente provistos — nunca inventes ni estimes cifras.
- Este es un ambiente demo — los datos son ficticios y solo para demostración técnica.`;

type HistoryItem = { role: 'user' | 'assistant'; content: string };

interface RequestBody {
  message: string;
  history?: HistoryItem[];
  conversationId?: string;
}

type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'done'; conversationId: string };

export async function POST(req: NextRequest) {
  // Auth check — verify JWT and extract customerId
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  let customerId = '';
  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? 'dev-secret-change-in-prod',
    );
    const { payload } = await jwtVerify(auth.slice(7), secret);
    customerId = (payload.customerId as string | undefined) ?? '';
  } catch {
    return Response.json({ error: 'Token inválido o expirado' }, { status: 401 });
  }

  // Parse body
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

  // Build system prompt — inject real customer data when available
  let systemPrompt = BASE_PROMPT;
  if (customerId && !customerId.startsWith('demo-') && process.env.DATABASE_URL) {
    try {
      const { db } = await import('@/lib/db');
      const { customers } = await import('@/lib/db/schema');
      const { eq } = await import('drizzle-orm');
      const rows = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (rows.length > 0) {
        const c = rows[0];
        const amount = Number(c.debtAmount).toLocaleString('es-CO');
        const STATUS: Record<string, string> = {
          active: 'Al día',
          mora: 'En mora',
          acuerdo: 'Acuerdo de pago activo',
          pagado: 'Saldo pagado',
        };
        const lastContact = c.lastContactDate
          ? new Date(c.lastContactDate).toLocaleDateString('es-CO')
          : 'Sin registro';
        systemPrompt += `\n\nDATOS REALES DEL CLIENTE AUTENTICADO:
- Nombre: ${c.name}
- Saldo actual: $${amount} COP
- Estado de cuenta: ${STATUS[c.debtStatus ?? ''] ?? c.debtStatus}
- Último contacto: ${lastContact}
- Notas internas: ${c.notes ?? 'Sin notas'}

Usa exclusivamente estos datos cuando el cliente pregunte por su cuenta. No corrijas ni redondees las cifras.`;
      }
    } catch {
      // DB unavailable — continue with base prompt
    }
  }

  const newConversationId = conversationId ?? crypto.randomUUID();

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message.trim() },
  ];

  // Try DeepSeek first, fallback to Groq
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!deepseekKey && !groqKey) {
    return streamText(
      'data: ' +
        JSON.stringify({
          type: 'text',
          text: '⚠️ Demo no configurada: agrega DEEPSEEK_API_KEY o GROQ_API_KEY en .env.local para activar el chatbot.',
        } satisfies StreamEvent) +
        '\n\n' +
        'data: ' +
        JSON.stringify({ type: 'done', conversationId: newConversationId } satisfies StreamEvent) +
        '\n\n',
    );
  }

  if (deepseekKey) {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({ model: 'deepseek-chat', stream: true, messages, max_tokens: 512, temperature: 0.4 }),
    });

    if (upstream.ok) {
      return pipeOpenAIStream(upstream, newConversationId);
    }
  }

  if (groqKey) {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        stream: true,
        messages,
        max_tokens: 512,
        temperature: 0.4,
      }),
    });

    if (upstream.ok) {
      return pipeOpenAIStream(upstream, newConversationId);
    }
  }

  return Response.json({ error: 'No se pudo conectar con el LLM' }, { status: 502 });
}

function streamText(text: string): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(ctrl) {
      ctrl.enqueue(enc.encode(text));
      ctrl.close();
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}

function pipeOpenAIStream(upstream: Response, conversationId: string): Response {
  const enc = new TextEncoder();
  const reader = upstream.body!.getReader();
  const dec = new TextDecoder();

  const stream = new ReadableStream({
    async start(ctrl) {
      let buf = '';
      try {
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
              const chunk = JSON.parse(raw) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const text = chunk.choices?.[0]?.delta?.content;
              if (text) {
                ctrl.enqueue(
                  enc.encode('data: ' + JSON.stringify({ type: 'text', text } satisfies StreamEvent) + '\n\n'),
                );
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }

        ctrl.enqueue(
          enc.encode(
            'data: ' + JSON.stringify({ type: 'done', conversationId } satisfies StreamEvent) + '\n\n',
          ),
        );
      } catch {
        ctrl.enqueue(
          enc.encode(
            'data: ' +
              JSON.stringify({ type: 'text', text: '\n\nError al procesar la respuesta.' } satisfies StreamEvent) +
              '\n\n',
          ),
        );
      } finally {
        ctrl.close();
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
