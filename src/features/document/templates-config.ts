/**
 * Document Templates Configuration
 * Defines all available templates and when they should be generated
 */

export interface DocumentTemplate {
  id: string;
  name: string;
  fileName: string;
  category: 'solicitud' | 'admision' | 'audiencia' | 'acuerdo' | 'fracaso' | 'rechazo' | 'otros';
  generateOnCreate: boolean; // Generate when case is created
  generateOnAdmission: boolean; // Generate when case is admitted
  generateOnAgreement: boolean; // Generate when agreement is reached
  generateOnFailure: boolean; // Generate when negotiation fails
  folderPath: string[]; // Path in Google Drive
  description: string;
}

/**
 * All document templates available in the system
 * Based on the HTML templates in "Documentos HTML" folder
 */
export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  // === SOLICITUD (Generated on Case Creation) ===
  {
    id: 'solicitud-insolvencia',
    name: 'Solicitud de Insolvencia',
    fileName: 'Solicitud de Insolvencia.html',
    category: 'solicitud',
    generateOnCreate: true,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Documento principal de solicitud de insolvencia',
  },
  {
    id: 'check-list',
    name: 'Check List',
    fileName: 'Check List.html',
    category: 'solicitud',
    generateOnCreate: true,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Lista de verificacion de documentos requeridos',
  },
  {
    id: 'certificado-ingresos',
    name: 'Certificado de Ingresos',
    fileName: 'Certificado de Ingresos.html',
    category: 'solicitud',
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
    generateOnCreate: true,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Declaracion juramentada de domicilio',
  },
  {
    id: 'hoja-guia',
    name: 'Hoja Guia',
    fileName: 'Hoja Guia con el final.html',
    category: 'solicitud',
    generateOnCreate: true,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Hoja guia con informacion del tramite',
  },

  // === ADMISION (Generated on Admission) ===
  {
    id: 'auto-admision',
    name: 'Auto Admision del Tramite',
    fileName: 'Auto admision del tramite.html',
    category: 'admision',
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
    generateOnCreate: false,
    generateOnAdmission: true,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Aceptacion del cargo por el operador',
  },
  {
    id: 'notificacion-acreedores',
    name: 'Notificacion a los Acreedores',
    fileName: 'Notificacion a los Acreedores.html',
    category: 'admision',
    generateOnCreate: false,
    generateOnAdmission: true,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Notificacion de admision a acreedores',
  },
  {
    id: 'edicto-emplazatorio',
    name: 'Edicto Emplazatorio',
    fileName: 'Edicto Emplazatorio Publicacion en periodico.html',
    category: 'admision',
    generateOnCreate: false,
    generateOnAdmission: true,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Edicto para publicacion en periodico',
  },
  {
    id: 'suspension-juzgados',
    name: 'Suspension Juzgados',
    fileName: 'Suspension Juzgados Procesos Judiciales.html',
    category: 'admision',
    generateOnCreate: false,
    generateOnAdmission: true,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Comunicacion de suspension de procesos judiciales',
  },
  {
    id: 'suspension-garantia-mobiliaria',
    name: 'Suspension Garantia Mobiliaria',
    fileName: 'Suspension Procesos Garantia Mobiliaria.html',
    category: 'admision',
    generateOnCreate: false,
    generateOnAdmission: true,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Suspension de procesos de garantia mobiliaria',
  },
  {
    id: 'envio-pagador-suspension',
    name: 'Envio Pagador Suspension',
    fileName: 'Formato Envio Pagador Para Suspension de Pagos.html',
    category: 'admision',
    generateOnCreate: false,
    generateOnAdmission: true,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Comunicacion a pagadores de libranzas',
  },
  {
    id: 'inadmision',
    name: 'Inadmision',
    fileName: 'Inadmision Cuando no Cumple con los Requisitos.html',
    category: 'admision',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: [],
    description: 'Auto de inadmision cuando no cumple requisitos',
  },

  // === AUDIENCIA ===
  {
    id: 'tramite-audiencia',
    name: 'Tramite Audiencia',
    fileName: 'Tramite Audiencia.html',
    category: 'audiencia',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Formatos Para Audiencias'],
    description: 'Acta de desarrollo de audiencia',
  },
  {
    id: 'cyg-tramite',
    name: 'Calificacion y Graduacion',
    fileName: 'CYG Tramite.html',
    category: 'audiencia',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Formatos Para Audiencias'],
    description: 'Calificacion y graduacion de creditos',
  },
  {
    id: 'sentido-voto',
    name: 'Sentido del Voto',
    fileName: 'Sentido Del Voto.html',
    category: 'audiencia',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Formatos Para Audiencias'],
    description: 'Formato de sentido del voto de acreedores',
  },

  // === ACUERDO ===
  {
    id: 'acuerdo-pago',
    name: 'Acuerdo de Pago',
    fileName: 'Acuerdo de Pago Tramite.html',
    category: 'acuerdo',
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
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: true,
    generateOnFailure: false,
    folderPath: ['Tipo de Acuerdo'],
    description: 'Acta de acuerdo bilateral',
  },
  {
    id: 'reforma-acuerdo',
    name: 'Reforma Acuerdo de Pago',
    fileName: 'Reforma Acuerdo de Pago Tramite.html',
    category: 'acuerdo',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Tipo de Acuerdo'],
    description: 'Reforma del acuerdo de pago',
  },
  {
    id: 'remision-resultado',
    name: 'Remision Resultado',
    fileName: 'Remision Resultado de la Negociacion Cuando Termina Tramite.html',
    category: 'acuerdo',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: true,
    generateOnFailure: true,
    folderPath: [],
    description: 'Comunicacion de resultado de negociacion',
  },

  // === RECHAZO ===
  {
    id: 'rechazo-inasistencia',
    name: 'Cierre por Inasistencia',
    fileName: 'Auto Cierre Tramite por Inasistencia del Deudor.html',
    category: 'rechazo',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Tipos de Rechazo'],
    description: 'Auto de cierre por inasistencia del deudor',
  },

  // === DESISTIMIENTO ===
  {
    id: 'desistimiento',
    name: 'Auto Desistimiento',
    fileName: 'Auto Desistimiento.html',
    category: 'otros',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Desistimiento'],
    description: 'Auto de desistimiento del tramite',
  },

  // === SOLICITUD DE INCUMPLIMIENTO ===
  {
    id: 'solicitud-incumplimiento',
    name: 'Solicitud por Incumplimiento',
    fileName: 'Auto Solicitud por Incumplimiento.html',
    category: 'otros',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Solicitud de Incumplimiento del Acuerdo'],
    description: 'Auto de solicitud por incumplimiento',
  },

  // === SOLICITUD DE REFORMA ===
  {
    id: 'solicitud-reforma',
    name: 'Solicitud Reforma del Acuerdo',
    fileName: 'Auto Solicitud Reforma del Acuerdo.html',
    category: 'otros',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: false,
    folderPath: ['Solicitud de Reforma del Acuerdo'],
    description: 'Auto de solicitud de reforma del acuerdo',
  },
];

