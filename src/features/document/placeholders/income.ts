/**
 * Sub-mapper del certificado de ingresos (Paso 4 de la división de
 * `placeholder-mapper.ts`; ver el plan en `docs/PLAN_DIVISION_MAPPER.md`).
 *
 * Se mueven aquí, SIN cambiar su código, `mapIncomeDeclaration` y su único
 * helper interno `buildIncomeNarrative`. Cumplen las dos condiciones de "menor
 * riesgo" del plan: no dependen de ningún otro sub-mapper (solo del tipo
 * `PlaceholderMap`, de `formatCurrency` —ya extraído en el Paso 1— y de
 * `escapePlaceholder`) y no participan en ninguna de las 16 colisiones del
 * contrato de orden de fusión (`mapper-merge-order.test.ts`). Se llaman desde
 * un solo lugar, `mapCaseToPlaceholders`.
 *
 * NOTA sobre `escapePlaceholder`: a diferencia de los Pasos 2 y 3, este grupo
 * SÍ escapa texto libre del usuario (ocupación, empleador, descripción de
 * otros ingresos) antes de interpolarlo en el HTML de `NARRATIVA_INGRESOS`
 * —una de las 16 claves de `HTML_PLACEHOLDERS_ALLOWLIST` (ver
 * `tests/unit/documents/html-escape-guard.test.ts`). `escapePlaceholder` se
 * queda deliberadamente en `placeholder-mapper.ts` (es el corte de seguridad
 * en el punto de fusión, Sesión 1 de `CLAUDE.md`), así que este módulo la
 * importa de vuelta desde ahí: es una dependencia circular real entre los dos
 * archivos, pero segura, porque ninguno de los dos la usa al cargar el módulo
 * —solo dentro de una llamada a función, para cuando el ciclo ya terminó de
 * resolverse—. El golden master de `insolvencia-xss` (que ejercita
 * `NARRATIVA_INGRESOS` con una carga hostil) es la prueba de que el enlace
 * circular sigue escapando en runtime, no solo en tipos.
 */

import { escapePlaceholder, type PlaceholderMap } from '../placeholder-mapper';
import type { CaseWithRelations } from '../../case/schemas';
import { formatCurrency } from './format';

