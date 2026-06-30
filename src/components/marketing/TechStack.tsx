'use client';

import { motion } from 'framer-motion';

const STACK = [
  { name: 'Next.js 16', category: 'Framework' },
  { name: 'React 19', category: 'UI' },
  { name: 'TypeScript', category: 'Language' },
  { name: 'Tailwind v4', category: 'Styling' },
  { name: 'LangGraph.js', category: 'AI Agents' },
  { name: 'DeepSeek', category: 'LLM' },
  { name: 'Groq', category: 'LLM' },
  { name: 'Supabase', category: 'Database' },
  { name: 'Drizzle ORM', category: 'ORM' },
  { name: 'Deepgram', category: 'STT' },
  { name: 'ElevenLabs', category: 'TTS' },
  { name: 'Vercel', category: 'Deploy' },
] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

export function TechStack() {
  return (
    <section id="stack" className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <h2 className="mb-3 text-center text-2xl font-bold sm:text-3xl">Tech Stack</h2>
          <p className="mb-10 text-center text-muted-foreground">
            Herramientas de producción para agentes de IA conversacional
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
        >
          {STACK.map(({ name, category }) => (
            <motion.div
              key={name}
              variants={item}
              className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
            >
              <span className="text-sm font-medium">{name}</span>
              <span className="text-xs text-muted-foreground">{category}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
