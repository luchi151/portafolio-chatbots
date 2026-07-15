'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ToolUsageCount } from '@/lib/db/analytics-queries';

interface Props {
  data: ToolUsageCount[];
}

const TOOL_LABELS: Record<string, string> = {
  consultar_cuenta: 'Consultar cuenta',
  calcular_plan_pago: 'Plan de pago',
  verificar_mora: 'Verificar mora',
  escalar_a_agente: 'Escalar a agente',
};

export function ToolUsageChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Sin herramientas ejecutadas todavía.
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, label: TOOL_LABELS[d.tool] ?? d.tool }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          {/* Labels here ("Calcular plan de pago", "Escalar a agente") are long
              enough to overlap at mobile widths when kept horizontal — angling
              them gives each one its own lane. */}
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={56}
          />
          <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