// === FRACASO TEMPLATES ===
// These are in subfolders and generate based on failure type
export const FRACASO_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'fracaso-acuerdo-bilateral',
    name: 'Fracaso por Acuerdo Bilateral',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por acuerdo bilateral'],
    description: 'Fracaso por celebracion de acuerdo bilateral',
  },
  {
    id: 'fracaso-falta-pago-gastos',
    name: 'Fracaso por Falta de Pago de Gastos',
    fileName: 'FRACASO POR FALTA DE PAGO DE GASTOS DE ADMINISTRACION.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por falta de pago gastos'],
    description: 'Fracaso por falta de pago de gastos de administracion',
  },
  {
    id: 'fracaso-impugnacion',
    name: 'Fracaso por Impugnacion',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por impugnacion del acuerdo'],
    description: 'Fracaso por impugnacion del acuerdo',
  },
  {
    id: 'fracaso-inasistencia-vencimiento',
    name: 'Fracaso por Inasistencia y Vencimiento',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por inasistencia y vencimiento de terminos'],
    description: 'Fracaso por inasistencia y vencimiento de terminos',
  },
  {
    id: 'fracaso-inasistencia-animo',
    name: 'Fracaso por Inasistencia y Animo de Conciliar',
    fileName: 'Fracaso tramite.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por inasistencia-Animo de conciliar'],
    description: 'Fracaso por inasistencia sin animo de conciliar',
  },
  {
    id: 'fracaso-incumplimiento',
    name: 'Fracaso por Incumplimiento',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por incumplimiento'],
    description: 'Fracaso por incumplimiento del acuerdo',
  },
  {
    id: 'fracaso-muerte-deudor',
    name: 'Fracaso por Muerte del Deudor',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por muerte del deudor'],
    description: 'Fracaso por fallecimiento del deudor',
  },
  {
    id: 'fracaso-propuesta-mala',
    name: 'Fracaso por Propuesta Inadecuada',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por propuesta mala'],
    description: 'Fracaso por propuesta de pago inadecuada',
  },
  {
    id: 'fracaso-propuesta-vencimiento',
    name: 'Fracaso por Propuesta y Vencimiento',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por propuesta mala y vencimiento de terminos'],
    description: 'Fracaso por propuesta mala y vencimiento de terminos',
  },
  {
    id: 'fracaso-propuesta-quorum',
    name: 'Fracaso por Propuesta y Quorum',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por propuestsa mala y Quorum'],
    description: 'Fracaso por propuesta mala y falta de quorum',
  },
  {
    id: 'fracaso-reforma-acuerdo',
    name: 'Fracaso por Reforma del Acuerdo',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por reforma del acuerdo'],
    description: 'Fracaso por reforma del acuerdo',
  },
  {
    id: 'fracaso-vencimiento-terminos',
    name: 'Fracaso por Vencimiento de Terminos',
    fileName: 'Fracaso Tramite.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por vencimiento de terminos'],
    description: 'Fracaso por vencimiento de terminos',
  },
  // === REMISION JUZGADO TEMPLATES (one per failure type) ===
  {
    id: 'remision-juzgado-acuerdo-bilateral',
    name: 'Remision Juzgado - Acuerdo Bilateral',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por acuerdo bilateral'],
    description: 'Remision al juzgado por fracaso de acuerdo bilateral',
  },
  {
    id: 'remision-juzgado-falta-pago-gastos',
    name: 'Remision Juzgado - Falta Pago Gastos',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por falta de pago gastos'],
    description: 'Remision al juzgado por falta de pago de gastos',
  },
  {
    id: 'remision-juzgado-impugnacion',
    name: 'Remision Juzgado - Impugnacion',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por impugnacion del acuerdo'],
    description: 'Remision al juzgado por impugnacion del acuerdo',
  },
  {
    id: 'remision-juzgado-inasistencia-vencimiento',
    name: 'Remision Juzgado - Inasistencia y Vencimiento',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por inasistencia y vencimiento de terminos'],
    description: 'Remision al juzgado por inasistencia y vencimiento de terminos',
  },
  {
    id: 'remision-juzgado-inasistencia-animo',
    name: 'Remision Juzgado - Inasistencia Animo Conciliar',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por inasistencia-Animo de conciliar'],
    description: 'Remision al juzgado por inasistencia sin animo de conciliar',
  },
  {
    id: 'remision-juzgado-incumplimiento',
    name: 'Remision Juzgado - Incumplimiento',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por incumplimiento'],
    description: 'Remision al juzgado por incumplimiento del acuerdo',
  },
  {
    id: 'remision-juzgado-muerte-deudor',
    name: 'Remision Juzgado - Muerte del Deudor',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por muerte del deudor'],
    description: 'Remision al juzgado por fallecimiento del deudor',
  },
  {
    id: 'remision-juzgado-propuesta-mala',
    name: 'Remision Juzgado - Propuesta Inadecuada',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por propuesta mala'],
    description: 'Remision al juzgado por propuesta de pago inadecuada',
  },
  {
    id: 'remision-juzgado-propuesta-vencimiento',
    name: 'Remision Juzgado - Propuesta y Vencimiento',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por propuesta mala y vencimiento de terminos'],
    description: 'Remision al juzgado por propuesta mala y vencimiento de terminos',
  },
  {
    id: 'remision-juzgado-propuesta-quorum',
    name: 'Remision Juzgado - Propuesta y Quorum',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por propuestsa mala y Quorum'],
    description: 'Remision al juzgado por propuesta mala y falta de quorum',
  },
  {
    id: 'remision-juzgado-reforma-acuerdo',
    name: 'Remision Juzgado - Reforma del Acuerdo',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por reforma del acuerdo'],
    description: 'Remision al juzgado por reforma del acuerdo',
  },
  {
    id: 'remision-juzgado-vencimiento-terminos',
    name: 'Remision Juzgado - Vencimiento de Terminos',
    fileName: 'Remision Juzgado F.html',
    category: 'fracaso',
    generateOnCreate: false,
    generateOnAdmission: false,
    generateOnAgreement: false,
    generateOnFailure: true,
    folderPath: ['Tipos De Fracaso', 'Fracaso por vencimiento de terminos'],
    description: 'Remision al juzgado por vencimiento de terminos',
  },
];

