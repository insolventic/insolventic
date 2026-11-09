/**
 * Las mutaciones de contactos, acreedores, deudores, documentos, pagos y roles
 * dejan su registro de auditoría antes de responder.
 *
 * Estas acciones llamaban a `createAuditLog` sin `await`. En Vercel la función
 * puede terminar al devolver la respuesta y matar el insert en vuelo (ver GC-M4
 * en `createAuditLog`), así que un cambio podía quedar sin registro.
 *
 * Por qué se demora el registro: sin demora, el insert sin `await` suele ganarle
 * a la consulta del test y el hueco no se ve, o se ve solo a veces. Con la
 * demora, la fila no puede existir al volver la acción a menos que la acción la
 * haya esperado. El insert sigue siendo el real.
 *
 * Necesita Prisma REAL: el rechazo de la última sección lo produce el propio
 * Postgres. Solo se simula lo que sale del proceso: Drive y la conversión a PDF.
 * Las plantillas también, porque aquí importa el registro y no el documento (de
 * lo otro se ocupa `documentos-e2e.db.test.ts`).
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../__mocks__/next-navigation'));

const DEMORA_DEL_REGISTRO_MS = 300;

jest.mock('@/features/audit-log/actions', () => {
  const real = jest.requireActual('@/features/audit-log/actions');
  return {
    ...real,
    createAuditLog: async (...args: unknown[]) => {
      await new Promise((r) => setTimeout(r, DEMORA_DEL_REGISTRO_MS));
      return real.createAuditLog(...args);
    },
  };
});

jest.mock('@/features/document/prepare-template', () => ({
  prepareTemplate: jest.fn().mockResolvedValue({
    htmlContent: '<html>sin placeholders</html>',
    html: '<html>sin placeholders</html>',
    placeholders: {},
    unresolved: [],
    coveragePercentage: 100,
    missing: [],
    empty: [],
  }),
  variantDisplayName: (template: { name: string }) => template.name,
  SIN_VARIANTE: { suffix: '', label: '', overlay: {} },
}));

jest.mock('@/lib/html-to-pdf', () => ({
  batchHtmlToPdf: jest.fn(async (entradas: Array<{ filename: string }>) => ({
    ok: entradas.map((e) => ({
      filename: e.filename.replace(/\.html$/, '.pdf'),
      buffer: Buffer.from('pdf'),
    })),
    failed: [],
  })),
}));

jest.mock('@/lib/google-drive', () => {
  let archivos = 0;
  const idNuevo = () => `drive-archivo-${++archivos}`;
  return {
    googleDriveService: {
      listFoldersAndFiles: jest.fn(async () => ({ folders: [], files: [] })),
      createFolder: jest.fn(async () => idNuevo()),
      createFolderHierarchy: jest.fn(async () => idNuevo()),
      findOrCreateCaseFolder: jest.fn(async () => idNuevo()),
      getFolderUrl: (id: string) => `https://drive.example/folders/${id}`,
      getFileUrl: (id: string) => `https://drive.example/file/${id}`,
      uploadFile: jest.fn(async () => idNuevo()),
      uploadDocumentToCase: jest.fn(async () => {
        const fileId = idNuevo();
        return { fileId, fileUrl: `https://drive.example/file/${fileId}` };
      }),
    },
  };
});

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { P } from '@/lib/permissions';
import { emailService } from '@/lib/email';
import { _resetRateLimitStore } from '@/lib/rate-limit';
import {
  addContactToCreditor,
  deleteContact,
  updateContact,
} from '@/features/contact/actions';
import {
  createCreditor,
  deleteCreditor,
  updateCreditor,
} from '@/features/creditor/actions';
import {
  createDebtor,
  deleteDebtor,
  updateDebtor,
} from '@/features/debtor/actions';
import {
  batchGenerateDocuments,
  uploadCaseDocument,
} from '@/features/document/actions';
import {
  generatePaymentSchedule,
  markPaymentPaid,
  registerPayment,
  uploadPaymentReceipt,
} from '@/features/payment/actions';
import { createRole, deleteRole, updateRole } from '@/features/role/actions';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  type TenantDePrueba,
} from './helpers/tenant';

const TAG = `auditoria-modulos-${Date.now().toString(36)}`;
const SIN_AUDITORIA = 'sin_auditoria_de_prueba_modulos';
const unPdf = (nombre: string) =>
  new File(['%PDF-1.4'], nombre, { type: 'application/pdf' });

let centro: TenantDePrueba;
let consecutivo = 0;
let enviarCorreo: jest.SpyInstance;

function sufijo() {
  consecutivo += 1;
  return `${consecutivo}-${TAG}`;
}

function datosDeDeudor() {
  const s = sufijo();
  return {
    name: 'Rubén Darío Castaño Pérez',
    idNumber: s,
    idType: 'CC',
    email: `ruben-${s}@correoejemplo.test`,
    phone: '3209981177',
    address: 'Carrera 48 # 22-14',
    city: 'Medellín',
    department: 'Antioquia',
    occupation: 'Mensajero motorizado',
    monthlyIncome: 1800000,
  };
}

function datosDeAcreedor() {
  const s = sufijo();
  return {
    name: `Banco Ejemplo ${s}`,
    type: 'Banco',
    email: `banco-${s}@correoejemplo.test`,
    phone: '6014445566',
    address: 'Calle 26 # 59-41, Bogotá D.C.',
    representative: 'Marta Lucía Gómez',
    nit: s,
  };
}

function datosDeContacto() {
  const s = sufijo();
  return {
    name: 'Óscar Iván Mejía',
    email: `oscar-${s}@correoejemplo.test`,
    phone: '3107788990',
    role: 'Abogado',
  };
}

const crearDeudor = () =>
  prisma.debtor.create({
    data: {
      ...datosDeDeudor(),
      totalDebt: 0,
      activeCases: 0,
      tenantId: centro.tenantId,
    },
  });

const crearAcreedor = () =>
  prisma.creditor.create({
    data: { ...datosDeAcreedor(), tenantId: centro.tenantId },
  });

async function crearContacto() {
  const { id: creditorId } = await crearAcreedor();
  return prisma.contact.create({
    data: { ...datosDeContacto(), creditorId, tenantId: centro.tenantId },
  });
}

async function crearCaso() {
  const deudor = await crearDeudor();
  return prisma.case.create({
    data: {
      caseNumber: `INSOL-${sufijo()}`,
      // El tenant de prueba no es un centro configurado: sin esto, las dos rutas
      // de documentos no pueden resolver la carpeta de Drive.
      centroConciliacionNombre: 'Centro de prueba',
      debtorName: deudor.name,
      type: 'INSOLVENCY',
      totalDebt: 12000000,
      creditors: 1,
      debtorId: deudor.id,
      operatorId: centro.userId,
      tenantId: centro.tenantId,
    },
  });
}

async function crearPago() {
  const caso = await crearCaso();
  return prisma.payment.create({
    data: {
      caseId: caso.id,
      debtorId: caso.debtorId,
      tenantId: centro.tenantId,
      amount: 1000000,
      status: 'pendiente',
      paymentNumber: 1,
    },
  });
}

// Con color y un permiso: la acción valida la fila antes de responder.
async function crearRol() {
  const permiso = await prisma.permission.findFirstOrThrow({
    where: { tenantId: centro.tenantId },
  });
  return prisma.role.create({
    data: {
      name: `Rol ${sufijo()}`,
      description: 'Rol de prueba',
      color: '#1d4ed8',
      tenantId: centro.tenantId,
      permissions: {
        create: { permissionId: permiso.id, tenantId: centro.tenantId },
      },
    },
  });
}

function datosDeRol() {
  return {
    name: `Rol ${sufijo()}`,
    description: 'Rol de prueba',
    permissions: [P.VER_CASOS],
    color: '#1d4ed8',
  };
}

interface Escenario {
  nombre: string;
  accionAuditada: 'created' | 'updated' | 'deleted';
  entityType: string;
  /** Devuelve el resultado de la acción y el `entityId` del registro esperado. */
  ejecutar: () => Promise<{
    resultado: { success: boolean; error?: string; message?: string };
    entityId: string;
  }>;
  /** Comprueba en la base que la operación quedó hecha. */
  quedoHecha: (entityId: string) => Promise<boolean>;
}

