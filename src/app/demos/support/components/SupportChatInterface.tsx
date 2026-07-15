'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/components/shared/DemoShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageList } from './MessageList';
import type { Message, RagSource } from '@/types';
import { Send, Trash2 } from 'lucide-react';

type StreamEvent =
  | { type: 'status'; text: string }
  | { type: 'sources'; sources: RagSource[] }
  | { type: 'text'; text: string }
  | { type: 'done'; conversationId: string };

export function SupportChatInterface() {
  const { token, setRateLimited } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setIsStreaming(true);

    const assistantMsg: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    setMessages([...nextMessages, assistantMsg]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const history = nextMessages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, history, conversationId }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        if (res.status === 429) {
          const resetSec = Number(res.headers.get('X-RateLimit-Reset') ?? 0);
          setRateLimited(resetSec ? resetSec * 1000 : Date.now() + 3_600_000);
        }
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Error ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;

          let event: StreamEvent;
          try {
            event = JSON.parse(raw) as StreamEvent;
          } catch {
            continue;
          }

          if (event.type === 'status') {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, agentStep: event.text };
              }
              return next;
            });
          } else if (event.type === 'sources') {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, sources: event.sources };
              }
              return next;
            });
          } else if (event.type === 'text') {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, content: last.content + event.text, agentStep: undefined };
              }
              return next;
            });
          } else if (event.type === 'done') {
            setConversationId(event.conversationId);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Error al procesar la respuesta.';
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          next[next.length - 1] = { ...last, content: msg };
        }
        return next;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function handleReset() {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(undefined);
    setInput('');
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <p className="text-sm font-medium">Asistente de Soporte</p>
          <p className="text-xs text-muted-foreground">
            {conversationId ? `Conv. ${conversationId.slice(0, 8)}…` : 'Nueva conversación · RAG (Voyage AI + pgvector)'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <Trash2 className="size-3.5" />
          Limpiar
        </Button>
      </div>

      {/* Messages */}
      <MessageList messages={messages} isStreaming={isStreaming} />

      {/* Input bar */}
      <div className="border-t border-border p-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe una pregunta sobre políticas o pagos…"
            disabled={isStreaming}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />

          <Button type="submit" size="icon-sm" disabled={isStreaming || !input.trim()} aria-label="Enviar">
            <Send className="size-4" />
          </Button>
        </form>

        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          Demo pública · DeepSeek + Voyage AI · No subas datos personales reales
        </p>
      </div>
    </div>
  );
}
