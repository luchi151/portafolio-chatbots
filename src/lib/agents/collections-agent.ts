// ─────────────────────────────────────────────────────────────────────────────
// Collections agent — transport-agnostic core shared by every channel.
//
// This module owns the "brain" of the cobranza agent: the system prompt, the
// tool definitions, the local tool executor, sentiment classification, and the
// two-step tool-calling loop. It knows nothing about HTTP, SSE, JWTs or the
// database — it takes a message + history + the authenticated customer, and
// reports progress through an `emit(event)` callback so each transport can
// render those events its own way:
//   - the web demos (/api/chat) map them to Server-Sent Events
//   - the Asterisk voice-bridge (Fase 2) will map `text` events to TTS audio
// Keeping a single source of truth here means the phone channel and the web
// channel run the *exact same* prompt and tools — they can't drift apart.
// ─────────────────────────────────────────────────────────────────────────────

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

export const STATUS_MAP: Record<string, string> = {
  active: 'Al día',
  mora: 'En mora',
  acuerdo: 'Acuerdo de pago activo',
  pagado: 'Saldo pagado',
};

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const TOOLS = [
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

export interface CustomerData {
  name: string;
  debtAmount: number;
  debtStatus: string;
  lastContactDate: string | null;
  notes: string | null;
}

export type HistoryItem = { role: 'user' | 'assistant'; content: string };

export type Sentiment = 'positive' | 'neutral' | 'negative' | 'frustrated';
const SENTIMENTS: Sentiment[] = ['positive', 'neutral', 'negative', 'frustrated'];

export interface Provider {
  url: string;
  model: string;
  key: string;
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

// Progress events the agent reports as it works. Deliberately a subset of what
// any transport ultimately emits — e.g. the SSE `done` frame with the
// conversationId is a transport concern and lives in the route, not here.
export type AgentEvent =
  | { type: 'status'; text: string }
  | { type: 'tool_start'; name: string }
  | { type: 'tool_call'; name: string; arguments: Record<string, unknown>; result: unknown }
  | { type: 'text'; text: string }
  | { type: 'sentiment'; value: Sentiment };

// The persisted outcome of one turn. Returned to the transport so it can log /
// notify. `null` (see runCollectionsAgent) means the turn failed before
// producing anything worth persisting.
export interface AgentResult {
  assistantText: string;
  toolsUsed: string[];
  escalated: boolean;
  escalationReason: string | null;
  escalationTicketId: string | null;
  sentiment: Sentiment;
}

// ─── Provider selection ────────────────────────────────────────────────────────

/**
 * Pick the LLM provider from the environment, preferring DeepSeek then Groq.
 * Returns null when neither key is configured, so the caller can surface a
 * "demo not configured" message without logging a bogus turn.
 */
export function selectProvider(): Provider | null {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (deepseekKey) {
    return { url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', key: deepseekKey };
  }
  if (groqKey) {
    return { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.1-70b-versatile', key: groqKey };
  }
  return null;
}

// ─── System prompt ─────────────────────────────────────────────────────────────

/**
 * Build the system prompt, appending the authenticated customer's data block
 * when a customer is present so the model answers with real figures, and the
 * cross-channel memory block (`priorContext`) when the same customer has recent
 * activity on other channels — this is what lets a phone call reference what
 * the customer just did on web/WhatsApp.
 */
export function buildSystemPrompt(
  customer: CustomerData | null,
  priorContext?: string | null,
): string {
  let prompt = BASE_PROMPT;

  if (customer) {
    const amount = customer.debtAmount.toLocaleString('es-CO');
    prompt += `\n\nDATOS DEL CLIENTE AUTENTICADO:
- Nombre: ${customer.name}
- Saldo actual: $${amount} COP
- Estado de cuenta: ${STATUS_MAP[customer.debtStatus] ?? customer.debtStatus}
- Último contacto: ${customer.lastContactDate ?? 'Sin registro'}
- Notas: ${customer.notes ?? 'Sin notas'}

Usa exclusivamente estos datos. No corrijas ni redondees las cifras.`;
  }

  if (priorContext) {
    prompt += `\n\nCONTEXTO DE CANALES PREVIOS (interacciones recientes de ESTE cliente en otros canales). Úsalo para dar continuidad natural cuando sea relevante — por ejemplo, retomar un plan de pago que ya venía consultando. NO lo repitas literal ni lo menciones si no viene al caso:
${priorContext}`;
  }

  return prompt;
}

// ─── Sentiment classification ──────────────────────────────────────────────────

async function classifySentiment(message: string, provider: Provider): Promise<Sentiment> {
  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0,
        max_tokens: 5,
        messages: [
          {
            role: 'system',
            content:
              'Clasifica el sentimiento del mensaje de un cliente de cobranza. Responde con UNA sola palabra en inglés: positive, neutral, negative o frustrated.',
          },
          { role: 'user', content: message },
        ],
      }),
    });
    if (!res.ok) return 'neutral';
    const data = (await res.json()) as OAIResponse;
    const raw = (data.choices?.[0]?.message?.content ?? '').trim().toLowerCase();
    return SENTIMENTS.find((s) => raw.includes(s)) ?? 'neutral';
  } catch {
    return 'neutral';
  }
}

