'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
                <p className="text-sm font-medium text-gray-600">
                  Nombre Completo
                </p>
                <p className="text-sm">
                  {caseData.conyugeNombreCompleto || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Tipo Documento
                </p>
                <p className="text-sm">
                  {caseData.conyugeTipoIdentificacion || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Número Documento
                </p>
                <p className="text-sm">
                  {caseData.conyugeIdentificacion || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Teléfono</p>
                <p className="text-sm">
                  {caseData.conyugeTelefono || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Email</p>
                <p className="text-sm">
                  {caseData.conyugeCorreo || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
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
              <p className="text-sm font-medium text-gray-600">
                Actividad Económica
              </p>
              <p className="text-sm">
                {caseData.deudorActividadEconomica || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Ocupación</p>
              <p className="text-sm">
                {caseData.deudorOcupacion || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Profesión</p>
              <p className="text-sm">
                {caseData.deudorProfesion || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Tipo Vinculación
              </p>
              <p className="text-sm">
                {caseData.deudorTipoVinculacion || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Nombre Empleador
              </p>
              <p className="text-sm">
                {caseData.deudorNombreEmpleador || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                NIT Empleador
              </p>
              <p className="text-sm">
                {caseData.deudorNitEmpleador || 'N/A'}
              </p>
            </div>
          </div>

          <Separator />

          {/* Ingresos */}
          <p className="text-sm font-semibold text-gray-700">Ingresos</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Ingreso Principal Mensual
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.ingresoPrincipalMensual)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Otros Ingresos Mensuales
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.otrosIngresosMensuales)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Ingresos Variables Promedio
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.ingresosVariablesPromedio)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Ingresos No Operacionales
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.ingresosNoOperacionales)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Total Ingresos Mensuales
              </p>
              <p className="text-sm font-semibold text-green-600">
                {formatCurrency(caseData.totalIngresosMensuales)}
              </p>
            </div>
          </div>

          <Separator />

          {/* Gastos */}
          <p className="text-sm font-semibold text-gray-700">Gastos</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-600">Vivienda</p>
              <p className="text-sm">
                {formatCurrency(caseData.gastosVivienda)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Alimentación</p>
              <p className="text-sm">
                {formatCurrency(caseData.gastosAlimentacion)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Transporte</p>
              <p className="text-sm">
                {formatCurrency(caseData.gastosTransporte)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Servicios Públicos
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.gastosServiciosPublicos)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Educación</p>
              <p className="text-sm">
                {formatCurrency(caseData.gastosEducacion)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Salud</p>
              <p className="text-sm">
                {formatCurrency(caseData.gastosSalud)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Otros Gastos</p>
              <p className="text-sm">
                {formatCurrency(caseData.otrosGastos)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
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
              <p className="text-sm font-medium text-gray-600">
                Capacidad de Pago Estimada
              </p>
              <p
                className={`text-sm font-semibold ${
                  capacidadPago >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(caseData.capacidadPagoEstimada)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Patrimonio Total Estimado
              </p>
              <p className="text-sm">
                {formatCurrency(caseData.patrimonioTotalEstimado)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
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
              <p className="text-sm font-medium text-gray-600">
                ¿Cesó pagos?
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.cesacionPagos)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Fecha</p>
              <p className="text-sm">
                {formatDate(caseData.fechaCesacionPagos)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Número Acreedores Actual
              </p>
              <p className="text-sm">
                {caseData.numeroAcreedoresActual ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Porcentaje Pasivo en Mora
              </p>
              <p className="text-sm">
                {caseData.porcentajePasivoEnMora != null
                  ? `${caseData.porcentajePasivoEnMora}%`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Obligaciones en Mora +90 Días
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.obligacionesEnMora90Dias)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Procesos Ejecutivos Vigentes
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.procesosEjecutivosVigentes)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Acreedores Definitivo */}
      {caseData.acreedores && caseData.acreedores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Acreedores Definitivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre / Razón Social</TableHead>
                    <TableHead>Tipo Doc.</TableHead>
                    <TableHead>No. Documento</TableHead>
                    <TableHead>Capital</TableHead>
                    <TableHead>Intereses</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Naturaleza</TableHead>
                    <TableHead>Garantía</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {caseData.acreedores.map((acreedor) => (
                    <TableRow key={acreedor.id}>
                      <TableCell>
                        {acreedor.acreedorNombreRazonSocial || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {acreedor.acreedorTipoIdentificacion || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {acreedor.acreedorIdentificacion || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(acreedor.valorCapital)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(acreedor.valorInteresesCorrientes)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(acreedor.valorTotalObligacion)}
                      </TableCell>
                      <TableCell>
                        {acreedor.naturalezaCredito || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {formatBoolean(acreedor.garantiaAsociada)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 5: Bienes Definitivo */}
      {caseData.bienes && caseData.bienes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bienes Definitivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Valor Comercial</TableHead>
                    <TableHead>Gravámenes</TableHead>
                    <TableHead>Embargado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {caseData.bienes.map((bien) => (
                    <TableRow key={bien.id}>
                      <TableCell>{bien.bienTipo || 'N/A'}</TableCell>
                      <TableCell>{bien.bienDescripcion || 'N/A'}</TableCell>
                      <TableCell>
                        {formatCurrency(bien.bienValorComercial)}
                      </TableCell>
                      <TableCell>
                        {formatBoolean(bien.bienGravamenes)}
                      </TableCell>
                      <TableCell>
                        {formatBoolean(bien.bienEmbargado)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 6: Procesos Judiciales Definitivo */}
      {caseData.procesosJudiciales && caseData.procesosJudiciales.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Procesos Judiciales Definitivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo Proceso</TableHead>
                    <TableHead>Juzgado</TableHead>
                    <TableHead>Radicado</TableHead>
                    <TableHead>Demandante</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {caseData.procesosJudiciales.map((proceso) => (
                    <TableRow key={proceso.id}>
                      <TableCell>{proceso.tipoProceso || 'N/A'}</TableCell>
                      <TableCell>
                        {proceso.juzgadoNombre || 'N/A'}
                        {proceso.juzgadoCiudad
                          ? ` - ${proceso.juzgadoCiudad}`
                          : ''}
                      </TableCell>
                      <TableCell>
                        {proceso.procesoJudicialRadicado || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {proceso.demandanteNombre || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {proceso.estadoProceso || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 7: Declaraciones */}
      <Card>
        <CardHeader>
          <CardTitle>Declaraciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-600">Buena Fe</p>
              <p className="text-sm">
                {formatBoolean(caseData.manifestacionBuenaFe)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Veracidad de Información
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.declaracionVeracidadInformacion)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                No Ocultamiento de Bienes
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.manifestacionNoOcultamientoBienes)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Autorización de Notificación Electrónica
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.autorizacionNotificacionesCorreo)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Autorización Consulta Centrales de Riesgo
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.autorizacionConsultaCentralesRiesgo)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Autorización Tratamiento de Datos
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.autorizacionTratamientoDatos)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 8: Propuesta Inicial de Pago */}
      <Card>
        <CardHeader>
          <CardTitle>Propuesta Inicial de Pago</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Plazo en Meses
              </p>
              <p className="text-sm">
                {caseData.propuestaPlazoMeses ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Periodicidad</p>
              <p className="text-sm">
                {caseData.propuestaPeriodicidadPago || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Tasa de Interés
              </p>
              <p className="text-sm">
                {caseData.propuestaTasaInteres != null
                  ? `${caseData.propuestaTasaInteres}%`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Quita Promedio
              </p>
              <p className="text-sm">
                {caseData.propuestaQuitaPromedio != null
                  ? `${caseData.propuestaQuitaPromedio}%`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Fecha Inicio Pago
              </p>
              <p className="text-sm">
                {formatDate(caseData.propuestaFechaInicioPago)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Observaciones
              </p>
              <p className="text-sm">
                {caseData.propuestaObservaciones || 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 9: Documentos Anexos */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos Anexos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Documento de Identidad
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.anexaDocumentoIdentidad)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Soporte de Ingresos
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.anexaSoporteIngresos)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Extractos Bancarios
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.anexaExtractosBancarios)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Certificados de Deuda
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.anexaCertificadosDeuda)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Certificado de Tradición
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.anexaCertificadoTradicion)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Relación de Procesos
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.anexaRelacionProcesos)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Declaración de Renta
              </p>
              <p className="text-sm">
                {formatBoolean(caseData.anexaDeclaracionRenta)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 10: Apoderado */}
      {caseData.apoderadoNombreCompleto && (
        <Card>
          <CardHeader>
            <CardTitle>Apoderado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-gray-600">Nombre</p>
                <p className="text-sm">
                  {caseData.apoderadoNombreCompleto || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Tipo Documento
                </p>
                <p className="text-sm">
                  {caseData.apoderadoTipoIdentificacion || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Número Documento
                </p>
                <p className="text-sm">
                  {caseData.apoderadoIdentificacion || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Tarjeta Profesional
                </p>
                <p className="text-sm">
                  {caseData.apoderadoTarjetaProfesional || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Dirección</p>
                <p className="text-sm">
                  {caseData.apoderadoDireccion || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Teléfono</p>
                <p className="text-sm">
                  {caseData.apoderadoTelefono || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Email</p>
                <p className="text-sm">
                  {caseData.apoderadoCorreo || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Poder Otorgado
                </p>
                <p className="text-sm">
                  {formatBoolean(caseData.existePoderOtorgado)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 11: Radicación Interna */}
      {(caseData.fechaRadicacion || caseData.expedienteNumero) && (
        <Card>
          <CardHeader>
            <CardTitle>Radicación Interna</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Expediente Número
                </p>
                <p className="text-sm">
                  {caseData.expedienteNumero || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Año Expediente
                </p>
                <p className="text-sm">
                  {caseData.expedienteAnio ?? 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Fecha Radicación
                </p>
                <p className="text-sm">
                  {formatDate(caseData.fechaRadicacion)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Centro de Conciliación
                </p>
                <p className="text-sm">
                  {caseData.centroConciliacionNombre || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Conciliador Asignado
                </p>
                <p className="text-sm">
                  {caseData.conciliadorAsignado || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Ciudad Radicación
                </p>
                <p className="text-sm">
                  {caseData.ciudadRadicacion || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
