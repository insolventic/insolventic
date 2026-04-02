/**
 * Excel Generation Service
 * Generates consolidated Excel report from case data
 */

import ExcelJS from 'exceljs';
import { googleDriveService } from '@/lib/google-drive';
import type { CaseWithRelations } from '../case/schemas';

// Header style
const headerStyle: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } },
  alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  border: {
    top: { style: 'thin' },
    bottom: { style: 'thin' },
    left: { style: 'thin' },
    right: { style: 'thin' },
  },
};

const cellBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
};

const currencyFormat = '"$"#,##0';

function applyHeaderRow(sheet: ExcelJS.Worksheet, headers: string[]) {
  const row = sheet.addRow(headers);
  row.eachCell((cell) => {
    cell.style = headerStyle;
  });
  row.height = 28;
}

function formatCellBorders(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row, rowIndex) => {
    if (rowIndex === 1) return; // skip header
    row.eachCell((cell) => {
      cell.border = cellBorder;
    });
  });
}

/**
 * Build "Datos Generales" sheet
 */
function buildDatosGenerales(
  workbook: ExcelJS.Workbook,
  caseData: CaseWithRelations,
) {
  const sheet = workbook.addWorksheet('Datos Generales');
  const debtor = caseData.debtor;

  sheet.columns = [{ width: 30 }, { width: 50 }];

  // Title
  sheet.mergeCells('A1:B1');
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = 'DATOS GENERALES DEL CASO';
  titleRow.getCell(1).style = {
    font: { bold: true, size: 14, color: { argb: 'FF1F4E79' } },
    alignment: { horizontal: 'center' },
  };
  titleRow.height = 30;

  sheet.addRow([]);

  const cd = caseData as Record<string, unknown>;
  const status = (cd.status as string) || '';

  const pairs: ([string, string | number] | null)[] = [
    ['Número de trámite', caseData.tramite || caseData.caseNumber],
    [
      'Fecha de radicación',
      caseData.filingDate
        ? new Date(caseData.filingDate).toLocaleDateString('es-CO')
        : '',
    ],
    ['Estado', status],
    ['Ciudad', caseData.city || ''],
    null,
    ['INFORMACIÓN DEL DEUDOR', ''],
    ['Nombre completo', debtor.name],
    ['Cédula', debtor.idNumber],
    ['Correo electrónico', debtor.email],
    ['Teléfono', debtor.phone],
    ['Dirección', debtor.address || ''],
    ['Ciudad', debtor.city || ''],
    ['Estado civil', debtor.maritalStatus || ''],
    ['Ocupación', debtor.occupation || ''],
    ['Ingreso mensual', Number(debtor.monthlyIncome) || 0],
    null,
    ['RESUMEN FINANCIERO', ''],
    [
      'Total deuda',
      caseData.debts.reduce((s, d) => s + (Number(d.amount) || 0), 0),
    ],
    ['Número de acreedores', caseData.debts.length],
    [
      'Total bienes',
      caseData.assets.reduce((s, a) => s + (Number(a.value) || 0), 0),
    ],
    ['Número de bienes', caseData.assets.length],
  ];

  for (const pair of pairs) {
    if (!pair) {
      sheet.addRow([]);
      continue;
    }
    const row = sheet.addRow(pair);
    row.getCell(1).font = { bold: true };
    row.getCell(1).border = cellBorder;
    row.getCell(2).border = cellBorder;
    // Currency format for monetary values
    if (
      typeof pair[1] === 'number' &&
      (pair[0].includes('deuda') ||
        pair[0].includes('bienes') ||
        pair[0].includes('Ingreso'))
    ) {
      row.getCell(2).numFmt = currencyFormat;
    }
  }
}

/**
 * Build "Acreedores" sheet
 */
