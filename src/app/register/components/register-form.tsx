'use client';

import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowLeft,
  User,
  Phone,
  MapPin,
  CreditCard,
} from 'lucide-react';
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

import { registerUser } from '@/features/auth/actions';
import type { RegisterInput } from '@/features/auth/schemas';

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

export function RegisterForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    professionalCard: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
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

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedDb) {
      setError('Debe seleccionar un tenant');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    const registerData: RegisterInput = {
      ...formData,
      tenantId: selectedDb,
    };

    startTransition(async () => {
      const { success, message } = await registerUser(registerData);

      if (success) {
        toast.success(message);
        router.push(`/login?db=${selectedDb}`);
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
              <CardTitle>Registrarse</CardTitle>
              <CardDescription>
                Crear cuenta en la base de datos de {currentDb.name}
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
              <Label htmlFor="name">Nombre Completo</Label>
              <div className="relative">
                <User className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Ingrese su nombre completo"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Ingrese su correo electrónico"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <div className="relative">
                <Phone className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Ingrese su teléfono"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <div className="relative">
                <MapPin className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                <Input
                  id="address"
                  type="text"
                  placeholder="Ingrese su dirección"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="professionalCard">Tarjeta Profesional</Label>
              <div className="relative">
                <CreditCard className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                <Input
                  id="professionalCard"
                  type="text"
                  placeholder="Ingrese su tarjeta profesional"
                  value={formData.professionalCard}
                  onChange={(e) =>
                    handleInputChange('professionalCard', e.target.value)
                  }
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) =>
                    handleInputChange('password', e.target.value)
                  }
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
              <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
              <div className="relative">
                <Lock className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repita su contraseña"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    handleInputChange('confirmPassword', e.target.value)
                  }
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
              {isLoading ? 'Registrando...' : 'Registrarse'}
            </Button>

            <div className="text-center">
              <span className="text-sm text-gray-600">¿Ya tienes cuenta? </span>
              <Link
                href={`/login?db=${selectedDb}`}
                className="text-sm text-blue-600 hover:underline"
              >
                Iniciar sesión
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
