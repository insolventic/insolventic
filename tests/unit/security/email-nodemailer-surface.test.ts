/**
 * Superficie de nodemailer que este proyecto realmente usa.
 *
 * POR QUÉ EXISTE ESTE TEST. La auditoría de dependencias señaló
 * GHSA-8m3c-c648-2xjj (*"resolveContent() on a MailMessage bypasses
 * disableFileAccess/disableUrlAccess when called with the legacy signature"*)
 * como la única advisory de nodemailer con una ruta de explotación plausible
 * aquí. La conclusión fue que **no es alcanzable** en este código, y el upgrade
 * a 9.1.1 la cerró de todas formas.
 *
 * Lo que este test fija es la **premisa** de esa conclusión, no la conclusión:
 * que `email.ts` sigue mandando correos sin adjuntos, sin contenido por `path`
 * ni por `href`, y sin llamar a `resolveContent`. Si alguien agrega un adjunto
 * mañana, el razonamiento deja de valer — y este test falla, que es
 * exactamente el aviso que haría falta.
 *
 * Es un test de superficie, no de comportamiento: lee el código fuente. Esa
 * es la única forma de afirmar "no usamos esta API" sin montar un servidor
 * SMTP.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RUTA_EMAIL = join(process.cwd(), 'src', 'lib', 'email.ts');
const fuente = readFileSync(RUTA_EMAIL, 'utf8');

describe('src/lib/email.ts — superficie de nodemailer (GHSA-8m3c-c648-2xjj)', () => {
  it('no llama a resolveContent', () => {
    // La API vulnerable. El proyecto nunca la invoca directamente.
    expect(fuente).not.toContain('resolveContent');
  });

  it('no manda adjuntos', () => {
    // `disableFileAccess` / `disableUrlAccess` solo importan cuando el mensaje
    // lleva contenido que referencia un archivo o una URL. Sin adjuntos, la
    // opción no tiene nada que proteger y el bypass no tiene qué puentear.
    expect(fuente).not.toMatch(/\battachments\b/);
  });

  it('no usa contenido por `path` ni por `href`', () => {
    // Las dos formas con las que nodemailer lee un archivo local o una URL
    // remota para incrustarla en el mensaje.
    expect(fuente).not.toMatch(/^\s*path:/m);
    expect(fuente).not.toMatch(/^\s*href:/m);
  });

  it('solo usa createTransport y sendMail', () => {
    const llamadas = [...fuente.matchAll(/nodemailer\.(\w+)/g)].map((m) => m[1]);
    // `createTransport` para construirlo y `Transporter` como tipo.
    expect(new Set(llamadas)).toEqual(new Set(['createTransport', 'Transporter']));
    expect(fuente).toContain('sendMail(');
  });

  it('el cuerpo del mensaje son solo los campos de texto', () => {
    // El objeto que se le pasa a sendMail: from / to / subject / text / html.
    // Nada que nodemailer tenga que "resolver" leyendo del disco o de la red.
    const sendMail = fuente.slice(fuente.indexOf('sendMail('));
    const cuerpo = sendMail.slice(0, sendMail.indexOf('});'));
    for (const clave of ['from', 'to', 'subject', 'text', 'html']) {
      expect(cuerpo).toContain(clave);
    }
    for (const prohibida of ['attachments', 'alternatives', 'raw', 'icalEvent']) {
      expect(cuerpo).not.toContain(prohibida);
    }
  });

  it('nodemailer está en 9.1.1 o superior (cierra la advisory de resolveContent)', () => {
    // La advisory cubre `<9.1.0`. `npm audit fix` subió 9.0.3 -> 9.1.1 sin
    // cambiar el rango `^9.0.3` de package.json.
    const version = require('nodemailer/package.json').version as string;
    const [major, minor] = version.split('.').map(Number);
    expect(major).toBeGreaterThanOrEqual(9);
    if (major === 9) expect(minor).toBeGreaterThanOrEqual(1);
  });
});
