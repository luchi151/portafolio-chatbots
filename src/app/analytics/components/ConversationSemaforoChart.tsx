'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ConversationSentimentStats } from '@/lib/db/analytics-queries';

interface Props {
  data: ConversationSentimentStats;
}

const SEMAFORO_META = {
  verde: { label: 'Verde', color: '#10b981' },
  amarillo: { label: 'Amarillo', color: '#f59e0b' },
  rojo: { label: 'Rojo', color: '#ef4444' },
} as const;

export function ConversationSemaforoChart({ data }: Props) {
  if (data.total === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Sin conversaciones analizadas todavía.
      </div>
    );
  }

  const chartData = (Object.keys(SEMAFORO_META) as Array<keyof typeof SEMAFORO_META>).map((key) => ({
    key,
    label: SEMAFORO_META[key].label,
    color: SEMAFORO_META[key].color,
    count: data[key],
  }));

  const rojoRate = Math.round((data.rojo / data.total) * 100);

  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        {rojoRate}% de las conversaciones terminaron en rojo ({data.total} conversaciones con sentimiento registrado)
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
