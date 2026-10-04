/**
 * Integration Tests: acreedores detallados (Debt), alta/baja completa post-creación.
 *
 * Hallazgo de la auditoría transversal formulario -> plantillas (2026-10-02):
 * `debtSchema` (el tipo del formulario) y el `reset()` de edit-case-dialog.tsx
 * ya tienen/cargan las ~20 columnas de `Debt` (dirección/ciudad/email del
 * acreedor, cuantía detallada, clasificación, codeudor...), pero
 * `addDebtToCaseSchema` -- lo único que el alta post-creación valida y envía
 * al servidor -- solo tenía 5: creditorId, amount, type, interestRate. Todo
 * lo demás era estructuralmente imposible de capturar una vez creado el
 * caso, aunque `create-case-dialog`'s `CreditorsDetailedSection` sí lo pide
 * al crear. Mismo hallazgo que el ítem 3 (apoderados), mismo patrón de
 * solución: ampliar el schema y la acción de alta, no construir un camino
 * nuevo.
 *
 * "Editar" una deuda sigue siendo, como en los 5 modelos hermanos, borrarla
 * y agregarla de nuevo con el dato corregido -- no hay edición en el lugar.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));

const mockCreateAuditLog = jest.fn().mockResolvedValue(undefined);
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

import { TENANT, ADMIN_USER } from '../helpers/fixtures';
import { P } from '@/lib/permissions';
import { addDebtToCase, removeDebtFromCase } from '@/features/case/actions';

const CASE_ID = 'case-1';
const DEBTOR_ID = 'debtor-1';

const FULL_DEBT_ROW = {
  id: 'debt-1',
  caseId: CASE_ID,
  tenantId: TENANT.id,
  debtorId: DEBTOR_ID,
  amount: 1000000,
  interestRate: 2.5,
  type: 'PERSONAL',
  creditorId: 'cred-1',
  creditorAddress: 'Calle 1 # 2-3',
  creditorCity: 'Bogotá',
  creditorEmail: 'acreedor@example.com',
  capitalAmount: 900000,
  interestAmount: 100000,
  isDeferred: true,
  documentType: 'Pagaré',
  grantDate: new Date('2024-01-15T00:00:00.000Z'),
  dueDate: new Date('2025-01-15T00:00:00.000Z'),
  creditClassification: 'QUIROGRAFARIO',
  hasActiveLibranza: true,
  creditorClass: 'FINANCIERO',
  percentageOfTotal: 45.5,
  daysOverdue: 30,
  coDebtorName: 'Juan Codeudor',
  coDebtorCity: 'Medellín',
  coDebtorAddress: 'Carrera 5 # 6-7',
  coDebtorPhone: '3001234567',
  coDebtorEmail: 'codeudor@example.com',
  creditor: { name: 'Banco de Pruebas' },
};

describe('acreedores detallados (Debt) — alta y baja post-creación', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    mockCreateAuditLog.mockClear();

    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN_USER, permissions: Object.values(P) },
      tenantId: TENANT.id,
    });
  });

  describe('addDebtToCase', () => {
    it('sin el permiso EDITAR_CASOS, rechaza sin tocar la base', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: { ...ADMIN_USER, permissions: [] },
        tenantId: TENANT.id,
      });

      const result = await addDebtToCase({
        caseId: CASE_ID,
        creditorId: 'cred-1',
        amount: '1000000',
        type: 'PERSONAL',
        interestRate: '2.5',
      });

      expect(result.success).toBe(false);
      expect(mockPrisma.debt.create).not.toHaveBeenCalled();
    });

    it('si el caso no existe (o es de otro tenant), rechaza sin crear nada', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(null);

      const result = await addDebtToCase({
        caseId: CASE_ID,
        creditorId: 'cred-1',
        amount: '1000000',
        type: 'PERSONAL',
        interestRate: '2.5',
      });

      expect(result.success).toBe(false);
      expect(mockPrisma.debt.create).not.toHaveBeenCalled();
    });

    it('crea la deuda con los ~20 campos detallados, scopeada al tenant', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({ debtorId: DEBTOR_ID });
      mockPrisma.debt.create.mockResolvedValue(FULL_DEBT_ROW);

      const result = await addDebtToCase({
        caseId: CASE_ID,
        creditorId: 'cred-1',
        amount: '1000000',
        type: 'PERSONAL',
        interestRate: '2.5',
        creditorAddress: 'Calle 1 # 2-3',
        creditorCity: 'Bogotá',
        creditorEmail: 'acreedor@example.com',
        capitalAmount: '900000',
        interestAmount: '100000',
        isDeferred: true,
        documentType: 'Pagaré',
        grantDate: '2024-01-15',
        dueDate: '2025-01-15',
        creditClassification: 'QUIROGRAFARIO',
        hasActiveLibranza: true,
        creditorClass: 'FINANCIERO',
        percentageOfTotal: '45.5',
        daysOverdue: 30,
        coDebtorName: 'Juan Codeudor',
        coDebtorCity: 'Medellín',
        coDebtorAddress: 'Carrera 5 # 6-7',
        coDebtorPhone: '3001234567',
        coDebtorEmail: 'codeudor@example.com',
      });

      expect(result.success).toBe(true);

      const call = mockPrisma.debt.create.mock.calls[0][0];
      expect(call.data).toMatchObject({
        caseId: CASE_ID,
        tenantId: TENANT.id,
        creditorId: 'cred-1',
        creditorAddress: 'Calle 1 # 2-3',
        creditorCity: 'Bogotá',
        creditorEmail: 'acreedor@example.com',
        capitalAmount: 900000,
        interestAmount: 100000,
        isDeferred: true,
        documentType: 'Pagaré',
        creditClassification: 'QUIROGRAFARIO',
        hasActiveLibranza: true,
        creditorClass: 'FINANCIERO',
        percentageOfTotal: 45.5,
        daysOverdue: 30,
        coDebtorName: 'Juan Codeudor',
        coDebtorCity: 'Medellín',
        coDebtorAddress: 'Carrera 5 # 6-7',
        coDebtorPhone: '3001234567',
        coDebtorEmail: 'codeudor@example.com',
      });
      // Las fechas del formulario se anclan al MEDIODÍA UTC, no a la medianoche.
      // `new Date('2024-01-15')` es medianoche UTC = 19:00 del 14 en Colombia, y
      // por eso toda fecha salía impresa un día antes en los documentos
      // (hallazgo T1 de docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md). Esta
      // expectativa fijaba justamente el instante equivocado; cambia a propósito.
      expect(call.data.grantDate).toEqual(new Date('2024-01-15T12:00:00.000Z'));
      expect(call.data.dueDate).toEqual(new Date('2025-01-15T12:00:00.000Z'));

      // La respuesta vuelve con fecha como 'YYYY-MM-DD', no Date: mismo
      // formato que el reset de edit-case-dialog.tsx, para que el cliente la
      // pueda meter directo en el formulario sin reconvertir.
      expect(result.data?.grantDate).toBe('2024-01-15');
      expect(result.data?.coDebtorName).toBe('Juan Codeudor');
      expect(result.data?.percentageOfTotal).toBe(45.5);
    });

    it('campos de texto opcionales en blanco se guardan como null, no como cadena vacía', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({ debtorId: DEBTOR_ID });
      mockPrisma.debt.create.mockResolvedValue({
        ...FULL_DEBT_ROW,
        creditorAddress: null,
        coDebtorName: null,
        grantDate: null,
        dueDate: null,
        capitalAmount: null,
        daysOverdue: null,
      });

      await addDebtToCase({
        caseId: CASE_ID,
        creditorId: 'cred-1',
        amount: '1000000',
        type: 'PERSONAL',
        interestRate: '2.5',
        creditorAddress: '',
        coDebtorName: '',
      });

      const call = mockPrisma.debt.create.mock.calls[0][0];
      expect(call.data.creditorAddress).toBeNull();
      expect(call.data.coDebtorName).toBeNull();
      expect(call.data.grantDate).toBeNull();
      expect(call.data.isDeferred).toBe(false);
      expect(call.data.hasActiveLibranza).toBe(false);
    });

    it('sin ninguno de los campos detallados opcionales, sigue creando la deuda básica (compatibilidad)', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({ debtorId: DEBTOR_ID });
      mockPrisma.debt.create.mockResolvedValue({
        ...FULL_DEBT_ROW,
        creditorAddress: null,
        creditorCity: null,
        creditorEmail: null,
        capitalAmount: null,
        interestAmount: null,
        isDeferred: false,
        documentType: null,
        grantDate: null,
        dueDate: null,
        creditClassification: null,
        hasActiveLibranza: false,
        creditorClass: null,
        percentageOfTotal: null,
        daysOverdue: null,
        coDebtorName: null,
        coDebtorCity: null,
        coDebtorAddress: null,
        coDebtorPhone: null,
        coDebtorEmail: null,
      });

      const result = await addDebtToCase({
        caseId: CASE_ID,
        creditorId: 'cred-1',
        amount: '1000000',
        type: 'PERSONAL',
        interestRate: '2.5',
      });

      expect(result.success).toBe(true);
    });

    it('registra auditoría con la deuda como sub-entidad', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({ debtorId: DEBTOR_ID });
      mockPrisma.debt.create.mockResolvedValue(FULL_DEBT_ROW);

      await addDebtToCase({
        caseId: CASE_ID,
        creditorId: 'cred-1',
        amount: '1000000',
        type: 'PERSONAL',
        interestRate: '2.5',
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityId: CASE_ID,
          metadata: expect.objectContaining({
            subEntity: 'debt',
            subEntityId: 'debt-1',
          }),
        }),
      );
    });
  });

  describe('removeDebtFromCase', () => {
    it('sin el permiso EDITAR_CASOS, rechaza sin borrar nada', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: { ...ADMIN_USER, permissions: [] },
        tenantId: TENANT.id,
      });

      const result = await removeDebtFromCase({ debtId: 'debt-1' });

      expect(result.success).toBe(false);
      expect(mockPrisma.debt.delete).not.toHaveBeenCalled();
    });

    it('borra scopeado al tenant: el where incluye tenantId, no solo el id', async () => {
      mockPrisma.debt.delete.mockResolvedValue(FULL_DEBT_ROW);

      const result = await removeDebtFromCase({ debtId: 'debt-1' });

      expect(result.success).toBe(true);
      const call = mockPrisma.debt.delete.mock.calls[0][0];
      expect(call.where).toMatchObject({ id: 'debt-1', tenantId: TENANT.id });
    });

    it('devuelve el detalle completo de la deuda borrada, no solo los 5 campos básicos', async () => {
      mockPrisma.debt.delete.mockResolvedValue(FULL_DEBT_ROW);

      const result = await removeDebtFromCase({ debtId: 'debt-1' });

      expect(result.data?.coDebtorName).toBe('Juan Codeudor');
      expect(result.data?.creditClassification).toBe('QUIROGRAFARIO');
      expect(result.data?.dueDate).toBe('2025-01-15');
    });

    it('si la deuda no existe (o es de otro tenant), devuelve error y no explota', async () => {
      mockPrisma.debt.delete.mockRejectedValue(
        new Error('Record to delete does not exist.'),
      );

      const result = await removeDebtFromCase({ debtId: 'debt-x' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('registra auditoría de baja con la deuda como sub-entidad', async () => {
      mockPrisma.debt.delete.mockResolvedValue(FULL_DEBT_ROW);

      await removeDebtFromCase({ debtId: 'debt-1' });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityId: CASE_ID,
          metadata: expect.objectContaining({
            subEntity: 'debt',
            subEntityId: 'debt-1',
          }),
        }),
      );
    });
  });
});

describe('el diálogo de edición usa DebtsTab, no el CreditorsSection básico de 5 campos', () => {
  const fs = jest.requireActual('fs') as typeof import('fs');
  const path = jest.requireActual('path') as typeof import('path');

  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/app/cases/components/edit-case-dialog.tsx'),
    'utf8',
  );

  it('importa DebtsTab desde edit-case-dialog/debts-tab', () => {
    expect(source).toMatch(
      /import\s*\{\s*DebtsTab\s*\}\s*from\s*['"]\.\/edit-case-dialog\/debts-tab['"]/,
    );
  });

  it('renderiza <DebtsTab>, no el <CreditorsTab> de 5 campos', () => {
    expect(source).toContain('<DebtsTab');
    expect(source).not.toContain('<CreditorsTab');
  });
});
