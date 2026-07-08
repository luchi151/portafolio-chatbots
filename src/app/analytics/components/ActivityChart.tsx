'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { DailyActivityPoint } from '@/lib/db/analytics-queries';

interface Props {
  data: DailyActivityPoint[];
}

const SERIES = [
  { key: 'chatbot' as const, name: 'Chatbot', color: '#3b82f6' },
  { key: 'voicebot' as const, name: 'Voicebot', color: '#10b981' },
  { key: 'db_query' as const, name: 'DB Query', color: '#8b5cf6' },
];

export function ActivityChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Sin actividad registrada todavía.
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11 }}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
