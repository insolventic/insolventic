/**
 * Unit Tests: un correo que no sale deja rastro (R-2).
 *
 * `sendEmail` devuelve `false` en el `catch` y no lanza. Varios llamadores son
 * best-effort y no miran el booleano, así que el único rastro de un aviso que
 * no salió era un `console.error` en los logs de Vercel: nada en Sentry, y
 * ninguna forma de responder "¿le llegó el correo al deudor?" — que en un
 * expediente con términos que corren puede importar (hallazgo R-2 de
 * `docs/AUDITORIA_BLOQUE3_2026-10-27.md`).
 *
 * De paso cierra una fuga chica: el destinatario se imprimía en claro
 * (`console.log('✅ Email sent successfully to:', to)`). Por el logger va bajo
 * la clave `email`, que `redactContext` reemplaza por `[REDACTED]`.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: () => ({
      sendMail: (...args: unknown[]) => mockSendMail(...args),
      verify: jest.fn(),
    }),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { logger } from '@/lib/logger';
import { emailService } from '@/lib/email';

// El modulo esta mockeado para poder afirmar que se registra; `redactContext`
// hace falta de verdad, asi que se trae el real.
const { redactContext } =
  jest.requireActual<typeof import('@/lib/logger')>('@/lib/logger');

const DESTINATARIO = 'deudor@example.com';

describe('emailService — el fallo de envío se reporta', () => {
  const env = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_USER = 'insolventic@example.com';
    process.env.SMTP_PASSWORD = 'app-password-de-prueba';
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('un envío que falla devuelve false Y lo registra por el logger', async () => {
    const fallo = new Error('535 Authentication credentials invalid');
    mockSendMail.mockRejectedValue(fallo);

    const enviado = await emailService.sendPasswordResetEmail(DESTINATARIO, {
      userName: 'Ana',
      resetUrl: 'https://insolventic.vercel.app/reset?token=x',
      expiresInMinutes: 60,
    } as never);

    // El contrato no cambia: sigue devolviendo false sin lanzar.
    expect(enviado).toBe(false);
    // Lo que cambia es que ahora existe para alguien más que la consola.
    expect(logger.error).toHaveBeenCalledWith(
      'No se pudo enviar el correo',
      fallo,
      expect.objectContaining({ action: 'email.send', email: DESTINATARIO }),
    );
  });

  it('un envío exitoso también queda registrado, con el messageId', async () => {
    mockSendMail.mockResolvedValue({ messageId: '<abc@smtp>' });

    const enviado = await emailService.sendPasswordResetEmail(DESTINATARIO, {
      userName: 'Ana',
      resetUrl: 'https://insolventic.vercel.app/reset?token=x',
      expiresInMinutes: 60,
    } as never);

    expect(enviado).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      'Correo enviado',
      expect.objectContaining({
        action: 'email.send',
        email: DESTINATARIO,
        messageId: '<abc@smtp>',
      }),
    );
  });

  it('el destinatario va bajo la clave `email`, que el logger redacta', () => {
    // El test de arriba afirma que el valor se le pasa al logger; este afirma
    // que el logger no lo escribe. Las dos mitades hacen la garantía.
    const redactado = redactContext({
      action: 'email.send',
      email: DESTINATARIO,
    });

    expect(redactado.email).toBe('[REDACTED]');
    expect(JSON.stringify(redactado)).not.toContain('deudor@');
  });
});

describe('emailService — sin SMTP configurado', () => {
  const env = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('en producción es un error operativo, no una simulación', async () => {
    const nodeEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true,
    });

    const enviado = await emailService.sendPasswordResetEmail(DESTINATARIO, {
      userName: 'Ana',
      resetUrl: 'https://insolventic.vercel.app/reset?token=x',
      expiresInMinutes: 60,
    } as never);

    expect(enviado).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'SMTP no configurado: el correo no se envió',
      expect.any(Error),
      expect.objectContaining({ action: 'email.send' }),
    );
    expect(mockSendMail).not.toHaveBeenCalled();

    Object.defineProperty(process.env, 'NODE_ENV', {
      value: nodeEnv,
      configurable: true,
    });
  });

  it('fuera de producción simula el envío y lo dice por `info`, no por `error`', async () => {
    const enviado = await emailService.sendPasswordResetEmail(DESTINATARIO, {
      userName: 'Ana',
      resetUrl: 'https://insolventic.vercel.app/reset?token=x',
      expiresInMinutes: 60,
    } as never);

    expect(enviado).toBe(true);
    // Es el camino esperado en desarrollo: inundar Sentry con esto sería ruido
    // (convención del logger en CLAUDE.md).
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'Correo simulado (SMTP no configurado)',
      expect.objectContaining({ action: 'email.simulate' }),
    );
  });
});
