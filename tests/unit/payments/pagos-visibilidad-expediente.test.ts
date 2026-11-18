/**
 * Unit Tests: visibilidad por expediente en las actions de pagos (N-B-01).
 *
 * El módulo de pagos solo acotaba por `tenantId` y, en algunos listados, por
 * `operatorId` escrito a mano. Consecuencias:
 *
 *  - El rol cliente (`Ver casos como cliente`) listaba los casos y los pagos
 *    de TODO el centro (`getCasesForPayment`, reporte y exportación).
 *  - `getPaymentHistory` dejaba pasar a cualquier cliente a cualquier
 *    expediente: miraba si tenía el permiso, no si el expediente era suyo.
 *  - Las actions que reciben un id (`getPaymentSchedule`, `markPaymentPaid`,
 *    `registerPayment`, `uploadPaymentReceipt`, `generatePaymentSchedule`) no
 *    comprobaban acceso al caso.
 *
 * La regla es la de `case-access.ts`, sin cambios: ver todos / ver propios
 * (operador) / ver como cliente (deudor) / ninguno. Los tests negativos
 * afirman que no se leyó ni se escribió nada; los positivos, que el guard no
 * bloquea de más al dueño del expediente.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));

const mockCreateAuditLog = jest.fn();
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, resetInMs: 0 }),
  getRateLimitKey: (...a: string[]) => a.join(':'),
  RATE_LIMIT_CONFIGS: { reportExport: {} },
}));

const mockUploadFile = jest.fn();
const mockCreateFolderHierarchy = jest.fn();
jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    createFolderHierarchy: (...a: unknown[]) => mockCreateFolderHierarchy(...a),
    uploadFile: (...a: unknown[]) => mockUploadFile(...a),
    findOrCreateCaseFolder: jest.fn().mockResolvedValue('carpeta'),
    getFileUrl: (id: string) => `https://drive.google.com/file/d/${id}/view`,
  },
}));

import {
  exportPaymentTrackingToExcel,
  generatePaymentSchedule,
  getCasePaymentSummaries,
  getCasesForPayment,
  getOverduePayments,
  getPaymentHistory,
  getPaymentSchedule,
  getPaymentTrackingReport,
  markPaymentPaid,
  registerPayment,
  uploadPaymentReceipt,
} from '@/features/payment/actions';
import { CASO_ACTIVO } from '@/lib/papelera';
import { P } from '@/lib/permissions';

const TENANT = 'tenant-1';

const ABOGADO = {
  id: 'abogado-1',
  email: 'abogado@test.com',
  name: 'Abogado',
  professionalCard: null,
  permissions: [
    P.VER_CASOS,
    P.VER_CASOS_PROPIOS,
    P.EDITAR_CASOS,
    P.REGISTRAR_PAGOS,
    P.VER_REPORTES,
  ],
};

const CLIENTE = {
  id: 'cliente-1',
  email: 'cliente@test.com',
  name: 'Cliente',
  professionalCard: null,
  permissions: [
    P.VER_CASOS,
    P.VER_CASOS_CLIENTE,
    P.EDITAR_CASOS,
    P.REGISTRAR_PAGOS,
    P.VER_REPORTES,
  ],
};

const SIN_ALCANCE = {
  id: 'sin-alcance-1',
  email: 'sinalcance@test.com',
  name: 'Sin alcance',
  professionalCard: null,
  permissions: [P.VER_CASOS, P.EDITAR_CASOS, P.REGISTRAR_PAGOS, P.VER_REPORTES],
};

const ADMIN = {
  id: 'admin-1',
  email: 'admin@test.com',
  name: 'Admin',
  professionalCard: null,
  permissions: Object.values(P),
};

const DEUDOR_DEL_CLIENTE = 'deudor-del-cliente';

/** Expediente de otro operador y otro deudor: nadie acotado lo ve. */
const CASO_AJENO = {
  id: 'caso-ajeno',
  caseNumber: 'INSOL-000099',
  debtorName: 'Deudor Ajeno',
  operatorId: 'otro-operador',
  debtorId: 'deudor-ajeno',
  totalDebt: 10_000_000,
  propuestaPlazoMeses: 12,
  propuestaPeriodicidadPago: 'Mensual',
  propuestaFechaInicioPago: new Date('2026-12-01T12:00:00Z'),
  paymentStartDate: null,
};

/** Expediente del abogado (operador) y del cliente (deudor). */
const CASO_PROPIO = {
  ...CASO_AJENO,
  id: 'caso-propio',
  caseNumber: 'INSOL-000001',
  operatorId: ABOGADO.id,
  debtorId: DEUDOR_DEL_CLIENTE,
};

