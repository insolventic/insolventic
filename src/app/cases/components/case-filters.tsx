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

interface CaseFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedPhase: string;
  onPhaseChange: (value: string) => void;
}

export function CaseFilters({
  searchTerm,
  onSearchChange,
  selectedPhase,
  onPhaseChange,
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
