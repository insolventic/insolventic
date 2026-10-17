/**
 * Test fixtures — reusable test data across all test suites
 */

export const TENANT = {
  id: 'tenant-test-id',
  slug: 'test-tenant',
  name: 'Test Tenant',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

export const PERMISSIONS = {
  VIEW_CASES: 'Ver casos',
  VIEW_ALL_CASES: 'Ver todos los casos',
  VIEW_OWN_CASES: 'Ver casos propios',
  VIEW_AS_CLIENT: 'Ver casos como cliente',
  CREATE_CASES: 'Crear casos',
  EDIT_CASES: 'Editar casos',
  DELETE_CASES: 'Eliminar casos',
  VIEW_DEBTORS: 'Ver deudores',
  CREATE_DEBTORS: 'Crear deudores',
  EDIT_DEBTORS: 'Editar deudores',
  DELETE_DEBTORS: 'Eliminar deudores',
  VIEW_DOCUMENTS: 'Ver documentos',
};

export const ADMIN_ROLE = {
  id: 'role-admin-id',
  name: 'Administrador',
  description: 'Full access',
  color: '#FF0000',
  tenantId: TENANT.id,
  permissions: [
    { permission: { name: PERMISSIONS.VIEW_CASES } },
    { permission: { name: PERMISSIONS.VIEW_ALL_CASES } },
    { permission: { name: PERMISSIONS.CREATE_CASES } },
    { permission: { name: PERMISSIONS.EDIT_CASES } },
    { permission: { name: PERMISSIONS.DELETE_CASES } },
    { permission: { name: PERMISSIONS.VIEW_DEBTORS } },
    { permission: { name: PERMISSIONS.CREATE_DEBTORS } },
    { permission: { name: PERMISSIONS.EDIT_DEBTORS } },
    { permission: { name: PERMISSIONS.DELETE_DEBTORS } },
    { permission: { name: PERMISSIONS.VIEW_DOCUMENTS } },
  ],
};

export const LAWYER_ROLE = {
  id: 'role-lawyer-id',
  name: 'Abogado',
  description: 'Lawyer access',
  color: '#0000FF',
  tenantId: TENANT.id,
  permissions: [
    { permission: { name: PERMISSIONS.VIEW_CASES } },
    { permission: { name: PERMISSIONS.VIEW_OWN_CASES } },
    { permission: { name: PERMISSIONS.VIEW_DEBTORS } },
  ],
};

export const USER_ROLE = {
  id: 'role-user-id',
  name: 'Usuario',
  description: 'Basic user',
  color: '#00FF00',
  tenantId: TENANT.id,
  permissions: [
    { permission: { name: PERMISSIONS.VIEW_CASES } },
    { permission: { name: PERMISSIONS.VIEW_AS_CLIENT } },
  ],
};

export const ADMIN_USER = {
  id: 'user-admin-id',
  name: 'Admin User',
  email: 'admin@test.com',
  password: '$2b$12$LJ3T4FmFb4K2bEfFVxVg6eG/BqXs1mR.8R5JlTd0.T0xOcRs3xCJi', // "password123"
  phone: '3001234567',
  address: 'Test Address',
  professionalCard: 'TP-001',
  roleId: ADMIN_ROLE.id,
  tenantId: TENANT.id,
  lastLogin: new Date('2025-01-15'),
  // A-6 (revocación de sesiones): authenticateUser compara
  // `payload.tokenVersion` (0 para un token sin ese claim, ver
  // src/lib/auth.ts) contra esta columna — sin ella, `undefined !== 0`
  // rechaza cualquier llamada autenticada en los tests.
  tokenVersion: 0,
  role: ADMIN_ROLE,
  tenant: TENANT,
};

export const LAWYER_USER = {
  id: 'user-lawyer-id',
  name: 'Lawyer User',
  email: 'lawyer@test.com',
  password: '$2b$12$LJ3T4FmFb4K2bEfFVxVg6eG/BqXs1mR.8R5JlTd0.T0xOcRs3xCJi',
  phone: '3009876543',
  address: 'Lawyer Address',
  professionalCard: 'TP-002',
  roleId: LAWYER_ROLE.id,
  tenantId: TENANT.id,
  lastLogin: new Date('2025-01-10'),
  tokenVersion: 0,
  role: LAWYER_ROLE,
  tenant: TENANT,
};

export const DEBTOR = {
  id: 'debtor-test-id',
  name: 'Juan Pérez',
  idType: 'CC',
  idNumber: '1234567890',
  email: 'juan@test.com',
  phone: '3001112233',
  address: 'Calle 123',
  city: 'Bogotá',
  department: 'Cundinamarca',
  occupation: 'Empleado',
  monthlyIncome: 3000000,
  monthlyExpenses: 2500000,
  otherIncomeAmount: 0,
  otherIncomeDescription: null,
  hasEmployerCertification: false,
  birthDate: null,
  maritalStatus: null,
  dependents: null,
  educationLevel: null,
  emergencyContact: null,
  emergencyPhone: null,
  bankAccount: null,
  bankName: null,
  accountType: null,
  description: null,
  totalDebt: 50000000,
  activeCases: 1,
  createdDate: new Date('2025-01-01'),
  lastUpdate: new Date('2025-01-01'),
  tenantId: TENANT.id,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

export const CASE_DATA = {
  id: 'case-test-id',
  caseNumber: 'CASO-000001',
  debtorName: 'Juan Pérez',
  type: 'INSOLVENCY',
  phase: 'ADMISION',
  status: 'ACTIVE',
  totalDebt: '50000000',
  creditors: '3',
  debtorId: DEBTOR.id,
  operatorId: ADMIN_USER.id,
  tenantId: TENANT.id,
  createdDate: new Date('2025-01-15'),
  updatedAt: new Date('2025-01-15'),
  hearingDate: null,
  causes: [],
  tramite: null,
  filingDate: null,
  debtorIdNumber: null,
  convened: null,
  attorney: null,
  owedCapital: null,
  designatedOperator: null,
  designationDate: null,
  positionAcceptanceDate: null,
  inadmissionDate: null,
  admissionDate: null,
  firstHearingDate: null,
  firstHearingTime: null,
  hasLegalProcesses: false,
  courtNumber: null,
  city: null,
  processType: null,
  plaintiff: null,
  judicialFileNumber: null,
  suspensionDate: null,
  resultDeliveryDate: null,
  resultType: null,
  resultDate: null,
  siccacNumber: null,
  riskCenterCommunication: false,
  monthlyIncome: 3000000,
  monthlyExpenses: 2500000,
  monthlyPaymentAmount: 500000,
  // C-1a/C-1c (auditoría del formulario de conciliación, 2026-10-12): las 11
  // columnas nuevas de Case. `caseSchema` las valida con `z.coerce.date()`
  // (las 3 fechas) o `z.string()` (las 8 de texto); ninguna de las dos acepta
  // `undefined` bajo `.nullable()` — sin esta entrada, cualquier mock que
  // haga spread de `CASE_DATA` y no las sobreescriba rompía con
  // "expected date, received Date" / "Invalid Date".
  concFechaSolicitud: null,
  concFechaCitacion: null,
  concFechaDesistimiento: null,
  concCampoConError: null,
  concDescripcionError: null,
  concValorIncorrecto: null,
  concValorCorrecto: null,
  concNumeroActaUnionRef: null,
  concNumeroTramiteUnionRef: null,
  concTipoSolicitanteDesistimiento: null,
  concApoderadoDesistimientoName: null,
};

export const DEBT = {
  id: 'debt-test-id',
  creditorName: 'Banco Test',
  creditorType: 'FINANCIAL',
  amount: 25000000,
  capitalAmount: 20000000,
  interestAmount: 5000000,
  interestRate: 1.5,
  classification: 'PRIMERA_CLASE',
  caseId: CASE_DATA.id,
  debtorId: DEBTOR.id,
  tenantId: TENANT.id,
};

export const ASSET = {
  id: 'asset-test-id',
  type: 'REAL_ESTATE',
  description: 'Apartamento en Bogotá',
  value: 150000000,
  location: 'Bogotá',
  caseId: CASE_DATA.id,
  debtorId: DEBTOR.id,
  tenantId: TENANT.id,
};

export function buildSessionPayload(user: typeof ADMIN_USER) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role.name,
    permissions: user.role.permissions.map((rp) => rp.permission.name),
    tenantId: TENANT.slug,
    tenantName: TENANT.name,
    lastLogin: new Date(),
  };
}
