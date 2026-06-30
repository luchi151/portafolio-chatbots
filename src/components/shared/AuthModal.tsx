'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface AuthModalProps {
  open: boolean;
  onSuccess: (token: string) => void;
}

export function AuthModal({ open, onSuccess }: AuthModalProps) {
  const [documentId, setDocumentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!documentId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/demo-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: documentId.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Cédula no encontrada en el sistema demo.');
      }

      const { token } = await res.json() as { token: string };
      onSuccess(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al autenticar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Accede a los demos</DialogTitle>
          <DialogDescription>
            Ingresa tu número de cédula para probar los demos con datos de muestra.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="doc-id" className="text-sm font-medium">
              Número de cédula
            </label>
            <Input
              id="doc-id"
              type="text"
              placeholder="1234567890"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              disabled={loading}
              aria-invalid={!!error}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <p className="text-xs text-muted-foreground">
            Usa cualquiera de las cédulas de los datos de muestra.{' '}
            <strong>No se almacenan datos reales.</strong>
          </p>

          <DialogFooter>
            <Button type="submit" disabled={loading || !documentId.trim()}>
              {loading ? 'Verificando...' : 'Acceder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
