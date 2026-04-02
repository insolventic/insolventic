'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const TARIFA_FIJA = '25 SMLMV';

const FUNDAMENTOS_DERECHO =
  'Ley 1564 de 2012 (Código General del Proceso, Arts. 531-576), ' +
  'Ley 2445 de 2025 (Modificaciones al régimen de insolvencia de persona natural), ' +
  'Decreto 2677 de 2012 (Reglamentación del procedimiento de negociación de deudas), ' +
  'Decreto 1069 de 2015 (Decreto Único Reglamentario del Sector Justicia, Parte 2, Título 4).';

export function LegalFoundationsSection() {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Tarifa y Fundamentos de Derecho</h3>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Tarifa Solicitada</Label>
          <Input
            type="text"
            readOnly
            className="bg-muted cursor-not-allowed font-semibold"
            value={TARIFA_FIJA}
          />
          <p className="text-muted-foreground text-xs">
            Tarifa fija establecida por normativa vigente
          </p>
        </div>

        <div className="space-y-2">
          <Label>Fundamentos de Derecho</Label>
          <div className="bg-muted text-muted-foreground rounded-md border p-3 text-sm leading-relaxed">
            {FUNDAMENTOS_DERECHO}
          </div>
          <p className="text-muted-foreground text-xs">
            Normativa base aplicable al procedimiento de insolvencia
          </p>
        </div>
      </div>
    </div>
  );
}
