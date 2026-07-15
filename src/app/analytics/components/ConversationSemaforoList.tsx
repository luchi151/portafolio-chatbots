'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ConversationDetail, ConversationSentimentSummary } from '@/lib/db/analytics-queries';

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

function formatDate(date: Date | string | null): string {
  if (!date) return 'Sin fecha';
  return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Click-to-copy identifier — used for the conversation id and, for escalated
// cases, the ticket id an advisor would reference when following up.
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title="Copiar identificador"
      className="font-mono text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
    >
      {copied ? 'Copiado ✓' : label}
    </button>
  );
}

export function ConversationSemaforoList({ conversations }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  async function openConversation(id: string) {
    setSelectedId(id);
    setDetail(null);
    setStatus('loading');
    try {
      const res = await fetch(`/api/analytics/conversations/${id}`);
      if (!res.ok) throw new Error('fetch failed');
      setDetail((await res.json()) as ConversationDetail);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  if (conversations.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Sin conversaciones analizadas todavía.
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-border">
        {conversations.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => openConversation(c.id)}
              className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
            >
              <span className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: SEMAFORO_DOT[c.state] }} />
                <span className="font-medium">{DEMO_LABELS[c.demoType] ?? c.demoType}</span>
                <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                <span className="font-mono text-[11px] text-muted-foreground">#{c.id.slice(0, 8)}</span>
                {c.state === 'rojo' && <Badge variant="destructive">Requiere atención</Badge>}
              </span>
              <span className="text-xs text-muted-foreground">
                {c.messageCount} {c.messageCount === 1 ? 'mensaje' : 'mensajes'} · promedio {c.avgScore.toFixed(1)}/3
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {detail && <span className="size-2.5 shrink-0 rounded-full" style={{ background: SEMAFORO_DOT[detail.state] }} />}
              Detalle de la conversación
              {detail && <CopyButton value={detail.id} label={`#${detail.id.slice(0, 8)}`} />}
            </DialogTitle>
            <DialogDescription>
              Datos sensibles (nombre, monto, documento) redactados automáticamente antes de mostrarse.
            </DialogDescription>
          </DialogHeader>

          {status === 'loading' && <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>}
          {status === 'error' && (
            <p className="py-6 text-center text-sm text-muted-foreground">No se pudo cargar la conversación.</p>
          )}

          {detail && status === 'idle' && (
            <div className="flex flex-col gap-3">
              {detail.escalated && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <p>Escalada a asesor humano — motivo: {detail.escalationReason ?? 'No especificado'}</p>
                  {detail.escalationTicketId && (
                    <p className="mt-1 flex items-center gap-1.5">
                      Ticket: <CopyButton value={detail.escalationTicketId} label={detail.escalationTicketId} />
                    </p>
                  )}
                </div>
              )}
              <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
                {detail.messages.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin mensajes registrados.</p>
                )}
                {detail.messages.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === 'user'
                        ? 'ml-8 rounded-lg bg-primary/10 px-3 py-2 text-sm'
                        : 'mr-8 rounded-lg bg-muted px-3 py-2 text-sm'
                    }
                  >
                    {m.content}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
