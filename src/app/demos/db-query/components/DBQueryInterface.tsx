'use client';

import { useState } from 'react';
import { useAuth } from '@/components/shared/DemoShell';
import type { DBQueryResponse } from '@/types';
import { QueryInput } from './QueryInput';
import { SQLDisplay } from './SQLDisplay';
import { DataVisualization } from './DataVisualization';
import { Database } from 'lucide-react';

interface QueryResult extends DBQueryResponse {
  usedRealDB: boolean;
}

export function DBQueryInterface() {
  const { token, setRateLimited } = useAuth();
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleQuery(question: string) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/db/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question }),
      });

      const data = (await res.json()) as QueryResult & { error?: string };

      if (!res.ok) {
        if (res.status === 429) {
          const resetSec = Number(res.headers.get('X-RateLimit-Reset') ?? 0);
          setRateLimited(resetSec ? resetSec * 1000 : Date.now() + 3_600_000);
        }
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la consulta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Query input */}
      <QueryInput onSubmit={handleQuery} loading={loading} />

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Results */}
      {result ? (
        <>
          <SQLDisplay
            sql={result.sql}
            usedRealDB={result.usedRealDB}
            metadata={result.metadata}
          />
          <DataVisualization results={result.results} visualization={result.visualization} />
        </>
      ) : !loading && !error ? (
        <EmptyState />
      ) : null}

      {/* Loading skeleton */}
      {loading && <LoadingSkeleton />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-[#8b5cf6]/10 text-[#8b5cf6]">
        <Database className="size-6" />
      </div>
      <div>
        <p className="text-sm font-semibold">Consultas en Lenguaje Natural → SQL</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Escribe una pregunta en español. El agente genera SQL, lo ejecuta contra la base de datos
          y visualiza los resultados automáticamente.
        </p>
      </div>
      <div className="mt-1 rounded-lg border border-[#8b5cf6]/20 bg-[#8b5cf6]/5 px-3 py-2 text-xs text-[#8b5cf6]">
        <span className="font-mono">DeepSeek → SQL → PostgreSQL → Recharts</span>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* SQL skeleton */}
      <div className="rounded-lg border border-border p-3">
        <div className="mb-2 h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="space-y-1.5">
          {[80, 60, 70, 50].map((w, i) => (
            <div key={i} className={`h-3 animate-pulse rounded bg-muted`} style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
      {/* Table skeleton */}
      <div className="rounded-lg border border-border">
        <div className="border-b border-border bg-muted/50 px-3 py-2">
          <div className="flex gap-4">
            {[30, 25, 20, 15].map((w, i) => (
              <div key={i} className="h-3 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex gap-4 border-b border-border/50 px-3 py-2">
            {[30, 25, 20, 15].map((w, j) => (
              <div key={j} className="h-3 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
