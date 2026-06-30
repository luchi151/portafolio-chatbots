import { type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const MAX_BYTES = 10 * 1024 * 1024;

// Magic bytes for basic file validation
const MAGIC: Record<string, Uint8Array> = {
  'application/pdf': new Uint8Array([0x25, 0x50, 0x44, 0x46]),  // %PDF
  'image/png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),         // .PNG
  'image/jpeg': new Uint8Array([0xff, 0xd8, 0xff]),               // JPEG SOI
};

async function matchesMagic(file: File): Promise<boolean> {
  const expected = MAGIC[file.type];
  if (!expected) return false;
  const buf = new Uint8Array(await file.slice(0, expected.length).arrayBuffer());
  return expected.every((b, i) => buf[i] === b);
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-in-prod');
    await jwtVerify(auth.slice(7), secret);
  } catch {
    return Response.json({ error: 'Token inválido' }, { status: 401 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    file = form.get('file') as File | null;
  } catch {
    return Response.json({ error: 'Form data inválido' }, { status: 400 });
  }

  if (!file) return Response.json({ error: 'Se requiere un archivo' }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json({ error: 'Solo se aceptan PDF, PNG y JPG' }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'El archivo excede 10 MB' }, { status: 413 });
  }
  if (!(await matchesMagic(file))) {
    return Response.json({ error: 'El archivo no coincide con el tipo declarado' }, { status: 415 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({
      error: 'Almacenamiento no configurado. Agrega NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    }, { status: 503 });
  }

  try {
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const path = `demo/${crypto.randomUUID()}.${ext}`;

    // Upload via Supabase Storage REST API (avoids SSR client complications)
    const uploadRes = await fetch(
      `${supabaseUrl}/storage/v1/object/documents/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': file.type,
          'x-upsert': 'false',
        },
        body: await file.arrayBuffer(),
      },
    );

    if (!uploadRes.ok) {
      const err = (await uploadRes.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message ?? `Storage upload failed: ${uploadRes.status}`);
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/documents/${path}`;
    return Response.json({ url: publicUrl, path });
  } catch (err) {
    console.error('[docs/upload]', err);
    return Response.json({ error: 'Error al subir el archivo' }, { status: 500 });
  }
}