const pagoDe = (caso: typeof CASO_AJENO) => ({
  id: `pago-${caso.id}`,
  caseId: caso.id,
  debtorId: caso.debtorId,
  amount: 100_000,
  dueDate: null,
  paymentDate: null,
  status: 'pendiente',
  paymentNumber: 1,
  paymentMethod: null,
  observations: null,
  registeredById: null,
  receiptFileId: null,
  receiptFileName: null,
  receiptFileUrl: null,
  createdAt: new Date('2026-11-01T12:00:00Z'),
  case: caso,
});

const archivo = () =>
  new File(['%PDF-1.4'], 'comprobante.pdf', { type: 'application/pdf' });

function sesion(user: typeof ABOGADO) {
  mockAuthenticateUser.mockResolvedValue({ user, tenantId: TENANT });
}

/** El mock de Prisma devuelve el expediente pedido por id, acotado al tenant. */
function conCasos(...casos: (typeof CASO_AJENO)[]) {
  mockPrisma.case.findUnique.mockImplementation(
    async ({ where }: { where: { id: string; tenantId: string } }) =>
      where.tenantId === TENANT
        ? (casos.find((c) => c.id === where.id) ?? null)
        : null,
  );
  mockPrisma.payment.findUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) => {
      const caso = casos.find((c) => `pago-${c.id}` === where.id);
      return caso ? pagoDe(caso) : null;
    },
  );
}

/** Nada se escribió ni se subió. */
function expectNadaEscrito() {
  expect(mockPrisma.payment.create).not.toHaveBeenCalled();
  expect(mockPrisma.payment.createMany).not.toHaveBeenCalled();
  expect(mockPrisma.payment.update).not.toHaveBeenCalled();
  expect(mockPrisma.case.update).not.toHaveBeenCalled();
  expect(mockUploadFile).not.toHaveBeenCalled();
  expect(mockCreateAuditLog).not.toHaveBeenCalled();
}

beforeEach(() => {
  resetAllMocks();
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  // El cliente tiene ficha de deudor; `resolveCaseVisibility` la busca por correo.
  mockPrisma.debtor.findFirst.mockImplementation(
    async ({ where }: { where: { email?: string } }) =>
      where.email === CLIENTE.email ? { id: DEUDOR_DEL_CLIENTE } : null,
  );
  mockCreateFolderHierarchy.mockResolvedValue('carpeta-comprobantes');
  mockUploadFile.mockResolvedValue('archivo-1');
  conCasos(CASO_AJENO, CASO_PROPIO);
});

// ---------------------------------------------------------------------------
// Actions que reciben un id de caso o de pago
// ---------------------------------------------------------------------------

const accionesPorId = (caso: typeof CASO_AJENO) =>
  [
    ['getPaymentSchedule', () => getPaymentSchedule(caso.id)],
    ['getPaymentHistory', () => getPaymentHistory(caso.id)],
    ['generatePaymentSchedule', () => generatePaymentSchedule(caso.id)],
    [
      'markPaymentPaid',
      () =>
        markPaymentPaid({
          paymentId: `pago-${caso.id}`,
          amount: 100_000,
          receipt: archivo(),
        }),
    ],
    [
      'registerPayment',
      () =>
        registerPayment({
          caseId: caso.id,
          amount: 100_000,
          paymentDate: '2026-11-12',
          receipt: archivo(),
        }),
    ],
    [
      'uploadPaymentReceipt',
      () =>
        uploadPaymentReceipt({
          paymentId: `pago-${caso.id}`,
          receipt: archivo(),
        }),
    ],
  ] as const;

describe.each([
  ['abogado (ver propios) sobre un expediente de otro operador', ABOGADO],
  ['cliente sobre un expediente de otro deudor', CLIENTE],
  ['rol sin permiso de alcance', SIN_ALCANCE],
] as const)('acceso denegado: %s', (_nombre, usuario) => {
  it.each(accionesPorId(CASO_AJENO))(
    '%s no lee ni escribe nada del expediente',
    async (_accion, llamar) => {
      sesion(usuario);

      const resultado = await llamar();

      expect(resultado).toEqual({
        success: false,
        error: 'No tienes permisos para acceder a este caso',
      });
      // Ni los pagos del caso ni el resumen se leyeron.
      expect(mockPrisma.payment.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.payment.count).not.toHaveBeenCalled();
      expectNadaEscrito();
    },
  );
});

