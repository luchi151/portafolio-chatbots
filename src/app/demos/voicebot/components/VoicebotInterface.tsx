'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/shared/DemoShell';
import { TranscriptDisplay } from './TranscriptDisplay';
import { VoiceControls } from './VoiceControls';

// ─── Web Speech API types (not in all TS DOM versions) ───────────────────────

interface SpeechResult {
  readonly transcript: string;
}

interface SpeechResultItem {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechResult;
}

interface SpeechResultList {
  readonly length: number;
  readonly [index: number]: SpeechResultItem;
}

interface SpeechEvent {
  readonly resultIndex: number;
  readonly results: SpeechResultList;
}

interface SpeechErrorEvent {
  readonly error: string;
}

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type Win = Window & {
  SpeechRecognition?: new () => ISpeechRecognition;
  webkitSpeechRecognition?: new () => ISpeechRecognition;
};

// ─── Component ────────────────────────────────────────────────────────────────

export type ConversationTurn = { role: 'user' | 'assistant'; text: string };
export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking';

export function VoicebotInterface() {
  const { token, setRateLimited } = useAuth();
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [interim, setInterim] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const finalTranscriptRef = useRef('');
  const shouldProcessRef = useRef(false);
  const conversationRef = useRef<ConversationTurn[]>([]);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  useEffect(() => {
    const w = window as Win;
    setIsSupported(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);

  const processTranscript = useCallback(async () => {
    const transcript = finalTranscriptRef.current.trim();
    finalTranscriptRef.current = '';
    setInterim('');

    if (!transcript) {
      setStatus('idle');
      return;
    }

    setConversation((prev) => [...prev, { role: 'user', text: transcript }]);
    setStatus('processing');
    setError(null);

    try {
      const history = conversationRef.current.map((t) => ({
        role: t.role,
        content: t.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: transcript, history }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          const resetSec = Number(res.headers.get('X-RateLimit-Reset') ?? 0);
          setRateLimited(resetSec ? resetSec * 1000 : Date.now() + 3_600_000);
        }
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Error ${res.status}`);
      }

      // Collect full text before TTS (needs the complete string)
      const reader = res.body?.getReader();
      if (!reader) throw new Error('Sin respuesta del servidor');

      const dec = new TextDecoder();
      let buf = '';
      let fullText = '';

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
          try {
            const evt = JSON.parse(raw) as { type: string; text?: string };
            if (evt.type === 'text' && evt.text) fullText += evt.text;
          } catch { /* ignore malformed chunks */ }
        }
      }

      if (!fullText.trim()) throw new Error('Respuesta vacía del agente');

      setConversation((prev) => [...prev, { role: 'assistant', text: fullText }]);
      setStatus('speaking');
      await speak(fullText, token ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la solicitud');
    } finally {
      setStatus('idle');
    }
  }, [token]);

  function startListening() {
    const w = window as Win;
    const RecognitionAPI = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!RecognitionAPI) {
      setError('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari.');
      return;
    }

    setError(null);
    finalTranscriptRef.current = '';
    shouldProcessRef.current = false;

    const rec = new RecognitionAPI();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'es-CO';

    rec.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }
      setInterim(interimText);
    };

    rec.onerror = (event) => {
      if (event.error === 'no-speech') return;
      setError(`Error de reconocimiento: ${event.error}`);
      setStatus('idle');
    };

    rec.onend = () => {
      if (shouldProcessRef.current) {
        shouldProcessRef.current = false;
        void processTranscript();
      }
    };

    recognitionRef.current = rec;
    rec.start();
    setStatus('listening');
  }

  function handleToggle() {
    if (status === 'idle') {
      startListening();
    } else if (status === 'listening') {
      shouldProcessRef.current = true;
      recognitionRef.current?.stop();
    } else if (status === 'speaking') {
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      setStatus('idle');
    }
  }

  function handleReset() {
    recognitionRef.current?.stop();
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    finalTranscriptRef.current = '';
    shouldProcessRef.current = false;
    setConversation([]);
    setStatus('idle');
    setInterim('');
    setError(null);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TranscriptDisplay
        conversation={conversation}
        interim={interim}
        status={status}
        onReset={handleReset}
      />
      <VoiceControls
        status={status}
        isSupported={isSupported}
        error={error}
        onToggle={handleToggle}
      />
    </div>
  );
}

// ─── Speech helpers ───────────────────────────────────────────────────────────

async function speak(text: string, token: string): Promise<void> {
  if (token) {
    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: text.slice(0, 1000) }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        await new Promise<void>((resolve) => {
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          void audio.play().catch(() => resolve());
        });
        return;
      }
    } catch { /* fall through to browser TTS */ }
  }

  await browserTTS(text);
}

function browserTTS(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'es-CO';
    utt.rate = 1.0;
    utt.onend = () => resolve();
    utt.onerror = () => resolve();
    window.speechSynthesis.speak(utt);
  });
}
