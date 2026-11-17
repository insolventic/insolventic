/**
 * Datos 100 % sintéticos del manual de usuario.
 *
 * Ninguna persona, cédula, NIT, correo ni dirección corresponde a un cliente,
 * deudor, acreedor o usuario real (Ley 1581 de 2012). Los nombres no repiten
 * los del seed de la aplicación ni los del equipo. Los correos usan el dominio
 * reservado `.test`, que no existe en Internet.
 *
 * Historia del manual: Jorge Enrique Salazar Peña, contador independiente de
 * Bogotá, acude al centro a solicitar un trámite de insolvencia. La operadora
 * Diana Marcela Restrepo Gil radica su caso (sección 4.1) y lo acompaña por el
 * resto del manual. Los demás deudores y casos solo dan contexto a listados.
 */

const DOMINIO = 'cdp-ejemplo.test';

export type ClaveRol =
  | 'admin'
  | 'operadora'
  | 'abogado'
  | 'asistente'
  | 'secretaria'
  | 'usuario';

export const USUARIOS: ReadonlyArray<{
  clave: Exclude<ClaveRol, 'usuario'>;
  nombre: string;
  email: string;
  tarjetaProfesional: string;
  telefono: string;
  direccion: string;
}> = [
  {
    clave: 'admin',
    nombre: 'Laura Patricia Quintero Rojas',
    email: `laura.quintero@${DOMINIO}`,
    tarjetaProfesional: '188.204',
    telefono: '3014467120',
    direccion: 'Carrera 15 # 93-40, Bogotá',
  },
  {
    clave: 'operadora',
    nombre: 'Diana Marcela Restrepo Gil',
    email: `diana.restrepo@${DOMINIO}`,
    tarjetaProfesional: '245.118',
    telefono: '3157720944',
    direccion: 'Calle 72 # 10-21, Bogotá',
  },
  {
    clave: 'abogado',
    nombre: 'Andrés Felipe Cárdenas Mora',
    email: `andres.cardenas@${DOMINIO}`,
    tarjetaProfesional: '301.442',
    telefono: '3206631078',
    direccion: 'Avenida Calle 26 # 69-76, Bogotá',
  },
  {
    clave: 'asistente',
    nombre: 'Juliana Ospina Vélez',
    email: `juliana.ospina@${DOMINIO}`,
    tarjetaProfesional: 'N/A',
    telefono: '3128805516',
    direccion: 'Calle 53 # 21-08, Bogotá',
  },
  {
    clave: 'secretaria',
    nombre: 'Paola Andrea Muñoz Castaño',
    email: `paola.munoz@${DOMINIO}`,
    tarjetaProfesional: 'N/A',
    telefono: '3009914253',
    direccion: 'Carrera 50 # 104-12, Bogotá',
  },
];

export const ACREEDORES = [
  {
    clave: 'bancoAndino',
    nombre: 'Banco Andino de Fomento S.A.',
    tipo: 'FINANCIAL',
    nit: '900.418.227-3',
    email: `cartera@bancoandino.${DOMINIO}`,
    telefono: '6017430000',
    direccion: 'Carrera 7 # 71-52, Bogotá',
    representante: 'Ricardo Alonso Beltrán Suárez',
    ciudad: 'Bogotá',
    departamento: 'Cundinamarca',
  },
  {
    clave: 'coopHorizonte',
    nombre: 'Cooperativa Multiactiva Horizonte',
    tipo: 'COOPERATIVE',
    nit: '830.512.904-1',
    email: `juridica@coophorizonte.${DOMINIO}`,
    telefono: '6016215500',
    direccion: 'Calle 19 # 4-88, Bogotá',
    representante: 'Gloria Inés Cifuentes Parra',
    ciudad: 'Bogotá',
    departamento: 'Cundinamarca',
  },
  {
    clave: 'rutaSur',
    nombre: 'Financiera Ruta Sur S.A.',
    tipo: 'FINANCIAL',
    nit: '901.233.618-5',
    email: `cobranza@rutasur.${DOMINIO}`,
    telefono: '6045118800',
    direccion: 'Carrera 43A # 1-50, Medellín',
    representante: 'Mauricio Esteban Zuluaga Henao',
    ciudad: 'Medellín',
    departamento: 'Antioquia',
  },
  {
    clave: 'elTrebol',
    nombre: 'Almacenes El Trébol S.A.S.',
    tipo: 'OTHER',
    nit: '900.775.140-9',
    email: `credito@eltrebol.${DOMINIO}`,
    telefono: '6017049900',
    direccion: 'Avenida Boyacá # 80-94, Bogotá',
    representante: 'Natalia Sofía Arango Ruiz',
    ciudad: 'Bogotá',
    departamento: 'Cundinamarca',
  },
] as const;

