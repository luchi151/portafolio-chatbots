'use client';

import { motion } from 'framer-motion';
import { MessageSquare, Mic, Database, HelpCircle } from 'lucide-react';
import { DemoCard } from './DemoCard';

const DEMOS = [
  {
    title: 'Asistente de Cobranza',
    description:
      'Chatbot con RAG que responde preguntas sobre clientes, deudas y estados de cuenta usando documentos como contexto.',
    tags: ['LangGraph', 'DeepSeek', 'Supabase', 'RAG'],
    href: '/demos/chatbot',
    icon: <MessageSquare className="size-5" />,
    accentColor: '#3b82f6',
  },
  {
    title: 'Agente de Voz',
    description:
      'Interacción por voz con STT en tiempo real, LLM para razonamiento, y TTS para respuestas naturales.',
    tags: ['Deepgram', 'ElevenLabs', 'Groq'],
    href: '/demos/voicebot',
    icon: <Mic className="size-5" />,
    accentColor: '#10b981',
  },
  {
    title: 'Consultas en Lenguaje Natural',
    description:
      'Convierte preguntas en lenguaje natural a SQL seguro y muestra los resultados en gráficas interactivas.',
    tags: ['DeepSeek', 'Drizzle', 'PostgreSQL', 'Recharts'],
    href: '/demos/db-query',
    icon: <Database className="size-5" />,
    accentColor: '#8b5cf6',
  },
  {
    title: 'Soporte con RAG',
    description:
      'Chat de FAQ/políticas que recupera contexto real desde una base de conocimiento vectorial antes de responder.',
    tags: ['Voyage AI', 'pgvector', 'DeepSeek', 'RAG'],
    href: '/demos/support',
    icon: <HelpCircle className="size-5" />,
    accentColor: '#f59e0b',
  },
] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

export function DemoCardsSection() {
  return (
    <section id="demos" className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <h2 className="mb-3 text-center text-2xl font-bold sm:text-3xl">
            Demos Interactivas
          </h2>
          <p className="mb-10 text-center text-muted-foreground">
            Agentes de IA conversacional listos para explorar
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {DEMOS.map((demo) => (
            <motion.div key={demo.href} variants={item}>
              <DemoCard {...demo} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
