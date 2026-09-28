/**
 * Test de guardia: la fecha de radicación es un dato del operador, no del deudor.
 *
 * La radicación la hace el centro de conciliación, así que en el wizard de alta
 * el campo no tenía quién lo respondiera: el deudor no la conoce todavía. Su
 * lugar es la pantalla del operador, que la exige antes de generar el paquete
 * de Admisión (los dos únicos documentos de insolvencia que la imprimen).
 *
 * Se lee el código fuente en vez de renderizar porque lo que hay que fijar es
 * de dónde sale el dato, no cómo se ve: un `<FormField name="filingDate">` que
 * vuelva al wizard es la regresión, y ningún test de render la vería si alguien
 * lo agrega en otra pestaña.
 */

import fs from 'fs';
import path from 'path';

const read = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

const CREATE_WIZARD = read('src/app/cases/components/create-case-dialog.tsx');
const CASE_DETAILS_SECTION = read(
  'src/app/cases/components/create-case-dialog/case-details-section.tsx',
);
const EDIT_DIALOG = read('src/app/cases/components/edit-case-dialog.tsx');
const PRE_GENERATION_FORM = read(
  'src/app/cases/components/case-details-dialog/pre-generation-form.tsx',
);
const DOCUMENTS_SECTION = read(
  'src/app/cases/components/case-details-dialog/documents-section.tsx',
);

describe('fecha de radicación — dato del operador', () => {
  describe('el wizard de alta no la pide', () => {
    it('create-case-dialog no menciona filingDate', () => {
      // Cubre las tres formas en que estaba: FIELD_TAB_MAP, defaultValues y la
      // carga de datos de demo.
      expect(CREATE_WIZARD).not.toContain('filingDate');
    });

    it('CaseDetailsSection la oculta por defecto', () => {
      expect(CASE_DETAILS_SECTION).toContain('showFilingDate = false');
      // El campo sigue existiendo, pero detrás del flag.
      expect(CASE_DETAILS_SECTION).toContain('{showFilingDate && (');
    });

    it('el wizard de alta renderiza la sección sin encender el flag', () => {
      expect(CREATE_WIZARD).toContain('<CaseDetailsSection />');
    });
  });

  describe('el operador sí la tiene', () => {
    it('el diálogo de edición enciende el flag', () => {
      expect(EDIT_DIALOG).toContain('<CaseDetailsSection showFilingDate />');
    });

    it('el formulario previo a la generación la exige', () => {
      // required en el input + guarda en el submit: sin fecha no se guarda ni
      // se sigue a la generación.
      expect(PRE_GENERATION_FORM).toContain('id="filingDate"');
      expect(PRE_GENERATION_FORM).toMatch(
        /if \(!filingDate \|\| !designationDate \|\| !positionAcceptanceDate\)/,
      );
      expect(PRE_GENERATION_FORM).toContain(
        'Todos los campos son obligatorios',
      );
    });

    it('la generación del paquete de Admisión se bloquea sin fecha', () => {
      // Es el paquete de los dos documentos de insolvencia que imprimen
      // FECHA_RADICACION (Designacion del Conciliador, Aceptacion del Cargo):
      // si falta, se abre el formulario del operador en vez de generar.
      expect(DOCUMENTS_SECTION).toContain('!caseData.filingDate');
      expect(DOCUMENTS_SECTION).toContain('setPreGenPackage(2)');
    });
  });
});
