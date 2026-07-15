import type { NextRequest } from 'next/server';
import { getConversationDetail } from '@/lib/db/analytics-queries';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getConversationDetail(id);
  if (!detail) {
    return Response.json({ error: 'Conversación no encontrada' }, { status: 404 });
  }
  return Response.json(detail);
}