export type ClaveAcreedor = (typeof ACREEDORES)[number]['clave'];

/** Deudor protagonista del manual: su caso se crea en la sección 4.1. */
export const DEUDOR_EJEMPLO = {
  clave: 'jorge',
  nombre: 'Jorge Enrique Salazar Peña',
  primerNombre: 'Jorge',
  segundoNombre: 'Enrique',
  primerApellido: 'Salazar',
  segundoApellido: 'Peña',
  cedula: '79845312',
  email: `jorge.salazar@${DOMINIO}`,
  telefono: '3108842267',
  direccion: 'Calle 63 # 24-15, apartamento 302',
  ciudad: 'Bogotá',
  departamento: 'Cundinamarca',
  ocupacion: 'Contador independiente',
  ingresoMensual: 4_200_000,
  gastoMensual: 3_100_000,
  fechaNacimiento: '1978-03-09',
} as const;

export const DEUDORES_CONTEXTO = [
  {
    clave: 'claudia',
    nombre: 'Claudia Milena Rincón Duarte',
    cedula: '52613874',
    email: `claudia.rincon@${DOMINIO}`,
    telefono: '3115520318',
    direccion: 'Carrera 68D # 40A-51 Sur',
    ciudad: 'Bogotá',
    departamento: 'Cundinamarca',
    ocupacion: 'Auxiliar de enfermería',
    ingresoMensual: 2_650_000,
    gastoMensual: 2_300_000,
  },
  {
    clave: 'hernan',
    nombre: 'Hernán Darío Villegas Toro',
    cedula: '71384209',
    email: `hernan.villegas@${DOMINIO}`,
    telefono: '3046613390',
    direccion: 'Calle 10 # 43E-31',
    ciudad: 'Medellín',
    departamento: 'Antioquia',
    ocupacion: 'Conductor',
    ingresoMensual: 2_100_000,
    gastoMensual: 1_950_000,
  },
  {
    clave: 'luz',
    nombre: 'Luz Ángela Moreno Bernal',
    cedula: '39758126',
    email: `luz.moreno@${DOMINIO}`,
    telefono: '3172248815',
    direccion: 'Transversal 22 # 61-14',
    ciudad: 'Bogotá',
    departamento: 'Cundinamarca',
    ocupacion: 'Docente',
    ingresoMensual: 3_400_000,
    gastoMensual: 2_900_000,
  },
  {
    clave: 'sergio',
    nombre: 'Sergio Iván Patiño Lozano',
    cedula: '1020745318',
    email: `sergio.patino@${DOMINIO}`,
    telefono: '3013379021',
    direccion: 'Carrera 9 # 11-60',
    ciudad: 'Chía',
    departamento: 'Cundinamarca',
    ocupacion: 'Comerciante',
    ingresoMensual: 2_900_000,
    gastoMensual: 2_700_000,
  },
  {
    clave: 'rosa',
    nombre: 'Rosa Elena Quiroga Díaz',
    cedula: '41922657',
    email: `rosa.quiroga@${DOMINIO}`,
    telefono: '3168890472',
    direccion: 'Calle 145 # 12-38',
    ciudad: 'Bogotá',
    departamento: 'Cundinamarca',
    ocupacion: 'Pensionada',
    ingresoMensual: 1_900_000,
    gastoMensual: 1_500_000,
  },
] as const;

export type ClaveDeudor = (typeof DEUDORES_CONTEXTO)[number]['clave'] | 'jorge';

/**
 * Casos de contexto (listado, filtros, dashboard). `diasAntes` se resta de la
 * fecha ancla. El caso de Jorge NO está aquí: lo crea la sección 4.1.
 */
