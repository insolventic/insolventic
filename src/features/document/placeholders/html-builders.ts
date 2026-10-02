/**
 * Builders HTML de patrimonio y pagos (Paso 6 de la división de
 * `placeholder-mapper.ts`; ver el plan en `docs/PLAN_DIVISION_MAPPER.md`).
 *
 * Se mueven aquí, SIN cambiar su código, los 7 `generate*`:
 * `generateDetalleBienes`, `generateDetallePagoCapital`,
 * `generateFormaPagoAcreedores`, `generateProyeccionPagos`,
 * `generateInventarioBienes`, `generateCalificacionGraduacionTable`,
 * `generatePropuestaPagoHtml`. Cumplen las dos condiciones de "menor riesgo"
 * del plan: no dependen de ningún otro sub-mapper (solo del tipo
 * `CaseWithRelations`, de `formatCurrency` —ya extraído en el Paso 1— y de
 * `escapePlaceholder` —extraído a `placeholders/escape.ts` antes de este
 * paso, justamente para que este import no repitiera la dependencia
 * circular del Paso 4—) y no participan en ninguna de las 16
 * colisiones del contrato de orden de fusión (`mapper-merge-order.test.ts`):
 * las claves HTML que producen (`DETALLE_BIENES`, `CUADRO_CALIFICACION_GRADUACION`,
 * etc.) las emite `mapDynamicTables`, que SÍ colisiona con `basePlaceholders`
 * pero se queda en `placeholder-mapper.ts` (Paso 9, por su colisión con
 * `mapPaymentProposal`) — mover estos 7 helpers no toca esa colisión.
 *
 * `mapDynamicTables` las llama a las 7 desde un solo lugar y queda importando
 * de este archivo en vez de definirlas localmente.
 */

import type { CaseWithRelations } from '../../case/schemas';
import { nowColombia, COLOMBIA_TZ } from '@/lib/date-colombia';
import { escapePlaceholder } from './escape';
import { formatCurrency } from './format';

// Generate Detalle de Bienes HTML
export function generateDetalleBienes(
  assets: CaseWithRelations['assets'],
): string {
  if (!assets || assets.length === 0) {
    return 'El deudor manifiesta no tener bienes a su nombre.';
  }

  const inmuebles = assets.filter(
    (a) => a.type === 'INMUEBLE' || a.type === 'REAL_ESTATE',
  );
  const muebles = assets.filter(
    (a) => a.type !== 'INMUEBLE' && a.type !== 'REAL_ESTATE',
  );

  let html = '';

  if (inmuebles.length > 0) {
    html += '<strong>Bienes Inmuebles:</strong><br>';
    html += inmuebles
      .map(
        (a, i) =>
          `${i + 1}. ${escapePlaceholder(a.propertyType || a.type)}: ${escapePlaceholder(a.address || a.name || 'Sin dirección')} - Matrícula: ${escapePlaceholder(a.registrationNumber || 'N/A')} - Valor: ${formatCurrency(a.value)}`,
      )
      .join('<br>');
    html += '<br><br>';
  }

  if (muebles.length > 0) {
    html += '<strong>Bienes Muebles:</strong><br>';
    html += muebles
      .map(
        (a, i) =>
          `${i + 1}. ${escapePlaceholder(a.type)}: ${escapePlaceholder(a.name || a.description || 'Sin descripción')} - Valor: ${formatCurrency(a.value)}`,
      )
      .join('<br>');
  }

  return html;
}

// Generate Detalle de Pago de Capital HTML
export function generateDetallePagoCapital(
  debts: CaseWithRelations['debts'],
  monthlyAmount: number,
  totalCapital: number,
): string {
  if (!debts || debts.length === 0) {
    return '<em>Pendiente de registrar acreedores para calcular distribución de pagos.</em>';
  }

  let html =
    '<table border="1" cellpadding="5" style="width:100%; border-collapse: collapse; font-size:11px;">';
  html +=
    '<tr style="background-color:#f0f0f0;"><th>Acreedor</th><th>Capital</th><th>% Participación</th><th>Cuota Mensual</th></tr>';

  debts.forEach((debt) => {
    const capital = Number(debt.capitalAmount) || Number(debt.amount) || 0;
    const percentage = totalCapital > 0 ? (capital / totalCapital) * 100 : 0;
    const monthlyPayment = (percentage / 100) * monthlyAmount;

    html += `<tr>
      <td style="padding:5px;">${escapePlaceholder(debt.creditor?.name || 'N/A')}</td>
      <td style="padding:5px; text-align:right;">${formatCurrency(capital)}</td>
      <td style="padding:5px; text-align:center;">${percentage.toFixed(2)}%</td>
      <td style="padding:5px; text-align:right;">${formatCurrency(monthlyPayment)}</td>
    </tr>`;
  });

  html += `<tr style="background-color:#e0e0e0; font-weight:bold;">
    <td style="padding:5px;">TOTAL</td>
    <td style="padding:5px; text-align:right;">${formatCurrency(totalCapital)}</td>
    <td style="padding:5px; text-align:center;">100%</td>
    <td style="padding:5px; text-align:right;">${formatCurrency(monthlyAmount)}</td>
  </tr>`;
  html += '</table>';

  return html;
}

