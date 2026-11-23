/**
 * @jest-environment jsdom
 */

/**
 * N4 (auditoría 2026-10-27): el detalle del caso se titulaba con el id
 * interno («Detalles del Caso cmvdafujp00ffv90gff9vo1x7») en vez del número
 * del expediente, que es lo que el operador reconoce y cita.
 *
 * Las secciones del diálogo se reemplazan por nada: lo que se prueba es el
 * encabezado, y cada sección tiene sus propias dependencias (acciones,
 * Drive, pagos) que no aportan nada acá.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const SECCIONES = [
  'debtor-info-section',
  'case-details-section',
  'legal-process-section',
  'creditors-section',
  'assets-section',
  'income-section',
  'payment-section',
  'legal-foundations-section',
  'documents-section',
  'payment-tracking-section',
  'activity-section',
  'definitivo-section',
] as const;

const nombreExportado = (archivo: string) =>
  archivo
    .split('-')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');

for (const archivo of SECCIONES) {
  jest.doMock(`@/app/cases/components/case-details-dialog/${archivo}`, () => ({
    [nombreExportado(archivo)]: () => null,
  }));
}

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}));

const CUID = 'cmvdafujp00ffv90gff9vo1x7';

function renderDialog() {
  // require después de los doMock: el import estático se resolvería antes.
  const {
    CaseDetailsDialog,
  } = require('@/app/cases/components/case-details-dialog');
  render(
    <CaseDetailsDialog
      open
      onOpenChange={() => {}}
      case={{
        id: CUID,
        caseNumber: 'INS-2025-001',
        debtorName: 'Pepita Pérez',
        phase: 'Inicial',
      }}
    />,
  );
}

describe('CaseDetailsDialog — título', () => {
  it('se titula con el número del expediente, no con el id interno', () => {
    renderDialog();

    expect(
      screen.getByRole('heading', { name: /Detalles del Caso INS-2025-001/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(CUID))).not.toBeInTheDocument();
  });
});
