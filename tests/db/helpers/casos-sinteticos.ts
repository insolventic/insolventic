/**
 * Expedientes sintéticos para la verificación de punta a punta
 * (`documentos-e2e.db.test.ts`).
 *
 * Cada valor es distintivo a propósito —direcciones con número, montos
 * irrepetibles, nombres con segundo apellido, placas, radicados— para poder
 * buscarlo LITERALMENTE en el documento renderizado y decidir si llegó o no.
 * Es lo contrario del relleno automático de desarrollo, donde cada campo vale
 * su propio nombre y por eso nada se puede distinguir de nada.
 *
 * Las causas de insolvencia van a propósito en las DOS formas que existen hoy
 * en la base: I1 guarda las etiquetas en español (como los expedientes
 * anteriores a la unificación) e I3 guarda los valores canónicos (como el
 * wizard a partir de ahora). Las dos tienen que imprimir SI en su renglón.
 */

export interface DebtorSeed {
  name: string;
  idNumber: string;
  idType: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  department: string;
  birthDate: Date;
  maritalStatus: string;
  occupation: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  dependents: number;
  educationLevel: string;
  totalDebt: number;
  emergencyContact: string;
  emergencyPhone: string;
  bankAccount: string;
  bankName: string;
  accountType: string;
  description: string;
  activeCases: number;
  otherIncomeDescription: string;
  otherIncomeAmount: number;
  hasEmployerCertification: boolean;
  // Sección I del formulario definitivo
  deudorTipoIdentificacion: string;
  deudorIdentificacion: string;
  deudorPrimerNombre: string;
  deudorSegundoNombre: string;
  deudorPrimerApellido: string;
  deudorSegundoApellido: string;
  deudorNombreCompleto: string;
  deudorFechaNacimiento: Date;
  deudorLugarNacimiento: string;
  deudorNacionalidad: string;
  deudorEstadoCivil: string;
  deudorRegimenMatrimonial: string;
  sociedadConyugalVigente: boolean;
  existeCapitulaciones: boolean;
  deudorDireccionResidencia: string;
  deudorCiudad: string;
  deudorDepartamento: string;
  deudorCodigoPostal: string;
  deudorTelefonoFijo: string;
  deudorTelefonoCelular: string;
  deudorCorreoElectronico: string;
}

export interface CaseFixture {
  key: string;
  label: string;
  caseType: 'INSOLVENCY' | 'CONCILIATION' | 'SUPPORT_AGREEMENT';
  debtor: DebtorSeed;
  /** Lo que el wizard manda a `createCase` (antes de `handleSubmit`). */
  form: Record<string, unknown>;
  /**
   * Valores que un revisor humano esperaría encontrar impresos en al menos un
   * documento del trámite. etiqueta → texto literal que debe aparecer.
   */
  expectations: Record<string, string>;
}

// ===========================================================================
// DEUDORES
// ===========================================================================

const DEUDOR_CASADA: DebtorSeed = {
  name: 'Gloria Esperanza Rincón Alzate',
  idNumber: '41567890',
  idType: 'CC',
  email: 'gloria.rincon@correoejemplo.com',
  phone: '3124457812',
  address: 'Calle 134 # 7-83 Apartamento 502',
  city: 'Bogotá D.C.',
  department: 'Cundinamarca',
  birthDate: new Date('1979-04-17'),
  maritalStatus: 'Casado(a)',
  occupation: 'Auxiliar de enfermería',
  monthlyIncome: 3850000,
  monthlyExpenses: 3120000,
  dependents: 2,
  educationLevel: 'Técnico',
  totalDebt: 98450000,
  emergencyContact: 'Hernán Darío Rincón Alzate',
  emergencyPhone: '3017789045',
  bankAccount: '4567123409',
  bankName: 'Banco de Occidente',
  accountType: 'Ahorros',
  description: 'Deudora remitida por la Personería de Suba.',
  activeCases: 0,
  otherIncomeDescription: 'Arriendo de local comercial en Fontibón',
  otherIncomeAmount: 620000,
  hasEmployerCertification: true,
  deudorTipoIdentificacion: 'CC',
  deudorIdentificacion: '41567890',
  deudorPrimerNombre: 'Gloria',
  deudorSegundoNombre: 'Esperanza',
  deudorPrimerApellido: 'Rincón',
  deudorSegundoApellido: 'Alzate',
  deudorNombreCompleto: 'Gloria Esperanza Rincón Alzate',
  deudorFechaNacimiento: new Date('1979-04-17'),
  deudorLugarNacimiento: 'Sogamoso, Boyacá',
  deudorNacionalidad: 'Colombiana',
  deudorEstadoCivil: 'Casado(a)',
  deudorRegimenMatrimonial: 'Sociedad conyugal',
  sociedadConyugalVigente: true,
  existeCapitulaciones: false,
  deudorDireccionResidencia: 'Calle 134 # 7-83 Apartamento 502',
  deudorCiudad: 'Bogotá D.C.',
  deudorDepartamento: 'Cundinamarca',
  deudorCodigoPostal: '110121',
  deudorTelefonoFijo: '6017458123',
  deudorTelefonoCelular: '3124457812',
  deudorCorreoElectronico: 'gloria.rincon@correoejemplo.com',
};

const DEUDOR_SOLTERO: DebtorSeed = {
  name: 'Yeison Alberto Mosquera Córdoba',
  idNumber: '1098765432',
  idType: 'CC',
  email: 'yeison.mosquera@correoejemplo.com',
  phone: '3209981177',
  address: 'Carrera 48 # 22-14 Barrio Belén',
  city: 'Medellín',
  department: 'Antioquia',
  birthDate: new Date('1993-11-02'),
  maritalStatus: 'Soltero(a)',
  occupation: 'Mensajero motorizado',
  monthlyIncome: 1800000,
  monthlyExpenses: 1450000,
  dependents: 0,
  educationLevel: 'Bachiller',
  totalDebt: 45200000,
  emergencyContact: 'Luz Marina Córdoba Palacios',
  emergencyPhone: '3184420099',
  bankAccount: '9012345678',
  bankName: 'Bancolombia',
  accountType: 'Ahorros',
  description: 'Solicitud radicada de forma presencial en la sede Belén.',
  activeCases: 0,
  otherIncomeDescription: '',
  otherIncomeAmount: 0,
  hasEmployerCertification: false,
  deudorTipoIdentificacion: 'CC',
  deudorIdentificacion: '1098765432',
  deudorPrimerNombre: 'Yeison',
  deudorSegundoNombre: 'Alberto',
  deudorPrimerApellido: 'Mosquera',
  deudorSegundoApellido: 'Córdoba',
  deudorNombreCompleto: 'Yeison Alberto Mosquera Córdoba',
  deudorFechaNacimiento: new Date('1993-11-02'),
  deudorLugarNacimiento: 'Quibdó, Chocó',
  deudorNacionalidad: 'Colombiana',
  deudorEstadoCivil: 'Soltero(a)',
  deudorRegimenMatrimonial: '',
  sociedadConyugalVigente: false,
  existeCapitulaciones: false,
  deudorDireccionResidencia: 'Carrera 48 # 22-14 Barrio Belén',
  deudorCiudad: 'Medellín',
  deudorDepartamento: 'Antioquia',
  deudorCodigoPostal: '050022',
  deudorTelefonoFijo: '',
  deudorTelefonoCelular: '3209981177',
  deudorCorreoElectronico: 'yeison.mosquera@correoejemplo.com',
};

const DEUDOR_VOLUMEN: DebtorSeed = {
  ...DEUDOR_CASADA,
  name: 'Martha Lucía Villegas Ocampo',
  idNumber: '24680135',
  email: 'martha.villegas@correoejemplo.com',
  phone: '3153340099',
  address: 'Avenida 6N # 23-45 Oficina 701',
  city: 'Cali',
  department: 'Valle del Cauca',
  maritalStatus: 'Divorciado(a)',
  occupation: 'Comerciante independiente',
  monthlyIncome: 7600000,
  monthlyExpenses: 6900000,
  totalDebt: 238900000,
  deudorIdentificacion: '24680135',
  deudorPrimerNombre: 'Martha',
  deudorSegundoNombre: 'Lucía',
  deudorPrimerApellido: 'Villegas',
  deudorSegundoApellido: 'Ocampo',
  deudorNombreCompleto: 'Martha Lucía Villegas Ocampo',
  deudorEstadoCivil: 'Divorciado(a)',
  deudorRegimenMatrimonial: 'Sociedad conyugal disuelta',
  sociedadConyugalVigente: false,
  deudorDireccionResidencia: 'Avenida 6N # 23-45 Oficina 701',
  deudorCiudad: 'Cali',
  deudorDepartamento: 'Valle del Cauca',
  deudorCorreoElectronico: 'martha.villegas@correoejemplo.com',
  deudorTelefonoCelular: '3153340099',
  deudorLugarNacimiento: 'Pereira, Risaralda',
  otherIncomeDescription: 'Utilidades de la papelería La Esquina',
  otherIncomeAmount: 1400000,
};

