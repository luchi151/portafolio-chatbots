import { eq } from 'drizzle-orm';
import { conversations } from './schema';

// db/index.ts throws at import time if DATABASE_URL is unset, so it's
// imported lazily inside each function — matches the pattern already used
// in the route handlers — letting the try/catch below fall back to empty data.
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

// Row volume for a portfolio demo is small — fetch the relevant columns once
// and aggregate in JS rather than reaching for raw SQL (date_trunc,
// jsonb_array_elements_text) for a handful of dashboard numbers.

export async function getDemoCounts(): Promise<DemoCount[]> {
  try {
    const db = await getDb();
    const rows = await db.select({ demoType: conversations.demoType }).from(conversations);
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.demoType, (counts.get(r.demoType) ?? 0) + 1);
    return Array.from(counts, ([demoType, count]) => ({ demoType, count }));
  } catch (err) {
    console.error('[analytics] getDemoCounts error:', err);
    return [];
  }
}

export async function getDailyActivity(days = 21): Promise<DailyActivityPoint[]> {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const db = await getDb();
    const rows = await db
      .select({ demoType: conversations.demoType, createdAt: conversations.createdAt })
      .from(conversations);

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
  } catch (err) {
    console.error('[analytics] getDailyActivity error:', err);
    return [];
  }
}

export async function getToolUsage(): Promise<ToolUsageCount[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select({ metadata: conversations.metadata })
      .from(conversations)
      .where(eq(conversations.demoType, 'chatbot'));

    const counts = new Map<string, number>();
    for (const r of rows) {
      const tools = (r.metadata as { toolsUsed?: unknown })?.toolsUsed;
      if (!Array.isArray(tools)) continue;
      for (const t of tools) {
        if (typeof t !== 'string') continue;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }

    return Array.from(counts, ([tool, count]) => ({ tool, count })).sort((a, b) => b.count - a.count);
  } catch (err) {
    console.error('[analytics] getToolUsage error:', err);
    return [];
  }
}

export async function getDbQueryStats(): Promise<DbQueryStats> {
  try {
    const db = await getDb();
    const rows = await db
      .select({ metadata: conversations.metadata })
      .from(conversations)
      .where(eq(conversations.demoType, 'db_query'));

    let totalTime = 0;
    let timedCount = 0;
    for (const r of rows) {
      const meta = r.metadata as { executionTime?: unknown; usedRealDB?: unknown };
      if (meta?.usedRealDB && typeof meta.executionTime === 'number') {
        totalTime += meta.executionTime;
        timedCount += 1;
      }
    }

    return {
      totalQueries: rows.length,
      avgExecutionTimeMs: timedCount > 0 ? Math.round(totalTime / timedCount) : 0,
    };
  } catch (err) {
    console.error('[analytics] getDbQueryStats error:', err);
    return { totalQueries: 0, avgExecutionTimeMs: 0 };
  }
}

export async function getEscalationStats(): Promise<EscalationStats> {
  try {
    const db = await getDb();
    const rows = await db
      .select({ demoType: conversations.demoType, metadata: conversations.metadata })
      .from(conversations);

    let conversational = 0;
    let escalated = 0;
    for (const r of rows) {
      if (r.demoType !== 'chatbot' && r.demoType !== 'voicebot') continue;
      conversational += 1;
      const meta = r.metadata as { escalated?: unknown };
      if (meta?.escalated === true) escalated += 1;
    }

    return {
      totalEscalated: escalated,
      escalationRate: conversational > 0 ? Math.round((escalated / conversational) * 100) : 0,
    };
  } catch (err) {
    console.error('[analytics] getEscalationStats error:', err);
    return { totalEscalated: 0, escalationRate: 0 };
  }
}

export async function getCsatStats(): Promise<CsatStats> {
  try {
    const db = await getDb();
    const rows = await db
      .select({ demoType: conversations.demoType, metadata: conversations.metadata })
      .from(conversations);

    let totalRated = 0;
    let thumbsUp = 0;
    for (const r of rows) {
      if (r.demoType !== 'chatbot' && r.demoType !== 'voicebot') continue;
      const rating = (r.metadata as { csat?: { rating?: unknown } })?.csat?.rating;
      if (rating !== 'up' && rating !== 'down') continue;
      totalRated += 1;
      if (rating === 'up') thumbsUp += 1;
    }

    return {
      totalRated,
      thumbsUp,
      satisfactionRate: totalRated > 0 ? Math.round((thumbsUp / totalRated) * 100) : 0,
    };
  } catch (err) {
    console.error('[analytics] getCsatStats error:', err);
    return { totalRated: 0, thumbsUp: 0, satisfactionRate: 0 };
  }
}
