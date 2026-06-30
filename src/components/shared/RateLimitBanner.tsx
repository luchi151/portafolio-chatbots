'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface Props {
  resetAt: number | null; // Unix ms
  onDismiss: () => void;
}

export function RateLimitBanner({ resetAt, onDismiss }: Props) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!resetAt) return;

    const update = () => {
      const diff = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
      if (diff === 0) { onDismiss(); return; }
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setRemaining(`${m}:${s.toString().padStart(2, '0')}`);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [resetAt, onDismiss]);

  if (!resetAt) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-[#f59e0b]/30 bg-[#f59e0b]/5 px-4 py-2.5"
    >
      <AlertCircle className="size-4 shrink-0 text-[#f59e0b]" />
      <p className="flex-1 text-xs text-[#f59e0b]">
        Límite de solicitudes alcanzado.{remaining ? ` Intenta en ${remaining}.` : ''}
      </p>
      <button
        onClick={onDismiss}
        aria-label="Cerrar aviso"
        className="text-[#f59e0b]/60 transition-colors hover:text-[#f59e0b]"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