export const CASOS_CONTEXTO: ReadonlyArray<{
  numero: string;
  tipo: 'INSOLVENCY' | 'CONCILIATION';
  deudor: Exclude<ClaveDeudor, 'jorge'>;
  fase: string;
  diasAntes: number;
  operador: 'operadora' | 'abogado';
  deudas: ReadonlyArray<{
    acreedor: ClaveAcreedor;
    monto: number;
    tasa: number;
    tipo: string;
  }>;
  /**
   * Si está, el caso nace en la papelera, eliminado `diasAntes` días antes de
   * la ancla por la operadora. Se siembra así (y no se elimina durante la
   * corrida) para que la fecha "Eliminado" de la papelera sea estable.
   */
  papelera?: { diasAntes: number };
}> = [
  {
    numero: 'INSOL-000001',
    tipo: 'INSOLVENCY',
    deudor: 'claudia',
    fase: 'En negociación',
    diasAntes: 96,
    operador: 'operadora',
    deudas: [
      {
        acreedor: 'bancoAndino',
        monto: 38_500_000,
        tasa: 24.5,
        tipo: 'Crédito de libre inversión',
      },
      {
        acreedor: 'elTrebol',
        monto: 6_200_000,
        tasa: 28.1,
        tipo: 'Crédito de consumo',
      },
    ],
  },
  {
    numero: 'INSOL-000002',
    tipo: 'INSOLVENCY',
    deudor: 'hernan',
    fase: 'Admisión',
    diasAntes: 41,
    operador: 'operadora',
    deudas: [
      {
        acreedor: 'rutaSur',
        monto: 52_300_000,
        tasa: 19.8,
        tipo: 'Crédito de vehículo',
      },
      {
        acreedor: 'coopHorizonte',
        monto: 9_800_000,
        tasa: 21.0,
        tipo: 'Crédito de libranza',
      },
    ],
  },
  {
    numero: 'INSOL-000003',
    tipo: 'INSOLVENCY',
    deudor: 'luz',
    fase: 'Acuerdo aprobado',
    diasAntes: 210,
    operador: 'abogado',
    deudas: [
      {
        acreedor: 'bancoAndino',
        monto: 27_900_000,
        tasa: 26.4,
        tipo: 'Tarjeta de crédito',
      },
      {
        acreedor: 'coopHorizonte',
        monto: 14_600_000,
        tasa: 20.2,
        tipo: 'Crédito de libranza',
      },
    ],
  },
  {
    numero: 'INSOL-000004',
    tipo: 'INSOLVENCY',
    deudor: 'sergio',
    fase: 'Inicial',
    diasAntes: 6,
    operador: 'abogado',
    deudas: [
      {
        acreedor: 'rutaSur',
        monto: 18_750_000,
        tasa: 25.3,
        tipo: 'Crédito de consumo',
      },
    ],
  },
  {
    numero: 'CONC-000001',
    tipo: 'CONCILIATION',
    deudor: 'rosa',
    fase: 'Inicial',
    diasAntes: 12,
    operador: 'operadora',
    deudas: [],
  },
  // Duplicado de CONC-000001 radicado por error y enviado a la papelera
  // (sección 4.3.1). Es de conciliación a propósito: la numeración de
  // insolvencia cuenta también la papelera, y el caso que crea la sección 4.1
  // debe seguir siendo INSOL-000005.
  {
    numero: 'CONC-000002',
    tipo: 'CONCILIATION',
    deudor: 'rosa',
    fase: 'Inicial',
    diasAntes: 12,
    operador: 'operadora',
    deudas: [],
    papelera: { diasAntes: 2 },
  },
];

/**
 * Notificaciones del Administrador para el dashboard (sección 3), con el
 * mismo título y texto que arma la app (`createNotificationForAction`).
 * `horasAntes` se resta de la fecha ancla.
 */
export const NOTIFICACIONES_ADMIN: ReadonlyArray<{
  tipo: string;
  titulo: string;
  mensaje: string;
  caso?: string;
  horasAntes: number;
  leida: boolean;
}> = [
  {
    tipo: 'case_updated',
    titulo: 'Caso actualizado',
    mensaje:
      "Se ha actualizado el caso 'INSOL-000001 - Claudia Milena Rincón Duarte' por el usuario Diana Marcela Restrepo Gil con cédula 245.118",
    caso: 'INSOL-000001',
    horasAntes: 2,
    leida: false,
  },
  {
    tipo: 'case_deleted',
    titulo: 'Caso eliminado',
    mensaje:
      "Se ha eliminado el caso 'CONC-000002 - Rosa Elena Quiroga Díaz' por el usuario Diana Marcela Restrepo Gil con cédula 245.118",
    horasAntes: 42,
    leida: false,
  },
  {
    tipo: 'debtor_created',
    titulo: 'Deudor creado',
    mensaje:
      "Se ha creado el deudor 'Jorge Enrique Salazar Peña' por el usuario Diana Marcela Restrepo Gil con cédula 245.118",
    horasAntes: 70,
    leida: true,
  },
  {
    tipo: 'case_created',
    titulo: 'Caso creado',
    mensaje:
      "Se ha creado el caso 'INSOL-000004 - Sergio Iván Patiño Lozano' por el usuario Andrés Felipe Cárdenas Mora con cédula 301.442",
    caso: 'INSOL-000004',
    horasAntes: 144,
    leida: true,
  },
];
