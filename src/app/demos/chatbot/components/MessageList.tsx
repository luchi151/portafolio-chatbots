'use client';

import { useEffect, useRef } from 'react';
import type { Message } from '@/types';
import { ToolCallDisplay } from './ToolCallDisplay';
import { Bot, User } from 'lucide-react';

interface Props {
  messages: Message[];
  isStreaming: boolean;
}

const SUGGESTIONS = [
  '¿Cuál es mi saldo actual?',
  '¿Cuándo vence mi próximo pago?',
  '¿Puedo refinanciar mi deuda?',
  '¿Qué opciones de pago tengo?',
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
          <p className="text-sm font-semibold">Asistente de Cobranza</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Pregunta sobre saldos, fechas de pago o acuerdos de refinanciación. El agente usa RAG
            para consultar tu historial.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {SUGGESTIONS.map((s) => (
            <span
              key={s}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
            >
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
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="w-full">
                  {msg.toolCalls.map((tc, j) => (
                    <ToolCallDisplay key={j} toolCall={tc} />
                  ))}
                </div>
              )}

              {/* Text content or streaming dots */}
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
              ) : streaming ? (
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