const DEUDOR_CONCILIACION: DebtorSeed = {
  ...DEUDOR_SOLTERO,
  name: 'Diana Carolina Pulido Benavides',
  idNumber: '52998877',
  email: 'diana.pulido@correoejemplo.com',
  phone: '3005512233',
  address: 'Transversal 23 # 98-11 Torre 3 Apto 904',
  city: 'Bogotá D.C.',
  department: 'Cundinamarca',
  maritalStatus: 'Unión libre',
  occupation: 'Administradora de empresas',
  monthlyIncome: 4200000,
  monthlyExpenses: 2600000,
  totalDebt: 0,
  deudorIdentificacion: '52998877',
  deudorPrimerNombre: 'Diana',
  deudorSegundoNombre: 'Carolina',
  deudorPrimerApellido: 'Pulido',
  deudorSegundoApellido: 'Benavides',
  deudorNombreCompleto: 'Diana Carolina Pulido Benavides',
  deudorEstadoCivil: 'Unión libre',
  deudorDireccionResidencia: 'Transversal 23 # 98-11 Torre 3 Apto 904',
  deudorCiudad: 'Bogotá D.C.',
  deudorDepartamento: 'Cundinamarca',
  deudorCorreoElectronico: 'diana.pulido@correoejemplo.com',
  deudorTelefonoCelular: '3005512233',
  deudorLugarNacimiento: 'Tunja, Boyacá',
};

const DEUDOR_CONCILIACION_2: DebtorSeed = {
  ...DEUDOR_CONCILIACION,
  name: 'Óscar Iván Betancur Ramírez',
  idNumber: '71334455',
  email: 'oscar.betancur@correoejemplo.com',
  phone: '3112298844',
  address: 'Calle 10 Sur # 50-22 Casa 14',
  city: 'Envigado',
  department: 'Antioquia',
  deudorIdentificacion: '71334455',
  deudorPrimerNombre: 'Óscar',
  deudorSegundoNombre: 'Iván',
  deudorPrimerApellido: 'Betancur',
  deudorSegundoApellido: 'Ramírez',
  deudorNombreCompleto: 'Óscar Iván Betancur Ramírez',
  deudorDireccionResidencia: 'Calle 10 Sur # 50-22 Casa 14',
  deudorCiudad: 'Envigado',
  deudorDepartamento: 'Antioquia',
  deudorCorreoElectronico: 'oscar.betancur@correoejemplo.com',
  deudorTelefonoCelular: '3112298844',
};

const DEUDOR_CONCILIACION_3: DebtorSeed = {
  ...DEUDOR_CONCILIACION,
  name: 'Sandra Milena Quintero Lasso',
  idNumber: '31778899',
  email: 'sandra.quintero@correoejemplo.com',
  phone: '3176654321',
  address: 'Carrera 15 # 4-60 Barrio San Fernando',
  city: 'Popayán',
  department: 'Cauca',
  deudorIdentificacion: '31778899',
  deudorPrimerNombre: 'Sandra',
  deudorSegundoNombre: 'Milena',
  deudorPrimerApellido: 'Quintero',
  deudorSegundoApellido: 'Lasso',
  deudorNombreCompleto: 'Sandra Milena Quintero Lasso',
  deudorDireccionResidencia: 'Carrera 15 # 4-60 Barrio San Fernando',
  deudorCiudad: 'Popayán',
  deudorDepartamento: 'Cauca',
  deudorCorreoElectronico: 'sandra.quintero@correoejemplo.com',
  deudorTelefonoCelular: '3176654321',
};

const DEUDOR_APOYO: DebtorSeed = {
  ...DEUDOR_SOLTERO,
  name: 'Jaime Andrés Cuartas Henao',
  idNumber: '15998877',
  email: 'jaime.cuartas@correoejemplo.com',
  phone: '3134478899',
  address: 'Calle 52 # 30-18 Barrio Prado Centro',
  city: 'Manizales',
  department: 'Caldas',
  maritalStatus: 'Soltero(a)',
  occupation: 'Pensionado',
  monthlyIncome: 2300000,
  monthlyExpenses: 1900000,
  totalDebt: 0,
  deudorIdentificacion: '15998877',
  deudorPrimerNombre: 'Jaime',
  deudorSegundoNombre: 'Andrés',
  deudorPrimerApellido: 'Cuartas',
  deudorSegundoApellido: 'Henao',
  deudorNombreCompleto: 'Jaime Andrés Cuartas Henao',
  deudorDireccionResidencia: 'Calle 52 # 30-18 Barrio Prado Centro',
  deudorCiudad: 'Manizales',
  deudorDepartamento: 'Caldas',
  deudorCorreoElectronico: 'jaime.cuartas@correoejemplo.com',
  deudorTelefonoCelular: '3134478899',
  deudorLugarNacimiento: 'Salamina, Caldas',
};

const DEUDOR_APOYO_2: DebtorSeed = {
  ...DEUDOR_APOYO,
  name: 'Rosa Elena Caicedo Mina',
  idNumber: '29445566',
  email: 'rosa.caicedo@correoejemplo.com',
  phone: '3188812345',
  address: 'Calle 3 # 12-40 Barrio El Jardín',
  city: 'Buenaventura',
  department: 'Valle del Cauca',
  deudorIdentificacion: '29445566',
  deudorPrimerNombre: 'Rosa',
  deudorSegundoNombre: 'Elena',
  deudorPrimerApellido: 'Caicedo',
  deudorSegundoApellido: 'Mina',
  deudorNombreCompleto: 'Rosa Elena Caicedo Mina',
  deudorDireccionResidencia: 'Calle 3 # 12-40 Barrio El Jardín',
  deudorCiudad: 'Buenaventura',
  deudorDepartamento: 'Valle del Cauca',
  deudorCorreoElectronico: 'rosa.caicedo@correoejemplo.com',
  deudorTelefonoCelular: '3188812345',
};

// ===========================================================================
// I-1 — INSOLVENCIA COMPLETA (casada, 3 apoderados, 6 acreedores, 2 juzgados)
// ===========================================================================

const I1_DEBTS = [
  {
    creditor: 'Banco Davivienda S.A.',
    type: 'TARJETA_CREDITO',
    interestRate: '2.15',
    capitalAmount: '28400000',
    interestAmount: '2180000',
    creditorAddress: 'Avenida El Dorado # 68B-31 Torre A',
    creditorCity: 'Bogotá D.C.',
    creditorEmail: 'notificaciones.judiciales@davivienda.test',
    documentType: 'Pagaré No. 4402-889771',
    grantDate: '2022-08-12',
    dueDate: '2027-08-12',
    creditClassification: 'Quinta clase',
    creditorClass: 'Entidad financiera vigilada',
    isDeferred: false,
    hasActiveLibranza: false,
    daysOverdue: 214,
    noCoDebtor: false,
    coDebtorName: 'Hernán Darío Rincón Alzate',
    coDebtorCity: 'Bogotá D.C.',
    coDebtorAddress: 'Calle 134 # 7-83 Apartamento 502',
    coDebtorPhone: '3017789045',
    coDebtorEmail: 'hernan.rincon@correoejemplo.com',
  },
  {
    creditor: 'Cooperativa Financiera Confiar',
    type: 'CREDITO_LIBRE_INVERSION',
    interestRate: '1.78',
    capitalAmount: '19750000',
    interestAmount: '1340000',
    creditorAddress: 'Calle 52 # 49-28 Piso 4',
    creditorCity: 'Medellín',
    creditorEmail: 'cartera@confiar.test',
    documentType: 'Libranza No. CF-77120',
    grantDate: '2023-02-20',
    dueDate: '2028-02-20',
    creditClassification: 'Quinta clase',
    creditorClass: 'Cooperativa',
    isDeferred: false,
    hasActiveLibranza: true,
    daysOverdue: 97,
    noCoDebtor: true,
  },
  {
    creditor: 'Empresa de Acueducto de Bogotá',
    type: 'SERVICIOS_PUBLICOS',
    interestRate: '0.9',
    capitalAmount: '3150000',
    interestAmount: '0',
    creditorAddress: 'Avenida Calle 24 # 37-15',
    creditorCity: 'Bogotá D.C.',
    creditorEmail: 'facturacion@acueducto.test',
    documentType: 'Factura de servicios No. 998877123',
    grantDate: '2025-01-15',
    dueDate: '2025-02-15',
    creditClassification: 'Quinta clase',
    creditorClass: 'Empresa de servicios públicos',
    isDeferred: false,
    hasActiveLibranza: false,
    daysOverdue: 330,
    noCoDebtor: true,
  },
  {
    creditor: 'DIAN - Dirección de Impuestos',
    type: 'IMPUESTOS',
    interestRate: '2.5',
    capitalAmount: '12600000',
    interestAmount: '3480000',
    creditorAddress: 'Carrera 8 # 6-64',
    creditorCity: 'Bogotá D.C.',
    creditorEmail: 'cobranzas@dian.test',
    documentType: 'Resolución de cobro No. 2024-44190',
    grantDate: '2024-06-30',
    dueDate: '2025-06-30',
    creditClassification: 'Primera clase',
    creditorClass: 'Entidad pública',
    isDeferred: true,
    hasActiveLibranza: false,
    daysOverdue: 180,
    noCoDebtor: true,
  },
  {
    creditor: 'Almacenes Éxito S.A.',
    type: 'TARJETA_CREDITO',
    interestRate: '2.4',
    capitalAmount: '5890000',
    interestAmount: '710000',
    creditorAddress: 'Carrera 48 # 32B Sur-139',
    creditorCity: 'Envigado',
    creditorEmail: 'juridica@exito.test',
    documentType: 'Contrato de tarjeta No. TX-5520',
    grantDate: '2021-11-05',
    dueDate: '2026-11-05',
    creditClassification: 'Quinta clase',
    creditorClass: 'Establecimiento de comercio',
    isDeferred: false,
    hasActiveLibranza: false,
    daysOverdue: 410,
    noCoDebtor: true,
  },
  {
    creditor: 'Nelson Aurelio Pardo Guzmán',
    type: 'PRESTAMO_PARTICULAR',
    interestRate: '3.0',
    capitalAmount: '18500000',
    interestAmount: '2450000',
    creditorAddress: 'Diagonal 61C # 24-18',
    creditorCity: 'Bogotá D.C.',
    creditorEmail: 'nelson.pardo@correoejemplo.com',
    documentType: 'Letra de cambio sin número',
    grantDate: '2024-03-01',
    dueDate: '2025-03-01',
    creditClassification: 'Quinta clase',
    creditorClass: 'Persona natural',
    isDeferred: false,
    hasActiveLibranza: false,
    daysOverdue: 500,
    noCoDebtor: false,
    coDebtorName: 'Claudia Patricia Alzate Tovar',
    coDebtorCity: 'Chía',
    coDebtorAddress: 'Vereda Bojacá, Finca El Recuerdo',
    coDebtorPhone: '3119988776',
    coDebtorEmail: 'claudia.alzate@correoejemplo.com',
  },
];

