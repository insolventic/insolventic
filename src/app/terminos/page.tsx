import { LegalPageLayout } from '@/components/legal/legal-page-layout';

export default function TerminosPage() {
  return (
    <LegalPageLayout
      title="Términos de uso para operadores"
      lastUpdated="2026-10-17"
    >
      <p>
        Estos términos rigen el uso de INSOLVENTIC por parte de los
        operadores, abogados y demás usuarios internos de un centro de
        conciliación. No aplican a deudores ni a acreedores: ellos no tienen
        cuenta en el sistema.
      </p>

      <h2>1. Quién puede usar el sistema</h2>
      <p>
        El acceso es por invitación: cada cuenta la crea el administrador
        del centro al que pertenece el operador. El registro público está
        cerrado — no es posible crear una cuenta propia desde la página de
        inicio de sesión.
      </p>

      <h2>2. Uso de la cuenta</h2>
      <ul>
        <li>
          La cuenta es personal e intransferible. No comparta su contraseña
          ni permita que otra persona use su sesión.
        </li>
        <li>
          La sesión se cierra automáticamente tras un período de
          inactividad, por seguridad.
        </li>
        <li>
          Todo lo que haga con su cuenta —crear, editar o eliminar un
          expediente, generar un documento, cambiar la fase de un trámite—
          queda registrado con su nombre en el registro de auditoría del
          centro.
        </li>
      </ul>

      <h2>3. Confidencialidad de los datos de los expedientes</h2>
      <p>
        Los expedientes contienen datos personales y financieros de
        deudores y acreedores (ver la{' '}
        <a href="/privacidad" className="text-primary hover:underline">
          política de privacidad
        </a>
        ). El operador se compromete a:
      </p>
      <ul>
        <li>
          Usar esos datos únicamente para el trámite del expediente al que
          corresponden.
        </li>
        <li>
          No extraer, copiar ni compartir esos datos fuera del sistema, salvo
          que el trámite mismo lo requiera (por ejemplo, al generar y
          entregar un documento del expediente a quien corresponde
          recibirlo).
        </li>
        <li>
          No acceder a un expediente que no le haya sido asignado o que no
          necesite consultar para su trabajo.
        </li>
      </ul>

      <h2>4. Aislamiento entre centros</h2>
      <p>
        Cada operador solo ve los expedientes de su propio centro de
        conciliación. El sistema separa técnicamente los datos de cada
        centro; un operador no puede acceder, por ningún medio previsto en
        el sistema, a los expedientes de otro centro.
      </p>

      <h2>5. Los documentos que genera el sistema</h2>
      <p>
        El sistema genera los documentos propios de cada etapa del trámite
        a partir de los datos registrados en el expediente. Es
        responsabilidad del operador revisar que esos datos estén completos
        y correctos antes de usar el documento generado — el sistema no
        reemplaza el criterio profesional del operador ni valida el
        contenido jurídico del documento.
      </p>

      <h2>6. Disponibilidad y responsabilidad</h2>
      <p>
        INSOLVENTIC es una herramienta de apoyo para la gestión de
        expedientes; se ofrece &ldquo;tal cual&rdquo;, sin garantía de disponibilidad
        ininterrumpida. Las decisiones del trámite, y la responsabilidad
        legal sobre ellas, corresponden al centro de conciliación y a sus
        operadores — nunca a la plataforma.
      </p>

      <h2>7. Modificaciones</h2>
      <p>
        Estos términos pueden actualizarse; la fecha de &ldquo;Última
        actualización&rdquo; al inicio de esta página indica la versión vigente.
      </p>
    </LegalPageLayout>
  );
}
