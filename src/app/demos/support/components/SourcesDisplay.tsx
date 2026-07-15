'use client';

import { useState } from 'react';
import type { RagSource } from '@/types';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

export function SourcesDisplay({ sources }: { sources: RagSource[] }) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) {
    return (
      <div className="mb-1.5 rounded-lg border border-warning/30 bg-warning/5 px-2.5 py-1.5 text-xs text-muted-foreground">
        Sin resultados relevantes en la base de conocimiento.
      </div>
    );
  }

  return (
    <div className="mb-1.5 rounded-lg border border-secondary/30 bg-secondary/5 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left"
      >
        <FileText className="size-3 shrink-0 text-secondary" />
        <span className="font-medium text-secondary">
          {sources.length} {sources.length === 1 ? 'fuente' : 'fuentes'}
        </span>
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-secondary/20 px-2.5 py-2">
          {sources.map((s, i) => (
            <div key={s.id} className="border-b border-secondary/10 pb-2 last:border-0 last:pb-0">
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  [{i + 1}] {s.title}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {Math.round(s.similarity * 100)}% similitud
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-foreground/80">{s.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
