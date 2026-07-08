import { type NextRequest } from 'next/server';
import { validateSQL } from '@/lib/sql-validator';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface LLMQueryResponse {
  sql: string;
  sampleData: Array<Record<string, unknown>>;
  visualization: {
    type: 'table' | 'bar' | 'line' | 'pie';
    xAxis?: string;
    yAxis?: string;
    title?: string;
  };
}

const SCHEMA = `customers (
  id UUID, document_id TEXT, name TEXT, phone TEXT, email TEXT,
  debt_amount NUMERIC(10,2),   -- monto en COP
  debt_status TEXT,             -- 'active' | 'paid' | 'overdue' | 'in_collection'
  last_contact_date TIMESTAMPTZ, notes TEXT, created_at TIMESTAMPTZ
)
conversations (id UUID, demo_type TEXT, session_id TEXT, created_at TIMESTAMPTZ)`;

const SYSTEM_PROMPT = `Eres un experto en SQL para bases de datos de cobranza financiera en Colombia.

Schema:
${SCHEMA}

Para la pregunta genera:
1. Una query SELECT de PostgreSQL válida
2. Datos de ejemplo realistas (5-8 filas) con montos en COP
3. El tipo de visualización más apropiado

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional):
{
  "sql": "SELECT ...",
  "sampleData": [{"columna": "valor"}],
  "visualization": {
    "type": "table",
    "xAxis": "nombre_columna",
    "yAxis": "columna_numerica",
    "title": "Título del gráfico"
  }
}

Reglas: Solo SELECT. PostgreSQL. sampleData debe coincidir con columnas del SELECT. Montos realistas en COP (500000-50000000). Nombres colombianos.`;

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-in-prod');
    await jwtVerify(auth.slice(7), secret);
  } catch {
    return Response.json({ error: 'Token inválido' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { question?: string } | null;
  const question = body?.question?.trim();
  if (!question) return Response.json({ error: 'Pregunta requerida' }, { status: 400 });

  // Step 1: Generate SQL + sample data via LLM
  const llmResult = await callLLM(question);
  if (!llmResult) {
    return Response.json({ error: 'No se pudo conectar con el LLM. Configura DEEPSEEK_API_KEY o GROQ_API_KEY.' }, { status: 503 });
  }

  // Step 2: Validate SQL
  const validation = validateSQL(llmResult.sql);
  if (!validation.valid) {
    return Response.json({ error: `SQL inválido: ${validation.error}` }, { status: 400 });
  }

  // Step 3: Execute against real DB or use LLM sample data
  const startTime = Date.now();
  let results = llmResult.sampleData;
  let usedRealDB = false;

  if (process.env.DATABASE_URL) {
    try {
      results = await executeSQL(llmResult.sql);
      usedRealDB = true;
    } catch (err) {
      console.error('[db/query] DB error, using sample data:', err);
    }
  }

  const executionTime = Date.now() - startTime;

  logConversation(llmResult.sql, results.length, executionTime, usedRealDB, llmResult.visualization.type);

  return Response.json({
    sql: llmResult.sql,
    results,
    usedRealDB,
    visualization: {
      type: llmResult.visualization.type,
      config: {
        xAxis: llmResult.visualization.xAxis,
        yAxis: llmResult.visualization.yAxis,
        title: llmResult.visualization.title ?? question,
      },
    },
    metadata: { executionTime: usedRealDB ? executionTime : 0, rowCount: results.length },
  });
}

// ─── Conversation logging ───────────────────────────────────────────────────

function logConversation(
  sql: string,
  rowCount: number,
  executionTime: number,
  usedRealDB: boolean,
  visualizationType: string,
): void {
  if (!process.env.DATABASE_URL) return;
  void (async () => {
    try {
      const { db } = await import('@/lib/db');
      const { conversations } = await import('@/lib/db/schema');
      await db.insert(conversations).values({
        demoType: 'db_query',
        messages: [],
        metadata: { event: 'query_executed', sql, rowCount, executionTime, usedRealDB, visualizationType },
      });
    } catch (err) {
      console.error('[db/query] log error:', err);
    }
  })();
}

async function callLLM(question: string): Promise<LLMQueryResponse | null> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: question },
  ];

  if (deepseekKey) {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return parseJSON(data.choices?.[0]?.message?.content ?? '');
    }
  }

  if (groqKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return parseJSON(data.choices?.[0]?.message?.content ?? '');
    }
  }

  return null;
}

function parseJSON(raw: string): LLMQueryResponse | null {
  try {
    // Strip markdown code blocks if present
    const clean = raw.replace(/```(?:json)?\n?/g, '').trim();
    const parsed = JSON.parse(clean) as Partial<LLMQueryResponse>;
    if (!parsed.sql || !Array.isArray(parsed.sampleData) || !parsed.visualization) return null;
    return parsed as LLMQueryResponse;
  } catch {
    return null;
  }
}

async function executeSQL(sqlString: string): Promise<Record<string, unknown>[]> {
  const { db } = await import('@/lib/db');
  const { sql } = await import('drizzle-orm');
  const result = await db.execute(sql.raw(sqlString));
  return Array.from(result) as Record<string, unknown>[];
}
