/**
 * Tablas dinámicas + propuesta de pago (Paso 9c de la división de
 * `placeholder-mapper.ts`; ver el plan en `docs/PLAN_DIVISION_MAPPER.md`).
 *
 * Se mueven aquí, SIN cambiar su código, `mapDynamicTables` y
 * `mapPaymentProposal`. No colisionan entre sí —ninguna clave que emita una
 * la emite la otra—, pero el plan las agrupa igual porque son vecinas en el
 * archivo y del mismo dominio (pagos/prelación). `mapDynamicTables` sí
 * colisiona con `basePlaceholders` (`CUADRO_CALIFICACION_GRADUACION`,
 * `DETALLE_BIENES`, `DETALLE_PAGO_CAPITAL`, `FORMA_PAGO_ACREEDORES`,
 * `PROYECCION_PAGOS`) y `mapAgreementResult` con `basePlaceholders`
 * (`ANO_FIRMA`) — colisiones contra el literal de `mapCaseToPlaceholders`,
 * que nunca se mueve, así que no bloquean nada (mismo caso que el Paso 7).
 *
 * `mapDynamicTables` llama a `escapePlaceholder` (de `placeholders/escape.ts`,
 * extraído antes de este paso) y a los 7 `generate*` del Paso 6
 * (`placeholders/html-builders.ts`) — ningún ciclo nuevo, los dos ya eran
 * leaves. `mapPaymentProposal` no llama a `escapePlaceholder`.
 */

import type { PlaceholderMap } from '../placeholder-mapper';
import type { CaseWithRelations } from '../../case/schemas';
import { getDebtClass } from '../../case/validation-rules';
import { escapePlaceholder } from './escape';
import { formatCurrency, getMonthName, boolToSiNo } from './format';
import {
  generateCalificacionGraduacionTable,
  generatePropuestaPagoHtml,
  generateDetalleBienes,
  generateDetallePagoCapital,
  generateFormaPagoAcreedores,
  generateProyeccionPagos,
  generateInventarioBienes,
} from './html-builders';

// Map dynamic tables (these generate HTML content)
export function mapDynamicTables(caseData: CaseWithRelations): PlaceholderMap {
  // Build creditors list for edicto
  const creditorsList = caseData.debts
    .map(
      (d, i) =>
        `${i + 1}. ${escapePlaceholder(d.creditor.name)} - ${formatCurrency(Number(d.amount) || 0)}`,
    )
    .join('<br>');

  // Build total creditors table
  const totalCreditors = caseData.debts.length;
  const totalDebt = caseData.debts.reduce(
    (sum, d) => sum + (Number(d.amount) || 0),
    0,
  );
  const totalCapital = caseData.debts.reduce(
    (sum, d) => sum + (Number(d.capitalAmount) || Number(d.amount) || 0),
    0,
  );
  const monthlyAmount = Number(caseData.monthlyPaymentAmount) || 0;

  // Build Calificación y Graduación table
  const calificacionTable = generateCalificacionGraduacionTable(
    caseData.debts,
    totalCapital,
  );

  // Build propuesta de pago HTML
  const propuestaPago = generatePropuestaPagoHtml(caseData);

  // Build new dynamic content
  const detalleBienes = generateDetalleBienes(caseData.assets);
  const detallePagoCapital = generateDetallePagoCapital(
    caseData.debts,
    monthlyAmount,
    totalCapital,
  );
  const formaPagoAcreedores = generateFormaPagoAcreedores(caseData.debts);
  const proyeccionPagos = generateProyeccionPagos(
    totalCapital,
    caseData.paymentTermMonths || 0,
    monthlyAmount,
  );
  const inventarioBienes = generateInventarioBienes(caseData.assets);

  return {
    // Dynamic table placeholders
    LISTA_ACREEDORES: creditorsList || '',

    // Creditor count for conditional rendering
    TIENE_ACREEDORES: caseData.debts.length > 0 ? 'SI' : 'NO',
    TIENE_BIENES: caseData.assets.length > 0 ? 'SI' : 'NO',
    TIENE_PROCESOS: (caseData.legalProcesses?.length || 0) > 0 ? 'SI' : 'NO',

    // Summary tables
    CUADRO_TOTAL_ACREEDORES: `
      <table border="1" cellpadding="5" style="width:100%; border-collapse: collapse;">
        <tr><th style="text-align:left; padding:8px;">Total Acreedores</th><td style="padding:8px;">${totalCreditors}</td></tr>
        <tr><th style="text-align:left; padding:8px;">Total Deuda</th><td style="padding:8px;">${formatCurrency(totalDebt)}</td></tr>
      </table>
    `,

    // Calificación y Graduación completa
    CUADRO_CALIFICACION_GRADUACION: calificacionTable,
    CUADRO_CALIFICACION_FIRMADO: calificacionTable,

    // Fracaso tables
    CUADRO_ACUERDO_BILATERAL: calificacionTable,
    CUADRO_FRACASO_NEGOCIACION: calificacionTable,

    // Propuesta de pago
    PROPUESTA_PAGO: propuestaPago,
    PROPUESTA_REFORMA_PAGO: propuestaPago,

    // Proyecto calificación
    PROYECTO_CALIFICACION_GRADUACION: calificacionTable,

    // New dynamic content generators (FASE 2 del plan)
    DETALLE_BIENES: detalleBienes,
    INVENTARIO_BIENES: inventarioBienes,
    DETALLE_PAGO_CAPITAL: detallePagoCapital,
    FORMA_PAGO_ACREEDORES: formaPagoAcreedores,
    PROYECCION_PAGOS: proyeccionPagos,
  };
}

