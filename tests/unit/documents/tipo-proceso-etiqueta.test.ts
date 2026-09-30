/**
 * `TIPO_PROCESO` imprime la etiqueta del tipo de proceso, no el valor guardado.
 *
 * HALLAZGO (2026-09-30, encontrado al implementar el oficio por juzgado): los
 * tipos de proceso se persisten como código —`RESTITUCION_INMUEBLE`,
 * `CIVIL_ALIMENTOS`, `OTROS`— desde que la abogada fijó la lista única
 * (`proceso-judicial-tipos.ts`). `mapExternalEntities` ponía ese valor crudo en
 * el placeholder, así que el oficio que lee el juzgado y la remisión de
 * resultado —las dos plantillas que usan `{{TIPO_PROCESO}}`— salían con el
 * código en pantalla. Peor en `OTROS`: el documento decía literalmente «OTROS»
 * y descartaba el texto libre que el operador había escrito.
 *
 * El helper `tipoProcesoLabel` ya existía para esto y lo usa la UI; el mapper
 * no lo llamaba. Los valores de las nomenclaturas viejas (filas guardadas antes
 * de la lista única) se devuelven tal cual, así que ningún expediente ya
 * generado cambia de contenido.
 */

import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';
import { TIPOS_PROCESO_JUDICIAL } from '@/features/case/proceso-judicial-tipos';

const makeCase = (legalProcesses: Record<string, unknown>[]) =>
  ({
    type: 'INSOLVENCY',
    caseNumber: 'INS-2026-030',
    debtor: {
      name: 'Ana Torres',
      idNumber: '987654321',
      address: 'Calle 8 # 3-20',
      city: 'Bogotá',
      email: 'ana@example.com',
      phone: '3001112222',
      occupation: 'Comerciante',
    },
    debts: [],
    assets: [],
    documents: [],
    legalProcesses,
    libranzas: [],
    suspendedServices: [],
    dependents: [],
    causes: [],
    applicantScope: [],
    operator: null,
  }) as never;

describe('TIPO_PROCESO — etiqueta, no código', () => {
  // Menos «Otros», que tiene su propio caso: la etiqueta genérica no se usa
  // cuando hay texto libre.
  const CON_ETIQUETA_FIJA = TIPOS_PROCESO_JUDICIAL.filter(
    (t) => t.value !== 'OTROS',
  );

  it.each(CON_ETIQUETA_FIJA.map((t) => [t.value, t.label]))(
    '%s se imprime como "%s"',
    (value, label) => {
      const p = mapCaseToPlaceholders(
        makeCase([{ court: 'Juzgado 1', processType: value }]),
      );

      expect(p.TIPO_PROCESO).toBe(label);
    },
  );

  it('en "Otros" imprime el texto libre del operador, no la palabra OTROS', () => {
    const p = mapCaseToPlaceholders(
      makeCase([
        {
          court: 'Juzgado 1',
          processType: 'OTROS',
          processTypeOther: 'Proceso monitorio',
        },
      ]),
    );

    expect(p.TIPO_PROCESO).toBe('Proceso monitorio');
  });

  it('en "Otros" sin texto libre cae a la etiqueta genérica, no al código', () => {
    const p = mapCaseToPlaceholders(
      makeCase([{ court: 'Juzgado 1', processType: 'OTROS' }]),
    );

    expect(p.TIPO_PROCESO).toBe('Otros');
  });

  it('un valor de las nomenclaturas viejas se devuelve tal cual: los expedientes ya generados no cambian', () => {
    const p = mapCaseToPlaceholders(
      makeCase([{ court: 'Juzgado 1', processType: 'Ejecutivo singular' }]),
    );

    expect(p.TIPO_PROCESO).toBe('Ejecutivo singular');
  });

  it('sin procesos judiciales queda vacío, como antes', () => {
    expect(mapCaseToPlaceholders(makeCase([])).TIPO_PROCESO).toBe('');
  });
});
