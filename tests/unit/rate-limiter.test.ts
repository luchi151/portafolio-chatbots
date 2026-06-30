import { beforeEach, describe, expect, it } from 'vitest';
import { checkRateLimit, clearRateLimit, RATE_LIMIT, RATE_WINDOW_MS } from '@/lib/rate-limiter';

const IP = '192.168.1.1';
const OTHER_IP = '10.0.0.1';

describe('checkRateLimit', () => {
  beforeEach(() => {
    clearRateLimit(IP);
    clearRateLimit(OTHER_IP);
  });

  it('allows the first request', () => {
    const result = checkRateLimit(IP);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(RATE_LIMIT - 1);
  });

  it('sets resetAt approximately one window from now', () => {
    const before = Date.now();
    const { resetAt } = checkRateLimit(IP);
    const after = Date.now();
    expect(resetAt).toBeGreaterThanOrEqual(before + RATE_WINDOW_MS - 5);
    expect(resetAt).toBeLessThanOrEqual(after + RATE_WINDOW_MS + 5);
  });

  it('decrements remaining on each call', () => {
    for (let i = 0; i < 5; i++) checkRateLimit(IP);
    const result = checkRateLimit(IP); // 6th call
    expect(result.remaining).toBe(RATE_LIMIT - 6);
  });

  it(`allows exactly ${RATE_LIMIT} requests`, () => {
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect(checkRateLimit(IP).allowed).toBe(true);
    }
  });

  it(`blocks the ${RATE_LIMIT + 1}th request`, () => {
    for (let i = 0; i < RATE_LIMIT; i++) checkRateLimit(IP);
    const result = checkRateLimit(IP);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('isolates different IPs independently', () => {
    for (let i = 0; i < RATE_LIMIT; i++) checkRateLimit(IP);
    // OTHER_IP should still be allowed
    expect(checkRateLimit(OTHER_IP).allowed).toBe(true);
    expect(checkRateLimit(OTHER_IP).remaining).toBe(RATE_LIMIT - 2);
  });

  it('clears an IP so it resets to full allowance', () => {
    for (let i = 0; i < RATE_LIMIT; i++) checkRateLimit(IP);
    expect(checkRateLimit(IP).allowed).toBe(false);

    clearRateLimit(IP);
    expect(checkRateLimit(IP).allowed).toBe(true);
    expect(checkRateLimit(IP).remaining).toBe(RATE_LIMIT - 2);
  });
});
