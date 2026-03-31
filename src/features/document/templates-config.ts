/**
 * Document Templates Configuration
 * Defines all 49 templates organized in 5 packages
 */

export type PackageNumber = 1 | 2 | 3 | 4 | 5;

export interface DocumentTemplate {
  id: string;
  name: string;
  fileName: string;
  category:
    | 'solicitud'
    | 'admision'
    | 'audiencia'
    | 'acuerdo'
    | 'fracaso'
    | 'rechazo'
    | 'otros';
  packageNumber: PackageNumber;
  packageName: string;
  subPackage?: string;
  generateOnCreate: boolean;
  generateOnAdmission: boolean;
  generateOnAgreement: boolean;
  generateOnFailure: boolean;
  folderPath: string[];
  description: string;
}

/**
 * Package definitions
 */
export const PACKAGES: Record<
  PackageNumber,
  { name: string; description: string }
> = {
  1: {
    name: 'Solicitud',
    description: 'Documentos de solicitud inicial de insolvencia',
  },
  2: {
    name: 'Admisión y Apertura',
    description: 'Documentos de admisión y apertura del trámite',
  },
  3: {
    name: 'Negociación y Acuerdo',
    description: 'Documentos de negociación, audiencia y acuerdo',
  },
  4: {
    name: 'Terminación Normal',
    description: 'Documentos de terminación normal del trámite',
  },
  5: {
    name: 'Fracaso',
    description: 'Documentos de fracaso de la negociación',
  },
};

/**
 * All 49 document templates organized in 5 packages
 */