// Map payment proposal
export function mapPaymentProposal(
  caseData: CaseWithRelations,
): PlaceholderMap {
  const monthlyIncome =
    Number(caseData.monthlyIncome) ||
    Number(caseData.debtor.monthlyIncome) ||
    0;
  const otherIncome =
    Number(caseData.otherIncomeAmount) ||
    Number(caseData.debtor.otherIncomeAmount) ||
    0;
  const totalIncome = monthlyIncome + otherIncome;
  const monthlyExpenses =
    Number(caseData.monthlyExpenses) ||
    Number(caseData.debtor.monthlyExpenses) ||
    0;
  const available = totalIncome - monthlyExpenses;

  // Calculate total capital from debts (Number() prevents Decimal string concatenation)
  const totalCapital = caseData.debts.reduce(
    (sum, d) => sum + (Number(d.capitalAmount) || Number(d.amount) || 0),
    0,
  );

  // Auto-calculate class totals from debts for prelación
  const classTotals = {
    primera: 0,
    segunda: 0,
    tercera: 0,
    cuarta: 0,
    quinta: 0,
  };
  for (const debt of caseData.debts) {
    const capital = Number(debt.capitalAmount) || Number(debt.amount) || 0;
    const interest = Number(debt.interestAmount) || 0;
    const total = capital + interest;
    const type = ((debt as Record<string, unknown>).type as string) || '';
    const cls = getDebtClass(type);
    classTotals[cls] += total;
  }

  // Apply quitas percentage to calculate post-reduction values
  const quitasPercent = Number(caseData.capitalReductionPercent) || 0;
  const quitasFactor = 1 - quitasPercent / 100;

  return {
    // Income/Expenses summary — uses TOTAL income (principal + otros)
    PROPUESTA_TOTAL_CAPITAL: formatCurrency(totalCapital),
    PROPUESTA_INGRESOS: formatCurrency(totalIncome),
    PROPUESTA_GASTOS: formatCurrency(monthlyExpenses),
    PROPUESTA_DISPONIBLE: formatCurrency(available),

    // Grace period
    PROP_GRACIA_SI: caseData.gracePeriodRequested ? 'X' : '',
    PROP_GRACIA_NO: !caseData.gracePeriodRequested ? 'X' : '',
    PROP_GRACIA_MESES: caseData.gracePeriodMonths?.toString() || '',

    // Dation in payment
    PROP_DACION_SI: caseData.paymentInKind ? 'X' : '',
    PROP_DACION_NO: !caseData.paymentInKind ? 'X' : '',
    PROP_DACION_DESC: caseData.paymentInKindDescription || '',

    // Asset sale
    PROP_VENTA_SI: caseData.assetSaleAuthorized ? 'X' : '',
    PROP_VENTA_NO: !caseData.assetSaleAuthorized ? 'X' : '',
    PROP_VENTA_DESC: caseData.assetSaleDescription || '',

    // Cash flow payment
    PROP_FLUJO_SI: caseData.cashFlowPayment ? 'X' : '',
    PROP_FLUJO_NO: !caseData.cashFlowPayment ? 'X' : '',

    // Term — cuota mensual: use manual value if set, otherwise calculate totalCapital / plazo
    PROP_PLAZO: caseData.paymentTermMonths?.toString() || '',
    PROP_CUOTA_MENSUAL: formatCurrency(
      Number(caseData.monthlyPaymentAmount) ||
        (caseData.paymentTermMonths && caseData.paymentTermMonths > 0
          ? totalCapital / caseData.paymentTermMonths
          : 0),
    ),
    PROP_CUOTA_VARIABLE: formatCurrency(Number(caseData.variablePayment) || 0),

    // Extraordinary payment (cesantías, primas, horas extra, bonificaciones)
    PROP_EXTRAORDINARIA_SI: caseData.extraordinaryPayment ? 'X' : '',
    PROP_EXTRAORDINARIA_NO: !caseData.extraordinaryPayment ? 'X' : '',
    PROP_EXTRA_FECHA: caseData.extraordinaryPaymentDate || '',
    PROP_EXTRA_MES: caseData.extraordinaryPaymentDate
      ? getMonthName(new Date(caseData.extraordinaryPaymentDate))
      : '',

    // Interest rate offered (placeholder - needs to be calculated based on business rules)
    PROP_TASA_MENSUAL: '0%',
    PROP_TASA_ANUAL: '0%',

    // Capital reduction (quitas)
    PROP_QUITAS_SI: caseData.capitalReduction ? 'X' : '',
    PROP_QUITAS_NO: !caseData.capitalReduction ? 'X' : '',
    PROP_QUITAS_PORCENTAJE: caseData.capitalReductionPercent?.toString() || '',
    PROP_QUITAS_VALOR: formatCurrency(totalCapital * quitasFactor),

    // Insurance
    PROP_SEGURO_INCENDIO: caseData.insuranceOffering?.includes('incendio')
      ? 'X'
      : '',
    PROP_SEGURO_VIDA: caseData.insuranceOffering?.includes('vida') ? 'X' : '',

    // Interest forgiveness
    PROP_COND_CAUSADO: boolToSiNo(caseData.forgiveAccruedInterest),
    PROP_COND_FUTURO: boolToSiNo(caseData.forgiveFutureInterest),

    // Payment order (prelation) — auto-calculated from debt types, with quitas applied
    PROP_PRELACION_1:
      classTotals.primera > 0
        ? `${formatCurrency(classTotals.primera)} → ${formatCurrency(classTotals.primera * quitasFactor)}`
        : '$0',
    PROP_PRELACION_2:
      classTotals.segunda > 0
        ? `${formatCurrency(classTotals.segunda)} → ${formatCurrency(classTotals.segunda * quitasFactor)}`
        : '$0',
    PROP_PRELACION_3:
      classTotals.tercera > 0
        ? `${formatCurrency(classTotals.tercera)} → ${formatCurrency(classTotals.tercera * quitasFactor)}`
        : '$0',
    PROP_PRELACION_4:
      classTotals.cuarta > 0
        ? `${formatCurrency(classTotals.cuarta)} → ${formatCurrency(classTotals.cuarta * quitasFactor)}`
        : '$0',
    PROP_PRELACION_5:
      classTotals.quinta > 0
        ? `${formatCurrency(classTotals.quinta)} → ${formatCurrency(classTotals.quinta * quitasFactor)}`
        : '$0',

    // Class privileges
    PROP_PRIVILEGIOS_SI: caseData.hasClassPrivileges ? 'X' : '',
    PROP_PRIVILEGIOS_NO: !caseData.hasClassPrivileges ? 'X' : '',
    PROP_PRIVILEGIOS_DESC: caseData.classPrivilegesDescription || '',

    // Third party payment
    PROP_PAGO_TERCEROS_SI: caseData.thirdPartyPaymentAuth ? 'X' : '',
    PROP_PAGO_TERCEROS_NO: !caseData.thirdPartyPaymentAuth ? 'X' : '',

    // Guarantee substitution
    PROP_GARANTIAS_SI: caseData.guaranteeSubstitution ? 'X' : '',
    PROP_GARANTIAS_NO: !caseData.guaranteeSubstitution ? 'X' : '',
  };
}
