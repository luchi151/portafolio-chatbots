'use client';

import { useEffect, useRef } from 'react';
import type { ConversationTurn, VoiceStatus } from './VoicebotInterface';
import { Bot, Mic, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  conversation: ConversationTurn[];
  interim: string;
  status: VoiceStatus;
  onReset: () => void;
}

const SUGGESTIONS = ['¿Cuál es mi saldo?', 'Tengo problemas para pagar', '¿Puedo refinanciar mi deuda?'];

export function TranscriptDisplay({ conversation, interim, status, onReset }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, interim]);

  if (conversation.length === 0 && !interim) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-[#10b981]/10 text-[#10b981]">
          <Mic className="size-8" />
        </div>
        <div>
          <p className="text-sm font-semibold">Agente de Voz</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Pulsa el botón y habla en español. El agente responde con voz usando ElevenLabs TTS
            o la síntesis de voz de tu navegador como respaldo.
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
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="text-sm font-medium">Transcripción</p>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <Trash2 className="size-3.5" />
          Limpiar
        </Button>
      </div>

      {/* Turns */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {conversation.map((turn, i) => {
          const isUser = turn.role === 'user';
          return (
            <div key={i} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                  isUser
                    ? 'bg-[#10b981]/15 text-[#10b981]'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isUser ? <Mic className="size-3.5" /> : <Bot className="size-3.5" />}
              </div>
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  isUser
                    ? 'rounded-tr-sm bg-[#10b981]/10 text-foreground'
                    : 'rounded-tl-sm bg-muted text-foreground'
                }`}
              >
                {turn.text}
              </div>
            </div>
          );
        })}

        {/* Interim transcript (user speaking) */}
        {status === 'listening' && interim && (
          <div className="flex flex-row-reverse gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#10b981]/15 text-[#10b981]">
              <Mic className="size-3.5" />
            </div>
            <div className="max-w-[78%] rounded-2xl rounded-tr-sm bg-[#10b981]/5 px-3.5 py-2.5 text-sm italic text-muted-foreground">
              {interim}
            </div>
          </div>
        )}

        {/* Processing placeholder */}
        {status === 'processing' && (
          <div className="flex gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bot className="size-3.5" />
            </div>
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
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
