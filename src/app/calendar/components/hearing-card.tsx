'use client';

import { Clock, Video, FileText } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPhaseBadgeClass, getPhaseLabel } from '@/lib/case-phases';
import type { Hearing } from '@/features/calendar/actions';

interface HearingCardProps {
  hearing: Hearing;
}

export function HearingCard({ hearing }: Readonly<HearingCardProps>) {
  const dateStr = new Date(hearing.date).toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="bg-card space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{hearing.debtorName}</p>
          <p className="text-muted-foreground text-xs">{hearing.caseNumber}</p>
        </div>
        <Badge className={getPhaseBadgeClass(hearing.phase)} variant="outline">
          {getPhaseLabel(hearing.phase)}
        </Badge>
      </div>

      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {dateStr}
          {hearing.time && ` · ${hearing.time}`}
        </span>
        <Badge variant="secondary" className="text-xs">
          {hearing.type}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        {hearing.zoomLink && (
          <Button variant="outline" size="sm" asChild>
            <a
              href={hearing.zoomLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Video className="mr-1 h-3 w-3" />
              Zoom
            </a>
          </Button>
        )}
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/cases`}>
            <FileText className="mr-1 h-3 w-3" />
            Ver caso
          </Link>
        </Button>
      </div>
    </div>
  );
}
