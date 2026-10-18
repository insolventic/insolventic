'use client';

import { Eye, EyeOff, Mail, Lock, ArrowLeft } from 'lucide-react';
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

import { loginUser } from '@/features/auth/actions';
import type { LoginInput } from '@/features/auth/schemas';
import { TENANT_THEMES } from '@/lib/tenant-theme';

import type React from 'react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [selectedDb, setSelectedDb] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, startTransition] = useTransition();

  useEffect(() => {
    const dbParam = searchParams.get('db');
    const storedDb = localStorage.getItem('selectedDatabase');

    if (dbParam && TENANT_THEMES[dbParam]) {
      setSelectedDb(dbParam);
      localStorage.setItem('selectedDatabase', dbParam);
    } else if (storedDb && TENANT_THEMES[storedDb]) {
      setSelectedDb(storedDb);
    } else {
      router.push('/');
    }
  }, [searchParams, router]);

  const currentDb = selectedDb ? TENANT_THEMES[selectedDb] : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedDb) {
      setError('Debe seleccionar un tenant');
      return;
    }

    const loginData: LoginInput = {
      email,
      password,
      tenantId: selectedDb,
    };

    startTransition(async () => {
      const { success, message } = await loginUser(loginData);

      if (success) {
        toast.success(message);

        // Forzar inicialización del timeout después del login exitoso
        // Eliminar esta inicialización forzada ya que useAuth ya la maneja
        console.log(
          '🚀 [LoginForm] Login successful, useAuth will handle session timeout initialization',
        );

        router.push('/dashboard');
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
            <h1 className="text-foreground text-3xl font-bold">INSOLVENTIC</h1>
            <Badge
              variant="outline"
              className={`${currentDb.textClass} mt-1 border-current`}
            >
              {currentDb.name}
            </Badge>
          </div>
        </div>
        <p className="text-muted-foreground">
          Sistema de Gestión de Procesos de Insolvencia
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Iniciar Sesión</CardTitle>
              <CardDescription>
                Acceso a la base de datos de {currentDb.name}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToSelector}
              className="text-muted-foreground hover:text-foreground"
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
                <Mail className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
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

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 pl-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="text-muted-foreground h-4 w-4" />
                  ) : (
                    <Eye className="text-muted-foreground h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>

            <div className="space-y-2 text-center">
              <Link
                href={`/forgot-password?db=${selectedDb}`}
                className="text-primary block text-sm hover:underline"
              >
                ¿Olvidó su contraseña?
              </Link>
              <p className="text-muted-foreground text-sm">
                ¿No tienes cuenta? Solicítala al administrador de tu centro.
              </p>
              <p className="text-muted-foreground text-xs">
                <Link href="/privacidad" className="hover:underline">
                  Política de privacidad
                </Link>
                {' · '}
                <Link href="/terminos" className="hover:underline">
                  Términos de uso
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
