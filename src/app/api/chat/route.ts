import { type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SYSTEM_PROMPT = `Eres un asistente de cobranza inteligente para una empresa financiera colombiana.
Tu rol es ayudar a los clientes a entender su situación de deuda, opciones de pago y acuerdos de refinanciación.

Instrucciones:
- Responde siempre en español, con tono profesional pero empático
- Si el cliente menciona dificultades económicas, muestra comprensión y explora opciones de pago
- Puedes hablar de saldos, fechas de pago, historial y opciones de acuerdo
- No inventes datos específicos de clientes — si no tienes la información, indícalo
- Mantén las respuestas concisas (máximo 3-4 párrafos)
- Este es un ambiente demo — los datos son ficticios y solo para demostración técnica`;

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
  // Auth check
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? 'dev-secret-change-in-prod',
    );
    await jwtVerify(auth.slice(7), secret);
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

  const newConversationId = conversationId ?? crypto.randomUUID();

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
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
      body: JSON.stringify({ model: 'deepseek-chat', stream: true, messages, max_tokens: 1024, temperature: 0.7 }),
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
        max_tokens: 1024,
        temperature: 0.7,
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
