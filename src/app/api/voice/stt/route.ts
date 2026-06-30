import { type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 15;

interface DeepgramResponse {
  results?: {
    channels?: Array<{
      alternatives?: Array<{ transcript: string; confidence: number }>;
    }>;
  };
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? 'dev-secret-change-in-prod',
    );
    await jwtVerify(auth.slice(7), secret);
  } catch {
    return Response.json({ error: 'Token inválido' }, { status: 401 });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'STT no configurado — agrega DEEPGRAM_API_KEY a .env.local' },
      { status: 503 },
    );
  }

  const contentType = req.headers.get('content-type') ?? 'audio/webm';
  const audioBuffer = await req.arrayBuffer();

  if (audioBuffer.byteLength === 0) {
    return Response.json({ error: 'Audio vacío' }, { status: 400 });
  }

  const res = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-2&language=es&smart_format=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': contentType,
      },
      body: audioBuffer,
    },
  );

  if (!res.ok) {
    return Response.json({ error: 'Error en STT service' }, { status: 502 });
  }

  const data = (await res.json()) as DeepgramResponse;
  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
  const confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence ?? 0;

  return Response.json({ transcript, confidence });
}