export const ALL_TEMPLATES: DocumentTemplate[] = [
  // =============================================
  // PAQUETE 1 - SOLICITUD (6 documentos)
  // =============================================
  {
    id: 'solicitud-insolvencia',
    name: 'Solicitud de Insolvencia',
    fileName: 'Solicitud de Insolvencia.html',
    category: 'solicitud',
    packageNumber: 1,
    packageName: 'Solicitud',
    generateOnCreate: true,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Documento principal de solicitud de insolvencia',
  },
  {
    id: 'certificado-ingresos',
    name: 'Certificado de Ingresos',
    fileName: 'Certificado de Ingresos.html',
    category: 'solicitud',
    packageNumber: 1,
    packageName: 'Solicitud',
    generateOnCreate: true,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Certificado de ingresos del deudor',
  },
  {
    id: 'declaracion-juramentada-domicilio',
    name: 'Declaracion Juramentada Domicilio',
    fileName: 'Declaracion Juramentada Domicilio.html',
    category: 'solicitud',
    packageNumber: 1,
    packageName: 'Solicitud',
    generateOnCreate: true,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Declaracion juramentada de domicilio',
  },
  {
    id: 'check-list',
    name: 'Check List',
    fileName: 'Check List.html',
    category: 'solicitud',
    packageNumber: 1,
    packageName: 'Solicitud',
    generateOnCreate: true,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Lista de verificacion de documentos requeridos',
  },
  {
    id: 'cyg-tramite',
    name: 'Calificacion y Graduacion',
    fileName: 'CYG Tramite.html',
    category: 'solicitud',
    packageNumber: 1,
    packageName: 'Solicitud',
    generateOnCreate: true,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Formatos Para Audiencias'],
    description: 'Calificacion y graduacion de creditos',
  },
  {
    id: 'inadmision',
    name: 'Inadmision',
    fileName: 'Inadmision Cuando no Cumple con los Requisitos.html',
    category: 'solicitud',
    packageNumber: 1,
    packageName: 'Solicitud',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Auto de inadmision cuando no cumple requisitos',
  },

  // =============================================
  // PAQUETE 2 - ADMISION Y APERTURA (7 documentos)
  // =============================================
  {
    id: 'auto-admision',
    name: 'Auto Admision del Tramite',
    fileName: 'Auto admision del tramite.html',
    category: 'admision',
    packageNumber: 2,
    packageName: 'Admisión y Apertura',
    generateOnCreate: false,
    generateOnAdmission: true,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Auto de admision del tramite de negociacion',
  },
  {
    id: 'designacion-conciliador',
    name: 'Designacion del Conciliador',
    fileName: 'Designacion del Conciliador.html',
    category: 'admision',
    packageNumber: 2,
    packageName: 'Admisión y Apertura',
    generateOnCreate: false,
    generateOnAdmission: true,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Designacion del operador de insolvencia',
  },
  {
    id: 'aceptacion-cargo',
    name: 'Aceptacion del Cargo del Conciliador',
    fileName: 'Aceptacion del Cargo del Conciliador.html',
    category: 'admision',
    packageNumber: 2,
    packageName: 'Admisión y Apertura',
    generateOnCreate: false,
    generateOnAdmission: true,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Aceptacion del cargo por el operador',
  },
  {
    id: 'edicto-emplazatorio',
    name: 'Edicto Emplazatorio',
    fileName: 'Edicto Emplazatorio Publicacion en periodico.html',
    category: 'admision',
    packageNumber: 2,
    packageName: 'Admisión y Apertura',
    generateOnCreate: false,
    generateOnAdmission: true,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Edicto para publicacion en periodico',
  },
  {
    id: 'notificacion-acreedores',
    name: 'Notificacion a los Acreedores',
    fileName: 'Notificacion a los Acreedores.html',
    category: 'admision',
    packageNumber: 2,
    packageName: 'Admisión y Apertura',
    generateOnCreate: false,
    generateOnAdmission: true,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Notificacion de admision a acreedores',
  },
  {
    id: 'suspension-juzgados',
    name: 'Suspension Juzgados',
    fileName: 'Suspension Juzgados Procesos Judiciales.html',
    category: 'admision',
    packageNumber: 2,
    packageName: 'Admisión y Apertura',
    generateOnCreate: false,
    generateOnAdmission: true,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Comunicacion de suspension de procesos judiciales',
  },
  {
    id: 'envio-pagador-suspension',
    name: 'Envio Pagador Suspension',
    fileName: 'Formato Envio Pagador Para Suspension de Pagos.html',
    category: 'admision',
    packageNumber: 2,
    packageName: 'Admisión y Apertura',
    generateOnCreate: false,
    generateOnAdmission: true,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Comunicacion a pagadores de libranzas',
  },

  // =============================================
  // PAQUETE 3 - NEGOCIACION Y ACUERDO (6 documentos)
  // =============================================
  {
    id: 'tramite-audiencia',
    name: 'Tramite Audiencia',
    fileName: 'Tramite Audiencia.html',
    category: 'audiencia',
    packageNumber: 3,
    packageName: 'Negociación y Acuerdo',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Formatos Para Audiencias'],
    description: 'Acta de desarrollo de audiencia',
  },
  {
    id: 'sentido-voto',
    name: 'Sentido del Voto',
    fileName: 'Sentido Del Voto.html',
    category: 'audiencia',
    packageNumber: 3,
    packageName: 'Negociación y Acuerdo',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Formatos Para Audiencias'],
    description: 'Formato de sentido del voto de acreedores',
  },
  {
    id: 'acuerdo-pago',
    name: 'Acuerdo de Pago',
    fileName: 'Acuerdo de Pago Tramite.html',
    category: 'acuerdo',
    packageNumber: 3,
    packageName: 'Negociación y Acuerdo',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: true,
    generateOnFailure: false,
    folderPath: ['Tipo de Acuerdo'],
    description: 'Acta de acuerdo de pago',
  },
  {
    id: 'acuerdo-bilateral',
    name: 'Acuerdo Bilateral',
    fileName: 'Acuerdo Bilateral Tramite.html',
    category: 'acuerdo',
    packageNumber: 3,
    packageName: 'Negociación y Acuerdo',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: true,
    generateOnFailure: false,
    folderPath: ['Tipo de Acuerdo'],
    description: 'Acta de acuerdo bilateral',
  },
  {
    id: 'solicitud-reforma',
    name: 'Auto Solicitud Reforma del Acuerdo',
    fileName: 'Auto Solicitud Reforma del Acuerdo.html',
    category: 'acuerdo',
    packageNumber: 3,
    packageName: 'Negociación y Acuerdo',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Solicitud de Reforma del Acuerdo'],
    description: 'Auto de solicitud de reforma del acuerdo',
  },
  {
    id: 'reforma-acuerdo',
    name: 'Reforma Acuerdo de Pago',
    fileName: 'Reforma Acuerdo de Pago Tramite.html',
    category: 'acuerdo',
    packageNumber: 3,
    packageName: 'Negociación y Acuerdo',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Tipo de Acuerdo'],
    description: 'Reforma del acuerdo de pago',
  },

  // =============================================
  // PAQUETE 4 - TERMINACION NORMAL (3 documentos)
  // =============================================
  {
    id: 'desistimiento',
    name: 'Auto Desistimiento',
    fileName: 'Auto Desistimiento.html',
    category: 'otros',
    packageNumber: 4,
    packageName: 'Terminación Normal',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Desistimiento'],
    description: 'Auto de desistimiento del tramite',
  },
  {
    id: 'remision-resultado',
    name: 'Remision Resultado',
    fileName:
      'Remision Resultado de la Negociacion Cuando Termina Tramite.html',
    category: 'otros',
    packageNumber: 4,
    packageName: 'Terminación Normal',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: true,
    generateOnFailure: true,
    folderPath: [],
    description: 'Comunicacion de resultado de negociacion',
  },
  {
    id: 'hoja-guia',
    name: 'Hoja Guia',
    fileName: 'Hoja Guia con el final.html',
    category: 'otros',
    packageNumber: 4,
    packageName: 'Terminación Normal',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Hoja guia con informacion del tramite',
  },

  // =============================================
  // PAQUETE 5 - FRACASO (27 documentos)
  // =============================================

  // --- 5.1 Fracaso por acuerdo bilateral ---
  {
    id: 'fracaso-acuerdo-bilateral',
    name: 'Fracaso por Acuerdo Bilateral',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por acuerdo bilateral',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por acuerdo bilateral'],
    description: 'Fracaso por celebracion de acuerdo bilateral',
  },
  {
    id: 'remision-juzgado-acuerdo-bilateral',
    name: 'Remision Juzgado - Acuerdo Bilateral',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por acuerdo bilateral',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por acuerdo bilateral'],
    description: 'Remision al juzgado por fracaso de acuerdo bilateral',
  },

  // --- 5.2 Fracaso por falta de pago gastos ---
  {
    id: 'fracaso-falta-pago-gastos',
    name: 'Fracaso por Falta de Pago de Gastos',
    fileName: 'FRACASO POR FALTA DE PAGO DE GASTOS DE ADMINISTRACION.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por falta de pago gastos',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por falta de pago gastos'],
    description: 'Fracaso por falta de pago de gastos de administracion',
  },
  {
    id: 'remision-juzgado-falta-pago-gastos',
    name: 'Remision Juzgado - Falta Pago Gastos',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por falta de pago gastos',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por falta de pago gastos'],
    description: 'Remision al juzgado por falta de pago de gastos',
  },

  // --- 5.3 Fracaso por impugnacion ---
  {
    id: 'fracaso-impugnacion',
    name: 'Fracaso por Impugnacion',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por impugnacion del acuerdo',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por impugnacion del acuerdo'],
    description: 'Fracaso por impugnacion del acuerdo',
  },
  {
    id: 'remision-juzgado-impugnacion',
    name: 'Remision Juzgado - Impugnacion',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por impugnacion del acuerdo',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por impugnacion del acuerdo'],
    description: 'Remision al juzgado por impugnacion del acuerdo',
  },

  // --- 5.4 Fracaso por inasistencia y vencimiento ---
  {
    id: 'fracaso-inasistencia-vencimiento',
    name: 'Fracaso por Inasistencia y Vencimiento',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por inasistencia y vencimiento de terminos',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: [
      'Tipos De Fracaso',
      'Fracaso por inasistencia y vencimiento de terminos',
    ],
    description: 'Fracaso por inasistencia y vencimiento de terminos',
  },
  {
    id: 'remision-juzgado-inasistencia-vencimiento',
    name: 'Remision Juzgado - Inasistencia y Vencimiento',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por inasistencia y vencimiento de terminos',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: [
      'Tipos De Fracaso',
      'Fracaso por inasistencia y vencimiento de terminos',
    ],
    description:
      'Remision al juzgado por inasistencia y vencimiento de terminos',
  },

  // --- 5.5 Fracaso por inasistencia - animo de conciliar ---
  {
    id: 'fracaso-inasistencia-animo',
    name: 'Fracaso por Inasistencia y Animo de Conciliar',
    fileName: 'Fracaso tramite.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por inasistencia-Animo de conciliar',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: [
      'Tipos De Fracaso',
      'Fracaso por inasistencia-Animo de conciliar',
    ],
    description: 'Fracaso por inasistencia sin animo de conciliar',
  },
  {
    id: 'remision-juzgado-inasistencia-animo',
    name: 'Remision Juzgado - Inasistencia Animo Conciliar',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por inasistencia-Animo de conciliar',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: [
      'Tipos De Fracaso',
      'Fracaso por inasistencia-Animo de conciliar',
    ],
    description: 'Remision al juzgado por inasistencia sin animo de conciliar',
  },

  // --- 5.6 Fracaso por incumplimiento ---
  {
    id: 'fracaso-incumplimiento',
    name: 'Fracaso por Incumplimiento',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por incumplimiento',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por incumplimiento'],
    description: 'Fracaso por incumplimiento del acuerdo',
  },
  {
    id: 'remision-juzgado-incumplimiento',
    name: 'Remision Juzgado - Incumplimiento',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por incumplimiento',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por incumplimiento'],
    description: 'Remision al juzgado por incumplimiento del acuerdo',
  },

  // --- 5.7 Fracaso por muerte del deudor ---
  {
    id: 'fracaso-muerte-deudor',
    name: 'Fracaso por Muerte del Deudor',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por muerte del deudor',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por muerte del deudor'],
    description: 'Fracaso por fallecimiento del deudor',
  },
  {
    id: 'remision-juzgado-muerte-deudor',
    name: 'Remision Juzgado - Muerte del Deudor',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por muerte del deudor',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por muerte del deudor'],
    description: 'Remision al juzgado por fallecimiento del deudor',
  },

  // --- 5.8 Fracaso por propuesta mala ---
  {
    id: 'fracaso-propuesta-mala',
    name: 'Fracaso por Propuesta Inadecuada',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por propuesta mala',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por propuesta mala'],
    description: 'Fracaso por propuesta de pago inadecuada',
  },
  {
    id: 'remision-juzgado-propuesta-mala',
    name: 'Remision Juzgado - Propuesta Inadecuada',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por propuesta mala',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por propuesta mala'],
    description: 'Remision al juzgado por propuesta de pago inadecuada',
  },

  // --- 5.9 Fracaso por propuesta mala y vencimiento ---
  {
    id: 'fracaso-propuesta-vencimiento',
    name: 'Fracaso por Propuesta y Vencimiento',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por propuesta mala y vencimiento de terminos',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: [
      'Tipos De Fracaso',
      'Fracaso por propuesta mala y vencimiento de terminos',
    ],
    description: 'Fracaso por propuesta mala y vencimiento de terminos',
  },
  {
    id: 'remision-juzgado-propuesta-vencimiento',
    name: 'Remision Juzgado - Propuesta y Vencimiento',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por propuesta mala y vencimiento de terminos',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: [
      'Tipos De Fracaso',
      'Fracaso por propuesta mala y vencimiento de terminos',
    ],
    description:
      'Remision al juzgado por propuesta mala y vencimiento de terminos',
  },

  // --- 5.10 Fracaso por propuesta mala y quorum ---
  {
    id: 'fracaso-propuesta-quorum',
    name: 'Fracaso por Propuesta y Quorum',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por propuestsa mala y Quorum',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por propuestsa mala y Quorum'],
    description: 'Fracaso por propuesta mala y falta de quorum',
  },
  {
    id: 'remision-juzgado-propuesta-quorum',
    name: 'Remision Juzgado - Propuesta y Quorum',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por propuestsa mala y Quorum',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por propuestsa mala y Quorum'],
    description: 'Remision al juzgado por propuesta mala y falta de quorum',
  },

  // --- 5.11 Fracaso por reforma del acuerdo ---
  {
    id: 'fracaso-reforma-acuerdo',
    name: 'Fracaso por Reforma del Acuerdo',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por reforma del acuerdo',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por reforma del acuerdo'],
    description: 'Fracaso por reforma del acuerdo',
  },
  {
    id: 'remision-juzgado-reforma-acuerdo',
    name: 'Remision Juzgado - Reforma del Acuerdo',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por reforma del acuerdo',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por reforma del acuerdo'],
    description: 'Remision al juzgado por reforma del acuerdo',
  },

  // --- 5.12 Fracaso por vencimiento de terminos ---
  {
    id: 'fracaso-vencimiento-terminos',
    name: 'Fracaso por Vencimiento de Terminos',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por vencimiento de terminos',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por vencimiento de terminos'],
    description: 'Fracaso por vencimiento de terminos',
  },
  {
    id: 'remision-juzgado-vencimiento-terminos',
    name: 'Remision Juzgado - Vencimiento de Terminos',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    subPackage: 'Fracaso por vencimiento de terminos',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por vencimiento de terminos'],
    description: 'Remision al juzgado por vencimiento de terminos',
  },

  // --- Documentos adicionales del Paquete 5 ---
  {
    id: 'suspension-garantia-mobiliaria',
    name: 'Suspension Garantia Mobiliaria',
    fileName: 'Suspension Procesos Garantia Mobiliaria.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: [],
    description: 'Suspension de procesos de garantia mobiliaria',
  },
  {
    id: 'solicitud-incumplimiento',
    name: 'Solicitud por Incumplimiento',
    fileName: 'Auto Solicitud por Incumplimiento.html',
    category: 'fracaso',
    packageNumber: 5,
    packageName: 'Fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Solicitud de Incumplimiento del Acuerdo'],
    description: 'Auto de solicitud por incumplimiento',
  },
  {
    id: 'rechazo-inasistencia',
    name: 'Cierre por Inasistencia',
    fileName: 'Auto Cierre Tramite por Inasistencia del Deudor.html',
    category: 'rechazo',
    packageNumber: 5,
    packageName: 'Fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Tipos de Rechazo'],
    description: 'Auto de cierre por inasistencia del deudor',
  },
];