const existe = (fila: unknown) => fila !== null;

const contactoExiste = async (id: string) =>
  existe(await prisma.contact.findUnique({ where: { id } }));
const acreedorExiste = async (id: string) =>
  existe(await prisma.creditor.findUnique({ where: { id } }));
const deudorExiste = async (id: string) =>
  existe(await prisma.debtor.findUnique({ where: { id } }));
const rolExiste = async (id: string) =>
  existe(await prisma.role.findUnique({ where: { id } }));
const documentosDelCaso = (caseId: string) =>
  prisma.document.count({ where: { caseId } });

// `entityId` puede salir del resultado (altas) o de la fila preparada.
const ESCENARIOS: Escenario[] = [
  {
    nombre: 'addContactToCreditor',
    accionAuditada: 'created',
    entityType: 'contact',
    ejecutar: async () => {
      const { id: creditorId } = await crearAcreedor();
      const resultado = await addContactToCreditor({
        ...datosDeContacto(),
        creditorId,
      });
      return { resultado, entityId: resultado.data?.id ?? '' };
    },
    quedoHecha: contactoExiste,
  },
  {
    nombre: 'updateContact',
    accionAuditada: 'updated',
    entityType: 'contact',
    ejecutar: async () => {
      const { id } = await crearContacto();
      const resultado = await updateContact({ id, role: 'Apoderado' });
      return { resultado, entityId: id };
    },
    quedoHecha: async (id) =>
      (await prisma.contact.findUnique({ where: { id } }))?.role ===
      'Apoderado',
  },
  {
    nombre: 'deleteContact',
    accionAuditada: 'deleted',
    entityType: 'contact',
    ejecutar: async () => {
      const { id } = await crearContacto();
      const resultado = await deleteContact({ id });
      return { resultado, entityId: id };
    },
    quedoHecha: async (id) => !(await contactoExiste(id)),
  },
  {
    nombre: 'createCreditor',
    accionAuditada: 'created',
    entityType: 'creditor',
    ejecutar: async () => {
      const resultado = await createCreditor(datosDeAcreedor());
      return { resultado, entityId: resultado.data?.id ?? '' };
    },
    quedoHecha: acreedorExiste,
  },
  {
    nombre: 'updateCreditor',
    accionAuditada: 'updated',
    entityType: 'creditor',
    ejecutar: async () => {
      const { id } = await crearAcreedor();
      const resultado = await updateCreditor({ id, phone: '6019990000' });
      return { resultado, entityId: id };
    },
    quedoHecha: async (id) =>
      (await prisma.creditor.findUnique({ where: { id } }))?.phone ===
      '6019990000',
  },
  {
    nombre: 'deleteCreditor',
    accionAuditada: 'deleted',
    entityType: 'creditor',
    ejecutar: async () => {
      const { id } = await crearAcreedor();
      const resultado = await deleteCreditor({ id });
      return { resultado, entityId: id };
    },
    quedoHecha: async (id) => !(await acreedorExiste(id)),
  },
  {
    nombre: 'createDebtor',
    accionAuditada: 'created',
    entityType: 'debtor',
    ejecutar: async () => {
      const resultado = await createDebtor(datosDeDeudor());
      return { resultado, entityId: resultado.data?.id ?? '' };
    },
    quedoHecha: deudorExiste,
  },
  {
    nombre: 'updateDebtor',
    accionAuditada: 'updated',
    entityType: 'debtor',
    ejecutar: async () => {
      const deudor = await crearDeudor();
      const resultado = await updateDebtor({
        id: deudor.id,
        name: deudor.name,
        idNumber: deudor.idNumber,
        idType: deudor.idType,
        email: deudor.email,
        phone: deudor.phone,
        address: deudor.address,
        city: deudor.city,
        department: deudor.department,
        occupation: 'Conductor',
        monthlyIncome: 1800000,
      });
      return { resultado, entityId: deudor.id };
    },
    quedoHecha: async (id) =>
      (await prisma.debtor.findUnique({ where: { id } }))?.occupation ===
      'Conductor',
  },
  {
    nombre: 'deleteDebtor',
    accionAuditada: 'deleted',
    entityType: 'debtor',
    ejecutar: async () => {
      const { id } = await crearDeudor();
      const resultado = await deleteDebtor(id);
      return { resultado, entityId: id };
    },
    quedoHecha: async (id) => !(await deudorExiste(id)),
  },
  {
    nombre: 'batchGenerateDocuments',
    accionAuditada: 'created',
    entityType: 'document',
    ejecutar: async () => {
      const { id } = await crearCaso();
      const resultado = await batchGenerateDocuments({
        caseId: id,
        templateIds: ['solicitud-insolvencia'],
      });
      return { resultado, entityId: id };
    },
    quedoHecha: async (id) => (await documentosDelCaso(id)) === 1,
  },
  {
    nombre: 'uploadCaseDocument',
    accionAuditada: 'created',
    entityType: 'document',
    ejecutar: async () => {
      const { id } = await crearCaso();
      const resultado = await uploadCaseDocument({
        caseId: id,
        docName: 'Cédula',
        file: unPdf('cedula.pdf'),
      });
      return { resultado, entityId: id };
    },
    quedoHecha: async (id) => (await documentosDelCaso(id)) === 1,
  },
  // Los pagos se auditan contra el caso: cada escenario crea el suyo.
  {
    nombre: 'generatePaymentSchedule',
    accionAuditada: 'created',
    entityType: 'case',
    ejecutar: async () => {
      const { id } = await crearCaso();
      const resultado = await generatePaymentSchedule(id);
      return { resultado, entityId: id };
    },
    quedoHecha: async (caseId) =>
      (await prisma.payment.count({ where: { caseId } })) > 0,
  },
  {
    nombre: 'markPaymentPaid',
    accionAuditada: 'updated',
    entityType: 'case',
    ejecutar: async () => {
      const pago = await crearPago();
      const resultado = await markPaymentPaid({ paymentId: pago.id });
      return { resultado, entityId: pago.caseId };
    },
    quedoHecha: async (caseId) =>
      (await prisma.payment.count({
        where: { caseId, status: 'pagado' },
      })) === 1,
  },
  {
    nombre: 'registerPayment',
    accionAuditada: 'created',
    entityType: 'case',
    ejecutar: async () => {
      const { id } = await crearCaso();
      const resultado = await registerPayment({
        caseId: id,
        amount: 250000,
        paymentDate: '2026-11-04',
      });
      return { resultado, entityId: id };
    },
    quedoHecha: async (caseId) =>
      (await prisma.payment.count({ where: { caseId } })) === 1,
  },
  {
    nombre: 'uploadPaymentReceipt',
    accionAuditada: 'updated',
    entityType: 'case',
    ejecutar: async () => {
      const pago = await crearPago();
      const resultado = await uploadPaymentReceipt({
        paymentId: pago.id,
        receipt: unPdf('comprobante.pdf'),
      });
      return { resultado, entityId: pago.caseId };
    },
    quedoHecha: async (caseId) =>
      (await prisma.payment.count({
        where: { caseId, receiptFileId: { not: null } },
      })) === 1,
  },
  {
    nombre: 'createRole',
    accionAuditada: 'created',
    entityType: 'role',
    ejecutar: async () => {
      const resultado = await createRole(datosDeRol());
      return { resultado, entityId: resultado.data?.id ?? '' };
    },
    quedoHecha: rolExiste,
  },
  {
    nombre: 'updateRole',
    accionAuditada: 'updated',
    entityType: 'role',
    ejecutar: async () => {
      const { id } = await crearRol();
      const resultado = await updateRole({ id, description: 'Rol editado' });
      return { resultado, entityId: id };
    },
    quedoHecha: async (id) =>
      (await prisma.role.findUnique({ where: { id } }))?.description ===
      'Rol editado',
  },
  {
    nombre: 'deleteRole',
    accionAuditada: 'deleted',
    entityType: 'role',
    ejecutar: async () => {
      const { id } = await crearRol();
      const resultado = await deleteRole(id);
      return { resultado, entityId: id };
    },
    quedoHecha: async (id) => !(await rolExiste(id)),
  },
];

