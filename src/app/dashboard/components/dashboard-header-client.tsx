'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Key,
  Building2,
  LogOut,
  Sun,
  Moon,
  UserCircle,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';

import { useAuth } from '@/hooks/use-auth';
import { P } from '@/lib/permissions';
import { getTenantTheme } from '@/lib/tenant-theme';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';

import { ChangePasswordDialog } from '@/components/auth/change-password-dialog';
import { GlobalSearch } from '@/components/global-search';
import { getUnreadCount } from '@/features/notification/actions';
import { DashboardHeaderSkeleton } from './dashboard-header-skeleton';

export function DashboardHeaderClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout, switchDatabase, checkPermission } =
    useAuth();
  const { theme, setTheme } = useTheme();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (user) {
      getUnreadCount().then((r) => {
        if (r.success && r.data !== undefined) setUnreadCount(r.data);
      });
    }
  }, [user]);

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

  const currentDb = user ? getTenantTheme(user.tenantId) : null;

  if (isLoading || !user || !currentDb) {
    return <DashboardHeaderSkeleton />;
  }

  return (
    <header className="border-border bg-card border-b px-6 py-4">
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
              <h1 className="text-foreground text-xl font-bold">INSOLVENTIC</h1>
              <div className="flex items-center space-x-2">
                <Image
                  src={currentDb.icon || '/placeholder.svg'}
                  alt={`${currentDb.name} Icon`}
                  width={16}
                  height={16}
                />
                <Badge
                  variant="outline"
                  className={`${currentDb.textClass} border-current text-xs`}
                >
                  {currentDb.name}
                </Badge>
              </div>
            </div>
          </Link>
        </div>

        <GlobalSearch />

        <div className="flex items-center space-x-6">
          {/* Desktop Layout - Show expanded user info with notifications */}
          <div className="hidden items-center space-x-6 lg:flex">
            {/* Notifications */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNotificationsClick}
              disabled={!checkPermission(P.VER_NOTIFICACIONES)}
              aria-label="Notificaciones"
              className="text-muted-foreground hover:text-foreground relative"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>

            {/* User Info Section with Dropdown - Better grouped */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="bg-muted hover:bg-accent flex cursor-pointer items-center space-x-3 rounded-lg px-3 py-2 transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt={user.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {getUserInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="text-foreground text-sm font-semibold">
                      {user.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {user.email}
                    </p>
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Mi Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleChangePassword}>
                  <Key className="mr-2 h-4 w-4" />
                  <span>Cambiar Contraseña</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    {isDark ? (
                      <Moon className="mr-2 h-4 w-4" />
                    ) : (
                      <Sun className="mr-2 h-4 w-4" />
                    )}
                    <span>Modo</span>
                  </div>
                  <Switch
                    checked={isDark}
                    onCheckedChange={(checked) =>
                      setTheme(checked ? 'dark' : 'light')
                    }
                    aria-label="Alternar modo oscuro"
                  />
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSwitchDatabase}>
                  <Building2 className="mr-2 h-4 w-4" />
                  <span>Cambiar Organización</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile/Tablet Layout - Show notifications and dropdown menu */}
          <div className="flex items-center space-x-3 lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNotificationsClick}
              disabled={!checkPermission(P.VER_NOTIFICACIONES)}
              aria-label="Notificaciones"
              className="text-muted-foreground hover:text-foreground relative"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt={user.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {getUserInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Mi Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleChangePassword}>
                  <Key className="mr-2 h-4 w-4" />
                  <span>Cambiar Contraseña</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    {isDark ? (
                      <Moon className="mr-2 h-4 w-4" />
                    ) : (
                      <Sun className="mr-2 h-4 w-4" />
                    )}
                    <span>Modo</span>
                  </div>
                  <Switch
                    checked={isDark}
                    onCheckedChange={(checked) =>
                      setTheme(checked ? 'dark' : 'light')
                    }
                    aria-label="Alternar modo oscuro"
                  />
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSwitchDatabase}>
                  <Building2 className="mr-2 h-4 w-4" />
                  <span>Cambiar Organización</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar Sesión</span>
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
