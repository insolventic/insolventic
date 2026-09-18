'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DESISTIMIENTO_SUBTYPES,
  getPhaseBadgeClass,
  getPhaseLabel,
  getValidTransitions,
  phaseRequiresSubtype,
} from '@/lib/case-phases';
import { getFailureTypes } from '@/features/document/templates-config';
import { updateCasePhase } from '@/features/case/actions';

interface PhaseTransitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseNumber: string;
  currentPhase: string | null;
  onPhaseChanged?: () => void;
}

/** YYYY-MM-DD para prerellenar <input type="date">, en la fecha del navegador del operador. */
function todayForDateInput(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Opciones de subtipo para la fase que las requiere (Fracaso, Desistimiento). */
function subtypeOptionsFor(
  phase: string | null,
): Array<{ id: string; label: string }> {
  if (phase === 'Fracaso') {
    return getFailureTypes().map((t) => ({ id: t.id, label: t.name }));
  }
  if (phase === 'Desistimiento') {
    return DESISTIMIENTO_SUBTYPES.map((s) => ({ id: s.id, label: s.label }));
  }
  return [];
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
  // Fase clicada que espera subtipo/fecha antes de confirmar. null = lista de
  // transiciones (comportamiento normal, sin cambios para el resto de fases).
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [subtype, setSubtype] = useState('');
  const [resultDate, setResultDate] = useState('');

  const phase = currentPhase ?? 'Inicial';
  const validTransitions = getValidTransitions(phase);
  const subtypeOptions = subtypeOptionsFor(pendingTarget);

  const resetPendingState = () => {
    setPendingTarget(null);
    setSubtype('');
    setResultDate('');
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetPendingState();
    onOpenChange(nextOpen);
  };

  const handleTransition = async (
    newPhase: string,
    extra?: { subtype: string; resultDate: string },
  ) => {
    setLoading(true);
    try {
      const result = await updateCasePhase({
        caseId,
        newPhase,
        ...extra,
      });
      if (result.success) {
        toast.success(`Fase actualizada a "${newPhase}"`);
        resetPendingState();
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

  const handleSelectTarget = (target: string) => {
    if (phaseRequiresSubtype(target)) {
      setPendingTarget(target);
      setSubtype('');
      setResultDate(todayForDateInput());
      return;
    }
    handleTransition(target);
  };

  const handleConfirmPending = () => {
    if (!pendingTarget || !subtype || !resultDate) return;
    handleTransition(pendingTarget, { subtype, resultDate });
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar Fase del Caso</DialogTitle>
          <DialogDescription>Caso {caseNumber}</DialogDescription>
        </DialogHeader>

        {pendingTarget ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className={getPhaseBadgeClass(phase)} variant="outline">
                {getPhaseLabel(phase)}
              </Badge>
              <ArrowRight className="h-4 w-4" />
              <Badge className={getPhaseBadgeClass(pendingTarget)}>
                {getPhaseLabel(pendingTarget)}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phase-transition-subtype">
                Subtipo de {getPhaseLabel(pendingTarget).toLowerCase()} *
              </Label>
              <Select value={subtype} onValueChange={setSubtype}>
                <SelectTrigger id="phase-transition-subtype" className="w-full">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {subtypeOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phase-transition-date">
                Fecha de {getPhaseLabel(pendingTarget).toLowerCase()} *
              </Label>
              <Input
                id="phase-transition-date"
                type="date"
                value={resultDate}
                onChange={(e) => setResultDate(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={resetPendingState}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmPending}
                disabled={loading || !subtype || !resultDate}
              >
                Confirmar cambio de fase
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                Fase actual:
              </span>
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
                      onClick={() => handleSelectTarget(target)}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
