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

const STATUS_MAP: Record<string, string> = {
  active: 'Al día',
  mora: 'En mora',
  acuerdo: 'Acuerdo de pago activo',
  pagado: 'Saldo pagado',
};

// ─── Tool definitions (OpenAI-compatible function calling) ────────────────────

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'consultar_cuenta',
      description: 'Consulta el saldo actual, estado de cuenta y último contacto del cliente autenticado.',
      parameters: { type: 'object' as const, properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calcular_plan_pago',
      description: 'Calcula las cuotas mensuales para un plan de pago del saldo actual del cliente.',
      parameters: {
        type: 'object' as const,
        properties: {
          cuotas: {
            type: 'integer',
            description: 'Número de cuotas mensuales',
            enum: [3, 6, 12, 24],
          },
        },
        required: ['cuotas'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'verificar_mora',
      description: 'Verifica si la cuenta está en mora y el estado detallado del cliente.',
      parameters: { type: 'object' as const, properties: {}, required: [] },
    },
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomerData {
  name: string;
  debtAmount: number;
  debtStatus: string;
  lastContactDate: string | null;
  notes: string | null;
}

interface OAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OAIResponse {
  choices?: Array<{
    message?: {
      role: string;
      content: string | null;
      tool_calls?: OAIToolCall[];
    };
    finish_reason?: string;
  }>;
}

type LLMMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string | null; tool_calls?: OAIToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };

type HistoryItem = { role: 'user' | 'assistant'; content: string };

interface RequestBody {
  message: string;
  history?: HistoryItem[];
  conversationId?: string;
}

type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; name: string; arguments: Record<string, unknown>; result: unknown }
  | { type: 'done'; conversationId: string };

// ─── Tool executor ────────────────────────────────────────────────────────────