// =============================================
// BACKWARD-COMPATIBLE EXPORTS
// =============================================

/** @deprecated Use ALL_TEMPLATES instead */
export const DOCUMENT_TEMPLATES: DocumentTemplate[] = ALL_TEMPLATES.filter(
  (t) => t.category !== 'fracaso',
);

/** @deprecated Use ALL_TEMPLATES.filter(t => t.category === 'fracaso') instead */
export const FRACASO_TEMPLATES: DocumentTemplate[] = ALL_TEMPLATES.filter(
  (t) => t.category === 'fracaso',
);

// =============================================
// PACKAGE-BASED QUERY FUNCTIONS
// =============================================

/**
 * Get templates by package number
 */
export function getTemplatesByPackage(
  packageNumber: PackageNumber,
): DocumentTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.packageNumber === packageNumber);
}

/**
 * Get templates grouped by package
 */
export function getTemplatesGroupedByPackage(): Record<
  PackageNumber,
  DocumentTemplate[]
> {
  return {
    1: getTemplatesByPackage(1),
    2: getTemplatesByPackage(2),
    3: getTemplatesByPackage(3),
    4: getTemplatesByPackage(4),
    5: getTemplatesByPackage(5),
  };
}

/**
 * Get package info with template count
 */
export function getPackageInfo(): Array<{
  packageNumber: PackageNumber;
  name: string;
  description: string;
  templateCount: number;
}> {
  return ([1, 2, 3, 4, 5] as PackageNumber[]).map((num) => ({
    packageNumber: num,
    ...PACKAGES[num],
    templateCount: getTemplatesByPackage(num).length,
  }));
}

