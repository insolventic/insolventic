'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getPhaseBadgeClass,
  getPhaseLabel,
  getValidTransitions,
} from '@/lib/case-phases';
import { updateCasePhase } from '@/features/case/actions';

interface PhaseTransitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseNumber: string;
  currentPhase: string | null;
  onPhaseChanged?: () => void;
}

export function PhaseTransitionDialog({
  open,
  onOpenChange,
  caseId,
  caseNumber,
  currentPhase,
  onPhaseChanged,
}: Readonly<PhaseTransitionDialogProps>) {
  const [loading, setLoading] = useState(false);
  const phase = currentPhase ?? 'Inicial';
  const validTransitions = getValidTransitions(phase);

  const handleTransition = async (newPhase: string) => {
    setLoading(true);
    try {
      const result = await updateCasePhase({ caseId, newPhase });
      if (result.success) {
        toast.success(`Fase actualizada a "${newPhase}"`);
        onOpenChange(false);
        onPhaseChanged?.();
      } else {
        toast.error(result.error ?? 'Error al cambiar la fase');
      }
    } catch {
      toast.error('Error al cambiar la fase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar Fase del Caso</DialogTitle>
          <DialogDescription>Caso {caseNumber}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Fase actual:</span>
            <Badge className={getPhaseBadgeClass(phase)}>
              {getPhaseLabel(phase)}
            </Badge>
          </div>

          {validTransitions.length > 0 ? (
            <div className="space-y-2">
              <span className="text-sm font-medium">
                Transiciones disponibles:
              </span>
              <div className="flex flex-col gap-2">
                {validTransitions.map((target) => (
                  <Button
                    key={target}
                    variant="outline"
                    className="justify-between"
                    disabled={loading}
                    onClick={() => handleTransition(target)}
                  >
                    <span className="flex items-center gap-2">
                      <Badge
                        className={getPhaseBadgeClass(phase)}
                        variant="outline"
                      >
                        {getPhaseLabel(phase)}
                      </Badge>
                      <ArrowRight className="h-4 w-4" />
                      <Badge className={getPhaseBadgeClass(target)}>
                        {getPhaseLabel(target)}
                      </Badge>
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No hay transiciones disponibles desde esta fase.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
