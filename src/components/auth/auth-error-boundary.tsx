'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface AuthErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function AuthErrorBoundary({ error, reset }: AuthErrorBoundaryProps) {
  const router = useRouter();

  useEffect(() => {
    console.error('🔐 [AuthErrorBoundary] Authentication error caught:', error);
  }, [error]);

  // If it's an auth-related error, redirect to home page
  const isAuthError =
    error.message.includes('token') ||
    error.message.includes('autenticado') ||
    error.message.includes('No hay token de acceso');

  const handleGoHome = () => {
    router.push('/');
  };

  if (isAuthError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-lg">
          <div className="mb-4 flex justify-center">
            <AlertCircle className="h-12 w-12 text-orange-500" />
          </div>
          <h1 className="mb-2 text-xl font-semibold text-gray-900">
            Sesión Requerida
          </h1>
          <p className="mb-6 text-gray-600">
            Tu sesión ha expirado o estás cambiando de tenant. Por favor, inicia
            sesión nuevamente.
          </p>
          <div className="space-y-3">
            <Button onClick={handleGoHome} className="w-full">
              Ir al Inicio
            </Button>
            <Button variant="outline" onClick={reset} className="w-full">
              Intentar de Nuevo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // For non-auth errors, show generic error
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-lg">
        <div className="mb-4 flex justify-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-gray-900">
          Ha ocurrido un error
        </h1>
        <p className="mb-6 text-gray-600">
          {error.message || 'Error inesperado del sistema'}
        </p>
        <div className="space-y-3">
          <Button onClick={reset} className="w-full">
            Intentar de Nuevo
          </Button>
          <Button variant="outline" onClick={handleGoHome} className="w-full">
            Ir al Inicio
          </Button>
        </div>
      </div>
    </div>
  );
}
