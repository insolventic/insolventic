'use client';

import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export function ApplicantScopeSection() {
  const form = useFormContext();
  const applicantScope = form.watch('applicantScope') || [];

  const scopeOptions = [
    { id: 'non-merchant', label: 'Persona natural no comerciante' },
    { id: 'small-merchant', label: 'Persona natural pequeño comerciante' },
  ];

  const handleScopeChange = (value: string, checked: boolean) => {
    const current = form.getValues('applicantScope') || [];
    const updated = checked
      ? [...current, value]
      : current.filter((item: string) => item !== value);
    form.setValue('applicantScope', updated);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-4 text-lg font-medium">Ámbito de Aplicación</h3>
        <div className="space-y-3">
          {scopeOptions.map((option) => (
            <div key={option.id} className="flex items-center space-x-2">
              <Checkbox
                id={option.id}
                checked={applicantScope.includes(option.label)}
                onCheckedChange={(checked) =>
                  handleScopeChange(option.label, checked as boolean)
                }
              />
              <Label htmlFor={option.id} className="cursor-pointer">
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