// =============================================
// LIFECYCLE-BASED QUERY FUNCTIONS (backward-compatible)
// =============================================

export function getTemplatesForCaseCreation(): DocumentTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.generateOnCreate);
}

export function getTemplatesForAdmission(): DocumentTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.generateOnAdmission);
}

export function getTemplatesForAgreement(): DocumentTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.generateOnAgreement);
}

export function getTemplatesForFailure(
  failureType?: string,
): DocumentTemplate[] {
  const failureTemplates = ALL_TEMPLATES.filter((t) => t.generateOnFailure);

  if (!failureType) {
    return failureTemplates;
  }

  const failureTypeMap: Record<string, string> = {
    'acuerdo-bilateral': 'Fracaso por acuerdo bilateral',
    'falta-pago-gastos': 'Fracaso por falta de pago gastos',
    impugnacion: 'Fracaso por impugnacion del acuerdo',
    'inasistencia-vencimiento':
      'Fracaso por inasistencia y vencimiento de terminos',
    'inasistencia-animo': 'Fracaso por inasistencia-Animo de conciliar',
    incumplimiento: 'Fracaso por incumplimiento',
    'muerte-deudor': 'Fracaso por muerte del deudor',
    'propuesta-mala': 'Fracaso por propuesta mala',
    'propuesta-vencimiento':
      'Fracaso por propuesta mala y vencimiento de terminos',
    'propuesta-quorum': 'Fracaso por propuestsa mala y Quorum',
    'reforma-acuerdo': 'Fracaso por reforma del acuerdo',
    'vencimiento-terminos': 'Fracaso por vencimiento de terminos',
  };

  const folderName = failureTypeMap[failureType];
  if (!folderName) {
    return [];
  }

  return failureTemplates.filter((t) => t.folderPath.includes(folderName));
}

