import { conversations } from './schema';

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

export interface AnalyticsDashboardData {
  demoCounts: DemoCount[];
  dailyActivity: DailyActivityPoint[];
  toolUsage: ToolUsageCount[];
  dbStats: DbQueryStats;
  escalationStats: EscalationStats;
  csatStats: CsatStats;
  sentimentStats: SentimentStats;
  conversationSentimentStats: ConversationSentimentStats;
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

  summaries.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

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
  };
}
