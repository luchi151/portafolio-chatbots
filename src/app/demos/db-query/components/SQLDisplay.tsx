import type { ReactNode } from 'react';
import { Clock, Database, Rows3 } from 'lucide-react';

// ─── SQL Syntax Highlighter ───────────────────────────────────────────────────

const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'GROUP', 'BY', 'ORDER', 'HAVING',
  'LIMIT', 'OFFSET', 'AND', 'OR', 'NOT', 'AS', 'LEFT', 'RIGHT', 'INNER',
  'OUTER', 'FULL', 'CROSS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'ROUND', 'COALESCE', 'CAST', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'NULL',
  'IS', 'IN', 'LIKE', 'BETWEEN', 'DESC', 'ASC', 'WITH', 'UNION', 'ALL',
  'EXISTS', 'OVER', 'PARTITION', 'ILIKE', 'ANY', 'SOME', 'TRUE', 'FALSE',
]);

type Token = { type: 'keyword' | 'string' | 'number' | 'other'; value: string };

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  const re = /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[^\w\s]|\s+)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(sql)) !== null) {
    const v = match[0];
    if (/^\s+$/.test(v)) {
      tokens.push({ type: 'other', value: v });
    } else if (/^'/.test(v) || /^"/.test(v)) {
      tokens.push({ type: 'string', value: v });
    } else if (/^\d/.test(v)) {
      tokens.push({ type: 'number', value: v });
    } else if (KEYWORDS.has(v.toUpperCase())) {
      tokens.push({ type: 'keyword', value: v });
    } else {
      tokens.push({ type: 'other', value: v });
    }
  }

  return tokens;
}

function renderSQL(sql: string): ReactNode[] {
  return tokenize(sql).map((tok, i) => {
    if (tok.type === 'keyword') {
      return (
        <span key={i} className="font-bold text-primary">
          {tok.value}
        </span>
      );
    }
    if (tok.type === 'string') {
      return (
        <span key={i} className="text-[#10b981]">
          {tok.value}
        </span>
      );
    }
    if (tok.type === 'number') {
      return (
        <span key={i} className="text-[#f59e0b]">
          {tok.value}
        </span>
      );
    }
    return <span key={i}>{tok.value}</span>;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  sql: string;
  usedRealDB: boolean;
  metadata: { executionTime: number; rowCount: number };
}

export function SQLDisplay({ sql, usedRealDB, metadata }: Props) {
  return (
    <div className="border-b border-border px-4 py-3">
      {/* Header */}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Database className="size-3.5" />
          <span>SQL generado</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {usedRealDB && (
            <span className="flex items-center gap-1 rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-2 py-0.5 text-[11px] text-[#10b981]">
              <Clock className="size-3" />
              {metadata.executionTime}ms
            </span>
          )}
          <span className="flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
            <Rows3 className="size-3" />
            {metadata.rowCount} filas
          </span>
          {!usedRealDB && (
            <span className="rounded-full border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-2 py-0.5 text-[11px] text-[#f59e0b]">
              datos de muestra (sin BD)
            </span>
          )}
        </div>
      </div>

      {/* SQL code block */}
      <pre className="overflow-x-auto rounded-lg bg-muted/60 p-3 font-mono text-[12px] leading-relaxed">
        {renderSQL(sql)}
      </pre>
    </div>
  );
}