const I1_FORM: Record<string, unknown> = {
  type: 'INSOLVENCY',
  totalDebt: '98450000',
  creditors: 6,
  phase: 'Inicial',
  caseNumber: '',
  hearingDate: null,
  tramite: '',
  causes: ['Pérdida de empleo', 'Enfermedad', 'Otros'],
  otherCauseDetail:
    'Cierre del local comercial arrendado por obras del Metro de Bogotá',
  applicantScope: ['Persona natural no comerciante'],
  filingDate: '2026-02-11',
  debtorIdNumber: '41567890',
  attorney: 'Dra. Carmen Alicia Nieto Ospina, T.P. 189.443 del C.S.J.',
  convened: 'Acreedores relacionados en la solicitud',
  owedCapital: '88290000',
  // Operador y fechas del trámite
  designatedOperator: 'Dra. Liliana Patricia Arango Mejía',
  designationDate: '2026-02-18',
  positionAcceptanceDate: '2026-02-20',
  admissionDate: '2026-02-25',
  firstHearingDate: '2026-03-19',
  firstHearingTime: '09:30',
  siccacNumber: 'SICAAC-2026-0098771',
  riskCenterCommunication: true,
  city: 'Bogotá D.C.',
  // Procesos judiciales
  hasLegalProcesses: true,
  courtNumber: 'Juzgado 14 Civil Municipal de Bogotá',
  processType: 'EJECUTIVO',
  plaintiff: 'Banco Davivienda S.A.',
  judicialFileNumber: '11001400301420250033100',
  suspensionDate: '2026-02-26',
  // Ingresos / gastos (tab 6 legacy)
  monthlyIncome: 3850000,
  monthlyExpenses: 3120000,
  otherIncomeDescription: 'Arriendo de local comercial en Fontibón',
  otherIncomeAmount: 620000,
  hasEmployerCertification: true,
  // Propuesta de pago
  gracePeriodRequested: true,
  gracePeriodMonths: 6,
  paymentInKind: true,
  paymentInKindDescription:
    'Entrega del vehículo Renault Logan de placas KQW-412 a favor de Confiar',
  assetSaleAuthorized: true,
  assetSaleDescription:
    'Venta del lote urbano de Soacha, matrícula 051-9988771',
  cashFlowPayment: true,
  paymentTermMonths: 60,
  monthlyPaymentAmount: 1180000,
  variablePayment: 340000,
  extraordinaryPayment: true,
  extraordinaryPaymentDate: '2026-12-15',
  capitalReduction: true,
  capitalReductionPercent: 18,
  insuranceOffering: 'Póliza de vida grupo deudores Seguros Bolívar 77-4412',
  forgiveAccruedInterest: true,
  forgiveFutureInterest: false,
  paymentOrder: {
    primera: 'DIAN - Dirección de Impuestos (crédito fiscal)',
    quinta: 'Los demás acreedores a prorrata de su capital',
  },
  hasClassPrivileges: true,
  classPrivilegesDescription:
    'Prelación de primera clase para la obligación tributaria de la DIAN',
  thirdPartyPaymentAuth: true,
  guaranteeSubstitution: true,
  // Cónyuge
  conyugeTipoIdentificacion: 'CC',
  conyugeIdentificacion: '79445512',
  conyugePrimerNombre: 'Hernán',
  conyugeSegundoNombre: 'Darío',
  conyugePrimerApellido: 'Rincón',
  conyugeSegundoApellido: 'Alzate',
  conyugeTelefono: '3017789045',
  conyugeCorreo: 'hernan.rincon@correoejemplo.com',
  sociedadConyugalDisuelta: false,
  spouseAddress: 'Calle 134 # 7-83 Apartamento 502',
  // Honorarios / fundamentos
  requestedFee: '2100000',
  legalFoundations:
    'Artículos 531 y siguientes del Código General del Proceso y Decreto 2677 de 2012',
  // Notificaciones
  notificationAddress: 'Calle 134 # 7-83 Apartamento 502',
  notificationCity: 'Bogotá D.C.',
  notificationPhone: '3124457812',
  notificationEmail: 'gloria.rincon@correoejemplo.com',
  applicantSignatureName: 'Gloria Esperanza Rincón Alzate',
  applicantSignatureId: '41567890',
  // Zoom
  zoomMeetingId: '812 4457 9930',
  zoomPassword: 'Insol2026',
  zoomLink: 'https://zoom.test/j/81244579930',
  // Acuerdo
  approvalPercentage: 72.5,
  // Ocupación / empleador (formulario definitivo)
  deudorOcupacion: 'Auxiliar de enfermería',
  deudorProfesion: 'Técnica en enfermería',
  deudorActividadEconomica: 'Servicios de salud humana',
  deudorTipoVinculacion: 'Contrato a término indefinido',
  deudorNombreEmpleador: 'Clínica del Country S.A.',
  deudorNitEmpleador: '860007760-1',
  ingresoPrincipalMensual: 3850000,
  otrosIngresosMensuales: 620000,
  totalIngresosMensuales: 4470000,
  ingresosVariablesPromedio: 180000,
  ingresosNoOperacionales: 95000,
  gastosVivienda: 1250000,
  gastosAlimentacion: 720000,
  gastosServiciosPublicos: 310000,
  gastosTransporte: 260000,
  gastosEducacion: 380000,
  gastosSalud: 140000,
  otrosGastos: 60000,
  totalGastosMensuales: 3120000,
  capacidadPagoEstimada: 1350000,
  patrimonioTotalEstimado: 212000000,
  pasivoTotalEstimado: 98450000,
  serviciosManutencion: [
    {
      tipo: 'GAS',
      nombre: 'Gas natural Vanti',
      descripcion: 'Promedio 48.000',
    },
    {
      tipo: 'AGUA',
      nombre: 'Acueducto de Bogotá',
      descripcion: 'Promedio 92.000',
    },
    {
      tipo: 'OTRO',
      nombre: 'Internet y telefonía Claro',
      descripcion: 'Plan hogar 110.000',
    },
  ],
  // Cesación de pagos
  cesacionPagos: true,
  fechaCesacionPagos: '2025-09-30',
  numeroAcreedoresActual: 6,
  porcentajePasivoEnMora: 64.3,
  procesosEjecutivosVigentes: true,
  // Declaraciones
  declaracionVeracidadInformacion: true,
  manifestacionBuenaFe: true,
  manifestacionNoOcultamientoBienes: true,
  autorizacionNotificacionesCorreo: true,
  autorizacionConsultaCentralesRiesgo: true,
  autorizacionTratamientoDatos: true,
  declaracionNoOmisiones: true,
  declaracionConocimientoNorma: true,
  // Propuesta estructurada
  propuestaPlazoMeses: 60,
  propuestaPeriodicidadPago: 'Mensual',
  propuestaTasaInteres: 1.2,
  propuestaQuitaPromedio: 18,
  propuestaFechaInicioPago: '2026-04-10',
  propuestaObservaciones:
    'Se solicita respetar la prelación legal y aplicar los abonos primero a capital',
  // Anexos
  anexaSoporteIngresos: true,
  anexaExtractosBancarios: true,
  anexaCertificadosDeuda: true,
  anexaCertificadoTradicion: true,
  anexaRelacionProcesos: true,
  anexaDeclaracionRenta: false,
  anexaDocumentoIdentidad: true,
  // Expediente
  expedienteNumero: '0098771',
  expedienteAnio: 2026,
  fechaRadicacion: '2026-02-11',
  centroConciliacionNombre: 'Centro de Conciliación Constructores de Paz',
  conciliadorAsignado: 'Dra. Liliana Patricia Arango Mejía',
  ciudadRadicacion: 'Bogotá D.C.',
  // Relaciones
  debts: I1_DEBTS,
  assets: [
    {
      name: 'Apartamento 502 Torre B conjunto Altos de Suba',
      type: 'INMUEBLE',
      value: '185000000',
      description: 'Vivienda familiar de 62 m²',
      propertyType: 'Apartamento',
      address: 'Calle 134 # 7-83 Apartamento 502',
      registrationNumber: '050N-20778431',
      encumbrance: 'Hipoteca abierta a favor de Banco Davivienda S.A.',
      affectation: 'Afectación a vivienda familiar',
      precautionaryMeasure: 'Embargo inscrito el 14 de agosto de 2025',
      proofDocument: 'Certificado de tradición y libertad del 02-02-2026',
      isFamilyHome: true,
      isInalienablePatrimony: true,
      hasPendingFinesOrTaxes: true,
    },
    {
      name: 'Automóvil Renault Logan modelo 2019',
      type: 'VEHICULO',
      value: '24500000',
      description: 'Vehículo de uso familiar, color plata',
      brand: 'Renault',
      model: '2019',
      condition: 'Usado, en funcionamiento',
      licensePlate: 'KQW-412',
      transitAuthority: 'Secretaría de Movilidad de Bogotá',
      guaranteeInFavorOf: 'Cooperativa Financiera Confiar',
      guaranteeAmount: '9800000',
    },
    {
      name: 'Lote urbano en Soacha sector Compartir',
      type: 'INMUEBLE',
      value: '48000000',
      description: 'Lote de 120 m² sin construir',
      propertyType: 'Lote',
      address: 'Carrera 7 Este # 4-22 Soacha',
      registrationNumber: '051-9988771',
      encumbrance: 'Sin gravamen',
      affectation: 'Ninguna',
      precautionaryMeasure: 'Ninguna',
      proofDocument: 'Escritura pública 1120 Notaría 2 de Soacha',
      isFamilyHome: false,
      isInalienablePatrimony: false,
      hasPendingFinesOrTaxes: false,
    },
    {
      name: 'Equipo de ecografía portátil',
      type: 'MUEBLE',
      value: '6300000',
      description: 'Herramienta de trabajo marca Mindray',
      brand: 'Mindray',
      model: 'DP-10',
      condition: 'Buen estado',
      material: 'Equipo médico',
    },
  ],
  libranzas: [
    {
      payerName: 'Clínica del Country S.A.',
      payerAddress: 'Carrera 16 # 82-57 Bogotá',
      payerEmail: 'nomina@clinicadelcountry.test',
      payerPhone: '6015301270',
      deductedAmount: '480000',
      productAndCreditor: 'Libranza CF-77120 - Cooperativa Financiera Confiar',
    },
    {
      payerName: 'Colpensiones',
      payerAddress: 'Carrera 10 # 72-33 Torre B Bogotá',
      payerEmail: 'notificaciones@colpensiones.test',
      payerPhone: '6014232121',
      deductedAmount: '150000',
      productAndCreditor: 'Descuento de aporte voluntario Fondo Protección',
    },
  ],
  suspendedServices: [
    {
      creditorName: 'Enel Colombia S.A. E.S.P.',
      address: 'Carrera 13 # 93-66 Bogotá',
      email: 'servicioalcliente@enel.test',
      phone: '6014268888',
      suspendedProduct: 'Energía eléctrica cuenta 8812445',
      amountOwed: '1240000',
    },
    {
      creditorName: 'Vanti S.A. E.S.P.',
      address: 'Calle 100 # 13-21 Bogotá',
      email: 'pqr@vanti.test',
      phone: '6013077060',
      suspendedProduct: 'Gas natural contrato 55-7781',
      amountOwed: '385000',
    },
  ],
  dependents: [
    { name: 'Sara Valentina Rincón Villegas', age: 14, relationship: 'Hija' },
    { name: 'Matías Rincón Villegas', age: 7, relationship: 'Hijo' },
  ],
  legalProcesses: [
    {
      processType: 'EJECUTIVO',
      plaintiff: 'Banco Davivienda S.A.',
      court: 'Juzgado 14 Civil Municipal de Bogotá',
      courtEmail: 'j14cmbta@cendoj.test',
      fileNumber: '11001400301420250033100',
      precautionaryMeasure: 'Embargo de salario en un 50%',
    },
    {
      processType: 'COACTIVO',
      plaintiff: 'DIAN - Dirección de Impuestos',
      court: 'División de Cobranzas DIAN Seccional Bogotá',
      courtEmail: 'cobranzas.bogota@dian.test',
      fileNumber: 'COA-2025-778120',
      precautionaryMeasure: 'Embargo de cuenta de ahorros 4567123409',
    },
    {
      processType: 'OTROS',
      processTypeOther: 'Restitución de local comercial arrendado',
      plaintiff: 'Inversiones La Castellana Ltda.',
      court: 'Juzgado 14 Civil Municipal de Bogotá',
      courtEmail: 'j14cmbta@cendoj.test',
      fileNumber: '11001400301420250044200',
      precautionaryMeasure: 'Ninguna',
    },
  ],
  apoderados: [
    {
      nombreCompleto: 'Carmen Alicia Nieto Ospina',
      tipoIdentificacion: 'CC',
      identificacion: '52114477',
      tarjetaProfesional: '189443',
      direccion: 'Calle 72 # 10-34 Oficina 801',
      telefono: '3145567788',
      correo: 'carmen.nieto@abogadosnieto.test',
      existePoderOtorgado: true,
    },
    {
      nombreCompleto: 'Fabián Eduardo Saldarriaga Mesa',
      tipoIdentificacion: 'CC',
      identificacion: '79882211',
      tarjetaProfesional: '204118',
      direccion: 'Carrera 11 # 93-45 Oficina 303',
      telefono: '3002211445',
      correo: 'fabian.saldarriaga@abogadosnieto.test',
      existePoderOtorgado: true,
    },
    {
      nombreCompleto: 'Angélica María Buitrago Peña',
      tipoIdentificacion: 'CE',
      identificacion: '432198765',
      tarjetaProfesional: '311204',
      direccion: 'Avenida 19 # 114-65 Oficina 210',
      telefono: '3187745512',
      correo: 'angelica.buitrago@abogadosnieto.test',
      existePoderOtorgado: false,
    },
  ],
};