export function getFailureTypes(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return [
    {
      id: 'acuerdo-bilateral',
      name: 'Acuerdo Bilateral',
      description: 'Fracaso por celebración de acuerdo bilateral',
    },
    {
      id: 'falta-pago-gastos',
      name: 'Falta de Pago de Gastos',
      description: 'Fracaso por falta de pago de gastos de administración',
    },
    {
      id: 'impugnacion',
      name: 'Impugnación del Acuerdo',
      description: 'Fracaso por impugnación del acuerdo',
    },
    {
      id: 'inasistencia-vencimiento',
      name: 'Inasistencia y Vencimiento',
      description: 'Fracaso por inasistencia y vencimiento de términos',
    },
    {
      id: 'inasistencia-animo',
      name: 'Inasistencia sin Ánimo',
      description: 'Fracaso por inasistencia sin ánimo de conciliar',
    },
    {
      id: 'incumplimiento',
      name: 'Incumplimiento',
      description: 'Fracaso por incumplimiento del acuerdo',
    },
    {
      id: 'muerte-deudor',
      name: 'Muerte del Deudor',
      description: 'Fracaso por fallecimiento del deudor',
    },
    {
      id: 'propuesta-mala',
      name: 'Propuesta Inadecuada',
      description: 'Fracaso por propuesta de pago inadecuada',
    },
    {
      id: 'propuesta-vencimiento',
      name: 'Propuesta y Vencimiento',
      description: 'Fracaso por propuesta mala y vencimiento de términos',
    },
    {
      id: 'propuesta-quorum',
      name: 'Propuesta y Quórum',
      description: 'Fracaso por propuesta mala y falta de quórum',
    },
    {
      id: 'reforma-acuerdo',
      name: 'Reforma del Acuerdo',
      description: 'Fracaso por reforma del acuerdo',
    },
    {
      id: 'vencimiento-terminos',
      name: 'Vencimiento de Términos',
      description: 'Fracaso por vencimiento de términos',
    },
  ];
}

// =============================================
// GENERAL QUERY FUNCTIONS
// =============================================

export function getTemplateById(id: string): DocumentTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}

export function getAllTemplates(): DocumentTemplate[] {
  return ALL_TEMPLATES;
}

/**
 * Base path to HTML templates folder
 */
export const TEMPLATES_BASE_PATH = 'templates/insolvency';

/**
 * Get full path to template file
 */
export function getTemplatePath(template: DocumentTemplate): string {
  const parts = [
    TEMPLATES_BASE_PATH,
    ...template.folderPath,
    template.fileName,
  ];
  return parts.join('/');
}
