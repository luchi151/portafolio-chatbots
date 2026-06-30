'use client';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { DBQueryResponse } from '@/types';

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

interface Props {
  results: DBQueryResponse['results'];
  visualization: DBQueryResponse['visualization'];
}

export function DataVisualization({ results, visualization }: Props) {
  if (results.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">La consulta no retornó resultados.</p>
      </div>
    );
  }

  const cfg = visualization.config as { xAxis?: string; yAxis?: string; title?: string };
  const xKey = cfg.xAxis ?? Object.keys(results[0])[0];
  const yKey = cfg.yAxis ?? Object.keys(results[0])[1];

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
      {/* Chart (if not table) */}
      {visualization.type !== 'table' && results.length > 0 && (
        <div>
          {cfg.title && (
            <p className="mb-2 text-center text-xs font-medium text-muted-foreground">{cfg.title}</p>
          )}
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              {visualization.type === 'bar' ? (
                <BarChart data={results} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={55} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey={yKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : visualization.type === 'line' ? (
                <LineChart data={results} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={55} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey={yKey} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              ) : (
                <PieChart>
                  <Pie
                    data={results}
                    dataKey={yKey}
                    nameKey={xKey}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {results.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table — always shown */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {Object.keys(results[0]).map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-medium text-muted-foreground"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((row, i) => (
              <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                {Object.values(row).map((cell, j) => (
                  <td key={j} className="px-3 py-2 font-mono text-foreground/80">
                    {cell === null ? (
                      <span className="text-muted-foreground">NULL</span>
                    ) : typeof cell === 'object' ? (
                      JSON.stringify(cell)
                    ) : (
                      String(cell)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