// ===========================================================================
// I-2 — INSOLVENCIA MÍNIMA (soltero, sin apoderado, 1 acreedor, sin bienes)
// ===========================================================================

const I2_FORM: Record<string, unknown> = {
  type: 'INSOLVENCY',
  totalDebt: '45200000',
  creditors: 1,
  phase: 'Inicial',
  caseNumber: '',
  hearingDate: null,
  causes: ['Sobreendeudamiento por falta de recursos'],
  applicantScope: ['Persona natural no comerciante'],
  filingDate: '2026-03-04',
  debtorIdNumber: '1098765432',
  city: 'Medellín',
  hasLegalProcesses: false,
  monthlyIncome: 1800000,
  monthlyExpenses: 1450000,
  notificationAddress: 'Carrera 48 # 22-14 Barrio Belén',
  notificationCity: 'Medellín',
  notificationPhone: '3209981177',
  notificationEmail: 'yeison.mosquera@correoejemplo.com',
  cashFlowPayment: true,
  paymentTermMonths: 48,
  monthlyPaymentAmount: 350000,
  centroConciliacionNombre: 'Centro de Conciliación Constructores de Paz',
  ciudadRadicacion: 'Medellín',
  declaracionVeracidadInformacion: true,
  manifestacionBuenaFe: true,
  debts: [
    {
      creditor: 'Banco Falabella S.A.',
      type: 'TARJETA_CREDITO',
      interestRate: '2.35',
      capitalAmount: '41200000',
      interestAmount: '4000000',
      creditorAddress: 'Calle 7 Sur # 42-70 Local 1120',
      creditorCity: 'Medellín',
      creditorEmail: 'notificaciones@falabella.test',
      documentType: 'Contrato de tarjeta No. FB-99120',
      grantDate: '2023-07-19',
      dueDate: '2026-07-19',
      creditClassification: 'Quinta clase',
      creditorClass: 'Entidad financiera vigilada',
      daysOverdue: 160,
      noCoDebtor: true,
    },
  ],
  assets: [],
  libranzas: [],
  suspendedServices: [],
  dependents: [],
  legalProcesses: [],
  apoderados: [],
};

// ===========================================================================
// I-3 — INSOLVENCIA DE VOLUMEN (12 acreedores, 3 juzgados, 6 bienes)
// ===========================================================================

const I3_CREDITORS = [
  ['Banco de Bogotá S.A.', '32400000', '2.05', 'Bogotá D.C.'],
  ['Banco Popular S.A.', '27800000', '2.12', 'Bogotá D.C.'],
  ['Banco Caja Social', '24150000', '1.95', 'Cali'],
  ['Scotiabank Colpatria', '21900000', '2.28', 'Bogotá D.C.'],
  ['Financiera Juriscoop', '19600000', '1.88', 'Bogotá D.C.'],
  ['Cooperativa Coomeva', '17300000', '1.72', 'Cali'],
  ['Banco Agrario de Colombia', '15800000', '1.65', 'Palmira'],
  ['Comfandi Supermercados', '13250000', '2.40', 'Cali'],
  ['Claro Comunicaciones S.A.', '9400000', '2.55', 'Bogotá D.C.'],
  ['Emcali E.I.C.E. E.S.P.', '7150000', '1.98', 'Cali'],
  ['Luis Fernando Arboleda Zapata', '6700000', '3.20', 'Yumbo'],
  ['Droguerías La Rebaja', '4450000', '2.60', 'Cali'],
] as const;

