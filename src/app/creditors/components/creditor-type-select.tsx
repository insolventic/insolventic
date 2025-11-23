'use client';

import { Building, Building2, Users, Filter } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CreditorTypeSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  includeAllOption?: boolean;
  allOptionLabel?: string;
  disabled?: boolean;
}

export function CreditorTypeSelect({
  value,
  onValueChange,
  placeholder = 'Seleccione el tipo',
  className,
  includeAllOption = false,
  allOptionLabel = 'Todos los tipos',
  disabled = false,
}: Readonly<CreditorTypeSelectProps>) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'FINANCIAL':
        return <Building className="h-4 w-4" />;
      case 'COOPERATIVE':
        return <Users className="h-4 w-4" />;
      case 'OTHER':
        return <Building2 className="h-4 w-4" />;
      case 'all':
        return <Filter className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'FINANCIAL':
        return 'Financiera';
      case 'COOPERATIVE':
        return 'Cooperativa';
      case 'OTHER':
        return 'Otro';
      case 'all':
        return allOptionLabel;
      default:
        return placeholder;
    }
  };

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          <div className="flex items-center gap-2">
            {value && getTypeIcon(value)}
            <span>{getTypeLabel(value)}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {includeAllOption && (
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              {allOptionLabel}
            </div>
          </SelectItem>
        )}
        <SelectItem value="FINANCIAL">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Financiera
          </div>
        </SelectItem>
        <SelectItem value="COOPERATIVE">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Cooperativa
          </div>
        </SelectItem>
        <SelectItem value="OTHER">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Otro
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
