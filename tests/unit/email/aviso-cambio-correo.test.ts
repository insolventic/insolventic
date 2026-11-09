/**
 * El aviso de cambio de correo lleva un nombre que escribe quien edita. Esa
 * persona es justo de quien el aviso protege, así que el nombre no puede meter
 * HTML ni enlaces en el correo que recibe el titular.
 */

import { emailService } from '@/lib/email';

interface Correo {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const servicio = emailService as unknown as {
  sendEmail: (correo: Correo) => Promise<boolean>;
};

describe('sendEmailChangedNotice', () => {
  let enviar: jest.SpyInstance<Promise<boolean>, [Correo]>;
  const fecha = new Date('2026-11-04T23:30:00.000Z');

  beforeEach(() => {
    enviar = jest.spyOn(servicio, 'sendEmail').mockResolvedValue(true);
  });

  afterEach(() => {
    enviar.mockRestore();
  });

  it('se envía a la dirección anterior con quién hizo el cambio', async () => {
    const enviado = await emailService.sendEmailChangedNotice(
      'anterior@centroejemplo.test',
      { changedBy: 'Liliana Arango', date: fecha },
    );

    expect(enviado).toBe(true);
    const [correo] = enviar.mock.calls[0];
    expect(correo.to).toBe('anterior@centroejemplo.test');
    expect(correo.html).toContain('Liliana Arango');
    expect(correo.text).toContain('Liliana Arango');
  });

  it('muestra la hora de Colombia, no la del servidor', async () => {
    await emailService.sendEmailChangedNotice('anterior@centroejemplo.test', {
      changedBy: 'Liliana Arango',
      date: fecha,
    });

    const [correo] = enviar.mock.calls[0];
    expect(correo.text).toContain('04/11/2026');
    expect(correo.text).toContain('18:30');
  });

  it('escapa el nombre en el HTML', async () => {
    await emailService.sendEmailChangedNotice('anterior@centroejemplo.test', {
      changedBy: '<a href="https://ejemplo.test">Soporte</a>',
      date: fecha,
    });

    const [correo] = enviar.mock.calls[0];
    expect(correo.html).not.toContain('<a href="https://ejemplo.test">');
    expect(correo.html).toContain('&lt;a href=');
  });

  it('devuelve false si el envío falla', async () => {
    enviar.mockResolvedValue(false);

    await expect(
      emailService.sendEmailChangedNotice('anterior@centroejemplo.test', {
        changedBy: 'Liliana Arango',
        date: fecha,
      }),
    ).resolves.toBe(false);
  });
});