// ─── Tool executor ────────────────────────────────────────────────────────────

export function executeTool(
  name: string,
  args: Record<string, unknown>,
  customer: CustomerData | null,
): unknown {
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

// ─── Agent loop ─────────────────────────────────────────────────────────────────

/**
 * Run one turn of the collections agent: classify sentiment, let the model pick
 * tools, execute them locally, then stream the final answer. Progress is
 * reported through `emit`; the returned AgentResult carries what the caller
 * should persist. Returns `null` when the turn failed before producing a
 * usable answer (provider unreachable), so the caller skips logging.
 */
export async function runCollectionsAgent(params: {
  provider: Provider;
  message: string;
  history: HistoryItem[];
  customer: CustomerData | null;
  priorContext?: string | null;
  emit: (evt: AgentEvent) => void;
}): Promise<AgentResult | null> {
  const { provider, message, history, customer, priorContext, emit } = params;

  const messages: LLMMessage[] = [
    { role: 'system', content: buildSystemPrompt(customer, priorContext) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` };
  const base = { model: provider.model, temperature: 0.4, max_tokens: 512 };

  // Step 1: non-streaming call with tools — model decides what to invoke.
  // Sentiment classification runs in parallel so it adds no perceived latency.
  emit({ type: 'status', text: 'Analizando consulta...' });

  const [step1Res, sentiment] = await Promise.all([
    fetch(provider.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...base, messages, tools: TOOLS, tool_choice: 'auto' }),
    }),
    classifySentiment(message, provider),
  ]);
  emit({ type: 'sentiment', value: sentiment });

  if (!step1Res.ok) {
    emit({ type: 'text', text: 'No se pudo conectar con el agente.' });
    return null;
  }

  const step1Data = (await step1Res.json()) as OAIResponse;
  const assistantMsg = step1Data.choices?.[0]?.message;
  const rawToolCalls = assistantMsg?.tool_calls ?? [];

  // No tool calls — model answered directly
  if (rawToolCalls.length === 0) {
    const assistantText = assistantMsg?.content ?? '';
    if (assistantMsg?.content) emit({ type: 'text', text: assistantMsg.content });
    return {
      assistantText,
      toolsUsed: [],
      escalated: false,
      escalationReason: null,
      escalationTicketId: null,
      sentiment,
    };
  }

  // Step 2: execute tools one by one, emitting events as each completes
  const toolResultMsgs: LLMMessage[] = [];
  let escalated = false;
  let escalationReason: string | null = null;
  let escalationTicketId: string | null = null;
  for (const tc of rawToolCalls) {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(tc.function.arguments) as Record<string, unknown>; } catch { /* ignore */ }

    if (tc.function.name === 'escalar_a_agente') {
      escalated = true;
      escalationReason = typeof args.motivo === 'string' ? args.motivo : 'No especificado';
    }

    emit({ type: 'tool_start', name: tc.function.name });
    const result = executeTool(tc.function.name, args, customer);
    if (tc.function.name === 'escalar_a_agente') {
      const ticket = (result as { ticket_id?: unknown }).ticket_id;
      if (typeof ticket === 'string') escalationTicketId = ticket;
    }
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
    return null;
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

  return {
    assistantText,
    toolsUsed: rawToolCalls.map((tc) => tc.function.name),
    escalated,
    escalationReason,
    escalationTicketId,
    sentiment,
  };
}