const I3_FORM: Record<string, unknown> = {
  type: 'INSOLVENCY',
  totalDebt: '238900000',
  creditors: 12,
  phase: 'Inicial',
  caseNumber: '',
  hearingDate: null,
  causes: ['SOBREENDEUDAMIENTO', 'DISMINUCION_INGRESOS'],
  applicantScope: ['Persona natural no comerciante'],
  filingDate: '2026-01-22',
  debtorIdNumber: '24680135',
  attorney: 'Dr. Gustavo Adolfo Ceballos Rengifo, T.P. 97.556 del C.S.J.',
  city: 'Cali',
  hasLegalProcesses: true,
  monthlyIncome: 7600000,
  monthlyExpenses: 6900000,
  otherIncomeDescription: 'Utilidades de la papelería La Esquina',
  otherIncomeAmount: 1400000,
  notificationAddress: 'Avenida 6N # 23-45 Oficina 701',
  notificationCity: 'Cali',
  notificationPhone: '3153340099',
  notificationEmail: 'martha.villegas@correoejemplo.com',
  cashFlowPayment: true,
  paymentTermMonths: 72,
  monthlyPaymentAmount: 2950000,
  centroConciliacionNombre: 'Centro de Conciliación Constructores de Paz',
  ciudadRadicacion: 'Cali',
  sociedadConyugalDisuelta: true,
  declaracionVeracidadInformacion: true,
  manifestacionBuenaFe: true,
  debts: I3_CREDITORS.map(([name, capital, rate, city], i) => ({
    creditor: name,
    type:
      i % 3 === 0
        ? 'TARJETA_CREDITO'
        : i % 3 === 1
          ? 'CREDITO_LIBRE_INVERSION'
          : 'OTRA',
    otherDebtTypeDetail:
      i % 3 === 2 ? 'Cuenta corriente de proveedor' : undefined,
    interestRate: rate,
    capitalAmount: capital,
    interestAmount: String(Math.round(Number(capital) * 0.07)),
    creditorAddress: `Calle ${10 + i} # ${20 + i}-${30 + i}`,
    creditorCity: city,
    creditorEmail: `cartera${i + 1}@acreedorejemplo.test`,
    documentType: `Pagaré No. VOL-${7700 + i}`,
    grantDate: '2023-05-10',
    dueDate: '2027-05-10',
    creditClassification: i === 0 ? 'Primera clase' : 'Quinta clase',
    creditorClass: 'Entidad financiera vigilada',
    daysOverdue: 90 + i * 10,
    noCoDebtor: true,
  })),
  assets: [
    {
      name: 'Casa en Ciudad Jardín',
      type: 'INMUEBLE',
      value: '420000000',
      propertyType: 'Casa',
      address: 'Calle 16 # 105-40 Cali',
      registrationNumber: '370-889977',
      encumbrance: 'Hipoteca a favor de Banco de Bogotá S.A.',
      isFamilyHome: true,
    },
    {
      name: 'Camioneta Toyota Prado 2021',
      type: 'VEHICULO',
      value: '165000000',
      brand: 'Toyota',
      model: '2021',
      licensePlate: 'LZT-889',
      transitAuthority: 'Secretaría de Tránsito de Cali',
    },
    {
      name: 'Local comercial Centro Comercial Unicentro',
      type: 'INMUEBLE',
      value: '280000000',
      propertyType: 'Local comercial',
      address: 'Carrera 100 # 5-169 Local 234',
      registrationNumber: '370-442211',
    },
    {
      name: 'Motocicleta Yamaha NMAX 2022',
      type: 'VEHICULO',
      value: '12800000',
      brand: 'Yamaha',
      model: '2022',
      licensePlate: 'WQR-55F',
    },
    {
      name: 'Inventario de papelería',
      type: 'MUEBLE',
      value: '18600000',
      description: 'Mercancía de la papelería La Esquina',
    },
    {
      name: 'Maquinaria de impresión digital',
      type: 'MUEBLE',
      value: '34200000',
      brand: 'Ricoh',
      model: 'Pro C5300',
    },
  ],
  libranzas: [],
  suspendedServices: [
    {
      creditorName: 'Emcali E.I.C.E. E.S.P.',
      address: 'Centro Administrativo Municipal CAM Cali',
      email: 'pqr@emcali.test',
      phone: '6025240000',
      suspendedProduct: 'Acueducto y energía cuenta 4455221',
      amountOwed: '7150000',
    },
  ],
  dependents: [
    { name: 'Juan Pablo Villegas Ocampo', age: 19, relationship: 'Hijo' },
    { name: 'Isabella Villegas Ocampo', age: 16, relationship: 'Hija' },
    { name: 'Blanca Ocampo de Villegas', age: 78, relationship: 'Madre' },
  ],
  legalProcesses: [
    {
      processType: 'EJECUTIVO',
      plaintiff: 'Banco de Bogotá S.A.',
      court: 'Juzgado 8 Civil Municipal de Cali',
      courtEmail: 'j08cmcali@cendoj.test',
      fileNumber: '76001400300820250011200',
      precautionaryMeasure: 'Embargo del local comercial 370-442211',
    },
    {
      processType: 'EJECUTIVO',
      plaintiff: 'Banco Popular S.A.',
      court: 'Juzgado 3 Civil del Circuito de Cali',
      courtEmail: 'j03ccircali@cendoj.test',
      fileNumber: '76001310300320250007700',
      precautionaryMeasure: 'Embargo de la camioneta LZT-889',
    },
    {
      processType: 'LABORAL',
      plaintiff: 'Yolanda Mejía Caicedo',
      court: 'Juzgado 2 Laboral del Circuito de Cali',
      courtEmail: 'j02lcircali@cendoj.test',
      fileNumber: '76001310500220250004400',
      precautionaryMeasure: 'Ninguna',
    },
    {
      processType: 'EJECUTIVO',
      plaintiff: 'Financiera Juriscoop',
      court: 'Juzgado 8 Civil Municipal de Cali',
      courtEmail: 'j08cmcali@cendoj.test',
      fileNumber: '76001400300820250022100',
      precautionaryMeasure: 'Embargo de remanentes',
    },
  ],
  apoderados: [
    {
      nombreCompleto: 'Gustavo Adolfo Ceballos Rengifo',
      tipoIdentificacion: 'CC',
      identificacion: '16778899',
      tarjetaProfesional: '97556',
      direccion: 'Avenida 4N # 17-25 Oficina 502',
      telefono: '3156678899',
      correo: 'gustavo.ceballos@ceballosabogados.test',
      existePoderOtorgado: true,
    },
  ],
};

// ===========================================================================
// C-1 — CONCILIACIÓN: alimentos, convocado persona jurídica, dos apoderados
// ===========================================================================

