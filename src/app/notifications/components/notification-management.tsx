'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { NotificationItem } from '@/components/notifications/notification-item';
import {
  getNotifications,
  getNotificationStats,
} from '@/features/notification/actions';
import { NotificationWithCase } from '@/features/notification/schemas';

import { DashboardHeader } from '../../dashboard/components/dashboard-header';

export function NotificationManagement() {
  const [notifications, setNotifications] = useState<NotificationWithCase[]>(
    [],
  );
  const [stats, setStats] = useState({
    total: 0,
  });
  const [, startTransition] = useTransition();

  const loadNotifications = useCallback(
    async (filters?: {
      type?:
        | 'case_created'
        | 'case_updated'
        | 'case_deleted'
        | 'creditor_created'
        | 'creditor_updated'
        | 'creditor_deleted'
        | 'debtor_created'
        | 'debtor_updated'
        | 'debtor_deleted'
        | 'user_created'
        | 'user_updated'
        | 'user_deleted'
        | 'role_created'
        | 'role_updated'
        | 'role_deleted';
    }) => {
      startTransition(async () => {
        const [notificationsResult, statsResult] = await Promise.all([
          getNotifications({ ...filters, limit: 50, offset: 0 }),
          getNotificationStats({}),
        ]);

        if (notificationsResult.success && notificationsResult.data) {
          setNotifications(notificationsResult.data.notifications);
        } else if (notificationsResult.error) {
          toast.error(notificationsResult.error);
        }

        if (statsResult.success && statsResult.data) {
          setStats({
            total: statsResult.data.total,
          });
        } else if (statsResult.error) {
          toast.error(statsResult.error);
        }
      });
    },
    [],
  );

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-muted min-h-screen">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground text-3xl font-bold">
                Centro de Notificaciones
              </h1>
              <p className="text-muted-foreground">
                Gestione alertas y notificaciones del sistema
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Todas las Notificaciones</CardTitle>
              <CardDescription>
                Lista completa de notificaciones del sistema ({stats.total})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    variant="full"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