function buildAcreedores(
  workbook: ExcelJS.Workbook,
  caseData: CaseWithRelations,
) {
  const sheet = workbook.addWorksheet('Acreedores');

  sheet.columns = [
    { width: 5 },
    { width: 30 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 15 },
    { width: 15 },
    { width: 12 },
    { width: 20 },
    { width: 25 },
  ];

  applyHeaderRow(sheet, [
    '#',
    'Acreedor',
    'Capital',
    'Intereses',
    'Total deuda',
    'Clasificación',
    'Clase',
    'Días mora',
    'Tipo documento',
    'Codeudor',
  ]);

  const totalCapital = caseData.debts.reduce(
    (s, d) => s + (Number(d.capitalAmount) || Number(d.amount) || 0),
    0,
  );

  caseData.debts.forEach((debt, i) => {
    const capital = Number(debt.capitalAmount) || Number(debt.amount) || 0;
    const interest = Number(debt.interestAmount) || 0;
    const hasNoCoDebtor = (debt as Record<string, unknown>).noCoDebtor;

    const row = sheet.addRow([
      i + 1,
      debt.creditor.name,
      capital,
      interest,
      Number(debt.amount) || 0,
      debt.creditClassification || '',
      debt.creditorClass || '',
      debt.daysOverdue || 0,
      debt.documentType || '',
      hasNoCoDebtor ? 'N/A' : debt.coDebtorName || '',
    ]);

    // Currency format for monetary columns
    [3, 4, 5].forEach((col) => {
      row.getCell(col).numFmt = currencyFormat;
    });
  });

  // Totals row
  const totalRow = sheet.addRow([
    '',
    'TOTALES',
    totalCapital,
    caseData.debts.reduce((s, d) => s + (Number(d.interestAmount) || 0), 0),
    caseData.debts.reduce((s, d) => s + (Number(d.amount) || 0), 0),
    '',
    '',
    '',
    '',
    '',
  ]);
  totalRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.border = cellBorder;
  });
  [3, 4, 5].forEach((col) => {
    totalRow.getCell(col).numFmt = currencyFormat;
  });

  // Percentage column
  sheet.getColumn(11).width = 12;
  sheet.getCell('K1').value = '% Participación';
  sheet.getCell('K1').style = headerStyle;
  caseData.debts.forEach((debt, i) => {
    const capital = Number(debt.capitalAmount) || Number(debt.amount) || 0;
    const pct = totalCapital > 0 ? (capital / totalCapital) * 100 : 0;
    const cell = sheet.getCell(`K${i + 2}`);
    cell.value = pct / 100;
    cell.numFmt = '0.00%';
    cell.border = cellBorder;
  });

  formatCellBorders(sheet);
}

/**
 * Build "Bienes" sheet
 */
function buildBienes(workbook: ExcelJS.Workbook, caseData: CaseWithRelations) {
  const sheet = workbook.addWorksheet('Bienes');

  sheet.columns = [
    { width: 5 },
    { width: 25 },
    { width: 15 },
    { width: 18 },
    { width: 30 },
    { width: 20 },
    { width: 20 },
    { width: 15 },
  ];

  applyHeaderRow(sheet, [
    '#',
    'Nombre / Descripción',
    'Tipo',
    'Valor estimado',
    'Dirección',
    'Matrícula / Registro',
    'Marca / Modelo',
    'Patrimonio familiar',
  ]);

  caseData.assets.forEach((asset, i) => {
    const row = sheet.addRow([
      i + 1,
      asset.name,
      asset.type === 'INMUEBLE' || asset.type === 'REAL_ESTATE'
        ? 'Inmueble'
        : 'Mueble',
      Number(asset.value) || 0,
      asset.address || '',
      asset.registrationNumber || '',
      [asset.brand, asset.model].filter(Boolean).join(' ') || '',
      asset.isFamilyHome ? 'Sí' : 'No',
    ]);
    row.getCell(4).numFmt = currencyFormat;
  });

  // Totals
  const totalRow = sheet.addRow([
    '',
    'TOTAL BIENES',
    '',
    caseData.assets.reduce((s, a) => s + (Number(a.value) || 0), 0),
    '',
    '',
    '',
    '',
  ]);
  totalRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.border = cellBorder;
  });
  totalRow.getCell(4).numFmt = currencyFormat;

  formatCellBorders(sheet);
}

/**
 * Build "Ingresos y Gastos" sheet
 */
