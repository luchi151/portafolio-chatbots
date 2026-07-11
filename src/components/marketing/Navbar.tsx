'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/#demos', label: 'Demos' },
  { href: '/#stack', label: 'Stack' },
  { href: '/analytics', label: 'Analytics' },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight" onClick={() => setOpen(false)}>
          Luis Calderón<span className="text-primary">.</span>
        </Link>
        <div className="flex items-center gap-4">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              {label}
            </Link>
          ))}
          <Link
            href="mailto:luis.calderonf@cun.edu.co"
            className={cn(buttonVariants({ size: 'sm' }), 'hidden sm:inline-flex')}
          >
            Contacto
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav-menu"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'sm:hidden')}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>
      {open && (
        <div id="mobile-nav-menu" className="border-t border-border bg-background sm:hidden">
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-3">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {label}
              </Link>
            ))}
            <Link
              href="mailto:luis.calderonf@cun.edu.co"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ size: 'sm' }), 'justify-start')}
            >
              Contacto
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
