/**
 * F4 (auditoría 2026-10-27), del lado de los pagos: `registerPayment` y
 * `markPaymentPaid` validaban solo `.positive()`, sin tope. Un pago de 1e21
 * llegaba a la base y a los reportes con dígitos de error de punto flotante.
 */
jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

const mockPaymentCreate = jest.fn();
const mockPaymentUpdate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    payment: {
      create: (...a: unknown[]) => mockPaymentCreate(...a),
      update: (...a: unknown[]) => mockPaymentUpdate(...a),
      findUnique: jest.fn(),
    },
    case: { findUnique: jest.fn() },
  },
}));
jest.mock('@/features/auth/actions', () => ({ authenticateUser: jest.fn() }));
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn(),
}));
jest.mock('@/lib/google-drive', () => ({ googleDriveService: {} }));

import { markPaymentPaid, registerPayment } from '@/features/payment/actions';

describe('montos de pago: tope y signo', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([1e21, 1e15 + 1])('registerPayment rechaza %p', async (amount) => {
    const r = await registerPayment({
      caseId: 'caso-1',
      amount,
      paymentDate: '2026-11-09',
    });
    expect(r.success).toBe(false);
    expect(mockPaymentCreate).not.toHaveBeenCalled();
  });

  it('markPaymentPaid rechaza un monto por encima del tope', async () => {
    const r = await markPaymentPaid({ paymentId: 'pago-1', amount: 1e21 });
    expect(r.success).toBe(false);
    expect(mockPaymentUpdate).not.toHaveBeenCalled();
  });
});
