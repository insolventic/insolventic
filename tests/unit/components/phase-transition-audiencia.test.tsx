/**
 * @jest-environment jsdom
 *
 * "Audiencia programada" no se ofrece sin una audiencia pendiente. El servidor
 * lo exige igual (`tests/db/audiencias.db.test.ts`); esto evita el clic en vano.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

jest.mock('@/features/case/actions', () => ({
  updateCasePhase: jest.fn(),
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock('@/features/document/templates-config', () => ({
  getFailureTypes: () => [],
}));

import { PhaseTransitionDialog } from '@/app/cases/components/phase-transition-dialog';

function abrir(audienciaPendiente?: boolean) {
  render(
    <PhaseTransitionDialog
      open
      onOpenChange={jest.fn()}
      caseId="caso-1"
      caseNumber="INS-1"
      currentPhase="En negociación"
      audienciaPendiente={audienciaPendiente}
    />,
  );
  return {
    programada: screen.getByRole('button', { name: /Audiencia programada/ }),
    acuerdo: screen.getByRole('button', { name: /Acuerdo aprobado/ }),
  };
}

describe('PhaseTransitionDialog: Audiencia programada', () => {
  it('sin audiencia pendiente la deshabilita y dice qué hacer', () => {
    const { programada, acuerdo } = abrir(false);
    expect(programada).toBeDisabled();
    expect(acuerdo).toBeEnabled();
    expect(screen.getByText(/primero/)).toBeInTheDocument();
  });

  it('con audiencia pendiente la permite', () => {
    const { programada } = abrir(true);
    expect(programada).toBeEnabled();
    expect(screen.queryByText(/primero/)).toBeNull();
  });

  it('un caso ya en esa fase puede salir sin audiencia', () => {
    render(
      <PhaseTransitionDialog
        open
        onOpenChange={jest.fn()}
        caseId="caso-1"
        caseNumber="INS-1"
        currentPhase="Audiencia programada"
        audienciaPendiente={false}
      />,
    );
    expect(
      screen.getByRole('button', { name: /En negociación/ }),
    ).toBeEnabled();
    expect(screen.queryByText(/primero/)).toBeNull();
  });
});
