'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Loader2,
  Save,
  Shield,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  UserCircle,
  Building2,
  Calendar,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/hooks/use-auth';
import { getProfile, updateProfile } from '@/features/user/actions';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { ChangePasswordDialog } from '@/components/auth/change-password-dialog';
import { DashboardHeader } from '../../dashboard/components/dashboard-header';

const profileFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().min(1, 'El teléfono es requerido'),
  address: z.string().min(1, 'La dirección es requerida'),
  professionalCard: z.string().min(1, 'La tarjeta profesional es requerida'),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export function ProfileSettings() {
  const { user, isLoading: authLoading } = useAuth();
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileData, setProfileData] = useState<{
    name: string;
    email: string;
    phone: string;
    address: string;
    professionalCard: string;
    roleName: string;
    createdDate: Date;
    lastLogin: Date | null;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      phone: '',
      address: '',
      professionalCard: '',
    },
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const result = await getProfile();
        if (result.success && result.data) {
          setProfileData(result.data);
          reset({
            name: result.data.name || '',
            phone: result.data.phone || '',
            address: result.data.address || '',
            professionalCard: result.data.professionalCard || '',
          });
        } else {
          toast.error('Error al cargar perfil', {
            description:
              result.error || 'No se pudo obtener la información del perfil.',
          });
        }
      } catch {
        toast.error('Error al cargar perfil', {
          description: 'Ocurrió un error inesperado.',
        });
      } finally {
        setProfileLoading(false);
      }
    }

    if (user) {
      fetchProfile();
    }
  }, [user, reset]);

  const getUserInitials = (name: string): string => {
    const nameParts = name.trim().split(' ').filter(Boolean);
    if (nameParts.length === 0) return 'U';
    if (nameParts.length === 1) return nameParts[0][0].toUpperCase();
    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  };

  const formatDate = (date: Date | string | null): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: Date | string | null): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const onSubmit = (data: ProfileFormData) => {
    startTransition(async () => {
      const result = await updateProfile(data);
      if (result.success) {
        toast.success('Perfil actualizado', {
          description:
            'Su información personal ha sido actualizada correctamente.',
        });
        // Update local profile data with the new name
        if (profileData) {
          setProfileData({ ...profileData, name: data.name });
        }
        reset(data);
      } else {
        toast.error('Error al actualizar perfil', {
          description: result.error || 'Ocurrió un error inesperado.',
        });
      }
    });
  };

  const isLoading = authLoading || profileLoading;

  if (isLoading || !user) {
    return (
      <div className="bg-muted min-h-screen">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-muted min-h-screen">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-foreground text-2xl font-bold">Mi Perfil</h1>
            <p className="text-muted-foreground mt-1">
              Gestione su información personal y configuración de cuenta
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Left Column: Profile Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                      {getUserInitials(profileData?.name || user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-foreground mt-4 text-lg font-semibold">
                    {profileData?.name || user.name}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {profileData?.email || user.email}
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <UserCircle className="h-3 w-3" />
                      {profileData?.roleName || user.roleName}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      <Building2 className="h-3 w-3" />
                      {user.tenantName}
                    </Badge>
                  </div>
                  <div className="mt-6 w-full space-y-3 border-t pt-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="text-muted-foreground h-4 w-4" />
                      <span className="text-muted-foreground">
                        Miembro desde:
                      </span>
                      <span className="text-foreground font-medium">
                        {formatDate(profileData?.createdDate || null)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="text-muted-foreground h-4 w-4" />
                      <span className="text-muted-foreground">
                        Último acceso:
                      </span>
                      <span className="text-foreground font-medium">
                        {formatDateTime(
                          profileData?.lastLogin || user.lastLogin,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right Column: Edit Form */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Información Personal</CardTitle>
                <CardDescription>
                  Actualice sus datos personales
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Nombre completo */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre completo *</Label>
                    <div className="relative">
                      <UserCircle className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                      <Input
                        id="name"
                        placeholder="Ingrese su nombre completo"
                        className={`pl-10 ${errors.name ? 'border-red-500' : ''}`}
                        {...register('name')}
                      />
                    </div>
                    {errors.name && (
                      <p className="text-sm text-red-500">
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  {/* Email (read-only) */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <div className="relative">
                      <Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                      <Input
                        id="email"
                        value={profileData?.email || user.email}
                        disabled
                        className="pl-10"
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      El correo electrónico no puede ser modificado. Contacte al
                      administrador si necesita cambiarlo.
                    </p>
                  </div>

                  {/* Teléfono */}
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono *</Label>
                    <div className="relative">
                      <Phone className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                      <Input
                        id="phone"
                        placeholder="Ingrese su teléfono"
                        className={`pl-10 ${errors.phone ? 'border-red-500' : ''}`}
                        {...register('phone')}
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-sm text-red-500">
                        {errors.phone.message}
                      </p>
                    )}
                  </div>

                  {/* Dirección */}
                  <div className="space-y-2">
                    <Label htmlFor="address">Dirección *</Label>
                    <div className="relative">
                      <MapPin className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                      <Input
                        id="address"
                        placeholder="Ingrese su dirección"
                        className={`pl-10 ${errors.address ? 'border-red-500' : ''}`}
                        {...register('address')}
                      />
                    </div>
                    {errors.address && (
                      <p className="text-sm text-red-500">
                        {errors.address.message}
                      </p>
                    )}
                  </div>

                  {/* Tarjeta profesional */}
                  <div className="space-y-2">
                    <Label htmlFor="professionalCard">
                      Tarjeta profesional *
                    </Label>
                    <div className="relative">
                      <CreditCard className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                      <Input
                        id="professionalCard"
                        placeholder="Ingrese su tarjeta profesional"
                        className={`pl-10 ${errors.professionalCard ? 'border-red-500' : ''}`}
                        {...register('professionalCard')}
                      />
                    </div>
                    {errors.professionalCard && (
                      <p className="text-sm text-red-500">
                        {errors.professionalCard.message}
                      </p>
                    )}
                  </div>

                  {/* Rol (read-only) */}
                  <div className="space-y-2">
                    <Label htmlFor="role">Rol</Label>
                    <Input
                      id="role"
                      value={profileData?.roleName || user.roleName}
                      disabled
                    />
                    <p className="text-muted-foreground text-xs">
                      El rol es asignado por el administrador y no puede ser
                      modificado.
                    </p>
                  </div>

                  {/* Save button */}
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={isPending || !isDirty}>
                      {isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Guardar cambios
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Security Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Seguridad
              </CardTitle>
              <CardDescription>
                Gestione la seguridad de su cuenta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground text-sm font-medium">
                    Contraseña
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Cambie su contraseña regularmente para mantener su cuenta
                    segura.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsChangePasswordOpen(true)}
                >
                  Cambiar Contraseña
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
      />
    </div>
  );
}