const C1_FORM: Record<string, unknown> = {
  type: 'CONCILIATION',
  totalDebt: '0',
  creditors: 0,
  phase: 'Inicial',
  caseNumber: '',
  hearingDate: null,
  causes: ['Conciliación extrajudicial en derecho'],
  filingDate: '2026-02-05',
  city: 'Bogotá D.C.',
  firstHearingDate: '2026-02-26',
  firstHearingTime: '14:00',
  zoomMeetingId: '905 7781 2234',
  zoomPassword: 'Conc2026',
  zoomLink: 'https://zoom.test/j/90577812234',
  centroConciliacionNombre: 'Centro de Conciliación Constructores de Paz',
  ciudadRadicacion: 'Bogotá D.C.',
  expedienteNumero: '0014522',
  expedienteAnio: 2026,
  fechaRadicacion: '2026-02-05',
  concAsunto: 'Fijación de cuota alimentaria y custodia de dos menores',
  concDescripcionHechos:
    'Las partes convivieron en unión libre entre 2012 y 2024 en Bogotá. De esa unión nacieron dos hijos. Desde marzo de 2025 el convocado dejó de aportar para la manutención.',
  concPretensiones:
    'Primera: fijar cuota alimentaria mensual de $900.000. Segunda: establecer régimen de visitas los fines de semana alternos. Tercera: definir el pago del 50% de gastos educativos y médicos.',
  concCuantiaPesos: '10800000',
  concCuantiaLetras: 'DIEZ MILLONES OCHOCIENTOS MIL PESOS',
  concRelacionPruebas:
    'Registros civiles de nacimiento, certificado laboral del convocado, recibos de matrícula del Colegio San Carlos y extractos bancarios.',
  concOtroMedioComunicacion: 'WhatsApp al número 3005512233',
  concFechaNacimiento: '1988-06-24',
  concConvocanteName: 'Diana Carolina Pulido Benavides',
  concConvocanteTipoId: 'CC',
  concConvocanteId: '52998877',
  concConvocanteDireccion: 'Transversal 23 # 98-11 Torre 3 Apto 904',
  concConvocanteCiudad: 'Bogotá D.C.',
  concConvocanteCorreo: 'diana.pulido@correoejemplo.com',
  concConvocanteCel: '3005512233',
  concConvocadoName: 'Transportes Andinos del Norte S.A.S.',
  concConvocadoTipoId: 'NIT',
  concConvocadoId: '901447782-3',
  concConvocadoDireccion: 'Autopista Norte Km 19 Bodega 14',
  concConvocadoCiudad: 'Chía',
  concConvocadoCorreo: 'notificaciones@transportesandinos.test',
  concConvocadoCel: '6018815544',
  concRepLegalName: 'Germán Alfonso Lozano Pinzón',
  concRepLegalTipoId: 'CC',
  concRepLegalId: '19445566',
  concRepLegalDireccion: 'Autopista Norte Km 19 Bodega 14 Oficina 2',
  concRepLegalCiudad: 'Chía',
  concRepLegalCorreo: 'german.lozano@transportesandinos.test',
  concRepLegalCel: '3101122334',
  concApoderadoConvocanteName: 'Beatriz Elena Sarmiento Ruiz',
  concApoderadoConvocanteTipoId: 'CC',
  concApoderadoConvocanteId: '51778822',
  concApoderadoConvocanteDireccion: 'Calle 93B # 17-25 Oficina 404',
  concApoderadoConvocanteCiudad: 'Bogotá D.C.',
  concApoderadoConvocanteCorreo: 'beatriz.sarmiento@sarmientolegal.test',
  concApoderadoConvocanteCel: '3122233445',
  concApoderadoConvocanteTP: '142778',
  concApoderadoConvocadoName: 'Ricardo Alonso Peñaranda Gil',
  concApoderadoConvocadoTipoId: 'CC',
  concApoderadoConvocadoId: '80112233',
  concApoderadoConvocadoCorreo: 'ricardo.penaranda@penarandalegal.test',
  concApoderadoConvocadoCel: '3144455667',
  concApoderadoConvocadoTP: '198004',
  concConciliadoraName: 'Liliana Patricia Arango Mejía',
  concConciliadoraCC: '43889977',
  concConciliadoraTP: '155820',
  concAcuerdoConciliatorio:
    'Las partes acuerdan una cuota alimentaria mensual de NOVECIENTOS MIL PESOS ($900.000) pagaderos los cinco primeros días de cada mes mediante consignación a la cuenta de ahorros 4567123409 de Bancolombia.',
  concInfoAdicional:
    'El convocado se compromete a mantener a los menores afiliados al plan complementario de salud.',
  concClausulaPrimeroAlimentos:
    'PRIMERO: El convocado pagará por concepto de cuota alimentaria la suma de $900.000 mensuales.',
  concClausulaSegundoAlimentos:
    'SEGUNDO: Los gastos de educación, uniformes y útiles se pagarán por partes iguales.',
  concClausulaTerceroAlimentos:
    'TERCERO: El régimen de visitas será fines de semana alternos desde el viernes a las 6:00 p.m.',
  concSituacionAlimentos: 'Los menores residen con la madre en Bogotá D.C.',
  concHoraProgramada: '14:00',
  concMenoresAlimentos: [
    { NOMBRE_MENOR: 'Samuel Alejandro Lozano Pulido' },
    { NOMBRE_MENOR: 'Antonella Lozano Pulido' },
  ],
  concClausulasAdicionalesAlimentos: [
    {
      NUMERO_CLAUSULA_ADICIONAL: 'CUARTO',
      TEXTO_CLAUSULA_ADICIONAL:
        'El convocado asumirá el 100% del transporte escolar del Colegio San Carlos.',
    },
    {
      NUMERO_CLAUSULA_ADICIONAL: 'QUINTO',
      TEXTO_CLAUSULA_ADICIONAL:
        'La cuota se incrementará cada 1 de enero conforme al IPC certificado por el DANE.',
    },
  ],
  concClausulasAcuerdo: [
    {
      NUMERO_CLAUSULA: 'PRIMERA',
      TEXTO_CLAUSULA:
        'Las partes se declaran mutuamente a paz y salvo por obligaciones anteriores.',
    },
  ],
  debts: [],
  assets: [],
  libranzas: [],
  suspendedServices: [],
  dependents: [],
  legalProcesses: [],
  apoderados: [],
};

// ===========================================================================
// C-2 — CONCILIACIÓN: unión marital de hecho, sin apoderados
// ===========================================================================

const C2_FORM: Record<string, unknown> = {
  type: 'CONCILIATION',
  totalDebt: '0',
  creditors: 0,
  phase: 'Inicial',
  caseNumber: '',
  hearingDate: null,
  causes: ['Conciliación extrajudicial en derecho'],
  filingDate: '2026-02-12',
  city: 'Envigado',
  firstHearingDate: '2026-03-05',
  firstHearingTime: '08:30',
  centroConciliacionNombre: 'Centro de Conciliación Constructores de Paz',
  ciudadRadicacion: 'Envigado',
  expedienteNumero: '0014533',
  expedienteAnio: 2026,
  fechaRadicacion: '2026-02-12',
  concAsunto: 'Declaración de existencia de unión marital de hecho',
  concDescripcionHechos:
    'Los comparecientes convivieron de manera permanente y singular desde el 3 de marzo de 2015 hasta el 20 de diciembre de 2025 en el municipio de Envigado.',
  concPretensiones:
    'Declarar la existencia de la unión marital de hecho y la sociedad patrimonial entre compañeros permanentes.',
  concCuantiaPesos: '0',
  concCuantiaLetras: 'SIN CUANTÍA',
  concRelacionPruebas:
    'Declaraciones extrajuicio de dos testigos, certificado de residencia y recibos de servicios públicos compartidos.',
  concConvocanteName: 'Óscar Iván Betancur Ramírez',
  concConvocanteTipoId: 'CC',
  concConvocanteId: '71334455',
  concConvocanteDireccion: 'Calle 10 Sur # 50-22 Casa 14',
  concConvocanteCiudad: 'Envigado',
  concConvocanteCorreo: 'oscar.betancur@correoejemplo.com',
  concConvocanteCel: '3112298844',
  concConvocadoName: 'Paula Andrea Restrepo Jaramillo',
  concConvocadoTipoId: 'CC',
  concConvocadoId: '43778811',
  concConvocadoDireccion: 'Carrera 43A # 38 Sur-25 Apto 1102',
  concConvocadoCiudad: 'Envigado',
  concConvocadoCorreo: 'paula.restrepo@correoejemplo.com',
  concConvocadoCel: '3012244556',
  concConciliadoraName: 'Liliana Patricia Arango Mejía',
  concConciliadoraCC: '43889977',
  concConciliadoraTP: '155820',
  concAcuerdoConciliatorio:
    'Las partes declaran que convivieron en unión marital de hecho desde el 3 de marzo de 2015 hasta el 20 de diciembre de 2025.',
  concSituacionBienes:
    'Durante la unión se adquirió el apartamento con matrícula 001-884471 ubicado en Envigado.',
  concSituacionAlimentos:
    'No se pactan alimentos entre compañeros permanentes.',
  concMenoresUnion: [{ NOMBRE_MENOR_UNION: 'Tomás Betancur Restrepo' }],
  concClausulasAdicionalesUnion: [
    {
      NUMERO_CLAUSULA_ADICIONAL: 'SEGUNDA',
      TEXTO_CLAUSULA_ADICIONAL:
        'Las partes reconocen que la sociedad patrimonial se liquidará por escritura pública separada.',
    },
  ],
  concClausulasAdicionalesDisolucion: [
    {
      NUMERO_CLAUSULA_ADICIONAL: 'TERCERA',
      TEXTO_CLAUSULA_ADICIONAL:
        'El apartamento 001-884471 se adjudica en común y proindiviso por partes iguales.',
    },
  ],
  debts: [],
  assets: [],
  libranzas: [],
  suspendedServices: [],
  dependents: [],
  legalProcesses: [],
  apoderados: [],
};

// ===========================================================================
// C-3 — CONCILIACIÓN: fracaso (inasistencia del convocado) + desistimiento
// ===========================================================================

const C3_FORM: Record<string, unknown> = {
  type: 'CONCILIATION',
  totalDebt: '0',
  creditors: 0,
  phase: 'Inicial',
  caseNumber: '',
  hearingDate: null,
  causes: ['Conciliación extrajudicial en derecho'],
  filingDate: '2026-01-15',
  city: 'Popayán',
  firstHearingDate: '2026-02-04',
  firstHearingTime: '10:00',
  centroConciliacionNombre: 'Centro de Conciliación Constructores de Paz',
  ciudadRadicacion: 'Popayán',
  expedienteNumero: '0014488',
  expedienteAnio: 2026,
  fechaRadicacion: '2026-01-15',
  concAsunto: 'Restitución de inmueble arrendado y pago de cánones',
  concDescripcionHechos:
    'La convocante arrendó el local comercial de la Carrera 6 # 3-45 de Popayán al convocado, quien dejó de pagar los cánones desde agosto de 2025.',
  concPretensiones:
    'Primera: la restitución del local. Segunda: el pago de $14.400.000 por cánones vencidos.',
  concCuantiaPesos: '14400000',
  concCuantiaLetras: 'CATORCE MILLONES CUATROCIENTOS MIL PESOS',
  concRelacionPruebas:
    'Contrato de arrendamiento del 1 de febrero de 2023 y estado de cuenta.',
  concConvocanteName: 'Sandra Milena Quintero Lasso',
  concConvocanteTipoId: 'CC',
  concConvocanteId: '31778899',
  concConvocanteDireccion: 'Carrera 15 # 4-60 Barrio San Fernando',
  concConvocanteCiudad: 'Popayán',
  concConvocanteCorreo: 'sandra.quintero@correoejemplo.com',
  concConvocanteCel: '3176654321',
  concConvocadoName: 'Comercializadora El Morro del Tulcán S.A.S.',
  concConvocadoTipoId: 'NIT',
  concConvocadoId: '900778112-5',
  concConvocadoDireccion: 'Carrera 6 # 3-45 Local 2',
  concConvocadoCiudad: 'Popayán',
  concConvocadoCorreo: 'gerencia@elmorro.test',
  concConvocadoCel: '3209987766',
  concConciliadoraName: 'Liliana Patricia Arango Mejía',
  concConciliadoraCC: '43889977',
  concConciliadoraTP: '155820',
  concDescripcionResultado:
    'El convocado no compareció a la audiencia programada ni justificó su ausencia dentro de los tres días siguientes.',
  concTipoConstanciaSolicitada: 'Constancia de inasistencia del convocado',
  concDescripcionCausaAnormal:
    'La convocante manifestó por escrito su decisión de desistir del trámite el 10 de febrero de 2026.',
  concCausaTerminacion: 'Desistimiento expreso de la parte convocante',
  concResultadoInforme: 'No acuerdo por inasistencia de la parte convocada',
  concHoraProgramada: '10:00',
  debts: [],
  assets: [],
  libranzas: [],
  suspendedServices: [],
  dependents: [],
  legalProcesses: [],
  apoderados: [],
};

