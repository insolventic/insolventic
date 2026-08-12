'use client';

/**
 * Boundary global de errores — captura errores del layout raíz que los
 * error.tsx por ruta no alcanzan. Reemplaza el <html> completo, por eso
 * define su propia estructura mínima.
 */

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    logger.error('Global error boundary caught error', error, {
      action: 'global-error-boundary',
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <h2 style={{ marginBottom: 8 }}>Algo salió mal</h2>
          <p style={{ color: '#666', marginBottom: 16 }}>
            Ocurrió un error inesperado. Puede intentar de nuevo; si persiste,
            contacte al administrador.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
