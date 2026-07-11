import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { extractBearerToken, signDemoToken, verifyDemoToken } from '@/lib/jwt';

const ORIGINAL_SECRET = process.env.JWT_SECRET;

describe('extractBearerToken', () => {
  it('extracts the token from a well-formed header', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('returns null when the header is missing', () => {
    expect(extractBearerToken(null)).toBeNull();
  });

  it('returns null when the header has no Bearer prefix', () => {
    expect(extractBearerToken('abc.def.ghi')).toBeNull();
  });

  it('returns null for a different auth scheme', () => {
    expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull();
  });
});

describe('signDemoToken / verifyDemoToken', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-jwt-suite';
  });

  afterEach(() => {
    process.env.JWT_SECRET = ORIGINAL_SECRET;
  });

  it('round-trips customerId and sessionId', async () => {
    const token = await signDemoToken({ customerId: 'cust-1', sessionId: 'sess-1' });
    const claims = await verifyDemoToken(token);
    expect(claims).toEqual({ customerId: 'cust-1', sessionId: 'sess-1' });
  });

  it('rejects a token signed with a different secret', async () => {
    process.env.JWT_SECRET = 'secret-a';
    const token = await signDemoToken({ customerId: 'cust-1', sessionId: 'sess-1' });

    process.env.JWT_SECRET = 'secret-b';
    await expect(verifyDemoToken(token)).rejects.toThrow();
  });

  it('rejects a malformed token', async () => {
    await expect(verifyDemoToken('not-a-valid-jwt')).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const expired = await new SignJWT({ customerId: 'cust-1', sessionId: 'sess-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('cust-1')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 60 * 60 * 25)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60 * 60) // expired 1h ago
      .sign(secret);

    await expect(verifyDemoToken(expired)).rejects.toThrow();
  });

  it('rejects a token whose alg was swapped to "none"', async () => {
    // Guards against the classic alg:none forgery — jose must not accept it.
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ customerId: 'attacker', sessionId: 'forged' }),
    ).toString('base64url');
    const forged = `${header}.${payload}.`;

    await expect(verifyDemoToken(forged)).rejects.toThrow();
  });

  it('rejects a token with a tampered payload', async () => {
    const token = await signDemoToken({ customerId: 'cust-1', sessionId: 'sess-1' });
    const [header, , signature] = token.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ customerId: 'someone-else', sessionId: 'sess-1' }),
    ).toString('base64url');

    await expect(verifyDemoToken(`${header}.${tamperedPayload}.${signature}`)).rejects.toThrow();
  });

  it('rejects a token missing required claims', async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const incomplete = await new SignJWT({ customerId: 'cust-1' }) // no sessionId
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('cust-1')
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

    await expect(verifyDemoToken(incomplete)).rejects.toThrow();
  });

  it('falls back to the dev secret when JWT_SECRET is unset', async () => {
    delete process.env.JWT_SECRET;
    const token = await signDemoToken({ customerId: 'cust-1', sessionId: 'sess-1' });
    const claims = await verifyDemoToken(token);
    expect(claims.customerId).toBe('cust-1');
  });
});
