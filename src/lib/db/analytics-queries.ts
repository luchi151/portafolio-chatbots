import { conversations, customers } from './schema';

// db/index.ts throws at import time if DATABASE_URL is unset, so it's
// imported lazily inside getDb() — matches the pattern already used in the
// route handlers — letting the try/catch below fall back to empty data.
async function getDb() {
  const { db } = await import('./index');
  return db;
}

export type DemoType = 'chatbot' | 'voicebot' | 'db_query';

export interface DemoCount {
  demoType: string;
  count: number;
}

export interface DailyActivityPoint {
  day: string; // 'YYYY-MM-DD'
  chatbot: number;
  voicebot: number;
  db_query: number;
}

export interface ToolUsageCount {
  tool: string;
  count: number;
}

export interface DbQueryStats {
  totalQueries: number;
  avgExecutionTimeMs: number;
}

export interface EscalationStats {
  totalEscalated: number;
  escalationRate: number; // % of chatbot + voicebot conversations
}

export interface CsatStats {
  totalRated: number;
  thumbsUp: number;
  satisfactionRate: number; // % of thumbsUp over totalRated
}

export interface SentimentStats {
  positive: number;
  neutral: number;
  negative: number;
  frustrated: number;
  total: number;
  negativeRate: number; // % of negative+frustrated over total
}

export type Semaforo = 'verde' | 'amarillo' | 'rojo';

export interface ConversationSentimentSummary {
  id: string;
  demoType: string;
  createdAt: Date | null;
  messageCount: number;
  avgScore: number; // 0 (frustrated) - 3 (positive)
  state: Semaforo;
}

