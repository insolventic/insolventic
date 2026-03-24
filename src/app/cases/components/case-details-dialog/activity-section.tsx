'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, Edit, Plus, Trash2, ArrowRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { CaseWithRelations } from '@/features/case/schemas';
import { getAuditLogs } from '@/features/audit-log/actions';

interface ActivitySectionProps {
  caseData: CaseWithRelations;
}

interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  userName: string;
  description: string;
  metadata: Record<string, string> | null;
  createdAt: string;
}

const ACTION_CONFIG = {
  created: {
    label: 'Creado',
    icon: Plus,
    badgeClass:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  updated: {
    label: 'Actualizado',
    icon: Edit,
    badgeClass:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  deleted: {
    label: 'Eliminado',
    icon: Trash2,
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
} as const;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActivitySection({ caseData }: Readonly<ActivitySectionProps>) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAuditLogs({
        entityType: 'case',
        entityId: caseData.id,
        page: 1,
        pageSize: 50,
      });
      if (result.success && result.data) {
        setLogs(result.data.logs as ActivityLog[]);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [caseData.id]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2" />
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actividad</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No hay registros de actividad para este caso.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Actividad</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="bg-border absolute top-0 left-4 h-full w-px" />

          {logs.map((log, idx) => {
            const config =
              ACTION_CONFIG[log.action as keyof typeof ACTION_CONFIG] ??
              ACTION_CONFIG.updated;
            const Icon = config.icon;

            return (
              <div key={log.id} className="relative flex gap-4 pb-6">
                {/* Timeline dot */}
                <div className="bg-card relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border">
                  <Icon className="text-muted-foreground h-3.5 w-3.5" />
                </div>

                {/* Content */}
                <div className="flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={config.badgeClass}>{config.label}</Badge>
                    <span className="text-muted-foreground text-xs">
                      por {log.userName}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{log.description}</p>

                  {/* Metadata: phase changes, payment actions, etc */}
                  {log.metadata && log.metadata.field === 'phase' && (
                    <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                      <span>{log.metadata.previousPhase}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-medium">
                        {log.metadata.newPhase}
                      </span>
                    </div>
                  )}

                  <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(log.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
