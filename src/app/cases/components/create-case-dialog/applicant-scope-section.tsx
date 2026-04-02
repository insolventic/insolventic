'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const SCOPE_OPTIONS = [
  {
    value: 'PERSONA_NATURAL_NO_COMERCIANTE',
    label: 'Persona natural no comerciante',
  },
  {
    value: 'PERSONA_NATURAL_PEQUENA_COMERCIANTE',
    label: 'Persona natural pequeño comerciante',
  },
] as const;

export function ApplicantScopeSection() {
  const form = useFormContext();
  const applicantScope =
    useWatch({ control: form.control, name: 'applicantScope' }) || [];

  // Current single value — take first element or empty
  const currentValue =
    typeof applicantScope === 'string'
      ? applicantScope
      : Array.isArray(applicantScope) && applicantScope.length > 0
        ? applicantScope[0]
        : '';

  const handleChange = (value: string) => {
    // Store as array for backward compatibility with existing logic
    form.setValue('applicantScope', [value]);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-4 text-lg font-medium">Ámbito de Aplicación</h3>
        <p className="text-muted-foreground mb-3 text-sm">
          Seleccione la categoría del solicitante
        </p>
        <RadioGroup value={currentValue} onValueChange={handleChange}>
          {SCOPE_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} id={option.value} />
              <Label htmlFor={option.value} className="cursor-pointer">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}
