import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Luis Calderón<span className="text-primary">.</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="#demos"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Demos
          </Link>
          <Link
            href="#stack"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Stack
          </Link>
          <Link
            href="mailto:luis.calderonf@cun.edu.co"
            className={buttonVariants({ size: 'sm' })}
          >
            Contacto
          </Link>
        </div>
      </nav>
    </header>
  );
}
