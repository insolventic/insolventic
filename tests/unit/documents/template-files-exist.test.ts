/**
 * Invariante de plantillas (P9, Quick Win pendiente en CLAUDE.md): cada
 * entrada de ALL_TEMPLATES debe apuntar a un archivo que existe en disco.
 *
 * Nace del bug real de #40: templates-config.ts reclasificó
 * 'rechazo-inasistencia' -> 'inasistencia-deudor' (folderPath incluido), pero
 * el archivo físico se quedó en la carpeta vieja. El golden master
 * (mapper-golden.test.ts) ya calcula fs.existsSync por plantilla, pero solo
 * para diffear contra un baseline committeado — si el baseline se regenera
 * aceptando 'ARCHIVO-NO-ENCONTRADO', el test queda verde para siempre. Este
 * test falla siempre que falte un archivo, sin depender de ningún baseline.
 */
import fs from 'fs';
import path from 'path';

import {
  ALL_TEMPLATES,
  getTemplatePath,
} from '@/features/document/templates-config';

describe('cada plantilla registrada apunta a un archivo que existe', () => {
  it.each(ALL_TEMPLATES.map((t) => [t.caseType, t.id, t] as const))(
    '%s/%s',
    (_caseType, _id, template) => {
      const file = path.join(process.cwd(), getTemplatePath(template));
      expect(fs.existsSync(file)).toBe(true);
    },
  );
});