export interface ConversationSentimentStats {
  verde: number;
  amarillo: number;
  rojo: number;
  total: number;
  recent: ConversationSentimentSummary[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationDetail {
  id: string;
  demoType: string;
  createdAt: Date | null;
  state: Semaforo;
  escalated: boolean;
  escalationReason: string | null;
  escalationTicketId: string | null;
  messages: ConversationMessage[];
}

// deltaPct is a relative % change (current vs previous) for count-based
// metrics, but a percentage-POINT difference for rate-based metrics like
// csatSatisfaction — callers must know which one they're rendering.
export interface TrendPoint {
  current: number;
  previous: number;
  deltaPct: number | null; // null when there's no previous-period data to compare against
}

export interface TrendStats {
  totalInteractions: TrendPoint;
  escalations: TrendPoint;
  csatSatisfaction: TrendPoint;
}

export interface AnalyticsDashboardData {
  demoCounts: DemoCount[];
  dailyActivity: DailyActivityPoint[];
  toolUsage: ToolUsageCount[];
  dbStats: DbQueryStats;
  escalationStats: EscalationStats;
  csatStats: CsatStats;
  sentimentStats: SentimentStats;
  conversationSentimentStats: ConversationSentimentStats;
  trend: TrendStats;
}

// Higher score = better tone. Used to average a conversation's per-message
// sentiments into a single semaforo verdict, rather than tracking a separate
// end-of-conversation state.
const SENTIMENT_SCORE: Record<string, number> = { frustrated: 0, negative: 1, neutral: 2, positive: 3 };

function classifySemaforo(avgScore: number): Semaforo {
  if (avgScore >= 2) return 'verde';
  if (avgScore >= 1) return 'amarillo';
  return 'rojo';
}

interface ConversationRow {
  id: string;
  demoType: string;
  createdAt: Date | null;
  metadata: unknown;
}

// Row volume for a portfolio demo is small — fetch every row ONCE here and
// derive all dashboard numbers from that single set in JS, instead of each
// stat re-querying the whole table (this page is force-dynamic and used to
// issue 8 separate full-table scans per load).
async function fetchConversationRows(): Promise<ConversationRow[]> {
  try {
    const db = await getDb();
    return await db
      .select({
        id: conversations.id,
        demoType: conversations.demoType,
        createdAt: conversations.createdAt,
        metadata: conversations.metadata,
      })
      .from(conversations);
  } catch (err) {
    console.error('[analytics] fetchConversationRows error:', err);
    return [];
  }
}

function computeDemoCounts(rows: ConversationRow[]): DemoCount[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.demoType, (counts.get(r.demoType) ?? 0) + 1);
  return Array.from(counts, ([demoType, count]) => ({ demoType, count }));
}

function computeDailyActivity(rows: ConversationRow[], days: number): DailyActivityPoint[] {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const byDay = new Map<string, DailyActivityPoint>();
  for (const r of rows) {
    if (!r.createdAt || r.createdAt < since) continue;
    const day = r.createdAt.toISOString().slice(0, 10);
    const point = byDay.get(day) ?? { day, chatbot: 0, voicebot: 0, db_query: 0 };
    if (r.demoType === 'chatbot' || r.demoType === 'voicebot' || r.demoType === 'db_query') {
      point[r.demoType] += 1;
    }
    byDay.set(day, point);
  }
  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
}

function computeToolUsage(rows: ConversationRow[]): ToolUsageCount[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.demoType !== 'chatbot') continue;
    const tools = (r.metadata as { toolsUsed?: unknown } | null)?.toolsUsed;
    if (!Array.isArray(tools)) continue;
    for (const t of tools) {
      if (typeof t !== 'string') continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return Array.from(counts, ([tool, count]) => ({ tool, count })).sort((a, b) => b.count - a.count);
}

function computeDbQueryStats(rows: ConversationRow[]): DbQueryStats {
  let totalQueries = 0;
  let totalTime = 0;
  let timedCount = 0;
  for (const r of rows) {
    if (r.demoType !== 'db_query') continue;
    totalQueries += 1;
    const meta = r.metadata as { executionTime?: unknown; usedRealDB?: unknown } | null;
    if (meta?.usedRealDB && typeof meta.executionTime === 'number') {
      totalTime += meta.executionTime;
      timedCount += 1;
    }
  }
  return { totalQueries, avgExecutionTimeMs: timedCount > 0 ? Math.round(totalTime / timedCount) : 0 };
}

function computeEscalationStats(rows: ConversationRow[]): EscalationStats {
  let conversational = 0;
  let escalated = 0;
  for (const r of rows) {
    if (r.demoType !== 'chatbot' && r.demoType !== 'voicebot') continue;
    conversational += 1;
    const meta = r.metadata as { escalated?: unknown } | null;
    if (meta?.escalated === true) escalated += 1;
  }
  return {
    totalEscalated: escalated,
    escalationRate: conversational > 0 ? Math.round((escalated / conversational) * 100) : 0,
  };
}

function computeCsatStats(rows: ConversationRow[]): CsatStats {
  let totalRated = 0;
  let thumbsUp = 0;
  for (const r of rows) {
    if (r.demoType !== 'chatbot' && r.demoType !== 'voicebot') continue;
    const rating = (r.metadata as { csat?: { rating?: unknown } } | null)?.csat?.rating;
    if (rating !== 'up' && rating !== 'down') continue;
    totalRated += 1;
    if (rating === 'up') thumbsUp += 1;
  }
  return { totalRated, thumbsUp, satisfactionRate: totalRated > 0 ? Math.round((thumbsUp / totalRated) * 100) : 0 };
}

function computeSentimentStats(rows: ConversationRow[]): SentimentStats {
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  let frustrated = 0;
  for (const r of rows) {
    if (r.demoType !== 'chatbot' && r.demoType !== 'voicebot') continue;
    const sentiments = (r.metadata as { sentiments?: unknown } | null)?.sentiments;
    if (!Array.isArray(sentiments)) continue;
    for (const s of sentiments) {
      if (s === 'positive') positive += 1;
      else if (s === 'neutral') neutral += 1;
      else if (s === 'negative') negative += 1;
      else if (s === 'frustrated') frustrated += 1;
    }
  }
  const total = positive + neutral + negative + frustrated;
  return {
    positive,
    neutral,
    negative,
    frustrated,
    total,
    negativeRate: total > 0 ? Math.round(((negative + frustrated) / total) * 100) : 0,
  };
}

function computeConversationSentimentStats(rows: ConversationRow[], recentLimit: number): ConversationSentimentStats {
  const summaries: ConversationSentimentSummary[] = [];
  for (const r of rows) {
    if (r.demoType !== 'chatbot' && r.demoType !== 'voicebot') continue;
    const sentiments = (r.metadata as { sentiments?: unknown } | null)?.sentiments;
    if (!Array.isArray(sentiments) || sentiments.length === 0) continue;

    let sum = 0;
    let count = 0;
    for (const s of sentiments) {
      const score = SENTIMENT_SCORE[s as string];
      if (score === undefined) continue;
      sum += score;
      count += 1;
    }
    if (count === 0) continue;

    const avgScore = sum / count;
    summaries.push({
      id: r.id,
      demoType: r.demoType,
      createdAt: r.createdAt,
      messageCount: count,
      avgScore,
      state: classifySemaforo(avgScore),
    });
  }

  // Urgency first (rojo needs attention before amarillo/verde), then most
  // recent within the same tier — this list drives a "panel de atención",
  // not a chronological feed.
  const STATE_PRIORITY: Record<Semaforo, number> = { rojo: 0, amarillo: 1, verde: 2 };
  summaries.sort((a, b) => {
    const byState = STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state];
    if (byState !== 0) return byState;
    return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
  });