function executeTool(name: string, args: Record<string, unknown>, customer: CustomerData | null): unknown {
  const debt = customer?.debtAmount ?? 2_500_000;
  const status = customer?.debtStatus ?? 'mora';

  switch (name) {
    case 'consultar_cuenta':
      return {
        nombre: customer?.name ?? 'Cliente Demo',
        saldo_cop: debt,
        estado: STATUS_MAP[status] ?? status,
        ultimo_contacto: customer?.lastContactDate ?? 'Sin registro',
      };

    case 'calcular_plan_pago': {
      const cuotas = (args.cuotas as number) ?? 6;
      const tasa = 0.025; // 2.5% mensual
      const cuotaMensual = (debt * tasa * Math.pow(1 + tasa, cuotas)) / (Math.pow(1 + tasa, cuotas) - 1);
      return {
        cuotas,
        cuota_mensual_cop: Math.round(cuotaMensual),
        total_cop: Math.round(cuotaMensual * cuotas),
        tasa_mensual: '2.5%',
      };
    }

    case 'verificar_mora':
      return {
        en_mora: status === 'mora',
        estado: STATUS_MAP[status] ?? status,
        notas: customer?.notes ?? null,
      };

    default:
      return { error: 'Herramienta no reconocida' };
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
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

  // Load customer data from DB when available
  let customer: CustomerData | null = null;
  let systemPrompt = BASE_PROMPT;
  if (customerId && !customerId.startsWith('demo-') && process.env.DATABASE_URL) {
    try {
      const { db } = await import('@/lib/db');
      const { customers } = await import('@/lib/db/schema');
      const { eq } = await import('drizzle-orm');
      const rows = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (rows.length > 0) {
        const c = rows[0];
        customer = {
          name: c.name,
          debtAmount: Number(c.debtAmount),
          debtStatus: c.debtStatus ?? 'active',
          lastContactDate: c.lastContactDate
            ? new Date(c.lastContactDate).toLocaleDateString('es-CO')
            : null,
          notes: c.notes ?? null,
        };
        const amount = customer.debtAmount.toLocaleString('es-CO');
        systemPrompt += `\n\nDATOS DEL CLIENTE AUTENTICADO:
- Nombre: ${customer.name}
- Saldo actual: $${amount} COP
- Estado de cuenta: ${STATUS_MAP[customer.debtStatus] ?? customer.debtStatus}
- Último contacto: ${customer.lastContactDate ?? 'Sin registro'}
- Notas: ${customer.notes ?? 'Sin notas'}

Usa exclusivamente estos datos. No corrijas ni redondees las cifras.`;
      }
    } catch {
      // DB unavailable — continue with base prompt
    }
  }

  const newConversationId = conversationId ?? crypto.randomUUID();

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message.trim() },
  ];

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!deepseekKey && !groqKey) {
    return buildPlainStream(
      '⚠️ Demo no configurada: agrega DEEPSEEK_API_KEY o GROQ_API_KEY en .env.local.',
      newConversationId,
    );
  }

  const provider = deepseekKey
    ? { url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', key: deepseekKey }
    : { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.1-70b-versatile', key: groqKey! };

  const basePayload = { model: provider.model, temperature: 0.4, max_tokens: 512 };
  const authHeader = { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` };

  // Step 1: Non-streaming call with tools to detect which tools the model wants to invoke
  let step1Data: OAIResponse;
  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({ ...basePayload, messages, tools: TOOLS, tool_choice: 'auto' }),
    });
    if (!res.ok) throw new Error(`LLM error ${res.status}`);
    step1Data = (await res.json()) as OAIResponse;
  } catch {
    return Response.json({ error: 'No se pudo conectar con el LLM' }, { status: 502 });
  }

  const assistantMsg = step1Data.choices?.[0]?.message;
  const rawToolCalls = assistantMsg?.tool_calls ?? [];

  // If the model answered directly without tools, stream that response
  if (rawToolCalls.length === 0 && assistantMsg?.content) {
    return buildPlainStream(assistantMsg.content, newConversationId);
  }

  // Step 2: Execute tools and collect stream events + tool result messages
  const toolEvents: StreamEvent[] = [];
  const toolResultMsgs: LLMMessage[] = [];

  for (const tc of rawToolCalls) {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(tc.function.arguments) as Record<string, unknown>; } catch { /* malformed args */ }

    const result = executeTool(tc.function.name, args, customer);
    toolEvents.push({ type: 'tool_call', name: tc.function.name, arguments: args, result });
    toolResultMsgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
  }

  // Step 3: Streaming call with tool results injected
  const messages2: LLMMessage[] = [
    ...messages,
    { role: 'assistant', content: assistantMsg?.content ?? null, tool_calls: rawToolCalls },
    ...toolResultMsgs,
  ];

  let step2Res: Response;
  try {
    step2Res = await fetch(provider.url, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({ ...basePayload, messages: messages2, stream: true }),
    });
    if (!step2Res.ok) throw new Error(`LLM stream error ${step2Res.status}`);
  } catch {
    return Response.json({ error: 'No se pudo conectar con el LLM' }, { status: 502 });
  }

  return buildAgentStream(toolEvents, step2Res, newConversationId);
}

// ─── Stream builders ──────────────────────────────────────────────────────────

function buildPlainStream(text: string, conversationId: string): Response {
  const enc = new TextEncoder();
  const payload =
    'data: ' + JSON.stringify({ type: 'text', text } satisfies StreamEvent) + '\n\n' +
    'data: ' + JSON.stringify({ type: 'done', conversationId } satisfies StreamEvent) + '\n\n';
  const stream = new ReadableStream({
    start(ctrl) { ctrl.enqueue(enc.encode(payload)); ctrl.close(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}

function buildAgentStream(toolEvents: StreamEvent[], upstream: Response, conversationId: string): Response {
  const enc = new TextEncoder();
  const reader = upstream.body!.getReader();
  const dec = new TextDecoder();

  const stream = new ReadableStream({
    async start(ctrl) {
      // Emit tool call events before the text response
      for (const evt of toolEvents) {
        ctrl.enqueue(enc.encode('data: ' + JSON.stringify(evt) + '\n\n'));
      }

      // Pipe the LLM streaming response
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
              const chunk = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> };
              const text = chunk.choices?.[0]?.delta?.content;
              if (text) {
                ctrl.enqueue(enc.encode('data: ' + JSON.stringify({ type: 'text', text } satisfies StreamEvent) + '\n\n'));
              }
            } catch { /* ignore malformed chunks */ }
          }
        }
        ctrl.enqueue(enc.encode('data: ' + JSON.stringify({ type: 'done', conversationId } satisfies StreamEvent) + '\n\n'));
      } catch {
        ctrl.enqueue(enc.encode('data: ' + JSON.stringify({ type: 'text', text: '\n\nError al procesar la respuesta.' } satisfies StreamEvent) + '\n\n'));
      } finally {
        ctrl.close();
      }
    },
    cancel() { void reader.cancel(); },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
