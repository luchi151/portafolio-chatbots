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
            <DialogTitle className="flex items-center gap-2">
              {detail && <span className="size-2.5 shrink-0 rounded-full" style={{ background: SEMAFORO_DOT[detail.state] }} />}
              Detalle de la conversación
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
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  Escalada a asesor humano — motivo: {detail.escalationReason ?? 'No especificado'}
                </p>
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
