import type { ReactNode } from 'react';
import Link from 'next/link';
import { DemoNav } from '@/components/shared/DemoNav';
import { DemoShell } from '@/components/shared/DemoShell';

export default function DemosLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Portafolio
          </Link>
          <span className="text-xs text-muted-foreground">Demo · IA Conversacional</span>
        </div>
        <DemoNav />
      </header>

      <DemoShell>
        <main className="flex flex-1 flex-col">{children}</main>
      </DemoShell>
    </div>
  );
}
