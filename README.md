# Portafolio IA Conversacional

Portafolio interactivo con tres demos en vivo que demuestran capacidades en agentes LLM, RAG, voice AI y consultas en lenguaje natural a bases de datos. Construido con Next.js 16 App Router.

**Demo en vivo:** https://portafolio-chatbots.vercel.app

---

## Demos

### 1. Asistente de Cobranza (Chatbot RAG)
Chatbot con streaming SSE que responde preguntas sobre deudas en COP. Soporta adjuntar documentos PDF/PNG/JPG — los parsea con LlamaParse y los inyecta como contexto al LLM. Usa DeepSeek con fallback a Groq (Llama 3.1 70B).

### 2. Agente de Voz (Voicebot)
Interfaz de voz que combina Web Speech API (STT nativo del browser) con ElevenLabs (TTS). Visualización de onda de audio en CSS puro. Deepgram como alternativa STT si está configurado.

### 3. Consultas en Lenguaje Natural (NL → SQL)
El usuario escribe en español; un LLM genera SQL; el sistema valida que sea solo `SELECT` y lo ejecuta contra PostgreSQL. Los resultados se visualizan con tablas y gráficas (Recharts: barras, líneas, torta).

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16.2 (App Router, Turbopack) |
| Lenguaje | TypeScript 5 strict |
| Estilos | Tailwind CSS v4 + shadcn/ui (base-nova) |
| Animaciones | Framer Motion 12 |
| BD / ORM | Supabase PostgreSQL + Drizzle ORM |
| Storage | Supabase Storage |
| LLMs | DeepSeek Chat + Groq (Llama 3.1 70B) |
| Agentes | LangGraph.js |
| Voz | ElevenLabs TTS + Deepgram STT |
| Parsing | LlamaParse |
| Auth | JWT (jose) — tokens demo de 24h |
| Testing | Vitest 4 (unit) + Playwright 1.61 (E2E) |
| Deploy | Vercel (región iad1) |

---

## Setup local

### Requisitos
- Node.js 20+
- pnpm 11+
- Cuenta en Supabase (gratis)

### 1. Clonar e instalar
```bash
git clone https://github.com/tu-usuario/portafolio-chatbots.git
cd portafolio-chatbots
pnpm install
```

### 2. Variables de entorno
```bash
cp .env.example .env.local
```

Edita `.env.local` con tus valores. El mínimo para que funcione:

```env
DATABASE_URL=postgresql://postgres.[ref]:[pass]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
JWT_SECRET=                          # openssl rand -base64 32
DEEPSEEK_API_KEY=                    # o GROQ_API_KEY — al menos uno
```

Las demás variables son opcionales: sin ellas los demos funcionan en modo degradado con respuestas simuladas.

### 3. Base de datos
```bash
# Empuja el schema a Supabase
pnpm drizzle-kit push

# Carga los datos demo (15 clientes colombianos + 8 conversaciones)
pnpm tsx src/lib/db/seed.ts
```

### 4. Levantar el servidor
```bash
pnpm dev
# → http://localhost:3000
```

---

## Deploy en Vercel