// ===========================================================================
// A-1 — ACUERDO DE APOYO COMPLETO (con cláusulas y conciliadora)
// ===========================================================================

const A1_FORM: Record<string, unknown> = {
  type: 'SUPPORT_AGREEMENT',
  totalDebt: '0',
  creditors: 0,
  phase: 'Inicial',
  caseNumber: '',
  hearingDate: null,
  causes: ['Acuerdo de apoyo Ley 1996 de 2019'],
  filingDate: '2026-02-18',
  city: 'Manizales',
  firstHearingDate: '2026-03-10',
  firstHearingTime: '11:00',
  centroConciliacionNombre: 'Centro de Conciliación Constructores de Paz',
  ciudadRadicacion: 'Manizales',
  expedienteNumero: '0007741',
  expedienteAnio: 2026,
  fechaRadicacion: '2026-02-18',
  apoyoAsunto:
    'Celebración de acuerdo de apoyo para la administración de la pensión y de los actos bancarios',
  apoyoDescripcionHechos:
    'El beneficiario tiene 71 años y una discapacidad visual sobreviniente que le dificulta desplazarse a las entidades bancarias y firmar documentos sin asistencia.',
  apoyoPretensiones:
    'Que se designe a su sobrina como persona de apoyo para acompañarlo en los trámites bancarios y en la administración de su pensión.',
  apoyoMontoMensual: '2300000',
  apoyoPlazoMeses: '36',
  apoyoCondiciones:
    'La persona de apoyo acompañará al beneficiario en las diligencias bancarias y rendirá cuentas trimestrales por escrito.',
  apoyoTipoApoyo:
    'Apoyo para la celebración de actos jurídicos de administración de bienes',
  apoyoBeneficiarioName: 'Jaime Andrés Cuartas Henao',
  apoyoBeneficiarioTipoId: 'CC',
  apoyoBeneficiarioId: '15998877',
  apoyoBeneficiarioDireccion: 'Calle 52 # 30-18 Barrio Prado Centro',
  apoyoBeneficiarioCiudad: 'Manizales',
  apoyoBeneficiarioCorreo: 'jaime.cuartas@correoejemplo.com',
  apoyoBeneficiarioCel: '3134478899',
  apoyoPrestadorName: 'Natalia Andrea Cuartas Jaramillo',
  apoyoPrestadorTipoId: 'CC',
  apoyoPrestadorId: '1053778899',
  apoyoPrestadorDireccion: 'Carrera 23 # 62-15 Apartamento 301',
  apoyoPrestadorCiudad: 'Manizales',
  apoyoPrestadorCorreo: 'natalia.cuartas@correoejemplo.com',
  apoyoPrestadorCel: '3196654433',
  apoyoPrestadorRelacion: 'Sobrina del beneficiario',
  apoyoConciliadoraName: 'Liliana Patricia Arango Mejía',
  apoyoConciliadoraCC: '43889977',
  apoyoConciliadoraTP: '155820',
  apoyoAcuerdo:
    'El beneficiario y la persona de apoyo acuerdan que todos los retiros superiores a UN MILLÓN DE PESOS ($1.000.000) se realizarán con el acompañamiento presencial de la persona de apoyo.',
  apoyoResultado: 'Acuerdo de apoyo celebrado de forma total',
  apoyoClausulas: [
    {
      NUMERO_CLAUSULA: 'PRIMERA',
      TEXTO_CLAUSULA:
        'La persona de apoyo acompañará al beneficiario en la apertura y manejo de productos financieros.',
    },
    {
      NUMERO_CLAUSULA: 'SEGUNDA',
      TEXTO_CLAUSULA:
        'El acuerdo tendrá una vigencia de treinta y seis (36) meses prorrogables por voluntad del beneficiario.',
    },
    {
      NUMERO_CLAUSULA: 'TERCERA',
      TEXTO_CLAUSULA:
        'La persona de apoyo rendirá cuentas por escrito cada tres meses ante el beneficiario.',
    },
  ],
  debts: [],
  assets: [],
  libranzas: [],
  suspendedServices: [],
  dependents: [],
  legalProcesses: [],
  apoderados: [],
};

// ===========================================================================
// A-2 — ACUERDO DE APOYO MÍNIMO (sin cláusulas, sin conciliadora explícita)
// ===========================================================================

const A2_FORM: Record<string, unknown> = {
  type: 'SUPPORT_AGREEMENT',
  totalDebt: '0',
  creditors: 0,
  phase: 'Inicial',
  caseNumber: '',
  hearingDate: null,
  causes: ['Acuerdo de apoyo Ley 1996 de 2019'],
  filingDate: '2026-03-02',
  city: 'Buenaventura',
  centroConciliacionNombre: 'Centro de Conciliación Constructores de Paz',
  ciudadRadicacion: 'Buenaventura',
  apoyoAsunto: 'Acuerdo de apoyo para trámites de salud',
  apoyoDescripcionHechos:
    'La beneficiaria requiere acompañamiento para autorizar procedimientos médicos y reclamar medicamentos.',
  apoyoPretensiones:
    'Designar a su hijo como persona de apoyo en trámites de salud.',
  apoyoTipoApoyo: 'Apoyo para actos jurídicos relacionados con la salud',
  apoyoBeneficiarioName: 'Rosa Elena Caicedo Mina',
  apoyoBeneficiarioTipoId: 'CC',
  apoyoBeneficiarioId: '29445566',
  apoyoBeneficiarioDireccion: 'Calle 3 # 12-40 Barrio El Jardín',
  apoyoBeneficiarioCiudad: 'Buenaventura',
  apoyoBeneficiarioCorreo: 'rosa.caicedo@correoejemplo.com',
  apoyoBeneficiarioCel: '3188812345',
  apoyoPrestadorName: 'Harold Steven Caicedo Mina',
  apoyoPrestadorTipoId: 'CC',
  apoyoPrestadorId: '1111998877',
  apoyoPrestadorDireccion: 'Calle 3 # 12-40 Barrio El Jardín',
  apoyoPrestadorCiudad: 'Buenaventura',
  apoyoPrestadorCorreo: 'harold.caicedo@correoejemplo.com',
  apoyoPrestadorCel: '3155544332',
  apoyoPrestadorRelacion: 'Hijo de la beneficiaria',
  apoyoCausaTerminacion: 'Revocatoria unilateral del beneficiario',
  apoyoClausulas: [],
  debts: [],
  assets: [],
  libranzas: [],
  suspendedServices: [],
  dependents: [],
  legalProcesses: [],
  apoderados: [],
};

// ===========================================================================
// Expectativas: valores que deben verse impresos en algún documento
// ===========================================================================

/**
 * Campos que NUNCA se imprimen literalmente, y por los que no tiene sentido
 * preguntar "¿aparece este texto en algún documento?".
 */
const NO_SE_IMPRIMEN_LITERALES = new Set([
  // Internos del expediente, no del documento.
  'type',
  'phase',
  'caseNumber',
  'tramite',
  // Montos: las plantillas los imprimen formateados ("$ 98.450.000"), nunca
  // como la cadena de dígitos que viaja en el formulario.
  'totalDebt',
  'owedCapital',
  'concCuantiaPesos',
  'apoyoMontoMensual',
  'requestedFee',
  // Enums de conciliación que la plantilla consume como bandera de un bloque
  // {{#if}}, no como texto.
  'concCausaTerminacion',
  'concResultadoInforme',
  'concTipoConstanciaSolicitada',
  'concDescripcionResultado',
  'concDescripcionCausaAnormal',
]);

/**
 * Deriva las expectativas del propio payload: todo texto largo que el operador
 * escribió debería poder encontrarse en algún documento del trámite.
 *
 * Se excluyen las fechas —tienen su propio chequeo, que compara las formas
 * realmente impresas— y los campos de NO_SE_IMPRIMEN_LITERALES.
 */