/**
 * Get templates that should be generated on case creation
 */
export function getTemplatesForCaseCreation(): DocumentTemplate[] {
  return DOCUMENT_TEMPLATES.filter(t => t.generateOnCreate);
}

/**
 * Get templates that should be generated on case admission
 */
export function getTemplatesForAdmission(): DocumentTemplate[] {
  return DOCUMENT_TEMPLATES.filter(t => t.generateOnAdmission);
}

/**
 * Get templates that should be generated on agreement
 */
export function getTemplatesForAgreement(): DocumentTemplate[] {
  return DOCUMENT_TEMPLATES.filter(t => t.generateOnAgreement);
}

/**
 * Get templates for failure (fracaso) by failure type
 */
export function getTemplatesForFailure(failureType?: string): DocumentTemplate[] {
  if (!failureType) {
    // Return all failure templates
    return FRACASO_TEMPLATES.filter(t => t.generateOnFailure);
  }

  // Map failure type to folder name
  const failureTypeMap: Record<string, string> = {
    'acuerdo-bilateral': 'Fracaso por acuerdo bilateral',
    'falta-pago-gastos': 'Fracaso por falta de pago gastos',
    'impugnacion': 'Fracaso por impugnacion del acuerdo',
    'inasistencia-vencimiento': 'Fracaso por inasistencia y vencimiento de terminos',
    'inasistencia-animo': 'Fracaso por inasistencia-Animo de conciliar',
    'incumplimiento': 'Fracaso por incumplimiento',
    'muerte-deudor': 'Fracaso por muerte del deudor',
    'propuesta-mala': 'Fracaso por propuesta mala',
    'propuesta-vencimiento': 'Fracaso por propuesta mala y vencimiento de terminos',
    'propuesta-quorum': 'Fracaso por propuestsa mala y Quorum',
    'reforma-acuerdo': 'Fracaso por reforma del acuerdo',
    'vencimiento-terminos': 'Fracaso por vencimiento de terminos',
  };

  const folderName = failureTypeMap[failureType];
  if (!folderName) {
    return [];
  }

  return FRACASO_TEMPLATES.filter(t =>
    t.generateOnFailure && t.folderPath.includes(folderName)
  );
}

