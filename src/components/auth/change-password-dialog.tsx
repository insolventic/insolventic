'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Key, Lock, Check } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from '@/features/auth/schemas';
import { changePassword } from '@/features/auth/actions';

interface ChangePasswordDialogProps
  extends React.ComponentProps<typeof Dialog> {
  onOpenChange?: (open: boolean) => void;
}

export function ChangePasswordDialog({
  onOpenChange,
  ...props
}: ChangePasswordDialogProps) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const [isPending, startTransition] = useTransition();

  const onSubmit = (data: ChangePasswordInput) => {
    startTransition(async () => {
      const { success, message } = await changePassword(data);

      if (success) {
        toast.success('Contraseña cambiada exitosamente', {
          description: 'Tu contraseña ha sido actualizada correctamente.',
          icon: <Check className="h-4 w-4" />,
        });
        reset();
        onOpenChange?.(false);
      } else {
        toast.error('Error al cambiar contraseña', {
          description: message || 'Ocurrió un error inesperado.',
        });
      }
    });
  };

  const handleDialogClose = () => {
    reset();
    onOpenChange?.(false);
  };

  return (
    <Dialog onOpenChange={handleDialogClose} {...props}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-600" />
            Cambiar Contraseña
          </DialogTitle>
          <DialogDescription>
            Por tu seguridad, ingresa tu contraseña actual y luego establece una
            nueva contraseña.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Contraseña Actual *</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                placeholder="Ingresa tu contraseña actual"
                {...register('currentPassword')}
                className={errors.currentPassword ? 'border-red-500' : ''}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-sm text-red-500">
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nueva Contraseña *</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                {...register('newPassword')}
                className={errors.newPassword ? 'border-red-500' : ''}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-sm text-red-500">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              Confirmar Nueva Contraseña *
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Repite la nueva contraseña"
                {...register('confirmPassword')}
                className={errors.confirmPassword ? 'border-red-500' : ''}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-red-500">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Security Tips */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-start space-x-2">
              <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
              <div className="text-sm text-blue-800">
                <p className="mb-1 font-medium">Tips de seguridad:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Use al menos 6 caracteres</li>
                  <li>• Combine letras, números y símbolos</li>
                  <li>• Evite información personal</li>
                  <li>• No reutilice contraseñas anteriores</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse space-y-2 space-y-reverse pt-2 sm:flex-row sm:justify-end sm:space-y-0 sm:space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleDialogClose}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPending ? 'Cambiando...' : 'Cambiar Contraseña'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