function auditoriaDe(entityType: string, entityId: string) {
  return prisma.auditLog.findMany({
    where: { tenantId: centro.tenantId, entityType, entityId },
  });
}

beforeAll(async () => {
  centro = await crearTenantDePrueba(TAG, [
    P.VER_CASOS,
    P.VER_TODOS_CASOS,
    P.EDITAR_CASOS,
    P.CREAR_ACREEDORES,
    P.EDITAR_ACREEDORES,
    P.ELIMINAR_ACREEDORES,
    P.CREAR_DEUDORES,
    P.EDITAR_DEUDORES,
    P.ELIMINAR_DEUDORES,
    P.GENERAR_DOCUMENTOS,
    P.REGISTRAR_PAGOS,
    P.CREAR_ROLES,
    P.EDITAR_ROLES,
    P.ELIMINAR_ROLES,
  ]);
});

beforeEach(() => {
  _resetRateLimitStore();
  mockCookies.clear();
  mockCookies.setToken('access-token', centro.token);
  enviarCorreo = jest
    .spyOn(
      emailService as unknown as { sendEmail: () => Promise<boolean> },
      'sendEmail',
    )
    .mockResolvedValue(true);
});

afterEach(() => {
  enviarCorreo.mockRestore();
});

afterAll(async () => {
  // Con el código sin arreglar quedan registros demorados en vuelo: se les da
  // tiempo de terminar para que no choquen con el borrado del tenant.
  await new Promise((r) => setTimeout(r, DEMORA_DEL_REGISTRO_MS * 2));
  await purgeTenant(centro.tenantId);
  await prisma.$disconnect();
});

