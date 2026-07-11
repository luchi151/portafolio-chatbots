'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

interface Props {
  conversationId: string;
  demo: 'chatbot' | 'voicebot';
  token: string | null;
}

export function CsatPrompt({ conversationId, demo, token }: Props) {
  const [rated, setRated] = useState<'up' | 'down' | null>(null);
  const [sending, setSending] = useState(false);

  async function handleRate(rating: 'up' | 'down') {
    if (sending || rated || !token) return;
    setSending(true);
    setRated(rating);
    try {
      await fetch('/api/csat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId, demo, rating }),
      });
    } catch {
      // Feedback opcional — un fallo de red no debe interrumpir la demo.
    } finally {
      setSending(false);
    }
  }

  if (rated) {
    return (
      <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground">
        ¡Gracias por tu feedback!
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
      <span>¿Te resultó útil esta conversación?</span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Útil"
        disabled={sending}
        onClick={() => void handleRate('up')}
      >
        <ThumbsUp className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="No útil"
        disabled={sending}
        onClick={() => void handleRate('down')}
      >
        <ThumbsDown className="size-3.5" />
      </Button>
    </div>
  );
}
