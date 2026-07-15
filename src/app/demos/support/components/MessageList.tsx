'use client';

import { useEffect, useRef } from 'react';
import type { Message } from '@/types';
import { SourcesDisplay } from './SourcesDisplay';
import { Bot, Loader2, User } from 'lucide-react';

interface Props {
  messages: Message[];
  isStreaming: boolean;
}

const SUGGESTIONS = [
  '¿Cómo se calculan los intereses de mora?',
  '¿Qué pasa si no pago mi cuota?',
  '¿Puedo hacer un acuerdo de pago?',
  '¿Qué medios de pago aceptan?',
];

export function MessageList({ messages, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Bot className="size-6" />
        </div>
        <div>
          <p className="text-sm font-semibold">Asistente de Soporte</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Pregunta sobre políticas de cobranza, pagos e intereses. Las respuestas se generan con RAG
            sobre una base de conocimiento real.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {SUGGESTIONS.map((s) => (
            <span key={s} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              {s}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';
        const isLast = i === messages.length - 1;
        const streaming = isStreaming && isLast && msg.role === 'assistant';

        return (
          <div key={i} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div
              className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
            </div>

            {/* Bubble */}
            <div className={`flex max-w-[78%] flex-col gap-1 ${isUser ? 'items-end' : ''}`}>
              {!isUser && msg.sources && <SourcesDisplay sources={msg.sources} />}

              {/* Agent step indicator */}
              {msg.agentStep && (
                <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 shrink-0 animate-spin" />
                  <span>{msg.agentStep}</span>
                </div>
              )}

              {/* Text bubble */}
              {msg.content ? (
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    isUser
                      ? 'rounded-tr-sm bg-primary text-primary-foreground'
                      : 'rounded-tl-sm bg-muted text-foreground'
                  }`}
                >
                  {msg.content}
                  {streaming && (
                    <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-current align-middle" />
                  )}
                </div>
              ) : streaming && !msg.agentStep && !msg.sources ? (
                <div className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-3">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((j) => (
                      <span
                        key={j}
                        className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                        style={{ animationDelay: `${j * 0.15}s` }}
                      />
                    ))}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