### 1. Importar el repo
En [vercel.com/new](https://vercel.com/new) selecciona el repositorio. Vercel detecta Next.js automáticamente; el `vercel.json` ya tiene `buildCommand` e `installCommand` configurados.

### 2. Variables de entorno
En **Settings → Environment Variables** agrega las mismas variables de `.env.local`. El campo `NEXT_PUBLIC_APP_URL` debe apuntar a tu dominio de Vercel:

```
NEXT_PUBLIC_APP_URL=https://tu-proyecto.vercel.app
```

### 3. Deploy
Vercel hace deploy automático en cada push a `main`. Para el primer deploy haz clic en **Deploy** en el dashboard.

### 4. Seed en producción
Corre el seed una vez apuntando a la BD de producción:
```bash
DATABASE_URL="postgresql://..." pnpm tsx src/lib/db/seed.ts
```

### Verificar el deploy
```
GET /api/health
```
Devuelve `{ status: "ok" | "degraded", checks: { db, jwt, llm, voice } }`. Si alguna variable falta, `status` será `"degraded"` pero el sitio sigue funcionando.

---

## Tests

```bash
# Unit tests (Vitest) — sql-validator + rate-limiter
pnpm test

# E2E tests (Playwright) — requiere pnpm dev corriendo
npx playwright install   # primera vez — descarga browsers
pnpm test:e2e

# E2E con UI interactiva
pnpm test:e2e:ui
```

**Cobertura actual:** 29 unit tests + 18 E2E tests.

---

## Arquitectura

```
portafolio-chatbots/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing page (Server Component, estático)
│   │   ├── layout.tsx                  # Root layout + metadata OG
│   │   ├── demos/
│   │   │   ├── chatbot/                # Demo 1 — RAG
│   │   │   ├── voicebot/               # Demo 2 — Voz
│   │   │   └── db-query/               # Demo 3 — NL→SQL
│   │   └── api/
│   │       ├── auth/demo-token/        # POST — genera JWT demo
│   │       ├── chat/                   # POST — streaming SSE (DeepSeek/Groq)
│   │       ├── voice/stt/              # POST — Deepgram STT
│   │       ├── voice/tts/              # POST — ElevenLabs TTS
│   │       ├── db/query/               # POST — NL→SQL→execute
│   │       ├── docs/parse/             # POST — LlamaParse
│   │       ├── docs/upload/            # POST — Supabase Storage
│   │       ├── analytics/              # POST — fire-and-forget
│   │       └── health/                 # GET  — health check
│   ├── components/
│   │   ├── marketing/                  # Hero, Navbar, DemoCards, TechStack, Footer
│   │   ├── shared/                     # DemoShell, DemoNav, AuthModal, RateLimitBanner
│   │   └── ui/                         # shadcn/ui: Button, Card, Input, Dialog, Badge
│   ├── lib/
│   │   ├── db/                         # Drizzle client + schema + seed
│   │   ├── supabase/                   # Clientes browser y server
│   │   ├── sql-validator.ts            # Whitelist SELECT — bloquea DDL e inyecciones
│   │   └── rate-limiter.ts             # In-memory Map, 10 req/h por IP
│   └── proxy.ts                        # Middleware Next.js 16 — rate limit + JWT verify
├── tests/
│   ├── unit/                           # sql-validator, rate-limiter
│   └── e2e/                            # chatbot-flow (landing, auth, nav, mobile)
├── vercel.json                         # Deploy config + security headers
└── drizzle.config.ts                   # ORM config
```

### Flujo de autenticación demo
1. El usuario ingresa su número de cédula en el `AuthModal`.
2. El frontend llama `POST /api/auth/demo-token` → el servidor genera un JWT HS256 firmado con `JWT_SECRET` (24h de expiración).
3. Todos los requests a `/api/chat`, `/api/voice/*` y `/api/db/query` llevan el token en el header `Authorization: Bearer <token>`.
4. `proxy.ts` verifica el JWT **y** aplica rate limiting (10 req/hora por IP) antes de dejar pasar el request.

### Rate limiting
- Implementado en `src/lib/rate-limiter.ts` con un `Map` en memoria.
- Cuando se supera el límite, el middleware devuelve `429` con el header `X-RateLimit-Reset` (Unix timestamp).
- `RateLimitBanner` en el cliente muestra un countdown y se auto-descarta cuando expira.

---

## Variables de entorno — referencia completa

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DATABASE_URL` | Sí | PostgreSQL Transaction pooler (Supabase, puerto 6543) |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Anon key de Supabase |
| `JWT_SECRET` | Sí | Secret para firmar tokens (`openssl rand -base64 32`) |
| `DEEPSEEK_API_KEY` | Uno de los dos | API key de DeepSeek |
| `GROQ_API_KEY` | Uno de los dos | API key de Groq (fallback LLM) |
| `LLAMAPARSE_API_KEY` | No | Sin clave: el parser devuelve contenido simulado |
| `DEEPGRAM_API_KEY` | No | Sin clave: STT usa Web Speech API del browser |
| `ELEVENLABS_API_KEY` | No | Sin clave: TTS deshabilitado en voicebot |
| `NEXT_PUBLIC_APP_URL` | No | URL base para OG/canonical (default: URL de Vercel) |

---

## Licencia

MIT — Luis Calderón · [luis.calderonf@cun.edu.co](mailto:luis.calderonf@cun.edu.co)