// Generate Forma de Pago a Acreedores HTML
export function generateFormaPagoAcreedores(
  debts: CaseWithRelations['debts'],
): string {
  if (!debts || debts.length === 0) {
    return '<em>Pendiente de registrar acreedores.</em>';
  }

  return debts
    .map(
      (debt) =>
        `• <strong>${escapePlaceholder(debt.creditor?.name || 'N/A')}:</strong> Consignación a cuenta bancaria o medio de pago acordado con el acreedor.`,
    )
    .join('<br>');
}

// Generate Proyección de Pagos HTML
export function generateProyeccionPagos(
  totalCapital: number,
  months: number,
  monthlyAmount: number,
  startDate?: Date,
): string {
  if (!months || months <= 0 || !monthlyAmount) {
    return 'Proyección pendiente de definir.';
  }

  const start = startDate || nowColombia();
  let html =
    '<table border="1" cellpadding="5" style="width:100%; border-collapse: collapse; font-size:10px;">';
  html +=
    '<tr style="background-color:#f0f0f0;"><th>#</th><th>Fecha</th><th>Cuota</th><th>Abono Capital</th><th>Saldo</th></tr>';

  let balance = totalCapital;

  // Generate ALL payment rows (no truncation)
  for (let i = 1; i <= months; i++) {
    const paymentDate = new Date(start);
    paymentDate.setMonth(paymentDate.getMonth() + i);

    // Calculate payment applied to capital
    const capitalPayment = Math.min(monthlyAmount, balance);
    balance = Math.max(0, balance - monthlyAmount);

    html += `<tr>
      <td style="padding:3px; text-align:center;">${i}</td>
      <td style="padding:3px; text-align:center;">${paymentDate.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: COLOMBIA_TZ })}</td>
      <td style="padding:3px; text-align:right;">${formatCurrency(monthlyAmount)}</td>
      <td style="padding:3px; text-align:right;">${formatCurrency(capitalPayment)}</td>
      <td style="padding:3px; text-align:right;">${formatCurrency(balance)}</td>
    </tr>`;
  }

  // Add totals row
  html += `<tr style="background-color:#e0e0e0; font-weight:bold;">
    <td colspan="2" style="padding:5px; text-align:right;">TOTALES</td>
    <td style="padding:5px; text-align:right;">${formatCurrency(monthlyAmount * months)}</td>
    <td style="padding:5px; text-align:right;">${formatCurrency(totalCapital)}</td>
    <td style="padding:5px; text-align:right;">$0</td>
  </tr>`;

  html += '</table>';
  return html;
}

// Generate Inventario de Bienes HTML (for agreements)
export function generateInventarioBienes(
  assets: CaseWithRelations['assets'],
): string {
  if (!assets || assets.length === 0) {
    return 'El deudor manifiesta no poseer bienes a su nombre.';
  }

  const totalValue = assets.reduce((sum, a) => sum + (Number(a.value) || 0), 0);

  let html =
    '<table border="1" cellpadding="5" style="width:100%; border-collapse: collapse; font-size:11px;">';
  html +=
    '<tr style="background-color:#f0f0f0;"><th>Tipo</th><th>Descripción</th><th>Valor</th></tr>';

  assets.forEach((asset) => {
    html += `<tr>
      <td style="padding:5px;">${escapePlaceholder(asset.type || 'N/A')}</td>
      <td style="padding:5px;">${escapePlaceholder(asset.name || asset.description || asset.address || 'Sin descripción')}</td>
      <td style="padding:5px; text-align:right;">${formatCurrency(Number(asset.value) || 0)}</td>
    </tr>`;
  });

  html += `<tr style="background-color:#e0e0e0; font-weight:bold;">
    <td colspan="2" style="padding:5px; text-align:right;">TOTAL</td>
    <td style="padding:5px; text-align:right;">${formatCurrency(totalValue)}</td>
  </tr>`;
  html += '</table>';

  return html;
}

