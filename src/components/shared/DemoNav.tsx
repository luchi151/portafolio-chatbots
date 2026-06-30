'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const DEMOS = [
  { label: 'Chatbot RAG', href: '/demos/chatbot' },
  { label: 'Voicebot', href: '/demos/voicebot' },
  { label: 'NL → SQL', href: '/demos/db-query' },
] as const;

export function DemoNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-0 overflow-x-auto px-4" aria-label="Navegación de demos">
      {DEMOS.map(({ label, href }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
