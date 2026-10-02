'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import type { CaseWithRelations } from '@/features/case/schemas';

interface DefinitivoSectionProps {
  caseData: CaseWithRelations;
}

const formatCurrency = (value: number | null | undefined): string => {
  return (value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  });
};

const formatDate = (value: Date | string | null | undefined): string => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('es-CO');
};

const formatBoolean = (value: boolean | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return value ? 'Sí' : 'No';
};

interface ApoderadoCardData {
  nombreCompleto: string;
  tipoIdentificacion?: string | null;
  identificacion?: string | null;
  tarjetaProfesional?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  correo?: string | null;
  existePoderOtorgado?: boolean | null;
}

function ApoderadoCard({
  title,
  data,
}: Readonly<{ title: string; data: ApoderadoCardData }>) {
  const fields: Array<[string, string]> = [
    ['Nombre', data.nombreCompleto || 'N/A'],
    ['Tipo Documento', data.tipoIdentificacion || 'N/A'],
    ['Número Documento', data.identificacion || 'N/A'],
    ['Tarjeta Profesional', data.tarjetaProfesional || 'N/A'],
    ['Dirección', data.direccion || 'N/A'],
    ['Teléfono', data.telefono || 'N/A'],
    ['Email', data.correo || 'N/A'],
    ['Poder Otorgado', formatBoolean(data.existePoderOtorgado)],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <p className="text-muted-foreground text-sm font-medium">
                {label}
              </p>
              <p className="text-sm">{value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DefinitivoSection({
  caseData,
}: Readonly<DefinitivoSectionProps>) {
  const hasSpouseData =
    caseData.conyugeNombreCompleto ||
    caseData.conyugeIdentificacion ||
    caseData.conyugeTelefono ||
    caseData.conyugeCorreo;

  const capacidadPago = caseData.capacidadPagoEstimada ?? 0;

  return (
    <>
      {/* Card 1: Información del Cónyuge (Definitivo) */}
      {hasSpouseData && (
        <Card>
          <CardHeader>
            <CardTitle>Información del Cónyuge (Definitivo)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Nombre Completo
                </p>
                <p className="text-sm">
                  {caseData.conyugeNombreCompleto || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Tipo Documento
                </p>
                <p className="text-sm">
                  {caseData.conyugeTipoIdentificacion || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Número Documento
                </p>
                <p className="text-sm">
                  {caseData.conyugeIdentificacion || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Teléfono
                </p>
                <p className="text-sm">{caseData.conyugeTelefono || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Email
                </p>
                <p className="text-sm">{caseData.conyugeCorreo || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Sociedad Conyugal Disuelta
                </p>
                <p className="text-sm">
                  {formatBoolean(caseData.sociedadConyugalDisuelta)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 2: Información Laboral y Económica */}
      <Card>
        <CardHeader>
          <CardTitle>Información Laboral y Económica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Actividad Económica
              </p>
              <p className="text-sm">
                {caseData.deudorActividadEconomica || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Ocupación
              </p>
              <p className="text-sm">{caseData.deudorOcupacion || 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Profesión
              </p>
              <p className="text-sm">{caseData.deudorProfesion || 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Tipo Vinculación
              </p>
              <p className="text-sm">
                {caseData.deudorTipoVinculacion || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Nombre Empleador
              </p>
              <p className="text-sm">
                {caseData.deudorNombreEmpleador || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                NIT Empleador
              </p>
              <p className="text-sm">{caseData.deudorNitEmpleador || 'N/A'}</p>
            </div>
          </div>

          <Separator />

          {/* Ingresos */}
          <p className="text-foreground text-sm font-semibold">Ingresos</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Ingreso Principal Mensual
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.ingresoPrincipalMensual)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Otros Ingresos Mensuales
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.otrosIngresosMensuales)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Ingresos Variables Promedio
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.ingresosVariablesPromedio)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Ingresos No Operacionales
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.ingresosNoOperacionales)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Total Ingresos Mensuales
              </p>
              <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(caseData.totalIngresosMensuales)}
              </p>
            </div>
          </div>

          <Separator />

          {/* Gastos */}
          <p className="text-foreground text-sm font-semibold">Gastos</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Vivienda
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.gastosVivienda)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Alimentación
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.gastosAlimentacion)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Transporte
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.gastosTransporte)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Servicios Públicos
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.gastosServiciosPublicos)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Educación
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.gastosEducacion)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">Salud</p>
              <p className="text-sm">{formatCurrency(caseData.gastosSalud)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Otros Gastos
              </p>
              <p className="text-sm">{formatCurrency(caseData.otrosGastos)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Total Gastos Mensuales
              </p>
              <p className="text-sm font-semibold text-red-600">
                {formatCurrency(caseData.totalGastosMensuales)}
              </p>
            </div>
          </div>

          <Separator />

          {/* Capacidad de Pago y Patrimonio */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Capacidad de Pago Estimada
              </p>
              <p
                className={`text-sm font-semibold ${
                  capacidadPago >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatCurrency(caseData.capacidadPagoEstimada)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Patrimonio Total Estimado
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.patrimonioTotalEstimado)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Pasivo Total Estimado
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.pasivoTotalEstimado)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Cesación de Pagos */}
      <Card>
        <CardHeader>
          <CardTitle>Cesación de Pagos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                ¿Cesó pagos?
              </p>
              <p className="text-sm">{formatBoolean(caseData.cesacionPagos)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">Fecha</p>
              <p className="text-sm">
                {formatDate(caseData.fechaCesacionPagos)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Número Acreedores Actual
              </p>
              <p className="text-sm">
                {caseData.numeroAcreedoresActual ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Porcentaje Pasivo en Mora
              </p>
              <p className="text-sm">
                {caseData.porcentajePasivoEnMora != null
                  ? `${caseData.porcentajePasivoEnMora}%`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Obligaciones en Mora +90 Días
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.obligacionesEnMora90Dias)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Procesos Ejecutivos Vigentes
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.procesosEjecutivosVigentes)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Declaraciones */}
      <Card>
        <CardHeader>
          <CardTitle>Declaraciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Buena Fe
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.manifestacionBuenaFe)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Veracidad de Información
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.declaracionVeracidadInformacion)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                No Ocultamiento de Bienes
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.manifestacionNoOcultamientoBienes)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Autorización de Notificación Electrónica
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.autorizacionNotificacionesCorreo)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Autorización Consulta Centrales de Riesgo
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.autorizacionConsultaCentralesRiesgo)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Autorización Tratamiento de Datos
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.autorizacionTratamientoDatos)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 5: Propuesta Inicial de Pago */}
      <Card>
        <CardHeader>
          <CardTitle>Propuesta Inicial de Pago</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Plazo en Meses
              </p>
              <p className="text-sm">{caseData.propuestaPlazoMeses ?? 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Periodicidad
              </p>
              <p className="text-sm">
                {caseData.propuestaPeriodicidadPago || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Tasa de Interés
              </p>
              <p className="text-sm">
                {caseData.propuestaTasaInteres != null
                  ? `${caseData.propuestaTasaInteres}%`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Quita Promedio
              </p>
              <p className="text-sm">
                {caseData.propuestaQuitaPromedio != null
                  ? `${caseData.propuestaQuitaPromedio}%`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Fecha Inicio Pago
              </p>
              <p className="text-sm">
                {formatDate(caseData.propuestaFechaInicioPago)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Observaciones
              </p>
              <p className="text-sm">
                {caseData.propuestaObservaciones || 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 6: Documentos Anexos */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos Anexos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Documento de Identidad
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.anexaDocumentoIdentidad)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Soporte de Ingresos
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.anexaSoporteIngresos)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Extractos Bancarios
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.anexaExtractosBancarios)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Certificados de Deuda
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.anexaCertificadosDeuda)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Certificado de Tradición
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.anexaCertificadoTradicion)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Relación de Procesos
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.anexaRelacionProcesos)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Declaración de Renta
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.anexaDeclaracionRenta)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 7: Apoderado(s). La lista nueva (tabla apoderados) manda; las 8
          columnas escalares son el respaldo para casos anteriores a la lista. */}
      {caseData.apoderados && caseData.apoderados.length > 0
        ? caseData.apoderados.map((apoderado, index) => (
            <ApoderadoCard
              key={apoderado.id}
              title={
                caseData.apoderados && caseData.apoderados.length > 1
                  ? index === 0
                    ? 'Apoderado principal'
                    : `Apoderado ${index + 1}`
                  : 'Apoderado'
              }
              data={apoderado}
            />
          ))
        : caseData.apoderadoNombreCompleto && (
            <ApoderadoCard
              title="Apoderado"
              data={{
                nombreCompleto: caseData.apoderadoNombreCompleto,
                tipoIdentificacion: caseData.apoderadoTipoIdentificacion,
                identificacion: caseData.apoderadoIdentificacion,
                tarjetaProfesional: caseData.apoderadoTarjetaProfesional,
                direccion: caseData.apoderadoDireccion,
                telefono: caseData.apoderadoTelefono,
                correo: caseData.apoderadoCorreo,
                existePoderOtorgado: caseData.existePoderOtorgado,
              }}
            />
          )}

      {/* Card 8: Radicación Interna */}
      {(caseData.fechaRadicacion || caseData.expedienteNumero) && (
        <Card>
          <CardHeader>
            <CardTitle>Radicación Interna</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Expediente Número
                </p>
                <p className="text-sm">{caseData.expedienteNumero || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Año Expediente
                </p>
                <p className="text-sm">{caseData.expedienteAnio ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Fecha Radicación
                </p>
                <p className="text-sm">
                  {formatDate(caseData.fechaRadicacion)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Centro de Conciliación
                </p>
                <p className="text-sm">
                  {caseData.centroConciliacionNombre || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Conciliador Asignado
                </p>
                <p className="text-sm">
                  {caseData.conciliadorAsignado || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Ciudad Radicación
                </p>
                <p className="text-sm">{caseData.ciudadRadicacion || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
