// Prisma client mock for unit tests.
// Provides a wide Prisma surface area so actions that call less-commonly
// mocked models (auditLog, payment, etc.) don't crash.

// By default each method resolves with an empty-ish value so fire-and-forget
// code paths (e.g. audit log, notifications) don't crash when a test doesn't
// explicitly mock them.
const makeModel = () => ({
  findUnique: jest.fn().mockResolvedValue(null),
  findFirst: jest.fn().mockResolvedValue(null),
  findMany: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({}),
  createMany: jest.fn().mockResolvedValue({ count: 0 }),
  update: jest.fn().mockResolvedValue({}),
  updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  upsert: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({}),
  deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  count: jest.fn().mockResolvedValue(0),
  aggregate: jest.fn().mockResolvedValue({ _count: 0, _sum: {}, _avg: {} }),
  groupBy: jest.fn().mockResolvedValue([]),
});

const mockPrismaClient = {
  tenant: makeModel(),
  user: makeModel(),
  role: makeModel(),
  permission: makeModel(),
  rolePermission: makeModel(),
  case: makeModel(),
  debtor: makeModel(),
  creditor: makeModel(),
  debt: makeModel(),
  asset: makeModel(),
  document: makeModel(),
  documentTemplate: makeModel(),
  legalProcess: makeModel(),
  libranza: makeModel(),
  suspendedService: makeModel(),
  dependent: makeModel(),
  notification: makeModel(),
  passwordResetToken: makeModel(),
  auditLog: makeModel(),
  payment: makeModel(),
  paymentReceipt: makeModel(),
  contact: makeModel(),
  report: makeModel(),
  formRequest: makeModel(),
  acreedor: makeModel(),
  bien: makeModel(),
  procesoJudicial: makeModel(),
  apoderado: makeModel(),
  documentGenerationRequest: makeModel(),
  documentFromDrive: makeModel(),
  $transaction: jest.fn(
    async (
      arg:
        | ((tx: typeof mockPrismaClient) => Promise<unknown>)
        | Array<Promise<unknown>>,
    ) => {
      if (typeof arg === 'function') {
        return arg(mockPrismaClient);
      }
      return Promise.all(arg);
    },
  ),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

export default mockPrismaClient;

const DEFAULT_RESOLVED: Record<string, unknown> = {
  findUnique: null,
  findFirst: null,
  findMany: [],
  create: {},
  createMany: { count: 0 },
  update: {},
  updateMany: { count: 0 },
  upsert: {},
  delete: {},
  deleteMany: { count: 0 },
  count: 0,
  aggregate: { _count: 0, _sum: {}, _avg: {} },
  groupBy: [],
};

export const resetAllMocks = () => {
  Object.values(mockPrismaClient).forEach((model) => {
    if (typeof model === 'object' && model !== null) {
      Object.entries(model).forEach(([methodName, method]) => {
        if (typeof method === 'function' && 'mockReset' in method) {
          (method as jest.Mock).mockReset();
          if (methodName in DEFAULT_RESOLVED) {
            (method as jest.Mock).mockResolvedValue(
              DEFAULT_RESOLVED[methodName],
            );
          }
        }
      });
    }
  });
  if ('mockReset' in mockPrismaClient.$transaction) {
    (mockPrismaClient.$transaction as jest.Mock).mockReset();
    (mockPrismaClient.$transaction as jest.Mock).mockImplementation(
      async (
        arg:
          | ((tx: typeof mockPrismaClient) => Promise<unknown>)
          | Array<Promise<unknown>>,
      ) => {
        if (typeof arg === 'function') {
          return arg(mockPrismaClient);
        }
        return Promise.all(arg);
      },
    );
  }
};
