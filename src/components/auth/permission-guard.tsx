'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';

import { validateSession } from '@/features/auth/actions';

interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function PermissionGuard({
  permission,
  children,
  fallback = null,
  redirectTo,
}: Readonly<PermissionGuardProps>) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkPermission() {
      const { valid, user } = await validateSession();

      if (!valid || !user) {
        setHasPermission(false);
        setIsLoading(false);
        if (redirectTo) {
          router.push(redirectTo);
        }
        return;
      }

      const userHasPermission = user.permissions.includes(permission);

      setHasPermission(userHasPermission);
      setIsLoading(false);

      if (!userHasPermission && redirectTo) {
        router.push(redirectTo);
      }
    }

    checkPermission();
  }, [permission, redirectTo, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <Shield className="h-8 w-8 text-blue-600" />
            <Loader2 className="absolute -top-1 -right-1 h-4 w-4 animate-spin text-blue-600" />
          </div>
          <p className="text-muted-foreground text-sm">
            Verificando permisos...
          </p>
          <div className="text-xs text-gray-400">
            Validando acceso y credenciales
          </div>
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    return fallback;
  }

  return <>{children}</>;
}