describe('acceso permitido: el guard no bloquea al dueño del expediente', () => {
  it.each(accionesPorId(CASO_PROPIO))(
    'abogado operador del caso: %s pasa',
    async (_accion, llamar) => {
      sesion(ABOGADO);
      const resultado = await llamar();
      expect(resultado.success).toBe(true);
    },
  );

  it('el cliente ve el historial de SU expediente', async () => {
    sesion(CLIENTE);
    const resultado = await getPaymentHistory(CASO_PROPIO.id);
    expect(resultado.success).toBe(true);
    expect(mockPrisma.payment.findMany).toHaveBeenCalled();
  });

  it('quien ve todos los casos registra un pago en cualquiera', async () => {
    sesion(ADMIN);
    const resultado = await registerPayment({
      caseId: CASO_AJENO.id,
      amount: 100_000,
      paymentDate: '2026-11-12',
    });
    expect(resultado.success).toBe(true);
    expect(mockPrisma.payment.create).toHaveBeenCalledTimes(1);
  });

  it('un caso de otro tenant (o en la papelera) sigue siendo "no encontrado"', async () => {
    sesion(ADMIN);
    const resultado = await getPaymentSchedule('caso-inexistente');
    expect(resultado).toEqual({ success: false, error: 'Caso no encontrado' });
    expect(mockPrisma.payment.findMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Listados, reportes y exportación
// ---------------------------------------------------------------------------

/** El `where.case` de la primera consulta a `payment.<metodo>`. */
function filtroDeCaso(metodo: 'findMany' | 'count') {
  const llamada = (mockPrisma.payment[metodo] as jest.Mock).mock.calls[0];
  return llamada[0].where.case;
}

const ALCANCES = [
  ['ver todos', ADMIN, { ...CASO_ACTIVO }],
  ['ver propios', ABOGADO, { ...CASO_ACTIVO, operatorId: ABOGADO.id }],
  ['cliente', CLIENTE, { ...CASO_ACTIVO, debtorId: DEUDOR_DEL_CLIENTE }],
  ['sin alcance', SIN_ALCANCE, { ...CASO_ACTIVO, id: { in: [] } }],
] as const;

describe.each(ALCANCES)(
  'listados de pagos acotados por visibilidad — %s',
  (_nombre, usuario, esperado) => {
    beforeEach(() => sesion(usuario));

    it('getPaymentTrackingReport: lista y totales con el mismo filtro', async () => {
      await getPaymentTrackingReport({});
      const llamadas = (mockPrisma.payment.findMany as jest.Mock).mock.calls;
      expect(llamadas).toHaveLength(2);
      for (const [args] of llamadas) {
        expect(args.where.case).toEqual(esperado);
        expect(args.where.tenantId).toBe(TENANT);
      }
    });

    it('getPaymentTrackingReport: la búsqueda no reemplaza el filtro de visibilidad', async () => {
      await getPaymentTrackingReport({ search: 'INSOL', status: 'pagado' });
      expect(filtroDeCaso('findMany')).toEqual(esperado);
    });

    it('exportPaymentTrackingToExcel aplica el mismo filtro que el reporte', async () => {
      const resultado = await exportPaymentTrackingToExcel({ search: 'x' });
      expect(resultado.success).toBe(true);
      expect(filtroDeCaso('findMany')).toEqual(esperado);
    });

    it('getOverduePayments cuenta solo los pagos visibles', async () => {
      await getOverduePayments();
      expect(filtroDeCaso('count')).toEqual(esperado);
    });
  },
);

describe('listados de casos para pagos acotados por visibilidad', () => {
  it.each([
    ['ver todos', ADMIN, { tenantId: TENANT }],
    ['ver propios', ABOGADO, { tenantId: TENANT, operatorId: ABOGADO.id }],
    ['cliente', CLIENTE, { tenantId: TENANT, debtorId: DEUDOR_DEL_CLIENTE }],
  ] as const)('getCasesForPayment — %s', async (_nombre, usuario, esperado) => {
    sesion(usuario);
    await getCasesForPayment();
    const [args] = (mockPrisma.case.findMany as jest.Mock).mock.calls[0];
    expect(args.where).toEqual(esperado);
  });

  it.each([
    ['ver todos', ADMIN, { tenantId: TENANT }],
    ['ver propios', ABOGADO, { tenantId: TENANT, operatorId: ABOGADO.id }],
    ['cliente', CLIENTE, { tenantId: TENANT, debtorId: DEUDOR_DEL_CLIENTE }],
  ] as const)(
    'getCasePaymentSummaries — %s',
    async (_nombre, usuario, esperado) => {
      sesion(usuario);
      await getCasePaymentSummaries();
      const [args] = (mockPrisma.case.findMany as jest.Mock).mock.calls[0];
      expect(args.where).toEqual({ ...esperado, payments: { some: {} } });
    },
  );

  it('sin alcance no consulta casos y devuelve una lista vacía', async () => {
    sesion(SIN_ALCANCE);
    await expect(getCasesForPayment()).resolves.toEqual({
      success: true,
      data: [],
    });
    await expect(getCasePaymentSummaries()).resolves.toEqual({
      success: true,
      data: [],
    });
    expect(mockPrisma.case.findMany).not.toHaveBeenCalled();
  });

  it('un cliente sin ficha de deudor tampoco ve casos', async () => {
    sesion({ ...CLIENTE, email: 'sin-ficha@test.com' });
    await expect(getCasesForPayment()).resolves.toEqual({
      success: true,
      data: [],
    });
    expect(mockPrisma.case.findMany).not.toHaveBeenCalled();
  });
});
