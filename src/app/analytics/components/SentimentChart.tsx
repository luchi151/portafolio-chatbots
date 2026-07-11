'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SentimentStats } from '@/lib/db/analytics-queries';

interface Props {
  data: SentimentStats;
}

const SENTIMENT_META: Record<'positive' | 'neutral' | 'negative' | 'frustrated', { label: string; color: string }> = {
  positive: { label: 'Positivo', color: '#10b981' },
  neutral: { label: 'Neutral', color: '#6b7280' },
  negative: { label: 'Negativo', color: '#f59e0b' },
  frustrated: { label: 'Frustrado', color: '#ef4444' },
};

export function SentimentChart({ data }: Props) {
  if (data.total === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Sin mensajes analizados todavía.
      </div>
    );
  }

  const chartData = (Object.keys(SENTIMENT_META) as Array<keyof typeof SENTIMENT_META>).map((key) => ({
    key,
    label: SENTIMENT_META[key].label,
    color: SENTIMENT_META[key].color,
    count: data[key],
  }));

  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        {data.negativeRate}% de los mensajes con tono negativo/frustrado ({data.total} analizados)
      </p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
            <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