function expectationsFor(
  form: Record<string, unknown>,
  extra: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...extra };
  for (const [k, v] of Object.entries(form)) {
    if (NO_SE_IMPRIMEN_LITERALES.has(k)) continue;
    if (typeof v !== 'string') continue;
    if (v.length < 6) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) continue;
    // Solo dígitos y separadores: es un monto, y se imprime formateado.
    if (/^[\d.,]+$/.test(v)) continue;
    out[k] = v;
  }
  return out;
}

export const FIXTURES: CaseFixture[] = [
  {
    key: 'I1-insolvencia-completa',
    label:
      'Insolvencia completa: casada con sociedad conyugal vigente, 3 apoderados, 6 acreedores (uno postergado, uno con libranza, dos con codeudor), 4 bienes, 2 libranzas, 2 servicios suspendidos, 2 dependientes, 3 procesos en 2 juzgados',
    caseType: 'INSOLVENCY',
    debtor: DEUDOR_CASADA,
    form: I1_FORM,
    expectations: expectationsFor(I1_FORM, {
      'debtor.name': 'Gloria Esperanza Rincón Alzate',
      'debtor.idNumber': '41567890',
      'debtor.address': 'Calle 134 # 7-83 Apartamento 502',
      'debtor.email': 'gloria.rincon@correoejemplo.com',
      'debtor.phone': '3124457812',
      'debtor.occupation': 'Auxiliar de enfermería',
      'conyuge.nombre': 'Hernán Darío Rincón Alzate',
      'conyuge.cedula': '79445512',
      'apoderado1.nombre': 'Carmen Alicia Nieto Ospina',
      'apoderado1.tp': '189443',
      'apoderado2.nombre': 'Fabián Eduardo Saldarriaga Mesa',
      'apoderado3.nombre': 'Angélica María Buitrago Peña',
      'acreedor1.nombre': 'Banco Davivienda S.A.',
      'acreedor2.nombre': 'Cooperativa Financiera Confiar',
      'acreedor3.nombre': 'Empresa de Acueducto de Bogotá',
      'acreedor4.nombre': 'DIAN - Dirección de Impuestos',
      'acreedor5.nombre': 'Almacenes Éxito S.A.',
      'acreedor6.nombre': 'Nelson Aurelio Pardo Guzmán',
      'codeudor1.nombre': 'Hernán Darío Rincón Alzate',
      'codeudor6.nombre': 'Claudia Patricia Alzate Tovar',
      'bien1.nombre': 'Apartamento 502 Torre B conjunto Altos de Suba',
      'bien1.matricula': '050N-20778431',
      'bien2.placa': 'KQW-412',
      'bien3.matricula': '051-9988771',
      'bien4.nombre': 'Equipo de ecografía portátil',
      'libranza1.pagador': 'Clínica del Country S.A.',
      'libranza2.pagador': 'Colpensiones',
      'servicio1.acreedor': 'Enel Colombia S.A. E.S.P.',
      'servicio2.acreedor': 'Vanti S.A. E.S.P.',
      'dependiente1.nombre': 'Sara Valentina Rincón Villegas',
      'dependiente2.nombre': 'Matías Rincón Villegas',
      'juzgado1.nombre': 'Juzgado 14 Civil Municipal de Bogotá',
      'juzgado2.nombre': 'División de Cobranzas DIAN Seccional Bogotá',
      'proceso1.radicado': '11001400301420250033100',
      'proceso2.radicado': 'COA-2025-778120',
      'proceso3.tipoOtro': 'Restitución de local comercial arrendado',
      'empleador.nombre': 'Clínica del Country S.A.',
    }),
  },
  {
    key: 'I2-insolvencia-minima',
    label:
      'Insolvencia mínima: soltero sin apoderado ni cónyuge, 1 acreedor, sin bienes, sin procesos, sin dependientes (deuda por debajo de la mínima cuantía)',
    caseType: 'INSOLVENCY',
    debtor: DEUDOR_SOLTERO,
    form: I2_FORM,
    expectations: expectationsFor(I2_FORM, {
      'debtor.name': 'Yeison Alberto Mosquera Córdoba',
      'debtor.idNumber': '1098765432',
      'acreedor1.nombre': 'Banco Falabella S.A.',
    }),
  },
  {
    key: 'I3-insolvencia-volumen',
    label:
      'Insolvencia de volumen: 12 acreedores, 6 bienes, 4 procesos en 3 juzgados distintos, 3 dependientes, 1 apoderado',
    caseType: 'INSOLVENCY',
    debtor: DEUDOR_VOLUMEN,
    form: I3_FORM,
    expectations: expectationsFor(I3_FORM, {
      'debtor.name': 'Martha Lucía Villegas Ocampo',
      'acreedor1.nombre': 'Banco de Bogotá S.A.',
      'acreedor5.nombre': 'Financiera Juriscoop',
      'acreedor9.nombre': 'Claro Comunicaciones S.A.',
      'acreedor12.nombre': 'Droguerías La Rebaja',
      'juzgado1.nombre': 'Juzgado 8 Civil Municipal de Cali',
      'juzgado2.nombre': 'Juzgado 3 Civil del Circuito de Cali',
      'juzgado3.nombre': 'Juzgado 2 Laboral del Circuito de Cali',
      'bien2.placa': 'LZT-889',
      'dependiente3.nombre': 'Blanca Ocampo de Villegas',
    }),
  },
  {
    key: 'C1-conciliacion-alimentos',
    label:
      'Conciliación de alimentos: convocante persona natural con apoderada, convocado persona jurídica con representante legal y apoderado, 2 menores, 2 cláusulas adicionales',
    caseType: 'CONCILIATION',
    debtor: DEUDOR_CONCILIACION,
    form: C1_FORM,
    expectations: expectationsFor(C1_FORM, {
      'convocante.nombre': 'Diana Carolina Pulido Benavides',
      'convocado.nombre': 'Transportes Andinos del Norte S.A.S.',
      'convocado.nit': '901447782-3',
      'replegal.nombre': 'Germán Alfonso Lozano Pinzón',
      'apoderadaConvocante.nombre': 'Beatriz Elena Sarmiento Ruiz',
      'apoderadaConvocante.tp': '142778',
      'apoderadoConvocado.nombre': 'Ricardo Alonso Peñaranda Gil',
      'apoderadoConvocado.tp': '198004',
      'conciliadora.nombre': 'Liliana Patricia Arango Mejía',
      'conciliadora.tp': '155820',
      'menor1.nombre': 'Samuel Alejandro Lozano Pulido',
      'menor2.nombre': 'Antonella Lozano Pulido',
      clausulaAdicional1: 'transporte escolar del Colegio San Carlos',
      clausulaAdicional2: 'IPC certificado por el DANE',
    }),
  },
  {
    key: 'C2-conciliacion-union-marital',
    label:
      'Conciliación de unión marital de hecho: sin apoderados, 1 menor de la unión, cláusulas adicionales de unión y de disolución',
    caseType: 'CONCILIATION',
    debtor: DEUDOR_CONCILIACION_2,
    form: C2_FORM,
    expectations: expectationsFor(C2_FORM, {
      'convocante.nombre': 'Óscar Iván Betancur Ramírez',
      'convocado.nombre': 'Paula Andrea Restrepo Jaramillo',
      'menorUnion.nombre': 'Tomás Betancur Restrepo',
      clausulaUnion:
        'sociedad patrimonial se liquidará por escritura pública separada',
      clausulaDisolucion: 'común y proindiviso por partes iguales',
    }),
  },
  {
    key: 'C3-conciliacion-fracaso',
    label:
      'Conciliación fallida: inasistencia del convocado, constancia solicitada, desistimiento de la convocante y terminación anormal',
    caseType: 'CONCILIATION',
    debtor: DEUDOR_CONCILIACION_3,
    form: C3_FORM,
    expectations: expectationsFor(C3_FORM, {
      'convocante.nombre': 'Sandra Milena Quintero Lasso',
      'convocado.nombre': 'Comercializadora El Morro del Tulcán S.A.S.',
    }),
  },
  {
    key: 'A1-apoyo-completo',
    label:
      'Acuerdo de apoyo completo: beneficiario y persona de apoyo identificados, conciliadora, 3 cláusulas, monto y plazo',
    caseType: 'SUPPORT_AGREEMENT',
    debtor: DEUDOR_APOYO,
    form: A1_FORM,
    expectations: expectationsFor(A1_FORM, {
      'beneficiario.nombre': 'Jaime Andrés Cuartas Henao',
      'prestador.nombre': 'Natalia Andrea Cuartas Jaramillo',
      'prestador.relacion': 'Sobrina del beneficiario',
      'conciliadora.nombre': 'Liliana Patricia Arango Mejía',
      clausula1: 'apertura y manejo de productos financieros',
      clausula3: 'rendirá cuentas por escrito cada tres meses',
    }),
  },
  {
    key: 'A2-apoyo-minimo',
    label:
      'Acuerdo de apoyo mínimo: sin cláusulas, sin conciliadora explícita, sin monto ni plazo, con causa de terminación',
    caseType: 'SUPPORT_AGREEMENT',
    debtor: DEUDOR_APOYO_2,
    form: A2_FORM,
    expectations: expectationsFor(A2_FORM, {
      'beneficiario.nombre': 'Rosa Elena Caicedo Mina',
      'prestador.nombre': 'Harold Steven Caicedo Mina',
    }),
  },
];