describe('cada acción espera su registro de auditoría', () => {
  it.each(ESCENARIOS)(
    '$nombre',
    async ({ ejecutar, accionAuditada, entityType }) => {
      const { resultado, entityId } = await ejecutar();
      expect(resultado).toMatchObject({ success: true });

      const registros = await auditoriaDe(entityType, entityId);
      expect(registros).toHaveLength(1);
      expect(registros[0]).toMatchObject({
        action: accionAuditada,
        userId: centro.userId,
      });
    },
  );
});

describe('si Postgres rechaza el registro, la operación sigue', () => {
  let errorDelLogger: jest.SpyInstance;

  beforeEach(async () => {
    errorDelLogger = jest.spyOn(logger, 'error').mockImplementation(() => {});
    // NOT VALID: las filas de auditoría que ya existen no se revisan.
    await prisma.$executeRawUnsafe(
      `ALTER TABLE audit_logs ADD CONSTRAINT ${SIN_AUDITORIA}
       CHECK ("tenantId" <> '${centro.tenantId}') NOT VALID`,
    );
  });

  afterEach(async () => {
    errorDelLogger.mockRestore();
    await prisma.$executeRawUnsafe(
      `ALTER TABLE audit_logs DROP CONSTRAINT ${SIN_AUDITORIA}`,
    );
  });

  it.each(ESCENARIOS)(
    '$nombre',
    async ({ ejecutar, quedoHecha, accionAuditada, entityType }) => {
      const { resultado, entityId } = await ejecutar();

      expect(resultado).toMatchObject({ success: true });
      expect(await quedoHecha(entityId)).toBe(true);
      expect(await auditoriaDe(entityType, entityId)).toEqual([]);

      const constancia = errorDelLogger.mock.calls.find(
        ([mensaje]) =>
          mensaje === 'No se pudo escribir el registro de auditoría',
      )?.[2];
      expect(constancia).toMatchObject({
        entityType,
        entityId,
        auditedAction: accionAuditada,
      });
    },
  );
});
