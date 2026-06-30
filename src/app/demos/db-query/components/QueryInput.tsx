'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const SUGGESTIONS = [
  '¿Cuántos clientes tienen deudas vencidas?',
  'Muestra los 5 clientes con mayor deuda',
  '¿Cuál es el total de deuda por estado?',
  '¿Cuál es la deuda promedio por cliente?',
  'Clientes sin contacto en los últimos 30 días',
];

interface Props {
  onSubmit: (question: string) => void;
  loading: boolean;
}

export function QueryInput({ onSubmit, loading }: Props) {
  const [value, setValue] = useState('');

  function handleSubmit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setValue(trimmed);
    onSubmit(trimmed);
  }

  return (
    <div className="border-b border-border px-4 py-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); handleSubmit(value); }}
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="¿Cuántos clientes tienen deuda vencida?"
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={loading || !value.trim()}>
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Generando…
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Search className="size-3.5" />
              Consultar
            </span>
          )}
        </Button>
      </form>

      {/* Suggestions */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleSubmit(s)}
            disabled={loading}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
