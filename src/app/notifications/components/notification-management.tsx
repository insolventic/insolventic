'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

import { Button } from '@/components/ui/button';
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

const PAGE_SIZE = 15;

export function NotificationManagement() {
  const [notifications, setNotifications] = useState<NotificationWithCase[]>(
    [],
  );
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadNotifications = useCallback(
    async (
      page: number,
      filters?: {
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
      },
    ) => {
      startTransition(async () => {
        const offset = (page - 1) * PAGE_SIZE;
        const [notificationsResult, statsResult] = await Promise.all([
          getNotifications({ ...filters, limit: PAGE_SIZE, offset }),
          getNotificationStats({}),
        ]);

        if (notificationsResult.success && notificationsResult.data) {
          setNotifications(notificationsResult.data.notifications);
          setTotal(notificationsResult.data.total);
        } else if (notificationsResult.error) {
          toast.error(notificationsResult.error);
        }

        if (statsResult.success && statsResult.data) {
          setTotal(statsResult.data.total);
        } else if (statsResult.error) {
          toast.error(statsResult.error);
        }
      });
    },
    [],
  );

  useEffect(() => {
    loadNotifications(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    loadNotifications(page);
  };

  // Generate page numbers to show (max 5 around current)
  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const rangeStart = (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, total);

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
                {total > 0
                  ? `Mostrando ${rangeStart}-${rangeEnd} de ${total} notificaciones`
                  : 'No hay notificaciones'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Inbox className="text-muted-foreground mb-4 h-12 w-12" />
                  <p className="text-muted-foreground text-lg font-medium">
                    No hay notificaciones
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Las notificaciones del sistema aparecerán aquí
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {notifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        variant="full"
                      />
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="mt-6 flex flex-col items-center gap-4 border-t pt-4 sm:flex-row sm:justify-between">
                      <p className="text-muted-foreground text-sm">
                        Página {currentPage} de {totalPages}
                      </p>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => goToPage(currentPage - 1)}
                          disabled={currentPage <= 1 || isLoading}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>

                        {getPageNumbers().map((page) => (
                          <Button
                            key={page}
                            variant={
                              page === currentPage ? 'default' : 'outline'
                            }
                            size="sm"
                            onClick={() => goToPage(page)}
                            disabled={isLoading}
                            className="h-8 w-8 p-0"
                          >
                            {page}
                          </Button>
                        ))}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => goToPage(currentPage + 1)}
                          disabled={currentPage >= totalPages || isLoading}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
