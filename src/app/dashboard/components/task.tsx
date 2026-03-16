'use client';

import { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { cn } from '@/lib/utils';

interface TaskProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  iconColor: string;
  selected: boolean;
  disabled?: boolean;
  helpText?: string;
  onClick: () => void;
}

export function Task({
  title,
  description,
  icon: Icon,
  color,
  iconColor,
  selected,
  disabled = false,
  helpText,
  onClick,
}: Readonly<Omit<TaskProps, 'id'>>) {
  return (
    <Card
      onClick={disabled ? undefined : onClick}
      className={cn(
        'overflow-hidden p-3 text-left transition-all',
        disabled
          ? 'bg-muted cursor-not-allowed opacity-50'
          : 'hover:bg-accent/50 cursor-pointer',
        selected && !disabled ? 'bg-accent' : 'bg-card',
        disabled && 'bg-muted',
      )}
    >
      <CardContent className="flex items-start gap-3 p-0">
        <div className={`rounded-lg p-2 ${color} shrink-0`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1">
            <h3 className="text-sm leading-tight font-semibold break-words">
              {title}
            </h3>
            {helpText && (
              <HelpTooltip
                text={helpText}
                ariaLabel={`Ayuda: ${title}`}
                position="top"
              />
            )}
          </div>
          <p className="text-muted-foreground text-xs leading-tight break-words hyphens-auto">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
