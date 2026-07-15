@AGENTS.md

# Portafolio Interactivo con Demos de IA Conversacional

Portafolio profesional que demuestra capacidades en IA conversacional mediante demos interactivas: chatbot con RAG, voicebot con speech-to-text/TTS, y consultas en lenguaje natural a bases de datos.

## Commands

- `pnpm dev` — Start development server (http://localhost:3000)
- `pnpm build` — Production build
- `pnpm start` — Run production build locally
- `pnpm lint` — Run ESLint
- `pnpm test` — Run unit tests (Vitest)
- `pnpm test:e2e` — Run E2E tests (Playwright)
- `pnpm drizzle-kit push` — Push schema changes to database
- `pnpm drizzle-kit generate` — Generate migrations
- `pnpm tsx src/lib/db/seed.ts` — Seed database with demo data
- `pnpm tsx src/lib/db/migrate-knowledge-base.ts` — Enable pgvector and create the knowledge_base table
- `pnpm tsx src/lib/db/seed-knowledge.ts` — Generate embeddings and seed the RAG support-chat knowledge base

## Tech Stack

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui (base-nova, @base-ui/react) + Supabase (PostgreSQL) + Drizzle ORM + LangGraph.js + DeepSeek/Groq (LLMs) + Framer Motion + Recharts

## Next.js 16 Breaking Changes (vs blueprint which targets v15)

1. **`middleware.ts` → `proxy.ts`**: Middleware file renamed; exported function is `proxy`, not `middleware`.
2. **All request APIs are async**: `cookies()`, `headers()`, `params`, `searchParams` — always use `await`.
3. **Turbopack by default**: `next dev` already uses Turbopack — do NOT add `--turbopack`.
4. **`next lint` removed**: Use `eslint` directly.

## Architecture

### Directory Structure
- `src/app/(marketing)/` — Landing page (public, no auth)
- `src/app/demos/` — 3 demos interactivas (chatbot, voicebot, db-query)
- `src/app/api/` — API routes (serverless functions)
- `src/components/ui/` — shadcn/ui components (base-nova style)
- `src/components/marketing/` — Landing page components
- `src/components/shared/` — Shared components (modals, banners)
- `src/lib/agents/` — LangGraph agents (chatbot, db-query)
- `src/lib/db/` — Drizzle schema + client
- `src/lib/supabase/` — Supabase clients (browser + server)
- `src/proxy.ts` — Rate limiting + auth verification (Next.js 16 middleware)

### Data Flow
**Server Components (default):**
- Landing page is static (no fetches)
- Analytics dashboard fetches directly from DB

**Client Components ("use client"):**
- Demos: useState for messages, streaming responses
- Auth modal: dialog state

**API Routes:**
- POST `/api/chat` → LangGraph agent → DeepSeek/Groq → streaming response
- POST `/api/voice/stt` → Deepgram (fallback of Web Speech API)
- POST `/api/voice/tts` → ElevenLabs
- POST `/api/db/query` → NL → SQL validation → execute → return results
- POST `/api/auth/demo-token` → validate document_id → generate JWT

### Key Patterns
- **Server Components by default.** Only add "use client" when component needs browser APIs, useState, or event handlers.
- **All database queries go through Drizzle ORM.** No raw SQL except in `db-query` demo (validated with whitelist).
- **Rate limiting in proxy.ts.** Check JWT or IP-based session before allowing API calls.
- **RLS policies enforce data isolation.** Demo users only see their customer data.

## Code Organization Rules

1. **One component per file.** Max 300 lines. If longer, extract sub-components.
2. **Path alias:** Use `@/` for `src/` imports. Example: `import { db } from '@/lib/db'`
3. **No barrel exports.** Import directly: `import { Button } from '@/components/ui/button'`
4. **Server Components by default.** Only add `"use client"` when component needs interactivity.
5. **Colocate page-specific components.** Keep in `app/[route]/components/` next to `page.tsx`.

## Design System

### Colors
- Primary (blue): `#3b82f6` — buttons, links, accents
- Secondary (green): `#10b981` — success states, "active" badges
- Accent (purple): `#8b5cf6` — AI-related elements (tool calls)
- Grays: `#f9fafb` (bg), `#111827` (text), `#6b7280` (muted)
- Semantic: `#ef4444` (error), `#f59e0b` (warning), `#10b981` (success)

### Typography
- Headings: `Inter`, weights 600-800
- Body: System fonts (`-apple-system, BlinkMacSystemFont, Segoe UI, ...`)
- Code: `JetBrains Mono` (SQL display, JSON, tool calls)

### Style
- Border radius: `8px` (buttons), `12px` (cards), `16px` (modals), full (avatars)
- Shadows: subtle (`shadow-sm` on cards, `shadow-md` on modals)
- Spacing base: `4px` (Tailwind default scale)
- Aesthetic: clean, modern, minimal — rounded corners, smooth animations

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL Transaction pooler URL (Supabase, port 6543) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `JWT_SECRET` | Secret for signing demo JWTs (`openssl rand -base64 32`) |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `GROQ_API_KEY` | Groq API key |
| `LLAMAPARSE_API_KEY` | LlamaParse API key |
| `DEEPGRAM_API_KEY` | Deepgram API key (optional, fallback STT) |
| `ELEVENLABS_API_KEY` | ElevenLabs API key (optional, TTS) |

## Reglas No Negociables

1. **TypeScript strict mode.** No `any` — usar `unknown` con type guards.
2. **Rate limiting obligatorio.** 10 requests/hora para demos públicas (proxy.ts).
3. **SQL injection prevention.** Drizzle ORM para todo. En demo DB query: whitelist de solo SELECT.
4. **File upload validation.** Max 10MB, solo PDF/PNG/JPG, validar magic bytes.
5. **Mobile-first responsive.** Test en viewport 375px antes de marcar completo.
6. **Error boundaries en cada demo.** Cada `/demos/*` necesita `<ErrorBoundary>`.
7. **No hardcodear secrets.** `.env.local` en dev, Vercel env vars en prod.
