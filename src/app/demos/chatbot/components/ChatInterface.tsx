'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/components/shared/DemoShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageList } from './MessageList';
import type { Message, Sentiment, ToolCall } from '@/types';
import { Loader2, Paperclip, Send, Trash2, X } from 'lucide-react';

type StreamEvent =
  | { type: 'status'; text: string }
  | { type: 'tool_start'; name: string }
  | { type: 'tool_call'; name: string; arguments: Record<string, unknown>; result: unknown }
  | { type: 'text'; text: string }
  | { type: 'sentiment'; value: Sentiment }
  | { type: 'done'; conversationId: string };

async function parseFile(file: File, token: string): Promise<string | null> {
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch('/api/docs/parse', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: string };
    return data.content ?? null;
  } catch {
    return null;
  }
}

export function ChatInterface() {
  const { token, setRateLimited } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [processingFiles, setProcessingFiles] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming || processingFiles) return;

    // Parse attached files first
    let augmentedMessage = text;
    if (files.length > 0 && token) {
      setProcessingFiles(true);
      try {
        const parsed = await Promise.all(files.map((f) => parseFile(f, token)));
        const chunks = parsed
          .map((content, i) => content ? `[${files[i].name}]\n${content}` : null)
          .filter(Boolean) as string[];
        if (chunks.length > 0) {
          augmentedMessage = `${text}\n\n---\nContenido de archivos adjuntos:\n\n${chunks.join('\n\n---\n\n')}`;
        }
      } finally {
        setProcessingFiles(false);
      }
    }

    const userMsg: Message = {
      role: 'user',
      content: text, // Show original text in UI, not the augmented version
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

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: augmentedMessage, history, conversationId, demo: 'chatbot' }),
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
          } else if (event.type === 'tool_start') {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') {
                next[next.length - 1] = {
                  ...last,
                  agentStep: undefined,
                  toolCalls: [
                    ...(last.toolCalls ?? []),
                    { name: event.name, arguments: {}, result: null, status: 'running' as const },
                  ],
                };
              }
              return next;
            });
          } else if (event.type === 'tool_call') {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') {
                const updated = (last.toolCalls ?? []).map((tc) =>
                  tc.name === event.name && tc.status === 'running'
                    ? { name: event.name, arguments: event.arguments, result: event.result, status: 'done' as const }
                    : tc,
                );
                next[next.length - 1] = { ...last, toolCalls: updated };
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
          } else if (event.type === 'sentiment') {
            setMessages((prev) => {
              const next = [...prev];
              const userIdx = next.length - 2; // last is the assistant placeholder
              if (next[userIdx]?.role === 'user') {
                next[userIdx] = { ...next[userIdx], sentiment: event.value };
              }
              return next;
            });
          } else if (event.type === 'done') {
            setConversationId(event.conversationId);
          }
        }
      }

      setFiles([]);
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
    setFiles([]);
    setInput('');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const valid = selected.filter((f) => {
      if (f.size > 10 * 1024 * 1024) return false;
      return ['application/pdf', 'image/png', 'image/jpeg'].includes(f.type);
    });
    setFiles((prev) => [...prev, ...valid].slice(0, 3));
    e.target.value = '';
  }

  const busy = isStreaming || processingFiles;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <p className="text-sm font-medium">Asistente de Cobranza</p>
          <p className="text-xs text-muted-foreground">
            {conversationId ? `Conv. ${conversationId.slice(0, 8)}…` : 'Nueva conversación · RAG + Tool Calling'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <Trash2 className="size-3.5" />
          Limpiar
        </Button>
      </div>

      {/* Messages */}
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        conversationId={conversationId}
        token={token}
      />

      {/* File chips */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-4 py-2">
          {processingFiles && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Procesando archivos…
            </span>
          )}
          {!processingFiles && files.map((f, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary"
            >
              {f.name.length > 22 ? `${f.name.slice(0, 22)}…` : f.name}
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="ml-0.5"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-border p-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            aria-label="Adjuntar PDF o imagen"
          >
            <Paperclip className="size-4" />
          </Button>

          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe un mensaje…"
            disabled={busy}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />

          <Button
            type="submit"
            size="icon-sm"
            disabled={busy || !input.trim()}
            aria-label="Enviar"
          >
            {processingFiles ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>

        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          Demo pública · DeepSeek + LangGraph · No subas datos personales reales
        </p>
      </div>
    </div>
  );
}
