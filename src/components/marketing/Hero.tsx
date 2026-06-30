'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

const fadeUp = (delay: number) => ({
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { delay, duration: 0.5, ease: 'easeOut' as const },
  },
});

export function Hero() {
  return (
    <section className="relative flex min-h-[88vh] flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 50% -5%, rgba(59,130,246,0.1), transparent 70%)',
        }}
      />

      <div className="flex max-w-3xl flex-col items-center gap-6">
        <motion.span
          variants={fadeUp(0)}
          initial="hidden"
          animate="show"
          className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
        >
          <span className="size-1.5 rounded-full bg-secondary-500" />
          Disponible para proyectos
        </motion.span>

        <motion.h1
          variants={fadeUp(0.1)}
          initial="hidden"
          animate="show"
          className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl"
        >
          IA Conversacional
          <br />
          <span className="text-primary">con impacto real</span>
        </motion.h1>

        <motion.p
          variants={fadeUp(0.2)}
          initial="hidden"
          animate="show"
          className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          Portfolio de Luis Calderón — demos interactivas de agentes LLM: chatbot con RAG,
          voicebot con STT/TTS, y consultas en lenguaje natural a bases de datos.
        </motion.p>

        <motion.div
          variants={fadeUp(0.3)}
          initial="hidden"
          animate="show"
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="#demos" className={buttonVariants({ size: 'lg' })}>
            Ver Demos →
          </Link>
          <Link href="#stack" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Tech Stack
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