  let verde = 0;
  let amarillo = 0;
  let rojo = 0;
  for (const s of summaries) {
    if (s.state === 'verde') verde += 1;
    else if (s.state === 'amarillo') amarillo += 1;
    else rojo += 1;
  }

  return { verde, amarillo, rojo, total: summaries.length, recent: summaries.slice(0, recentLimit) };
}

// Period-over-period comparison so StatsCards can show a ↑/↓ trend, not just
// a raw total. Window length matches the activity chart's `days` so both
// reflect the same "recent" definition.
function computeTrend(rows: ConversationRow[], days: number): TrendStats {
  const now = Date.now();
  const periodMs = days * 24 * 60 * 60 * 1000;
  const currentStart = now - periodMs;
  const previousStart = now - 2 * periodMs;

  let curTotal = 0;
  let prevTotal = 0;
  let curEsc = 0;
  let prevEsc = 0;
  let curCsatUp = 0;
  let curCsatTotal = 0;
  let prevCsatUp = 0;
  let prevCsatTotal = 0;

  for (const r of rows) {
    const t = r.createdAt?.getTime();
    if (t === undefined) continue;
    const isCurrent = t >= currentStart;
    const isPrevious = t >= previousStart && t < currentStart;
    if (!isCurrent && !isPrevious) continue;

    if (isCurrent) curTotal += 1;
    else prevTotal += 1;

    if (r.demoType !== 'chatbot' && r.demoType !== 'voicebot') continue;
    const meta = r.metadata as { escalated?: unknown; csat?: { rating?: unknown } } | null;

    if (meta?.escalated === true) {
      if (isCurrent) curEsc += 1;
      else prevEsc += 1;
    }

    const rating = meta?.csat?.rating;
    if (rating === 'up' || rating === 'down') {
      if (isCurrent) {
        curCsatTotal += 1;
        if (rating === 'up') curCsatUp += 1;
      } else {
        prevCsatTotal += 1;
        if (rating === 'up') prevCsatUp += 1;
      }
    }
  }

  // A previous-period base under this size makes the % change swing wildly
  // (e.g. 1→5 reads as "+400%") and reads as noise, not a real trend — treat
  // it the same as "no previous data" rather than showing a misleading spike.
  const MIN_SAMPLE = 3;
  const relativePct = (a: number, b: number): number | null =>
    b < MIN_SAMPLE ? null : Math.round(((a - b) / b) * 100);
  const curCsatRate = curCsatTotal > 0 ? Math.round((curCsatUp / curCsatTotal) * 100) : 0;
  const prevCsatRate = prevCsatTotal > 0 ? Math.round((prevCsatUp / prevCsatTotal) * 100) : 0;

  return {
    totalInteractions: { current: curTotal, previous: prevTotal, deltaPct: relativePct(curTotal, prevTotal) },
    escalations: { current: curEsc, previous: prevEsc, deltaPct: relativePct(curEsc, prevEsc) },
    csatSatisfaction: {
      current: curCsatRate,
      previous: prevCsatRate,
      deltaPct: prevCsatTotal < MIN_SAMPLE ? null : curCsatRate - prevCsatRate,
    },
  };
}