function buildIngresosGastos(
  workbook: ExcelJS.Workbook,
  caseData: CaseWithRelations,
) {
  const sheet = workbook.addWorksheet('Ingresos y Gastos');

  sheet.columns = [{ width: 35 }, { width: 22 }];

  // Title
  sheet.mergeCells('A1:B1');
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = 'RELACIÓN DE INGRESOS Y GASTOS';
  titleRow.getCell(1).style = {
    font: { bold: true, size: 14, color: { argb: 'FF1F4E79' } },
    alignment: { horizontal: 'center' },
  };
  titleRow.height = 30;

  sheet.addRow([]);

  const cd = caseData as Record<string, unknown>;

  // Ingresos
  const ingresoPrincipal =
    Number(cd.ingresoPrincipalMensual) ||
    Number(caseData.monthlyIncome) ||
    Number(caseData.debtor.monthlyIncome) ||
    0;
  const otrosIngresos =
    Number(cd.otrosIngresosMensuales) ||
    Number(caseData.otherIncomeAmount) ||
    Number(caseData.debtor.otherIncomeAmount) ||
    0;
  const ingresosVariables = Number(cd.ingresosVariablesPromedio) || 0;
  const ingresosNoOp = Number(cd.ingresosNoOperacionales) || 0;
  const totalIngresos =
    ingresoPrincipal + otrosIngresos + ingresosVariables + ingresosNoOp;

  const incomeHeader = sheet.addRow(['INGRESOS', 'Valor mensual']);
  incomeHeader.eachCell((cell) => {
    cell.style = headerStyle;
  });

  const incomeRows: [string, number][] = [
    ['Ingreso principal mensual', ingresoPrincipal],
    ['Otros ingresos mensuales', otrosIngresos],
    ['Ingresos variables (promedio)', ingresosVariables],
    ['Ingresos no operacionales', ingresosNoOp],
  ];

  for (const [label, val] of incomeRows) {
    const row = sheet.addRow([label, val]);
    row.getCell(1).border = cellBorder;
    row.getCell(2).numFmt = currencyFormat;
    row.getCell(2).border = cellBorder;
  }

  const totalIncRow = sheet.addRow(['TOTAL INGRESOS', totalIngresos]);
  totalIncRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.border = cellBorder;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD6E4F0' },
    };
  });
  totalIncRow.getCell(2).numFmt = currencyFormat;

  sheet.addRow([]);

  // Gastos
  const gastosVivienda = Number(cd.gastosVivienda) || 0;
  const gastosAlimentacion = Number(cd.gastosAlimentacion) || 0;
  const gastosServicios = Number(cd.gastosServiciosPublicos) || 0;
  const gastosTransporte = Number(cd.gastosTransporte) || 0;
  const gastosEducacion = Number(cd.gastosEducacion) || 0;
  const gastosSalud = Number(cd.gastosSalud) || 0;
  const otrosGastos = Number(cd.otrosGastos) || 0;
  const totalGastos =
    gastosVivienda +
    gastosAlimentacion +
    gastosServicios +
    gastosTransporte +
    gastosEducacion +
    gastosSalud +
    otrosGastos;

  const expHeader = sheet.addRow(['GASTOS', 'Valor mensual']);
  expHeader.eachCell((cell) => {
    cell.style = headerStyle;
  });

  const expenseRows: [string, number][] = [
    ['Vivienda (arriendo/crédito)', gastosVivienda],
    ['Alimentación', gastosAlimentacion],
    ['Servicios públicos', gastosServicios],
    ['Transporte', gastosTransporte],
    ['Educación', gastosEducacion],
    ['Salud', gastosSalud],
    ['Otros gastos', otrosGastos],
  ];

  for (const [label, val] of expenseRows) {
    const row = sheet.addRow([label, val]);
    row.getCell(1).border = cellBorder;
    row.getCell(2).numFmt = currencyFormat;
    row.getCell(2).border = cellBorder;
  }

  const totalExpRow = sheet.addRow(['TOTAL GASTOS', totalGastos]);
  totalExpRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.border = cellBorder;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFCE4D6' },
    };
  });
  totalExpRow.getCell(2).numFmt = currencyFormat;

  sheet.addRow([]);

  // Capacidad de pago
  const capacidadRow = sheet.addRow([
    'CAPACIDAD DE PAGO (Ingresos - Gastos)',
    totalIngresos - totalGastos,
  ]);
  capacidadRow.eachCell((cell) => {
    cell.font = { bold: true, size: 12 };
    cell.border = cellBorder;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2EFDA' },
    };
  });
  capacidadRow.getCell(2).numFmt = currencyFormat;
}

/**
 * Generate consolidated Excel workbook for a case
 */
export async function generateExcelForCase(
  caseData: CaseWithRelations,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Insolventic';
  workbook.created = new Date();

  buildDatosGenerales(workbook, caseData);
  buildAcreedores(workbook, caseData);
  buildBienes(workbook, caseData);
  buildIngresosGastos(workbook, caseData);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate Excel and upload to Google Drive
 */
export async function generateAndUploadExcel(
  caseData: CaseWithRelations,
  caseFolderId: string,
): Promise<{
  googleDriveId: string;
  googleDriveUrl: string;
  fileName: string;
}> {
  const buffer = await generateExcelForCase(caseData);
  const fileName = `Consolidado - ${caseData.debtor.name}.xlsx`;

  const googleDriveId = await googleDriveService.uploadFile(
    fileName,
    buffer,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    caseFolderId,
  );

  return {
    googleDriveId,
    googleDriveUrl: `https://docs.google.com/spreadsheets/d/${googleDriveId}`,
    fileName,
  };
}
