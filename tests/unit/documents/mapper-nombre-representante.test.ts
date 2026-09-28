/**
 * NOMBRE_REPRESENTANTE (parte del Hallazgo 5, PR #43).
 *
 * "Auto Solicitud por Incumplimiento.html" pide {{NOMBRE_REPRESENTANTE}} junto a
 * {{NOMBRE_ACREEDOR}} ("el acreedor X, representado por el Dr. Y"). El mapper
 * nunca produjo esa clave — SOLO produce NOMBRE_REPRESENTANTE_LEGAL, pero esa es
 * otra cosa: sale de mapConciliationFields (columnas conc_rep_legal_*, el
 * representante legal del convocante/convocado en una CONCILIACIÓN) y ni
 * siquiera se calcula para casos de tipo INSOLVENCY — la plantilla en cuestión
 * es de insolvencia. No son el mismo dato con nombre distinto: son dos conceptos
 * distintos (representante del acreedor que reporta el incumplimiento vs.
 * representante legal de una parte en conciliación). Unificarlos hubiera dejado
 * el placeholder igual de vacío.
 *
 * El dato SÍ existe en el schema: Creditor.representative — ya usado por NOMBRE_ACREEDOR
 * (mismo acreedor, `caseData.debts?.[0]?.creditor`), nunca leído para el nombre
 * del representante. Fix: agregar NOMBRE_REPRESENTANTE desde ese mismo campo.
 */
import fs from 'fs';
import path from 'path';

import {
  mapCaseToPlaceholders,
  renderDocumentHtml,
} from '@/features/document/placeholder-mapper';

import { SCENARIOS } from '../../helpers/mapper-scenarios';

const TEMPLATE_PATH = path.join(
  process.cwd(),
  'templates/insolvency/Solicitud de Incumplimiento del Acuerdo/Auto Solicitud por Incumplimiento.html',
);

describe('NOMBRE_REPRESENTANTE — representante del acreedor (Hallazgo 5)', () => {
  it('NOMBRE_REPRESENTANTE_LEGAL no es el mismo concepto: no lo calcula el mapper para insolvencia', () => {
    const p = mapCaseToPlaceholders(
      SCENARIOS['insolvencia-completa'].build() as never,
    );
    expect(p.NOMBRE_REPRESENTANTE_LEGAL).toBeUndefined();
  });

  it('sale el representante del MISMO acreedor que NOMBRE_ACREEDOR', () => {
    const caseData = SCENARIOS['insolvencia-completa'].build() as never;
    const p = mapCaseToPlaceholders(caseData);
    const firstCreditor = (
      caseData as {
        debts: { creditor: { name: string; representative: string } }[];
      }
    ).debts[0].creditor;
    expect(p.NOMBRE_ACREEDOR).toBe(firstCreditor.name);
    expect(p.NOMBRE_REPRESENTANTE).toBe(firstCreditor.representative);
  });

  it('la plantilla real ya no queda con el placeholder sin resolver', () => {
    const html = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const p = mapCaseToPlaceholders(
      SCENARIOS['insolvencia-completa'].build() as never,
    );
    const { unresolved, html: rendered } = renderDocumentHtml(html, p);
    expect(unresolved).not.toContain('NOMBRE_REPRESENTANTE');
    expect(rendered).not.toContain('«FALTA: NOMBRE_REPRESENTANTE»');
    expect(rendered).toContain(
      (p.NOMBRE_REPRESENTANTE as string) ?? '__nunca__',
    );
  });
});
