'use client';

import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CASE_PHASES } from '@/lib/case-phases';

const CASE_TYPES = [
  { value: 'Insolvencia', label: 'Insolvencia' },
  { value: 'Conciliación', label: 'Conciliación' },
  { value: 'Acuerdo de Apoyo', label: 'Acuerdo de Apoyo' },
] as const;

interface CaseFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedPhase: string;
  onPhaseChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
}

export function CaseFilters({
  searchTerm,
  onSearchChange,
  selectedPhase,
  onPhaseChange,
  selectedType,
  onTypeChange,
}: Readonly<CaseFiltersProps>) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
        <Input
          placeholder="Buscar por nombre, ID o cédula..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-80 pl-10"
        />
      </div>
      <Select value={selectedType} onValueChange={onTypeChange}>
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Todos los tipos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          {CASE_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={selectedPhase} onValueChange={onPhaseChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Todas las fases" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las fases</SelectItem>
          {CASE_PHASES.map((phase) => (
            <SelectItem key={phase.value} value={phase.value}>
              {phase.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
