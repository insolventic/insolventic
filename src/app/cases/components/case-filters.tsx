'use client';

import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';

interface CaseFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function CaseFilters({
  searchTerm,
  onSearchChange,
}: Readonly<CaseFiltersProps>) {
  return (
    <div className="relative">
      <Search className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
      <Input
        placeholder="Buscar por nombre, ID o cédula..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-80 pl-10"
      />
    </div>
  );
}
