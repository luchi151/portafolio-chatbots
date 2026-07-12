import type { ConversationSentimentSummary } from '@/lib/db/analytics-queries';

interface Props {
  conversations: ConversationSentimentSummary[];
}

const SEMAFORO_DOT: Record<ConversationSentimentSummary['state'], string> = {
  verde: '#10b981',
  amarillo: '#f59e0b',
  rojo: '#ef4444',
};

const DEMO_LABELS: Record<string, string> = {
  chatbot: 'Chatbot',
  voicebot: 'Voicebot',
};

export function ConversationSemaforoList({ conversations }: Props) {
  if (conversations.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Sin conversaciones analizadas todavía.
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {conversations.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm">
          <span className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: SEMAFORO_DOT[c.state] }} />
            <span className="font-medium">{DEMO_LABELS[c.demoType] ?? c.demoType}</span>
            <span className="text-xs text-muted-foreground">
              {c.createdAt
                ? new Date(c.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : 'Sin fecha'}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            {c.messageCount} {c.messageCount === 1 ? 'mensaje' : 'mensajes'} · promedio {c.avgScore.toFixed(1)}/3
          </span>
        </li>
      ))}
    </ul>
  );
}
