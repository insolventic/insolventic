'use client';

import { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
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
        <div className="flex-1">
          <h3 className="mb-1 text-sm leading-tight font-semibold break-words">
            {title}
          </h3>
          <p className="text-xs leading-tight break-words hyphens-auto text-gray-500">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