/**
 * Get available failure types
 */
export function getFailureTypes(): Array<{ id: string; name: string; description: string }> {
  return [
    { id: 'acuerdo-bilateral', name: 'Acuerdo Bilateral', description: 'Fracaso por celebración de acuerdo bilateral' },
    { id: 'falta-pago-gastos', name: 'Falta de Pago de Gastos', description: 'Fracaso por falta de pago de gastos de administración' },
    { id: 'impugnacion', name: 'Impugnación del Acuerdo', description: 'Fracaso por impugnación del acuerdo' },
    { id: 'inasistencia-vencimiento', name: 'Inasistencia y Vencimiento', description: 'Fracaso por inasistencia y vencimiento de términos' },
    { id: 'inasistencia-animo', name: 'Inasistencia sin Ánimo', description: 'Fracaso por inasistencia sin ánimo de conciliar' },
    { id: 'incumplimiento', name: 'Incumplimiento', description: 'Fracaso por incumplimiento del acuerdo' },
    { id: 'muerte-deudor', name: 'Muerte del Deudor', description: 'Fracaso por fallecimiento del deudor' },
    { id: 'propuesta-mala', name: 'Propuesta Inadecuada', description: 'Fracaso por propuesta de pago inadecuada' },
    { id: 'propuesta-vencimiento', name: 'Propuesta y Vencimiento', description: 'Fracaso por propuesta mala y vencimiento de términos' },
    { id: 'propuesta-quorum', name: 'Propuesta y Quórum', description: 'Fracaso por propuesta mala y falta de quórum' },
    { id: 'reforma-acuerdo', name: 'Reforma del Acuerdo', description: 'Fracaso por reforma del acuerdo' },
    { id: 'vencimiento-terminos', name: 'Vencimiento de Términos', description: 'Fracaso por vencimiento de términos' },
  ];
}

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): DocumentTemplate | undefined {
  return [...DOCUMENT_TEMPLATES, ...FRACASO_TEMPLATES].find(t => t.id === id);
}

/**
 * Get all templates
 */
export function getAllTemplates(): DocumentTemplate[] {
  return [...DOCUMENT_TEMPLATES, ...FRACASO_TEMPLATES];
}

/**
 * Base path to HTML templates folder
 */
export const TEMPLATES_BASE_PATH = 'Documentos HTML';

/**
 * Get full path to template file
 */
export function getTemplatePath(template: DocumentTemplate): string {
  const parts = [TEMPLATES_BASE_PATH, ...template.folderPath, template.fileName];
  return parts.join('/');
}
