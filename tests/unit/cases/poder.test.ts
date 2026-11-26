/**
 * El Poder en dos piezas: estado Completo/Incompleto, el anexo único anterior
 * cuenta como "poder firmado", y para crear el caso basta una pieza.
 */
import {
  ID_PODER,
  ID_PODER_CAPTURA_CORREO,
  ID_PODER_FIRMADO,
  NOMBRE_PODER_ANEXO_UNICO,
  PIEZAS_PODER,
  cumpleRequisitoPoder,
  estadoDelPoder,
} from '@/features/case/poder';
import {
  CONDITIONAL_DOCUMENTS,
  validateDocumentsComplete,
} from '@/features/case/validation-rules';

const [CAPTURA, FIRMADO] = PIEZAS_PODER;
const doc = (name: string) => ({ name, url: `https://drive/${name}` });

describe('piezas del Poder', () => {
  it('son dos, en este orden, con ayuda marcada para validar con el abogado', () => {
    expect(PIEZAS_PODER.map((p) => p.id)).toEqual([
      ID_PODER_CAPTURA_CORREO,
      ID_PODER_FIRMADO,
    ]);
    for (const p of PIEZAS_PODER) {
      expect(p.ayuda).toMatch(/\[VALIDAR CON ABOGADO/);
    }
  });

  it('el requisito de grupo conserva el nombre del anexo único anterior', () => {
    expect(CONDITIONAL_DOCUMENTS.find((d) => d.id === ID_PODER)?.name).toBe(
      NOMBRE_PODER_ANEXO_UNICO,
    );
  });
});

describe('estadoDelPoder', () => {
  it('sin nada: incompleto', () => {
    expect(estadoDelPoder([])).toMatchObject({
      tieneCaptura: false,
      tieneFirmado: false,
      completo: false,
    });
  });

  it('una sola pieza: incompleto', () => {
    expect(estadoDelPoder([doc(CAPTURA.nombre)]).completo).toBe(false);
    expect(estadoDelPoder([doc(FIRMADO.nombre)]).completo).toBe(false);
  });

  it('las dos piezas: completo', () => {
    expect(
      estadoDelPoder([doc(CAPTURA.nombre), doc(FIRMADO.nombre)]).completo,
    ).toBe(true);
  });

  it('el anexo único anterior cuenta como poder firmado y sigue listado', () => {
    const e = estadoDelPoder([
      doc(NOMBRE_PODER_ANEXO_UNICO),
      doc('Cédula de ciudadanía'),
    ]);
    expect(e.tieneFirmado).toBe(true);
    expect(e.firmadoAnterior).toEqual([doc(NOMBRE_PODER_ANEXO_UNICO)]);
    expect(e.completo).toBe(false);
    expect(
      estadoDelPoder([doc(NOMBRE_PODER_ANEXO_UNICO), doc(CAPTURA.nombre)])
        .completo,
    ).toBe(true);
  });

  it('documentos de otro tipo no cuentan', () => {
    expect(
      estadoDelPoder([doc('Cédula de ciudadanía del apoderado')]).tieneFirmado,
    ).toBe(false);
  });
});

describe('requisito para crear el caso', () => {
  it('basta una pieza, o el anexo único anterior', () => {
    expect(cumpleRequisitoPoder([])).toBe(false);
    expect(cumpleRequisitoPoder([ID_PODER_CAPTURA_CORREO])).toBe(true);
    expect(cumpleRequisitoPoder([ID_PODER_FIRMADO])).toBe(true);
    expect(cumpleRequisitoPoder([ID_PODER])).toBe(true);
  });

  const conPoderOtorgado = {
    apoderados: [{ nombreCompleto: 'Ana Torres', existePoderOtorgado: true }],
  } as Parameters<typeof validateDocumentsComplete>[1];
  const base = [
    'cedula',
    'redam',
    'cert_ingresos',
    'cedula_apoderado',
    'tarjeta_profesional_apoderado',
  ];

  it('validateDocumentsComplete: sin piezas falta el poder', () => {
    const r = validateDocumentsComplete(base, conPoderOtorgado);
    expect(r.isValid).toBe(false);
    expect(r.missingDocuments.map((d) => d.id)).toEqual([ID_PODER]);
  });

  it.each([[ID_PODER_CAPTURA_CORREO], [ID_PODER_FIRMADO]])(
    'validateDocumentsComplete: con %s ya no falta',
    (pieza) => {
      expect(
        validateDocumentsComplete([...base, pieza], conPoderOtorgado).isValid,
      ).toBe(true);
    },
  );
});
