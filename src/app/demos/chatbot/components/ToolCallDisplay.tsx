'use client';

import { useState } from 'react';
import type { ToolCall } from '@/types';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';

export function ToolCallDisplay({ toolCall }: { toolCall: ToolCall }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-1.5 rounded-lg border border-accent/30 bg-accent/5 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left"
      >
        <Wrench className="size-3 shrink-0 text-accent" />
        <span className="font-mono font-medium text-accent">{toolCall.name}</span>
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </span>
      </button>
      {open && (
        <div className="border-t border-accent/20 px-2.5 py-2 font-mono">
          <p className="mb-1 text-muted-foreground">Input:</p>
          <pre className="overflow-x-auto whitespace-pre-wrap text-[11px] text-foreground/80">
            {JSON.stringify(toolCall.arguments, null, 2)}
          </pre>
          {toolCall.result !== null && (
            <>
              <p className="mb-1 mt-2 text-muted-foreground">Output:</p>
              <pre className="overflow-x-auto whitespace-pre-wrap text-[11px] text-foreground/80">
                {typeof toolCall.result === 'string'
                  ? toolCall.result
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
