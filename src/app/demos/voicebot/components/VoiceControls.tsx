'use client';

import type { VoiceStatus } from './VoicebotInterface';
import { Loader2, Mic, MicOff, Volume2 } from 'lucide-react';

interface Props {
  status: VoiceStatus;
  isSupported: boolean;
  error: string | null;
  onToggle: () => void;
}

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: 'Pulsa para hablar',
  listening: 'Escuchando… pulsa para enviar',
  processing: 'Procesando…',
  speaking: 'Respondiendo… pulsa para interrumpir',
};

const STATUS_HINT: Record<VoiceStatus, string> = {
  idle: 'Habla en español con el agente',
  listening: 'Di tu pregunta con claridad',
  processing: 'El agente está pensando',
  speaking: 'ElevenLabs TTS · DeepSeek LLM',
};

export function VoiceControls({ status, isSupported, error, onToggle }: Props) {
  const active = status !== 'processing' && isSupported;

  const buttonColors: Record<VoiceStatus, string> = {
    idle: 'bg-primary hover:bg-primary/80 shadow-primary/25',
    listening: 'bg-[#10b981] hover:bg-[#059669] shadow-[#10b981]/30',
    processing: 'bg-muted cursor-not-allowed opacity-70 shadow-none',
    speaking: 'bg-[#8b5cf6] hover:bg-[#7c3aed] shadow-[#8b5cf6]/30',
  };

  return (
    <div className="flex flex-col items-center gap-5 border-t border-border px-6 py-8">
      {/* Waveform — visible only when listening */}
      <div
        aria-hidden
        className={`flex h-8 items-end gap-[3px] transition-opacity duration-300 ${
          status === 'listening' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {Array.from({ length: 11 }, (_, i) => {
          const baseH = 6 + Math.abs(Math.sin(i * 0.9)) * 16;
          return (
            <span
              key={i}
              className="w-1 rounded-full bg-[#10b981] origin-bottom"
              style={{
                height: `${baseH}px`,
                animation:
                  status === 'listening'
                    ? `voiceWave ${0.5 + (i % 3) * 0.15}s ease-in-out infinite alternate`
                    : 'none',
                animationDelay: `${i * 0.07}s`,
              }}
            />
          );
        })}
      </div>

      {/* Main button */}
      <button
        type="button"
        onClick={active ? onToggle : undefined}
        disabled={!active}
        aria-label={STATUS_LABEL[status]}
        className={`relative flex size-24 items-center justify-center rounded-full text-white shadow-xl transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/50 ${buttonColors[status]} ${
          status === 'listening' ? 'scale-110' : 'hover:scale-105'
        }`}
      >
        {status === 'processing' ? (
          <Loader2 className="size-9 animate-spin" />
        ) : status === 'speaking' ? (
          <Volume2 className="size-9" />
        ) : status === 'listening' ? (
          <MicOff className="size-9" />
        ) : (
          <Mic className="size-9" />
        )}

        {/* Ping ring while listening */}
        {status === 'listening' && (
          <span className="absolute inset-0 animate-ping rounded-full bg-[#10b981]/25" />
        )}
      </button>

      {/* Label */}
      <div className="text-center">
        <p className="text-sm font-medium">{STATUS_LABEL[status]}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{STATUS_HINT[status]}</p>
      </div>

      {/* Error */}
      {error && <p className="max-w-xs text-center text-xs text-destructive">{error}</p>}

      {/* Browser not supported */}
      {!isSupported && (
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          Tu navegador no soporta reconocimiento de voz. Usa Chrome, Edge o Safari.
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        Web Speech API · ElevenLabs TTS · DeepSeek / Groq LLM
      </p>
    </div>
  );
}
