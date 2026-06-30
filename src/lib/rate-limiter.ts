export const RATE_LIMIT = 10;
export const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const rlMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  let entry = rlMap.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + RATE_WINDOW_MS };
    rlMap.set(ip, entry);
    return { allowed: true, remaining: RATE_LIMIT - 1, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return {
    allowed: entry.count <= RATE_LIMIT,
    remaining: Math.max(0, RATE_LIMIT - entry.count),
    resetAt: entry.resetAt,
  };
}

export function clearRateLimit(ip: string): void {
  rlMap.delete(ip);
}
