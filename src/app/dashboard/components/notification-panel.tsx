'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { NotificationItem } from '@/components/notifications/notification-item';
import { getNotifications } from '@/features/notification/actions';
import { NotificationWithCase } from '@/features/notification/schemas';

export function NotificationPanel() {
  const [notifications, setNotifications] = useState<NotificationWithCase[]>(
    [],
  );

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const result = await getNotifications({ limit: 5, offset: 0 });
        if (result.success && result.data) {
          setNotifications(result.data.notifications);
        }
      } catch (error) {
        // Silently handle auth errors - user will be redirected by page-level check
        // Only log non-auth errors
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          !errorMessage.includes('autorizado') &&
          !errorMessage.includes('token')
        ) {
          console.error('Error loading notifications:', error);
        }
      }
    };
    loadNotifications();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Bell className="h-5 w-5" />
          <span>Notificaciones</span>
        </CardTitle>
        <CardDescription>Alertas y recordatorios importantes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notifications.length === 0 ? (
          <div className="py-8 text-center">
            <Bell className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900">
              No hay notificaciones
            </h3>
            <p className="text-sm text-gray-500">
              Cuando tengas nuevas alertas aparecerán aquí
            </p>
          </div>
        ) : (
          <>
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                variant="dashboard"
              />
            ))}

            {notifications.length > 0 && (
              <div className="border-t pt-4">
                <Link href="/notifications">
                  <Button variant="outline" size="sm" className="w-full">
                    Ver todas las notificaciones
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
