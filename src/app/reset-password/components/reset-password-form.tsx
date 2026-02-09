'use client';

import { Eye, EyeOff, Lock, ArrowLeft } from 'lucide-react';
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

import { resetPassword } from '@/features/auth/actions';
import type { ResetPasswordInput } from '@/features/auth/schemas';

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

export function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, startTransition] = useTransition();

  useEffect(() => {
    const dbParam = searchParams.get('db');
    const tokenParam = searchParams.get('token');
    const storedDb = localStorage.getItem('selectedDatabase');

    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError('Token de recuperación no válido');
      return;
    }

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

    if (!selectedDb || !token) {
      setError('Parámetros de reseteo inválidos');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    const resetPasswordData: ResetPasswordInput = {
      token,
      password,
      confirmPassword,
      tenantId: selectedDb,
    };

    startTransition(async () => {
      const { success, message } = await resetPassword(resetPasswordData);

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
              Contraseña Actualizada
            </CardTitle>
            <CardDescription className="text-center">
              Su contraseña ha sido restablecida exitosamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-gray-600">
              Ahora puede iniciar sesión con su nueva contraseña.
            </p>
            <Button asChild className="w-full">
              <Link href={`/login?db=${selectedDb}`}>Iniciar Sesión</Link>
            </Button>
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
              <CardTitle>Nueva Contraseña</CardTitle>
              <CardDescription>Ingrese su nueva contraseña</CardDescription>
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
              <Label htmlFor="password">Nueva Contraseña</Label>
              <div className="relative">
                <Lock className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 pl-10"
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirmar Nueva Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repita su nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10 pl-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Actualizando...' : 'Actualizar Contraseña'}
            </Button>

            <div className="text-center">
              <Link
                href={`/login?db=${selectedDb}`}
                className="text-sm text-blue-600 hover:underline"
              >
                Volver al inicio de sesión
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
