import { after, type NextRequest } from 'next/server';

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
- No repitas una herramienta que ya ejecutaste en esta conversación si la información sigue siendo válida.
- Si el cliente disputa formalmente un cobro (ej. dice que ya pagó, que el monto está mal), pide explícitamente hablar con una persona/asesor humano, o plantea un caso que las demás herramientas no cubren (fraude, queja formal, negociación especial), usa la herramienta escalar_a_agente indicando el motivo y comunica al cliente que un asesor humano se pondrá en contacto.
- Este es un ambiente demo — los datos son ficticios y solo para demostración técnica.`;

const STATUS_MAP: Record<string, string> = {
  active: 'Al día',
  mora: 'En mora',
  acuerdo: 'Acuerdo de pago activo',
  pagado: 'Saldo pagado',
};

// ─── Tool definitions ─────────────────────────────────────────────────────────

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
  {
    type: 'function' as const,
    function: {
      name: 'escalar_a_agente',
      description: 'Transfiere la conversación a un asesor humano cuando el caso no puede resolverse con las demás herramientas (disputa de cobro, solicitud explícita de un humano, queja formal, fraude).',
      parameters: {
        type: 'object' as const,
        properties: {
          motivo: {
            type: 'string',
            description: 'Motivo breve de la escalación, ej. "disputa de pago ya realizado" o "solicitud explícita de agente humano".',
          },
        },
        required: ['motivo'],
      },
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
  demo?: 'chatbot' | 'voicebot';
}

type StreamEvent =
  | { type: 'status'; text: string }
  | { type: 'tool_start'; name: string }
  | { type: 'tool_call'; name: string; arguments: Record<string, unknown>; result: unknown }
  | { type: 'text'; text: string }
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
      const tasa = 0.025;
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

    case 'escalar_a_agente': {
      const motivo = typeof args.motivo === 'string' ? args.motivo : 'No especificado';
      return {
        escalado: true,
        ticket_id: `ESC-${Date.now().toString(36).toUpperCase()}`,
        motivo,
        mensaje: 'Caso transferido a un asesor humano. Contacto en las próximas 24 horas.',
      };
    }

    default:
      return { error: 'Herramienta no reconocida' };
  }
}

// ─── Conversation logging ───────────────────────────────────────────────────

async function logConversation(
  demo: 'chatbot' | 'voicebot',
  conversationId: string,
  userMessage: string,
  assistantText: string,
  toolsUsed: string[],
  hasCustomer: boolean,
  escalated: boolean,
  escalationReason: string | null,
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const { db } = await import('@/lib/db');
    const { conversations } = await import('@/lib/db/schema');
    const { and, eq } = await import('drizzle-orm');

    const newTurn = [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantText },
    ];

    // All turns of one session share `conversationId` — accumulate them onto a
    // single row instead of one row per turn, so the dashboard/table reflects
    // full conversations rather than disconnected message pairs.
    const existing = await db
      .select({ id: conversations.id, messages: conversations.messages, metadata: conversations.metadata })
      .from(conversations)
      .where(and(eq(conversations.demoType, demo), eq(conversations.sessionId, conversationId)))
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      const prevMessages = Array.isArray(row.messages) ? row.messages : [];
      const prevMeta =
        (row.metadata as {
          toolsUsed?: string[];
          hasCustomer?: boolean;
          escalated?: boolean;
          escalationReason?: string | null;
        } | null) ?? {};

      await db
        .update(conversations)
        .set({
          messages: [...prevMessages, ...newTurn],
          metadata: {
            event: 'message_sent',
            toolsUsed: [...(prevMeta.toolsUsed ?? []), ...toolsUsed],
            hasCustomer: prevMeta.hasCustomer || hasCustomer,
            // Escalation is sticky — once a session is escalated it stays flagged,
            // keeping the original reason unless a later turn escalates again.
            escalated: prevMeta.escalated || escalated,
            escalationReason: escalated ? escalationReason : (prevMeta.escalationReason ?? null),
          },
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, row.id));
    } else {
      await db.insert(conversations).values({
        demoType: demo,
        sessionId: conversationId,
        messages: newTurn,
        metadata: { event: 'message_sent', toolsUsed, hasCustomer, escalated, escalationReason },
      });
    }
  } catch (err) {
    console.error('[chat] log error:', err);
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

  const { message, history = [], conversationId, demo = 'chatbot' } = body;
  if (!message?.trim()) {
    return Response.json({ error: 'Mensaje requerido' }, { status: 400 });
  }

  // Load customer from DB when available
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
    return buildStream((emit) => {
      emit({ type: 'text', text: '⚠️ Demo no configurada: agrega DEEPSEEK_API_KEY o GROQ_API_KEY en .env.local.' });
    }, newConversationId);
  }

  const provider = deepseekKey
    ? { url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', key: deepseekKey }
    : { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.1-70b-versatile', key: groqKey! };

  return buildStream(async (emit) => {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` };
    const base = { model: provider.model, temperature: 0.4, max_tokens: 512 };

    // Step 1: non-streaming call with tools — model decides what to invoke
    emit({ type: 'status', text: 'Analizando consulta...' });

    const step1Res = await fetch(provider.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...base, messages, tools: TOOLS, tool_choice: 'auto' }),
    });

    if (!step1Res.ok) {
      emit({ type: 'text', text: 'No se pudo conectar con el agente.' });
      return;
    }

    const step1Data = (await step1Res.json()) as OAIResponse;
    const assistantMsg = step1Data.choices?.[0]?.message;
    const rawToolCalls = assistantMsg?.tool_calls ?? [];

    // No tool calls — model answered directly
    if (rawToolCalls.length === 0) {
      if (assistantMsg?.content) emit({ type: 'text', text: assistantMsg.content });
      after(() =>
        logConversation(demo, newConversationId, message.trim(), assistantMsg?.content ?? '', [], !!customer, false, null),
      );
      return;
    }

    // Step 2: execute tools one by one, emitting events as each completes
    const toolResultMsgs: LLMMessage[] = [];
    let escalated = false;
    let escalationReason: string | null = null;
    for (const tc of rawToolCalls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments) as Record<string, unknown>; } catch { /* ignore */ }

      if (tc.function.name === 'escalar_a_agente') {
        escalated = true;
        escalationReason = typeof args.motivo === 'string' ? args.motivo : 'No especificado';
      }

      emit({ type: 'tool_start', name: tc.function.name });
      const result = executeTool(tc.function.name, args, customer);
      emit({ type: 'tool_call', name: tc.function.name, arguments: args, result });
      toolResultMsgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
    }

    emit({ type: 'status', text: 'Generando respuesta...' });

    // Step 3: streaming call with tool results
    const messages2: LLMMessage[] = [
      ...messages,
      { role: 'assistant', content: assistantMsg?.content ?? null, tool_calls: rawToolCalls },
      ...toolResultMsgs,
    ];

    const step2Res = await fetch(provider.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...base, messages: messages2, stream: true }),
    });

    if (!step2Res.ok) {
      emit({ type: 'text', text: 'Error al generar la respuesta.' });
      return;
    }

    // Pipe streaming chunks
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
        } catch { /* ignore malformed chunks */ }
      }
    }

    after(() =>
      logConversation(
        demo,
        newConversationId,
        message.trim(),
        assistantText,
        rawToolCalls.map((tc) => tc.function.name),
        !!customer,
        escalated,
        escalationReason,
      ),
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