// Build narrative paragraph for income certificate based on employment type
function buildIncomeNarrative(caseData: CaseWithRelations): string {
  const tipoVinculacion = (caseData as Record<string, unknown>)
    .deudorTipoVinculacion as string | null;
  const empleador = (caseData as Record<string, unknown>)
    .deudorNombreEmpleador as string | null;
  const actividad = (caseData as Record<string, unknown>)
    .deudorActividadEconomica as string | null;
  const ocupacion = caseData.debtor.occupation || 'No especificada';
  const ingresoPrincipal =
    Number((caseData as Record<string, unknown>).ingresoPrincipalMensual) ||
    Number(caseData.monthlyIncome) ||
    Number(caseData.debtor.monthlyIncome) ||
    0;
  const otrosIngresos =
    Number((caseData as Record<string, unknown>).otrosIngresosMensuales) ||
    Number(caseData.otherIncomeAmount) ||
    Number(caseData.debtor.otherIncomeAmount) ||
    0;
  const otrosDesc =
    ((caseData as Record<string, unknown>).otherIncomeDescription as string) ||
    caseData.debtor.otherIncomeDescription ||
    '';

  const parts: string[] = [];

  // NARRATIVA_INGRESOS está en la allowlist HTML — los datos del usuario que
  // interpola se escapan aquí, dentro del builder.
  const safeOcupacion = escapePlaceholder(ocupacion);
  const safeEmpleador = escapePlaceholder(empleador || 'No especificada');
  const safeVinculacion = escapePlaceholder(tipoVinculacion);
  const safeActividad = escapePlaceholder(actividad || ocupacion);
  const safeOtrosDesc = escapePlaceholder(otrosDesc);

  const tipo = (tipoVinculacion || '').toLowerCase();
  if (
    tipo === 'empleado' ||
    tipo.includes('contrato') ||
    tipo.includes('término')
  ) {
    parts.push(
      `<p class="justified">Actualmente me encuentro vinculado(a) laboralmente como <strong>${safeOcupacion}</strong> en la empresa <strong>${safeEmpleador}</strong>, bajo modalidad de <strong>${safeVinculacion}</strong>, devengando un ingreso principal mensual de <strong>${formatCurrency(ingresoPrincipal)}</strong>.</p>`,
    );
  } else if (tipo === 'independiente' || tipo === 'contratista') {
    parts.push(
      `<p class="justified">Me desempeño como trabajador(a) independiente en la actividad de <strong>${safeActividad}</strong>, de la cual derivo un ingreso principal mensual aproximado de <strong>${formatCurrency(ingresoPrincipal)}</strong>.</p>`,
    );
  } else if (tipo === 'pensionado') {
    parts.push(
      `<p class="justified">Actualmente soy pensionado(a), percibiendo una mesada pensional mensual de <strong>${formatCurrency(ingresoPrincipal)}</strong>.</p>`,
    );
  } else if (tipo === 'desempleado') {
    parts.push(
      `<p class="justified">Actualmente me encuentro desempleado(a). Mi sustento proviene de ${safeOtrosDesc || 'apoyo familiar y otros recursos'}, con un ingreso aproximado mensual de <strong>${formatCurrency(ingresoPrincipal + otrosIngresos)}</strong>.</p>`,
    );
  } else {
    // Fallback genérico
    parts.push(
      `<p class="justified">Mis ingresos mensuales provienen de la actividad vinculada con <strong>${safeActividad}</strong>, con un ingreso principal mensual de <strong>${formatCurrency(ingresoPrincipal)}</strong>.</p>`,
    );
  }

  if (otrosIngresos > 0 && tipo !== 'desempleado') {
    parts.push(
      `<p class="justified">Adicionalmente, percibo otros ingresos mensuales por concepto de <strong>${safeOtrosDesc || 'otras fuentes'}</strong> por valor de <strong>${formatCurrency(otrosIngresos)}</strong>.</p>`,
    );
  }

  return parts.join('\n    ');
}

// Map certificate of income variables (Certificado de Ingresos)
export function mapIncomeDeclaration(
  caseData: CaseWithRelations,
): PlaceholderMap {
  const debtor = caseData.debtor;
  const monthlyIncome =
    Number((caseData as Record<string, unknown>).ingresoPrincipalMensual) ||
    Number(caseData.monthlyIncome) ||
    Number(debtor.monthlyIncome) ||
    0;
  const otrosIngresos =
    Number((caseData as Record<string, unknown>).otrosIngresosMensuales) ||
    Number(caseData.otherIncomeAmount) ||
    Number(debtor.otherIncomeAmount) ||
    0;
  const otrosDesc =
    ((caseData as Record<string, unknown>).otherIncomeDescription as string) ||
    debtor.otherIncomeDescription ||
    '';
  const totalIngresos = monthlyIncome + otrosIngresos;

  return {
    NOMBRE_DECLARANTE: debtor.name,
    CEDULA_DECLARANTE: debtor.idNumber,
    CIUDAD_DOMICILIO: debtor.city || caseData.city || '',
    CORREO_DECLARANTE: debtor.email,
    TELEFONO_DECLARANTE: debtor.phone,
    ACTIVIDAD_ECONOMICA: debtor.occupation || 'No especificada',
    INGRESO_MENSUAL: formatCurrency(monthlyIncome),
    NARRATIVA_INGRESOS: buildIncomeNarrative(caseData),
    OTROS_INGRESOS_LABEL:
      otrosIngresos > 0
        ? `Otros ingresos (${otrosDesc || 'otras fuentes'})`
        : 'Otros ingresos',
    OTROS_INGRESOS_MONTO: formatCurrency(otrosIngresos),
    TOTAL_INGRESOS_CERTIFICADO: formatCurrency(totalIngresos),
  };
}
