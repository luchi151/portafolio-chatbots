'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { AuthModal } from './AuthModal';
import { RateLimitBanner } from './RateLimitBanner';

interface AuthContextValue {
  token: string | null;
  clearToken: () => void;
  setRateLimited: (resetAtMs: number) => void;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  clearToken: () => {},
  setRateLimited: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function DemoShell({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('demo_token');
    if (stored) setToken(stored);
  }, []);

  function handleAuthSuccess(newToken: string) {
    localStorage.setItem('demo_token', newToken);
    setToken(newToken);
  }

  function clearToken() {
    localStorage.removeItem('demo_token');
    setToken(null);
  }

  const setRateLimited = useCallback((resetAtMs: number) => {
    setRateLimitedUntil(resetAtMs);
  }, []);

  const dismissRateLimit = useCallback(() => {
    setRateLimitedUntil(null);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-muted-foreground">Cargando...</span>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ token, clearToken, setRateLimited }}>
      <AuthModal open={!token} onSuccess={handleAuthSuccess} />
      <RateLimitBanner resetAt={rateLimitedUntil} onDismiss={dismissRateLimit} />
      {children}
    </AuthContext.Provider>
  );
}
