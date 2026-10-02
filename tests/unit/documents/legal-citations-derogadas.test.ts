/**
 * Ítem 7 de la lista verificada de la auditoría transversal: citas a normas
 * derogadas en las plantillas HTML. La Ley 640 de 2001 (conciliación
 * extrajudicial) fue derogada por la Ley 2220 de 2022, que no se cita.
 *
 * Esta cláusula de registro ("...en los términos que contempla el artículo 14
 * de la ley 640 del 2001...") aparece en 4 plantillas. Solo la del Acta de
 * Disolución de Unión Marital tiene el visto bueno de la abogada para
 * corregirse (confirmado fuera de `docs/PENDIENTES_DECISION_LEGAL.md`,
 * previo a su creación). Las otras 3 — dos de insolvencia y una de
 * support-agreements — quedan documentadas como pregunta abierta en ese
 * archivo (§3) y NO se tocan sin su respuesta. Este test fija ambos lados:
 * que la corregida cambió, y que las pendientes siguen intactas (para que
 * nadie las toque sin pasar por el documento de pendientes).
 */

import { readFileSync } from 'fs';
import path from 'path';

const read = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), relativePath), 'utf-8');

describe('Acta Disolución Unión Marital — cita corregida (aprobado por la abogada)', () => {
  const content = read(
    'templates/conciliation/Actas de Conciliacion/Acta Disolucion Union Marital.html',
  );

  it('ya no cita la Ley 640 de 2001 (derogada)', () => {
    expect(content).not.toContain('Ley 640');
  });

  it('cita la Ley 2220 de 2022 (norma vigente), igual que sus hermanas', () => {
    expect(content).toMatch(/Ley 2220 de\s+2022/);
  });
});

describe('Citas a la Ley 640/2001 pendientes de confirmación — NO tocar sin pasar por docs/PENDIENTES_DECISION_LEGAL.md', () => {
  it('Acuerdo de Pago Tramite.html sigue citando el art. 14 de la Ley 640/2001', () => {
    const content = read(
      'templates/insolvency/Tipo de Acuerdo/Acuerdo de Pago Tramite.html',
    );
    expect(content).toContain('ley 640 del 2001');
  });

  it('Acuerdo Bilateral Tramite.html sigue citando el art. 14 de la Ley 640/2001', () => {
    const content = read(
      'templates/insolvency/Tipo de Acuerdo/Acuerdo Bilateral Tramite.html',
    );
    expect(content).toContain('ley 640 del 2001');
  });

  it('Constancia de Incumplimiento Acuerdo de Apoyo.html sigue citando el art. 2 de la Ley 640/2001', () => {
    const content = read(
      'templates/support-agreements/Constancia de Incumplimiento Acuerdo de Apoyo.html',
    );
    expect(content).toContain('Ley 640 de 2001');
  });
});
