'use client';

import { CircleHelp } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface HelpTooltipProps {
  /** The help text to display in the tooltip */
  text: string;
  /** Preferred position of the tooltip relative to the icon */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Accessible label for the help icon */
  ariaLabel?: string;
  /** Additional CSS classes for the icon container */
  className?: string;
}

export function HelpTooltip({
  text,
  position = 'top',
  ariaLabel = 'Ayuda',
  className,
}: Readonly<HelpTooltipProps>) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            className={cn(
              'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
              'text-muted-foreground hover:text-foreground transition-colors',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
              className,
            )}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <CircleHelp className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={position} className="max-w-[260px]">
          <p className="leading-relaxed">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
