/**
 * @jest-environment jsdom
 */

/**
 * F1 (auditoría 2026-10-27): la etiqueta decía «Porcentaje de aprobacion
 * (%)», sin tilde. La auditoría la daba por la única de la interfaz, pero el
 * mismo formulario tenía otras 8 sin tilde, en etiquetas y en el aviso de
 * datos faltantes: radicación, designación, aceptación, aprobación,
 * Admisión, información y generación.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/features/case/actions', () => ({ updateCase: jest.fn() }));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

import { PreGenerationForm } from '@/app/cases/components/case-details-dialog/pre-generation-form';
import type { CaseWithRelations } from '@/features/case/schemas';

const SIN_TILDE =
  /(radicacion|designacion|aceptacion|aprobacion|Admision|informacion|generacion)/;

function renderPaquete(packageNumber: 2 | 3) {
  return render(
    <PreGenerationForm
      caseData={{ id: 'caso-1' } as unknown as CaseWithRelations}
      packageNumber={packageNumber}
      onDataSaved={() => {}}
    />,
  );
}

describe('PreGenerationForm — ortografía', () => {
  it('«Porcentaje de aprobación» lleva tilde y nombra su campo', () => {
    renderPaquete(3);
    expect(
      screen.getByLabelText('Porcentaje de aprobación (%)'),
    ).toHaveAttribute('id', 'approvalPercentage');
  });

  it.each([2, 3] as const)(
    'paquete %i: ni etiquetas ni aviso de faltantes salen sin tilde',
    (paquete) => {
      const { container } = renderPaquete(paquete);
      expect(container.textContent).not.toMatch(SIN_TILDE);
    },
  );

  it('el aviso de faltantes del paquete 2 nombra las fechas con tilde', () => {
    renderPaquete(2);
    expect(screen.getByText(/Faltan los siguientes datos/)).toHaveTextContent(
      'Fecha de radicación, Fecha de designación, Fecha de aceptación del cargo',
    );
  });
});
