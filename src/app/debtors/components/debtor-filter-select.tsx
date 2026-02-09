'use client';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DebtorFilterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  includeAllOption?: boolean;
  allOptionLabel?: string;
  occupations: string[];
}

export function DebtorFilterSelect({
  value,
  onValueChange,
  placeholder = 'Filtrar por ocupación',
  className,
  includeAllOption = false,
  allOptionLabel = 'Todas las ocupaciones',
  occupations,
}: DebtorFilterSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Ocupación</SelectLabel>
          {includeAllOption && (
            <SelectItem value="all">{allOptionLabel}</SelectItem>
          )}
          {occupations.map((occupation) => (
            <SelectItem key={occupation} value={occupation}>
              {occupation}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
