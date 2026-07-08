import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DbQueryStats, DemoCount, EscalationStats, ToolUsageCount } from '@/lib/db/analytics-queries';

const DEMO_LABELS: Record<string, { label: string; color: string }> = {
  chatbot: { label: 'Chatbot de cobranza', color: '#3b82f6' },
  voicebot: { label: 'Agente de voz', color: '#10b981' },
  db_query: { label: 'Consultas NL → SQL', color: '#8b5cf6' },
};

interface Props {
  demoCounts: DemoCount[];
  toolUsage: ToolUsageCount[];
  dbStats: DbQueryStats;
  escalationStats: EscalationStats;
}

export function StatsCards({ demoCounts, toolUsage, dbStats, escalationStats }: Props) {
  const total = demoCounts.reduce((sum, d) => sum + d.count, 0);
  const totalToolCalls = toolUsage.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total interacciones</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{total}</p>
        </CardContent>
      </Card>

      <Card className="sm:col-span-2 lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Por demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {demoCounts.length === 0 && <p className="text-sm text-muted-foreground">Sin datos aún</p>}
          {demoCounts.map((d) => {
            const meta = DEMO_LABELS[d.demoType];
            return (
              <div key={d.demoType} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: meta?.color ?? '#6b7280' }} />
                  {meta?.label ?? d.demoType}
                </span>
                <span className="font-semibold">{d.count}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Tiempo promedio SQL</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{dbStats.avgExecutionTimeMs}<span className="text-lg font-normal text-muted-foreground"> ms</span></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Herramientas ejecutadas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{totalToolCalls}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Escalados a asesor</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{escalationStats.totalEscalated}</p>
          <p className="text-xs text-muted-foreground">{escalationStats.escalationRate}% de las conversaciones</p>
        </CardContent>
      </Card>
    </div>
  );
}
