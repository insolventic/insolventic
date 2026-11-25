/**
 * Tipo de caso de las plantillas: el guard y el error de pedir plantillas de
 * otro tipo.
 *
 * Módulo aparte de `templates-config.ts` para que las actions puedan
 * importarlo de forma estática (los `catch` lo necesitan) sin cargar la
 * configuración de 65 plantillas, que las actions importan con `import()`.
 */
import type { CaseType, DocumentTemplate } from './templates-config';

const CASE_TYPES: readonly CaseType[] = [
  'INSOLVENCY',
  'CONCILIATION',
  'SUPPORT_AGREEMENT',
];

export function isCaseType(value: unknown): value is CaseType {
  return CASE_TYPES.includes(value as CaseType);
}

const CASE_TYPE_LABELS: Record<CaseType, string> = {
  INSOLVENCY: 'insolvencia',
  CONCILIATION: 'conciliación',
  SUPPORT_AGREEMENT: 'acuerdo de apoyo',
};

/**
 * Se pidieron por id plantillas de otro tipo de caso. Es un error y no un
 * filtro silencioso: la UI nunca las pide (el plan sale del tipo del caso),
 * así que si llegan, algo armó mal la llamada y conviene que se vea.
 */
export class PlantillasDeOtroTipoError extends Error {
  readonly caseType: CaseType;
  readonly templateIds: string[];

  constructor(caseType: CaseType, plantillas: DocumentTemplate[]) {
    const nombres = plantillas.map((p) => `"${p.name}"`).join(', ');
    super(
      plantillas.length === 1
        ? `La plantilla ${nombres} no corresponde a un caso de ${CASE_TYPE_LABELS[caseType]}.`
        : `Las plantillas ${nombres} no corresponden a un caso de ${CASE_TYPE_LABELS[caseType]}.`,
    );
    this.name = 'PlantillasDeOtroTipoError';
    this.caseType = caseType;
    this.templateIds = plantillas.map((p) => p.id);
  }
}

/** true si el error vino de este módulo. Sobrevive al cruce de bundles. */
export function isPlantillasDeOtroTipoError(
  error: unknown,
): error is PlantillasDeOtroTipoError {
  return error instanceof Error && error.name === 'PlantillasDeOtroTipoError';
}
