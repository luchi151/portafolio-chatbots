import { type NextRequest } from 'next/server';
import { signDemoToken } from '@/lib/jwt';

export const runtime = 'nodejs';

interface RequestBody {
  documentId: string;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 });
  }

  const documentId = body.documentId?.trim();
  if (!documentId) {
    return Response.json({ error: 'documentId es requerido' }, { status: 400 });
  }

  let customerId: string;

  if (process.env.DATABASE_URL) {
    // Query real DB
    try {
      const { db } = await import('@/lib/db');
      const { customers } = await import('@/lib/db/schema');
      const { eq } = await import('drizzle-orm');

      const rows = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.documentId, documentId))
        .limit(1);

      if (rows.length === 0) {
        return Response.json({ error: 'Cédula no encontrada en el sistema demo.' }, { status: 404 });
      }

      customerId = rows[0].id;
    } catch {
      return Response.json({ error: 'Error al verificar la cédula.' }, { status: 500 });
    }
  } else {
    // Demo mode: accept any non-empty documentId when no DB is configured.
    // In production this branch is unreachable.
    customerId = `demo-${documentId}`;
  }

  const sessionId = crypto.randomUUID();
  const token = await signDemoToken({ customerId, sessionId });

  return Response.json({ token });
}
