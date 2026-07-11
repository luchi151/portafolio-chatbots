import { SignJWT, jwtVerify } from 'jose';

const DEV_FALLBACK_SECRET = 'dev-secret-change-in-prod';

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? DEV_FALLBACK_SECRET);
}

export interface DemoTokenClaims {
  customerId: string;
  sessionId: string;
}

export async function signDemoToken(claims: DemoTokenClaims): Promise<string> {
  return new SignJWT({ customerId: claims.customerId, sessionId: claims.sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.customerId)
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret());
}

export async function verifyDemoToken(token: string): Promise<DemoTokenClaims> {
  const { payload } = await jwtVerify(token, getSecret());

  if (typeof payload.customerId !== 'string' || typeof payload.sessionId !== 'string') {
    throw new Error('Token payload inválido');
  }

  return { customerId: payload.customerId, sessionId: payload.sessionId };
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
