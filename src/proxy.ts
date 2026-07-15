import { type NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMIT } from '@/lib/rate-limiter';
import { extractBearerToken, verifyDemoToken } from '@/lib/jwt';

const PROTECTED = ['/api/chat', '/api/voice/', '/api/db/query', '/api/csat', '/api/support-chat'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!PROTECTED.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Rate limit by IP
  const ip = (req.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
  const { allowed, remaining, resetAt } = checkRateLimit(ip);

  const rlHeaders = {
    'X-RateLimit-Limit': String(RATE_LIMIT),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  };

  if (!allowed) {
    return NextResponse.json(
      { error: 'Límite de solicitudes alcanzado. Intenta en 1 hora.' },
      {
        status: 429,
        headers: {
          ...rlHeaders,
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  // JWT verification
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: rlHeaders });
  }

  try {
    await verifyDemoToken(token);
  } catch {
    return NextResponse.json(
      { error: 'Token inválido o expirado' },
      { status: 401, headers: rlHeaders },
    );
  }

  const res = NextResponse.next();
  Object.entries(rlHeaders).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export const config = {
  matcher: ['/api/chat', '/api/voice/:path*', '/api/db/query', '/api/csat', '/api/support-chat'],
};
