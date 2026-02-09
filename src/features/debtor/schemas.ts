import { z } from 'zod';

const decimalToNumber = z.any().transform((val) => {
  if (val && typeof val === 'object' && 'toNumber' in val) {
    return val.toNumber();
  }
  return Number(val);
});

const caseForDebtorSchema = z.object({
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
});

const debtForDebtorSchema = z.object({
  id: z.string(),
  amount: decimalToNumber,
  interestRate: decimalToNumber,
  type: z.string(),
  caseId: z.string(),
  creditorId: z.string(),
  debtorId: z.string().nullable(),
  creditor: z.object({
    name: z.string(),
  }),
});

const assetForDebtorSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  value: decimalToNumber,
  caseId: z.string(),
  debtorId: z.string().nullable(),
});

export const debtorSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'El nombre es requerido'),
  idNumber: z.string().min(1, 'El número de identificación es requerido'),
  idType: z.string().min(1, 'El tipo de identificación es requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(1, 'El teléfono es requerido'),
  address: z.string().min(1, 'La dirección es requerida'),
  city: z.string().min(1, 'La ciudad es requerida'),
  department: z.string().min(1, 'El departamento es requerido'),
  birthDate: z.coerce.date().nullable(),
  maritalStatus: z.string().nullable(),
  occupation: z.string().min(1, 'La ocupación es requerida'),
  monthlyIncome: decimalToNumber,
  monthlyExpenses: decimalToNumber.nullable(),
  dependents: z.coerce
    .number()
    .min(0, 'El número de dependientes debe ser positivo')
    .nullable(),
  educationLevel: z.string().nullable(),
  emergencyContact: z.string().nullable(),
  emergencyPhone: z.string().nullable(),
  bankAccount: z.string().nullable(),
  bankName: z.string().nullable(),
  accountType: z.string().nullable(),
  description: z.string().nullable(),
  totalDebt: decimalToNumber,
  activeCases: z.coerce.number(),
  createdDate: z.coerce.date(),
  lastUpdate: z.coerce.date(),

  // Additional income details
  otherIncomeDescription: z.string().nullable(),
  otherIncomeAmount: decimalToNumber.nullable(),
  hasEmployerCertification: z.boolean(),

  cases: z.array(caseForDebtorSchema),
  debts: z.array(debtForDebtorSchema),
  assets: z.array(assetForDebtorSchema),
  _count: z.object({
    cases: z.coerce.number(),
    debts: z.coerce.number(),
    assets: z.coerce.number(),
  }),
});

export type Debtor = z.infer<typeof debtorSchema>;

export const createDebtorSchema = debtorSchema
  .omit({
    id: true,
    createdDate: true,
    lastUpdate: true,
    cases: true,
    debts: true,
    assets: true,
    _count: true,
  })
  .extend({
    totalDebt: z.coerce.number().default(0),
    activeCases: z.coerce.number().default(0),
    monthlyIncome: z.coerce.number().default(0),
    birthDate: z.date().optional(),
    maritalStatus: z.string().optional(),
    monthlyExpenses: decimalToNumber.optional(),
    dependents: z.coerce
      .number()
      .min(0, 'El número de dependientes debe ser positivo')
      .optional(),
    educationLevel: z.string().optional(),
    emergencyContact: z.string().optional(),
    emergencyPhone: z.string().optional(),
    bankAccount: z.string().optional(),
    bankName: z.string().optional(),
    accountType: z.string().optional(),
    description: z.string().optional(),
    otherIncomeDescription: z.string().optional(),
    otherIncomeAmount: z.coerce.number().optional(),
    hasEmployerCertification: z.boolean().default(false),
  });

export type CreateDebtorData = z.infer<typeof createDebtorSchema>;

export const updateDebtorSchema = debtorSchema
  .omit({
    cases: true,
    debts: true,
    assets: true,
    _count: true,
    createdDate: true,
    lastUpdate: true,
    totalDebt: true,
    activeCases: true,
  })
  .extend({
    id: z.string(),
    birthDate: z.date().optional(),
    maritalStatus: z.string().optional(),
    monthlyExpenses: z.coerce.number().optional(),
    dependents: z.coerce
      .number()
      .min(0, 'El número de dependientes debe ser positivo')
      .optional(),
    educationLevel: z.string().optional(),
    emergencyContact: z.string().optional(),
    emergencyPhone: z.string().optional(),
    bankAccount: z.string().optional(),
    bankName: z.string().optional(),
    accountType: z.string().optional(),
    description: z.string().optional(),
    otherIncomeDescription: z.string().optional(),
    otherIncomeAmount: z.coerce.number().optional(),
    hasEmployerCertification: z.boolean().optional(),
  });

export type UpdateDebtorData = z.infer<typeof updateDebtorSchema>;

export const debtorSummarySchema = debtorSchema.omit({
  cases: true,
  debts: true,
  assets: true,
  _count: true,
});

export type DebtorSummaryData = z.infer<typeof debtorSummarySchema>;

export const updateDebtorFormSchema = debtorSummarySchema.omit({
  id: true,
});

export type UpdateDebtorFormData = z.infer<typeof updateDebtorFormSchema>;

export const getAllDebtorsSchema = z.array(debtorSchema);
export const getDebtorByIdSchema = z.string();
export const deleteDebtorSchema = z.string();
