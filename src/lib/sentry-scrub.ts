/**
 * Redacción compartida para los `beforeSend` de Sentry (client/server/edge).
 * Pura y sin dependencias: segura para el runtime edge.
 *
 * Genérica sobre el tipo de evento (client y server usan tipos distintos de
 * `ErrorEvent`), con guards en runtime en lugar de asumir la forma exacta.
 */

const SENSITIVE_QUERY_PARAMS =
  /(token|secret|password|apikey|api_key|code)=([^&#]+)/gi;
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key'];

/**
 * Claves cuyo VALOR se redacta dentro de texto libre (mensajes de excepción,
 * breadcrumbs, `extra`) — a diferencia de `logger.ts` (`isSensitiveKey`), que
 * redacta por SUBCADENA sobre objetos ya estructurados, acá el texto es
 * libre: el pretty-print de un `PrismaClientValidationError` imprime el
 * payload completo de la operación como `clave: "valor"` (confirmado contra
 * un error real — ver PR de este cambio). Redactar por subcadena sobre texto
 * así de denso golpearía `fileName`/`templateName`/`documentName` (contienen
 * "name" pero no son datos personales) sin ganar nada, porque esos valores
 * nunca aparecen en este formato `clave: "valor"` en primer lugar (se arman
 * con interpolación de texto libre, ver `google-drive.ts`). Por eso la
 * comparación es por clave EXACTA (case-insensitive) contra esta lista, no
 * por `.includes()`.
 *
 * Derivada de los campos de `schema.prisma` que son nombres/apellidos,
 * correos, teléfonos o identificaciones de una persona (deudor, cónyuge,
 * acreedor, apoderado, conciliador, convocante/convocado, etc.) — excluye a
 * propósito nombres de ARCHIVOS/PLANTILLAS/ENTIDADES (`fileName`,
 * `documentName`, `templateName`, `receiptFileName`, `driveFolderName`,
 * `bankName`, `juzgadoNombre`, `centroConciliacionNombre`, `entityName`).
 */
const SENSITIVE_TEXT_KEYS = new Set(
  [
    'password',
    'secret',
    'token',
    'apikey',
    'api_key',
    'authorization',
    'cookie',
    'zoomPassword',
    // Genéricos
    'name',
    'nombre',
    'email',
    'correo',
    'phone',
    'telefono',
    'celular',
    'cedula',
    'idnumber',
    'identificacion',
    // Deudor
    'debtorName',
    'deudorNombreCompleto',
    'deudorPrimerNombre',
    'deudorSegundoNombre',
    'deudorPrimerApellido',
    'deudorSegundoApellido',
    'deudorCorreoElectronico',
    'deudorTelefonoFijo',
    'deudorTelefonoCelular',
    'deudorIdentificacion',
    'deudorTipoIdentificacion',
    'deudorNombreEmpleador',
    'coDebtorName',
    // Cónyuge
    'conyugeNombreCompleto',
    'conyugePrimerNombre',
    'conyugeSegundoNombre',
    'conyugePrimerApellido',
    'conyugeSegundoApellido',
    'conyugeCorreo',
    'conyugeTelefono',
    'conyugeIdentificacion',
    'conyugeTipoIdentificacion',
    'spouseName',
    'spouseEmail',
    'spousePhone',
    // Acreedor / apoderado
    'creditorName',
    'creditorEmail',
    'acreedorNombreRazonSocial',
    'acreedorCorreo',
    'acreedorTelefono',
    'acreedorIdentificacion',
    'acreedorTipoIdentificacion',
    'apoderadoNombreCompleto',
    'apoderadoCorreo',
    'apoderadoTelefono',
    'apoderadoIdentificacion',
    'apoderadoTipoIdentificacion',
    // Conciliación
    'concConvocanteName',
    'concConvocanteCorreo',
    'concConvocadoName',
    'concConvocadoCorreo',
    'concRepLegalName',
    'concRepLegalCorreo',
    'concApoderadoConvocanteName',
    'concApoderadoConvocanteCorreo',
    'concApoderadoConvocadoName',
    'concApoderadoConvocadoCorreo',
    'concConciliadoraName',
    'concNombreMenor',
    'demandanteNombre',
    'demandadoNombre',
    // Acuerdo de apoyo
    'apoyoBeneficiarioName',
    'apoyoBeneficiarioCorreo',
    'apoyoPrestadorName',
    'apoyoPrestadorCorreo',
    'apoyoConciliadoraName',
    // Firma / registro / pagos
    'applicantSignatureName',
    'representativeEmail',
    'representativePhone',
    'registeredByName',
    'payerName',
    'payerEmail',
    'payerPhone',
    'notificationEmail',
    'notificationPhone',
    'emergencyPhone',
    'userCedula',
    'nombreCodeudores',
  ].map((k) => k.toLowerCase()),
);

// `clave: "valor"` o `clave: 'valor'` — el pretty-print de Prisma (y JSON.stringify)
// citan strings así; no toca valores sin comillas (números, booleans, tipos
// sugeridos con `?`) porque esos no son el dato en sí.
const KEY_VALUE_PATTERN =
  /([A-Za-z_][A-Za-z0-9_]*)(\s*:\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;

/** Redacta los valores de `SENSITIVE_TEXT_KEYS` dentro de un texto libre. */
export function scrubSensitiveText(text: string): string {
  return text.replace(KEY_VALUE_PATTERN, (match, key: string, sep: string) =>
    SENSITIVE_TEXT_KEYS.has(key.toLowerCase())
      ? `${key}${sep}"[REDACTED]"`
      : match,
  );
}

function scrubStructured(value: unknown): unknown {
  if (typeof value === 'string') return scrubSensitiveText(value);
  if (Array.isArray(value)) return value.map(scrubStructured);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_TEXT_KEYS.has(k.toLowerCase())
        ? '[REDACTED]'
        : scrubStructured(v);
    }
    return out;
  }
  return value;
}

/**
 * Elimina cookies, headers de auth y parámetros sensibles de la URL, y
 * redacta datos personales embebidos en el texto de excepciones, breadcrumbs
 * y `extra` antes de que el evento salga hacia Sentry. Devuelve el mismo
 * evento (mutado).
 */
export function scrubSentryEvent<T>(event: T): T {
  const req = (
    event as {
      request?: {
        url?: unknown;
        query_string?: unknown;
        cookies?: unknown;
        headers?: unknown;
      };
    }
  ).request;
  if (req) {
    if (typeof req.url === 'string') {
      req.url = req.url.replace(SENSITIVE_QUERY_PARAMS, '$1=[REDACTED]');
    }
    if (typeof req.query_string === 'string') {
      req.query_string = req.query_string.replace(
        SENSITIVE_QUERY_PARAMS,
        '$1=[REDACTED]',
      );
    }
    if (req.cookies && typeof req.cookies === 'object') {
      req.cookies = {};
    }
    if (req.headers && typeof req.headers === 'object') {
      const headers = req.headers as Record<string, unknown>;
      for (const header of SENSITIVE_HEADERS) {
        if (headers[header] !== undefined) headers[header] = '[REDACTED]';
      }
    }
  }

  const e = event as {
    message?: unknown;
    exception?: { values?: Array<{ value?: unknown }> };
    breadcrumbs?: Array<{ message?: unknown; data?: unknown }>;
    extra?: unknown;
  };

  if (typeof e.message === 'string') {
    e.message = scrubSensitiveText(e.message);
  }

  if (Array.isArray(e.exception?.values)) {
    for (const ex of e.exception.values) {
      if (typeof ex.value === 'string') ex.value = scrubSensitiveText(ex.value);
    }
  }

  if (Array.isArray(e.breadcrumbs)) {
    for (const crumb of e.breadcrumbs) {
      if (typeof crumb.message === 'string') {
        crumb.message = scrubSensitiveText(crumb.message);
      }
      if (crumb.data && typeof crumb.data === 'object') {
        crumb.data = scrubStructured(crumb.data);
      }
    }
  }

  if (e.extra && typeof e.extra === 'object') {
    e.extra = scrubStructured(e.extra);
  }

  return event;
}