// ─── Conversation detail (public, redacted) ──────────────────────────────────
// The panel is public and unauthenticated, but this is a debt-collection demo
// — transcripts can contain the customer's name, debt amount or document id.
// Best-effort redaction here (not full NLP) is enough for fictional seed data
// and keeps the raw text out of the response entirely rather than trusting the
// client to hide it.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONEY_RE = /\$?\s?\d{1,3}(?:[.,]\d{3})+(?:\s?cop)?/gi;
const LONG_DIGITS_RE = /\b\d{6,}\b/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function fetchCustomerNames(): Promise<string[]> {
  try {
    const db = await getDb();
    const rows = await db.select({ name: customers.name }).from(customers);
    return rows.map((r) => r.name).filter(Boolean);
  } catch (err) {
    console.error('[analytics] fetchCustomerNames error:', err);
    return [];
  }
}

function redactPII(text: string, customerNames: string[]): string {
  let out = text.replace(MONEY_RE, '[monto]').replace(LONG_DIGITS_RE, '[documento]');
  const tokens = new Set<string>();
  for (const name of customerNames) {
    for (const token of name.split(/\s+/)) {
      if (token.length >= 3) tokens.add(token);
    }
  }
  for (const token of tokens) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, 'gi'), '[cliente]');
  }
  return out;
}

export async function getConversationDetail(id: string): Promise<ConversationDetail | null> {
  if (!UUID_RE.test(id)) return null;
  try {
    const db = await getDb();
    const { eq } = await import('drizzle-orm');
    const rows = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    if (rows.length === 0) return null;

    const row = rows[0];
    if (row.demoType !== 'chatbot' && row.demoType !== 'voicebot') return null;

    const rawMessages = Array.isArray(row.messages) ? (row.messages as unknown[]) : [];
    const meta = row.metadata as
      | { sentiments?: unknown; escalated?: unknown; escalationReason?: unknown; escalationTicketId?: unknown }
      | null;

    const customerNames = await fetchCustomerNames();
    const messages: ConversationMessage[] = rawMessages
      .filter(
        (m): m is { role: string; content: string } =>
          typeof m === 'object' && m !== null && 'role' in m && 'content' in m,
      )
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: redactPII(String(m.content), customerNames) }));

    const sentiments = Array.isArray(meta?.sentiments) ? (meta.sentiments as unknown[]) : [];
    let sum = 0;
    let count = 0;
    for (const s of sentiments) {
      const score = SENTIMENT_SCORE[s as string];
      if (score === undefined) continue;
      sum += score;
      count += 1;
    }
    const state = classifySemaforo(count > 0 ? sum / count : 2);

    return {
      id: row.id,
      demoType: row.demoType,
      createdAt: row.createdAt,
      state,
      escalated: meta?.escalated === true,
      escalationReason:
        typeof meta?.escalationReason === 'string' ? redactPII(meta.escalationReason, customerNames) : null,
      escalationTicketId: typeof meta?.escalationTicketId === 'string' ? meta.escalationTicketId : null,
      messages,
    };
  } catch (err) {
    console.error('[analytics] getConversationDetail error:', err);
    return null;
  }
}

export async function getAnalyticsDashboardData(
  { activityDays = 21, recentConversations = 8 }: { activityDays?: number; recentConversations?: number } = {},
): Promise<AnalyticsDashboardData> {
  const rows = await fetchConversationRows();

  return {
    demoCounts: computeDemoCounts(rows),
    dailyActivity: computeDailyActivity(rows, activityDays),
    toolUsage: computeToolUsage(rows),
    dbStats: computeDbQueryStats(rows),
    escalationStats: computeEscalationStats(rows),
    csatStats: computeCsatStats(rows),
    sentimentStats: computeSentimentStats(rows),
    conversationSentimentStats: computeConversationSentimentStats(rows, recentConversations),
    trend: computeTrend(rows, activityDays),
  };
}
