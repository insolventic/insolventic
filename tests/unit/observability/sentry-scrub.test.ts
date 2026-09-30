/**
 * scrubSentryEvent: además de `event.request` (cookies/headers/query),
 * ahora redacta datos personales embebidos en el TEXTO de excepciones,
 * breadcrumbs y `extra`.
 *
 * El caso real que motiva esto: un `PrismaClientValidationError` imprime el
 * payload completo de la operación fallida (pretty-print con `clave: "valor"`)
 * — así se vieron nombres, teléfonos y correos en la terminal el día del
 * incidente de `notificationCity`. Ese mismo texto viajaba sin tocar a
 * Sentry vía `logger.error` -> `Sentry.captureException(err, ...)`, porque
 * el `beforeSend` compartido solo tocaba `event.request`.
 *
 * El mensaje de abajo es el texto REAL que produce Prisma (capturado contra
 * una base Postgres real con un `update` que declara `thisFieldDoesNotExist`,
 * no escrito a mano) — confirma que el formato es `clave: "valor"` por línea,
 * y que las sugerencias de tipo (`?   campo?: String | ...`) no llevan
 * comillas, así que el redactor no las toca.
 */
import { scrubSentryEvent } from '@/lib/sentry-scrub';

const REAL_PRISMA_VALIDATION_ERROR = `
Invalid \`prisma.debtor.update()\` invocation in
/app/scratch.ts:7:25

  4
  5 async function main() {
  6   try {
→ 7     await prisma.debtor.update({
          where: {
            id: "x"
          },
          data: {
            name: "Juan Pérez",
            phone: "3001234567",
            email: "juan@example.com",
            thisFieldDoesNotExist: "boom",
            ~~~~~~~~~~~~~~~~~~~~~
        ?   idNumber?: String | StringFieldUpdateOperationsInput,
        ?   address?: String | StringFieldUpdateOperationsInput
          }
        })

Unknown argument \`thisFieldDoesNotExist\`. Available options are marked with ?.`;

function makeExceptionEvent(message: string) {
  return {
    exception: {
      values: [{ type: 'PrismaClientValidationError', value: message }],
    },
  };
}

describe('scrubSentryEvent — texto de excepciones', () => {
  it('redacta nombre, teléfono y correo de un error de validación de Prisma real', () => {
    const event = makeExceptionEvent(REAL_PRISMA_VALIDATION_ERROR);
    const scrubbed = scrubSentryEvent(event) as typeof event;
    const text = scrubbed.exception.values[0].value;

    expect(text).not.toContain('Juan Pérez');
    expect(text).not.toContain('3001234567');
    expect(text).not.toContain('juan@example.com');
    expect(text).toContain('name: "[REDACTED]"');
    expect(text).toContain('phone: "[REDACTED]"');
    expect(text).toContain('email: "[REDACTED]"');

    // El resto del mensaje (útil para depurar el bug real) sigue intacto.
    expect(text).toContain('Unknown argument `thisFieldDoesNotExist`');
    expect(text).toContain('id: "x"');
  });

  it('un error con nombre de plantilla queda intacto (no es dato personal)', () => {
    const message =
      'Error generando documento: templateName: "Auto de Admisión", documentName: "Auto_Admision_INS-2026-001.pdf", fileName: "plantilla.html"';
    const event = makeExceptionEvent(message);
    const scrubbed = scrubSentryEvent(event) as typeof event;

    expect(scrubbed.exception.values[0].value).toBe(message);
  });

  it('no confunde fileName con name por subcadena (match es por clave exacta)', () => {
    const message = 'fileName: "Cedula_Maria_Gomez.pdf", name: "Maria Gómez"';
    const event = makeExceptionEvent(message);
    const scrubbed = scrubSentryEvent(event) as typeof event;
    const text = scrubbed.exception.values[0].value;

    // El nombre real (clave "name") se redacta...
    expect(text).toContain('name: "[REDACTED]"');
    // ...pero el nombre de archivo (clave "fileName") no.
    expect(text).toContain('fileName: "Cedula_Maria_Gomez.pdf"');
  });

  it('redacta event.message (captureMessage) igual que exception.values', () => {
    const event = { message: 'Fallo con email: "ana@example.com"' };
    const scrubbed = scrubSentryEvent(event) as typeof event;
    expect(scrubbed.message).toBe('Fallo con email: "[REDACTED]"');
  });

  it('redacta breadcrumbs (message y data)', () => {
    const event = {
      breadcrumbs: [
        { message: 'Buscando deudor con email: "juan@example.com"' },
        { data: { name: 'Juan Pérez', requestId: 'req-1', apikey: 'abc' } },
      ],
    };
    const scrubbed = scrubSentryEvent(event) as typeof event;

    expect(scrubbed.breadcrumbs![0].message).toBe(
      'Buscando deudor con email: "[REDACTED]"',
    );
    expect(scrubbed.breadcrumbs![1].data).toEqual({
      name: '[REDACTED]',
      requestId: 'req-1',
      apikey: '[REDACTED]',
    });
  });

  it('redacta extra (recursivo, por clave y por texto embebido)', () => {
    const event = {
      extra: {
        requestId: 'req-1',
        payload: { email: 'juan@example.com', city: 'Bogotá' },
        rawMessage: 'email: "juan@example.com"',
      },
    };
    const scrubbed = scrubSentryEvent(event) as typeof event;

    expect(scrubbed.extra).toEqual({
      requestId: 'req-1',
      payload: { email: '[REDACTED]', city: 'Bogotá' },
      rawMessage: 'email: "[REDACTED]"',
    });
  });

  it('sigue redactando cookies/headers/query params de event.request (comportamiento previo)', () => {
    const event = {
      request: {
        url: 'https://app.test/x?token=abc123&other=1',
        cookies: { session: 'xyz' },
        headers: { authorization: 'Bearer xyz', 'x-custom': 'ok' },
      },
    };
    const scrubbed = scrubSentryEvent(event) as typeof event;

    expect(scrubbed.request.url).toBe(
      'https://app.test/x?token=[REDACTED]&other=1',
    );
    expect(scrubbed.request.cookies).toEqual({});
    expect(scrubbed.request.headers).toEqual({
      authorization: '[REDACTED]',
      'x-custom': 'ok',
    });
  });

  it('no explota con un evento vacío o sin las formas esperadas', () => {
    expect(() => scrubSentryEvent({})).not.toThrow();
    expect(() => scrubSentryEvent({ exception: {} })).not.toThrow();
    expect(() => scrubSentryEvent({ breadcrumbs: [{}] })).not.toThrow();
  });
});
