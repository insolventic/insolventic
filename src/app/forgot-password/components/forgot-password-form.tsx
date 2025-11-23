'use client';

import { Mail, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useTransition } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { forgotPassword } from '@/features/auth/actions';
import type { ForgotPasswordInput } from '@/features/auth/schemas';

import type React from 'react';

interface DatabaseInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const databaseInfo: Record<string, DatabaseInfo> = {
  armonia: {
    id: 'armonia',
    name: 'Armonia',
    icon: '/images/toucan.png',
    color: 'text-orange-600',
  },
  'constructores-paz': {
    id: 'constructores-paz',
    name: 'Constructores de Paz',
    icon: '/images/dove-of-peace.png',
    color: 'text-blue-600',
  },
};

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, startTransition] = useTransition();

  useEffect(() => {
    const dbParam = searchParams.get('db');
    const storedDb = localStorage.getItem('selectedDatabase');

    if (dbParam && databaseInfo[dbParam]) {
      setSelectedDb(dbParam);
      localStorage.setItem('selectedDatabase', dbParam);
    } else if (storedDb && databaseInfo[storedDb]) {
      setSelectedDb(storedDb);
    } else {
      router.push('/');
    }
  }, [searchParams, router]);

  const currentDb = selectedDb ? databaseInfo[selectedDb] : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedDb) {
      setError('Debe seleccionar un tenant');
      return;
    }

    const forgotPasswordData: ForgotPasswordInput = {
      email,
      tenantId: selectedDb,
    };

    startTransition(async () => {
      const { success, message } = await forgotPassword(forgotPasswordData);

      if (success) {
        setSuccess(true);
        toast.success(message);
      } else {
        setError(message);
      }
    });
  };

  const handleBackToSelector = () => {
    localStorage.removeItem('selectedDatabase');
    router.push('/');
  };

  if (!currentDb) {
    return <div>Cargando...</div>;
  }

  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center">
            <Image
              src={currentDb.icon || '/placeholder.svg'}
              alt={`${currentDb.name} Icon`}
              width={60}
              height={60}
              className="mr-3"
            />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">INSOLVENTIC</h1>
              <Badge
                variant="outline"
                className={`${currentDb.color} mt-1 border-current`}
              >
                {currentDb.name}
              </Badge>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-green-600">
              Solicitud Enviada
            </CardTitle>
            <CardDescription className="text-center">
              Correo de recuperación enviado exitosamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-gray-600">
              Revise su bandeja de entrada y siga las instrucciones del correo
              electrónico.
            </p>
            <div className="text-center">
              <Link
                href={`/login?db=${selectedDb}`}
                className="text-blue-600 hover:underline"
              >
                Volver al inicio de sesión
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="mb-4 flex items-center justify-center">
          <Image
            src={currentDb.icon || '/placeholder.svg'}
            alt={`${currentDb.name} Icon`}
            width={60}
            height={60}
            className="mr-3"
          />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">INSOLVENTIC</h1>
            <Badge
              variant="outline"
              className={`${currentDb.color} mt-1 border-current`}
            >
              {currentDb.name}
            </Badge>
          </div>
        </div>
        <p className="text-gray-600">
          Sistema de Gestión de Procesos de Insolvencia
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recuperar Contraseña</CardTitle>
              <CardDescription>
                Ingrese su correo electrónico para recibir instrucciones
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToSelector}
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Cambiar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Ingrese su correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Enviando...' : 'Enviar Instrucciones'}
            </Button>

            <div className="space-y-2 text-center">
              <Link
                href={`/login?db=${selectedDb}`}
                className="block text-sm text-blue-600 hover:underline"
              >
                Volver al inicio de sesión
              </Link>
              <Link
                href={`/register?db=${selectedDb}`}
                className="block text-sm text-gray-600 hover:underline"
              >
                ¿No tienes cuenta? Registrarse
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
