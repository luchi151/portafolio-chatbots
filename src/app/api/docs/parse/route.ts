import { type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const LLAMAPARSE_BASE = 'https://api.cloud.llamaindex.ai';
const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

async function verifyJWT(auth: string | null): Promise<boolean> {
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-in-prod');
    await jwtVerify(auth.slice(7), secret);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyJWT(req.headers.get('authorization')))) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
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

  const apiKey = process.env.LLAMAPARSE_API_KEY;

  // Demo fallback — no API key configured
  if (!apiKey) {
    return Response.json({
      content: demoContent(file.name),
      pages: 1,
      demo: true,
    });
  }

  try {
    // 1. Upload to LlamaParse
    const uploadForm = new FormData();
    uploadForm.append('file', file);

    const uploadRes = await fetch(`${LLAMAPARSE_BASE}/api/parsing/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      throw new Error(`LlamaParse upload failed: ${uploadRes.status}`);
    }

    const { id: jobId } = (await uploadRes.json()) as { id: string };

    // 2. Poll until done (max 25s)
    let status = 'PENDING';
    const deadline = Date.now() + 25_000;
    while (status === 'PENDING' || status === 'PROCESSING') {
      if (Date.now() > deadline) throw new Error('LlamaParse timeout');
      await new Promise((r) => setTimeout(r, 1500));

      const statusRes = await fetch(`${LLAMAPARSE_BASE}/api/parsing/job/${jobId}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      });
      if (!statusRes.ok) throw new Error(`LlamaParse status check failed`);
      const data = (await statusRes.json()) as { status: string; num_pages?: number };
      status = data.status;

      if (status === 'SUCCESS') {
        // 3. Fetch markdown result
        const resultRes = await fetch(
          `${LLAMAPARSE_BASE}/api/parsing/job/${jobId}/result/markdown`,
          { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } },
        );
        if (!resultRes.ok) throw new Error('LlamaParse result fetch failed');
        const { markdown } = (await resultRes.json()) as { markdown: string };
        return Response.json({ content: markdown.slice(0, 8000), pages: data.num_pages ?? 1, demo: false });
      }

      if (status === 'ERROR') throw new Error('LlamaParse processing error');
    }

    throw new Error('LlamaParse unexpected status: ' + status);
  } catch (err) {
    console.error('[docs/parse]', err);
    // Graceful fallback to demo content on any LlamaParse error
    return Response.json({ content: demoContent(file.name), pages: 1, demo: true });
  }
}

function demoContent(filename: string): string {
  return `[Demo] Contenido simulado para "${filename}"\n\n` +
    `Este documento contiene información sobre deuda financiera del cliente.\n\n` +
    `Resumen de cuenta:\n` +
    `- Saldo actual: $4.250.000 COP\n` +
    `- Fecha de vencimiento: 15/07/2026\n` +
    `- Estado: En mora (45 días)\n` +
    `- Tasa de interés: 2.4% mensual\n\n` +
    `Historial de pagos:\n` +
    `- Enero 2026: $500.000 COP — PAGADO\n` +
    `- Febrero 2026: $500.000 COP — PAGADO\n` +
    `- Marzo 2026: $500.000 COP — PENDIENTE\n\n` +
    `(Agrega LLAMAPARSE_API_KEY para parsear documentos reales.)`;
}
