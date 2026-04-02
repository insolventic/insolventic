'use client';

import { Label } from '@/components/ui/label';

const TEXTO_TARIFA =
  'Atendiendo las tarifas contenidas en el Decreto 2677 de 2012, por las condiciones ' +
  'de insolvencia económica en que me encuentro, con el debido respeto con fundamento ' +
  'en Artículo 536 de la ley 1564 de 2012 y su Decreto reglamentario, le solicito ' +
  'fijar una tarifa que me permita tener acceso a este mecanismo de negociación de ' +
  'mis obligaciones.';

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
          <Label>Sobre la tarifa</Label>
          <div className="bg-muted text-muted-foreground rounded-md border p-3 text-sm leading-relaxed">
            {TEXTO_TARIFA}
          </div>
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
