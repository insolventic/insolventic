import { LegalPageLayout, Completar } from '@/components/legal/legal-page-layout';

export default function PrivacidadPage() {
  return (
    <LegalPageLayout
      title="Política de tratamiento de datos personales"
      lastUpdated="2026-10-17"
    >
      <p>
        Esta política describe cómo INSOLVENTIC —el sistema de gestión de
        expedientes de insolvencia, conciliación y acuerdos de apoyo usado
        por los centros de conciliación identificados más abajo— trata los
        datos personales de deudores, acreedores y demás personas cuyos
        datos quedan registrados en un expediente.
      </p>

      <h2>1. Responsable y encargado del tratamiento</h2>
      <p>
        Cada centro de conciliación que usa el sistema es{' '}
        <strong>responsable</strong> del tratamiento de los datos personales
        de sus propios expedientes. Los datos de un centro están aislados de
        los de otro: el sistema los separa técnicamente por centro
        (<em>tenant</em>) y ningún centro puede ver los expedientes de otro.
      </p>
      <p>Los centros que hoy usan el sistema son:</p>
      <ul>
        <li>
          Centro de Conciliación Armonía — razón social:{' '}
          <Completar>razón social de Armonía</Completar>, NIT:{' '}
          <Completar>NIT de Armonía</Completar>.
        </li>
        <li>
          Centro de Conciliación Constructores de Paz — razón social:{' '}
          <Completar>razón social de Constructores de Paz</Completar>, NIT:{' '}
          <Completar>NIT de Constructores de Paz</Completar>.
        </li>
      </ul>
      <p>
        El equipo técnico que opera la plataforma Insolventic actúa como{' '}
        <strong>encargado del tratamiento</strong>: procesa los datos por
        cuenta e instrucción de cada centro (responsable), no decide para
        qué se usan.
      </p>

      <h2>2. Qué datos se tratan</h2>
      <p>
        El sistema registra, para cada expediente, los datos que la ley
        exige o que el trámite (insolvencia, conciliación o acuerdo de
        apoyo) requiere para adelantarse. En concreto:
      </p>
      <ul>
        <li>
          <strong>Del deudor:</strong> nombre, tipo y número de cédula,
          correo, teléfono, dirección, ciudad, departamento, fecha de
          nacimiento, estado civil, ocupación, ingresos y gastos mensuales,
          número de dependientes, nivel educativo, contacto de emergencia, y
          —cuando aplica— datos bancarios (banco, tipo de cuenta) para el
          plan de pagos.
        </li>
        <li>
          <strong>De los bienes del deudor:</strong> descripción, tipo y
          valor de cada bien (incluye datos de inmuebles cuando el bien es
          un inmueble: dirección, matrícula, gravámenes).
        </li>
        <li>
          <strong>De los acreedores:</strong> nombre o razón social, NIT,
          correo, teléfono, dirección, representante, y el detalle de cada
          obligación (monto, tipo, clasificación).
        </li>
        <li>
          <strong>Del trámite:</strong> fechas de cada etapa (radicación,
          admisión, audiencias, acuerdos, terminación), documentos
          generados, y comunicaciones del trámite.
        </li>
        <li>
          <strong>De los operadores del centro</strong> (quienes usan el
          sistema): nombre, correo, teléfono, cédula profesional, y un
          registro de qué acciones realizó cada uno sobre cada expediente
          (auditoría).
        </li>
      </ul>

      <h2>3. Finalidad del tratamiento</h2>
      <p>
        Los datos se tratan exclusivamente para gestionar el expediente del
        trámite correspondiente: registrar la información del deudor y sus
        acreedores, generar los documentos propios de cada etapa del
        trámite (solicitud, admisión, audiencias, actas, acuerdos,
        constancias), hacer seguimiento del estado del expediente, y enviar
        las notificaciones del trámite por correo a quien corresponda.
      </p>

      <h2>4. Transmisión a terceros y a otros países</h2>
      <p>
        El sistema usa dos servicios de Google para operar:
      </p>
      <ul>
        <li>
          <strong>Google Drive</strong>, donde se almacenan los documentos
          generados de cada expediente (solicitudes, actas, acuerdos,
          constancias y los demás documentos del trámite).
        </li>
        <li>
          <strong>Gmail (vía SMTP)</strong>, para el envío de las
          notificaciones del trámite por correo electrónico.
        </li>
      </ul>
      <p>
        Estos dos servicios son operados por Google y sus servidores pueden
        estar ubicados fuera de Colombia — es decir, hay una transmisión
        internacional de los datos almacenados o enviados por estos medios.
        No se transmiten datos a ningún otro tercero distinto de estos dos
        servicios para el funcionamiento del sistema.
      </p>

      <h2>5. Derechos de los titulares (derechos ARCO)</h2>
      <p>Como titular de sus datos, usted tiene derecho a:</p>
      <ul>
        <li>
          <strong>Conocer</strong> qué datos suyos están registrados en el
          expediente y para qué se usan.
        </li>
        <li>
          <strong>Actualizar</strong> sus datos cuando hayan cambiado (por
          ejemplo, un cambio de dirección o de teléfono).
        </li>
        <li>
          <strong>Rectificar</strong> datos que estén incompletos, sean
          inexactos o puedan generar confusión.
        </li>
        <li>
          <strong>Suprimir</strong> sus datos, cuando la ley lo permita —
          ver la nota sobre el expediente legal más abajo.
        </li>
      </ul>
      <p>
        <strong>Canal para ejercer estos derechos:</strong> escriba a{' '}
        <Completar>correo del canal ARCO de cada centro</Completar>,
        indicando el centro de conciliación, el número de expediente (si lo
        conoce) y el derecho que desea ejercer. El procedimiento interno
        para atender estas solicitudes está en{' '}
        <code>docs/PROCEDIMIENTO_ARCO.md</code> (documento interno, no
        público).
      </p>
      <p>
        <strong>Nota sobre la supresión y el expediente legal:</strong> un
        expediente de insolvencia, conciliación o acuerdo de apoyo es, en
        sí mismo, un registro de un trámite legal. Si existe una obligación
        de conservar ese registro, la supresión de sus datos podría no ser
        posible mientras esa obligación esté vigente — esta tensión está
        identificada como una decisión pendiente de revisión legal (ver{' '}
        <code>docs/PROCEDIMIENTO_ARCO.md</code>), y esta política no afirma
        tener la respuesta.
      </p>

      <h2>6. Tiempo de conservación de los datos</h2>
      <p>
        Los datos de un expediente se conservan mientras el trámite esté
        activo, y después de terminado, durante:{' '}
        <Completar>plazo de retención tras terminar el trámite</Completar>.
      </p>

      <h2>7. Seguridad</h2>
      <p>
        El acceso al sistema requiere una cuenta asignada por el
        administrador del centro, y cada cuenta solo puede ver los
        expedientes de su propio centro. Las contraseñas no se almacenan en
        texto plano. El detalle técnico de estas medidas no se publica aquí
        por razones de seguridad.
      </p>
    </LegalPageLayout>
  );
}
