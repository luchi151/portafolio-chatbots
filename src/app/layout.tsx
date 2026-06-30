import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portafolio-chatbots.vercel.app';
const TITLE = 'Luis Calderón | IA Conversacional';
const DESCRIPTION =
  'Portafolio interactivo con demos en vivo de IA conversacional: chatbot con RAG y tool calling, voicebot con STT/TTS, y consultas en lenguaje natural a PostgreSQL.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | Luis Calderón',
  },
  description: DESCRIPTION,
  keywords: [
    'IA conversacional',
    'chatbot RAG',
    'LangGraph',
    'LLM agents',
    'voicebot',
    'NL to SQL',
    'Next.js',
    'DeepSeek',
    'Supabase',
  ],
  authors: [{ name: 'Luis Calderón', url: `mailto:luis.calderonf@cun.edu.co` }],
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    url: SITE_URL,
    siteName: 'Luis Calderón — Portafolio IA',
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Portafolio IA Conversacional — Luis Calderón',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.png'],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#3b82f6',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
