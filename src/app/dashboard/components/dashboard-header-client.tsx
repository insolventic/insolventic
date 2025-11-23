'use client';

import { useState } from 'react';
import { ArrowLeft, Bell, Key, Database, LogOut } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

import { useAuth } from '@/hooks/use-auth';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { ChangePasswordDialog } from '@/components/auth/change-password-dialog';
import { DashboardHeaderSkeleton } from './dashboard-header-skeleton';

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

export function DashboardHeaderClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout, switchDatabase, checkPermission } =
    useAuth();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const getUserInitials = (name: string): string => {
    const nameParts = name.trim().split(' ').filter(Boolean);

    if (nameParts.length === 0) return 'U';
    if (nameParts.length === 1) return nameParts[0][0].toUpperCase();

    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  };

  const handleBack = () => {
    router.back();
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleSwitchDatabase = async () => {
    await switchDatabase();
  };

  const handleNotificationsClick = () => {
    router.push('/notifications');
  };

  const handleChangePassword = () => {
    setIsChangePasswordOpen(true);
  };

  const currentDb = user?.tenantId ? databaseInfo[user.tenantId] : null;

  if (isLoading || !user || !currentDb) {
    return <DashboardHeaderSkeleton />;
  }

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {pathname !== '/dashboard' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              aria-label="Volver atrás"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Link
            href="/dashboard"
            className="flex cursor-pointer items-center space-x-3"
          >
            <Image
              src="/images/insolventic-logo.png"
              alt="INSOLVENTIC Logo"
              width={40}
              height={40}
              className="rounded-full"
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900">INSOLVENTIC</h1>
              <div className="flex items-center space-x-2">
                <Image
                  src={currentDb.icon || '/placeholder.svg'}
                  alt={`${currentDb.name} Icon`}
                  width={16}
                  height={16}
                />
                <Badge
                  variant="outline"
                  className={`${currentDb.color} border-current text-xs`}
                >
                  {currentDb.name}
                </Badge>
              </div>
            </div>
          </Link>
        </div>

        <div className="flex items-center space-x-6">
          {/* Desktop Layout - Show expanded user info with notifications */}
          <div className="hidden items-center space-x-6 lg:flex">
            {/* Notifications */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNotificationsClick}
              disabled={!checkPermission('Ver casos')}
              aria-label="Notificaciones"
              className="text-gray-600 hover:text-gray-900"
            >
              <Bell className="h-4 w-4" />
            </Button>

            {/* User Info Section with Dropdown - Better grouped */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex cursor-pointer items-center space-x-3 rounded-lg bg-gray-50 px-3 py-2 transition-colors hover:bg-gray-100">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt={user.name} />
                    <AvatarFallback className="bg-blue-100 font-semibold text-blue-700">
                      {getUserInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-gray-900">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48" align="end" forceMount>
                <DropdownMenuItem onClick={handleChangePassword}>
                  <Key className="mr-2 h-4 w-4" />
                  <span>Cambiar Contraseña</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Action Buttons - Improved hierarchy */}
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSwitchDatabase}
                className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              >
                <Database className="mr-2 h-4 w-4" />
                <span className="hidden xl:inline">Cambiar BD</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span className="hidden xl:inline">Cerrar Sesión</span>
              </Button>
            </div>
          </div>

          {/* Mobile/Tablet Layout - Show notifications and dropdown menu */}
          <div className="flex items-center space-x-3 lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNotificationsClick}
              disabled={!checkPermission('Ver casos')}
              aria-label="Notificaciones"
              className="text-gray-600 hover:text-gray-900"
            >
              <Bell className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt={user.name} />
                    <AvatarFallback className="bg-blue-100 font-semibold text-blue-700">
                      {getUserInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48" align="end" forceMount>
                <DropdownMenuItem onClick={handleChangePassword}>
                  <Key className="mr-2 h-4 w-4" />
                  <span>Cambiar Contraseña</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
      />
    </header>
  );
}