// Generate Calificación y Graduación table HTML
export function generateCalificacionGraduacionTable(
  debts: CaseWithRelations['debts'],
  totalCapital: number,
): string {
  if (!debts || debts.length === 0) {
    // Return empty table structure instead of error message
    // The validation layer will prevent document generation if required
    return `
      <table border="1" cellpadding="5" style="width:100%; border-collapse: collapse; font-size:12px;">
        <thead>
          <tr style="background-color:#f0f0f0;">
            <th style="padding:8px; border:1px solid #000;">ACREEDOR</th>
            <th style="padding:8px; border:1px solid #000;">No.</th>
            <th style="padding:8px; border:1px solid #000;">PRELACIÓN</th>
            <th style="padding:8px; border:1px solid #000;">CAPITAL</th>
            <th style="padding:8px; border:1px solid #000;">INTERESES</th>
            <th style="padding:8px; border:1px solid #000;">% PARTICIPACIÓN</th>
          </tr>
        </thead>
        <tbody>
          <tr><td colspan="6" style="padding:10px; text-align:center; color:#999;">Pendiente de registrar acreedores</td></tr>
        </tbody>
      </table>
    `;
  }

  const tableRows = debts
    .map((debt, index) => {
      const capital = Number(debt.capitalAmount) || Number(debt.amount) || 0;
      const interest = Number(debt.interestAmount) || 0;
      const percentage =
        totalCapital > 0 ? ((capital / totalCapital) * 100).toFixed(2) : '0.00';
      const prelacion = debt.creditorClass || 'Quirografario';

      return `
      <tr>
        <td style="padding:5px; border:1px solid #000;">${escapePlaceholder(debt.creditor?.name || 'N/A')}</td>
        <td style="padding:5px; border:1px solid #000; text-align:center;">${index + 1}</td>
        <td style="padding:5px; border:1px solid #000; text-align:center;">${escapePlaceholder(prelacion)}</td>
        <td style="padding:5px; border:1px solid #000; text-align:right;">${formatCurrency(capital)}</td>
        <td style="padding:5px; border:1px solid #000; text-align:right;">${formatCurrency(interest)}</td>
        <td style="padding:5px; border:1px solid #000; text-align:center;">${percentage}%</td>
      </tr>
    `;
    })
    .join('');

  const totalInterest = debts.reduce(
    (sum, d) => sum + (Number(d.interestAmount) || 0),
    0,
  );

  return `
    <table border="1" cellpadding="5" style="width:100%; border-collapse: collapse; font-size:12px;">
      <thead>
        <tr style="background-color:#f0f0f0;">
          <th style="padding:8px; border:1px solid #000;">ACREEDOR</th>
          <th style="padding:8px; border:1px solid #000;">No.</th>
          <th style="padding:8px; border:1px solid #000;">PRELACIÓN</th>
          <th style="padding:8px; border:1px solid #000;">CAPITAL</th>
          <th style="padding:8px; border:1px solid #000;">INTERESES</th>
          <th style="padding:8px; border:1px solid #000;">% PARTICIPACIÓN</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
      <tfoot>
        <tr style="background-color:#e0e0e0; font-weight:bold;">
          <td colspan="3" style="padding:8px; border:1px solid #000; text-align:right;">TOTALES</td>
          <td style="padding:8px; border:1px solid #000; text-align:right;">${formatCurrency(totalCapital)}</td>
          <td style="padding:8px; border:1px solid #000; text-align:right;">${formatCurrency(totalInterest)}</td>
          <td style="padding:8px; border:1px solid #000; text-align:center;">100.00%</td>
        </tr>
      </tfoot>
    </table>
  `;
}

// Generate Propuesta de Pago HTML
export function generatePropuestaPagoHtml(caseData: CaseWithRelations): string {
  const monthlyIncome =
    Number(caseData.monthlyIncome) ||
    Number(caseData.debtor.monthlyIncome) ||
    0;
  const monthlyExpenses =
    Number(caseData.monthlyExpenses) ||
    Number(caseData.debtor.monthlyExpenses) ||
    0;
  const available = monthlyIncome - monthlyExpenses;
  const totalCapital = caseData.debts.reduce(
    (sum, d) => sum + (Number(d.capitalAmount) || Number(d.amount) || 0),
    0,
  );

  return `
    <table border="1" cellpadding="5" style="width:100%; border-collapse: collapse; font-size:12px;">
      <tr>
        <td style="padding:8px; border:1px solid #000;"><strong>Ingresos Mensuales:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;">${formatCurrency(monthlyIncome)}</td>
      </tr>
      <tr>
        <td style="padding:8px; border:1px solid #000;"><strong>Gastos Mensuales:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;">${formatCurrency(monthlyExpenses)}</td>
      </tr>
      <tr style="background-color:#f0f0f0;">
        <td style="padding:8px; border:1px solid #000;"><strong>Disponible para Pago:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;"><strong>${formatCurrency(available)}</strong></td>
      </tr>
      <tr>
        <td style="padding:8px; border:1px solid #000;"><strong>Total Capital Adeudado:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;">${formatCurrency(totalCapital)}</td>
      </tr>
      <tr>
        <td style="padding:8px; border:1px solid #000;"><strong>Plazo Propuesto:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;">${caseData.paymentTermMonths || '____'} meses</td>
      </tr>
      <tr>
        <td style="padding:8px; border:1px solid #000;"><strong>Cuota Mensual Propuesta:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;">${formatCurrency(Number(caseData.monthlyPaymentAmount) || 0)}</td>
      </tr>
      <tr>
        <td style="padding:8px; border:1px solid #000;"><strong>Periodo de Gracia:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;">${caseData.gracePeriodRequested ? `${caseData.gracePeriodMonths} meses` : 'No solicitado'}</td>
      </tr>
      <tr>
        <td style="padding:8px; border:1px solid #000;"><strong>Condonación de Intereses:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;">${caseData.forgiveAccruedInterest ? 'Causados y Futuros' : 'No solicitada'}</td>
      </tr>
    </table>
  `;
}
