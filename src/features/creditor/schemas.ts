import { z } from 'zod';

const decimalToNumber = z.any().transform((val) => {
  if (val && typeof val === 'object' && 'toNumber' in val) {
    return val.toNumber();
  }
  return Number(val);
});

const contactForCreditorSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  role: z.string(),
  creditorId: z.string(),
});

const debtForCreditorSchema = z.object({
  id: z.string(),
  amount: decimalToNumber,
  interestRate: decimalToNumber,
  type: z.string(),
  caseId: z.string(),
  creditorId: z.string(),
  debtorId: z.string().nullable(),
});

const caseForDebtSchema = z.object({
  id: z.string(),
  caseNumber: z.string(),
  debtorName: z.string(),
  type: z.string(),
  totalDebt: decimalToNumber,
  creditors: z.coerce.number(),
  createdDate: z.coerce.date(),
  hearingDate: z.coerce.date().nullable(),
  phase: z.string().nullable(),
  causes: z.array(z.string()),
  debtorId: z.string(),
  operatorId: z.string(),
  debtor: z.object({
    id: z.string(),
    name: z.string(),
    idNumber: z.string(),
    idType: z.string(),
    email: z.string(),
    phone: z.string(),
  }),
});

const debtWithCaseSchema = debtForCreditorSchema.extend({
  case: caseForDebtSchema,
});

export const creditorSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'El nombre es requerido'),
  type: z.string().min(1, 'El tipo es requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(1, 'El teléfono es requerido'),
  address: z.string().min(1, 'La dirección es requerida'),
  city: z.string().nullable(),
  department: z.string().nullable(),
  representative: z.string().min(1, 'El representante es requerido'),
  nit: z.string().min(1, 'El NIT es requerido'),
  website: z.string().nullable(),
  createdDate: z.coerce.date().nullable(),
  lastUpdate: z.coerce.date().nullable(),
  description: z.string().nullable(),
  representativeId: z.string().nullable(),
  representativeEmail: z.string().nullable(),
  representativePhone: z.string().nullable(),
  bankName: z.string().nullable(),
  contacts: z.array(contactForCreditorSchema),
  debts: z.array(debtForCreditorSchema),
  _count: z.object({
    debts: z.coerce.number(),
  }),
});

export type Creditor = z.infer<typeof creditorSchema>;

export const creditorWithCasesSchema = creditorSchema.extend({
  debts: z.array(debtWithCaseSchema),
});

export type CreditorWithCases = z.infer<typeof creditorWithCasesSchema>;

export const createCreditorSchema = creditorSchema
  .omit({
    id: true,
    createdDate: true,
    lastUpdate: true,
    contacts: true,
    debts: true,
    _count: true,
  })
  .extend({
    city: z.string().optional(),
    department: z.string().optional(),
    website: z.string().optional(),
    description: z.string().optional(),
    representativeEmail: z
      .string()
      .email('Email del representante inválido')
      .or(z.literal(''))
      .optional(),
    representativeId: z.string().optional(),
    representativePhone: z.string().optional(),
    bankName: z.string().optional(),
  });

export type CreateCreditorData = z.infer<typeof createCreditorSchema>;

export const updateCreditorSchema = creditorSchema
  .omit({
    contacts: true,
    debts: true,
    _count: true,
    createdDate: true,
    lastUpdate: true,
  })
  .extend({
    id: z.string(),
    name: z.string().min(1, 'El nombre es requerido').optional(),
    type: z.string().min(1, 'El tipo es requerido').optional(),
    email: z.string().email('Email inválido').optional(),
    phone: z.string().min(1, 'El teléfono es requerido').optional(),
    address: z.string().min(1, 'La dirección es requerida').optional(),
    representative: z
      .string()
      .min(1, 'El representante es requerido')
      .optional(),
    nit: z.string().min(1, 'El NIT es requerido').optional(),
    city: z.string().optional(),
    department: z.string().optional(),
    website: z.string().optional(),
    description: z.string().optional(),
    representativeEmail: z
      .string()
      .email('Email del representante inválido')
      .or(z.literal(''))
      .optional(),
    representativeId: z.string().optional(),
    representativePhone: z.string().optional(),
    bankName: z.string().optional(),
  });

export type UpdateCreditorData = z.infer<typeof updateCreditorSchema>;

export const creditorSummarySchema = creditorSchema.omit({
  contacts: true,
  debts: true,
  _count: true,
});

export type CreditorSummaryData = z.infer<typeof creditorSummarySchema>;

export const getAllCreditorsSchema = z.array(creditorSchema);
export const getCreditorByIdSchema = z.string();
export const deleteCreditorSchema = z.object({ id: z.string() });
