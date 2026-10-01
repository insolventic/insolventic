/**
 * Sub-mappers del "Formulario Definitivo" (Paso 3 de la división de
 * `placeholder-mapper.ts`; ver el plan en `docs/PLAN_DIVISION_MAPPER.md` y la
 * red de seguridad en `tests/unit/documents/mapper-golden.test.ts`).
 *
 * Son el snapshot por caso de las Secciones I, V, VI y VII del formulario: los
 * modelos `Acreedor`, `Bien` y `ProcesoJudicial` (los de nombre en español, el
 * detalle por caso — no confundir con `Creditor`/`Asset`/`LegalProcess`, que son
 * el registro general reutilizable entre casos), más los campos extendidos del
 * deudor.
 *
 * Se movieron aquí SIN cambiar su código. Cumplen las dos condiciones de "menor
 * riesgo" del plan, las mismas del Paso 2: no dependen de ningún otro
 * sub-mapper —solo del tipo `PlaceholderMap` y de tres helpers de formato ya
 * extraídos en el Paso 1— y no participan en ninguna de las 16 colisiones del
 * contrato de orden de fusión (`mapper-merge-order.test.ts`). Las cuatro se
 * llaman desde un solo lugar, `mapCaseToPlaceholders`.
 *
 * NOTA sobre los slots numerados: estos tres mappers recorren 15 acreedores, 10
 * bienes y 10 procesos, y lo que pase de ahí se pierde en silencio — el mismo
 * patrón que se está retirando de la Solicitud de Insolvencia. Acá no se toca:
 * este paso es un movimiento puro, y el tope de las plantillas del Formulario
 * Definitivo es una decisión aparte.
 */

import type { PlaceholderMap } from '../placeholder-mapper';
import type { CaseWithRelations } from '../../case/schemas';
import { boolToSiNo, formatCurrency, formatShortDate } from './format';

// Map Acreedores (formulario definitivo)
export function mapAcreedoresDefinitivo(
  caseData: CaseWithRelations,
): PlaceholderMap {
  const result: PlaceholderMap = {};
  const acreedores = caseData.acreedores || [];

  for (let i = 0; i < 15; i++) {
    const a = acreedores[i];
    const idx = i + 1;

    if (a) {
      result[`acr_${idx}_tipo`] = a.acreedorTipo || '';
      result[`acr_${idx}_nombre`] = a.acreedorNombreRazonSocial || '';
      result[`acr_${idx}_identificacion`] = a.acreedorIdentificacion || '';
      result[`acr_${idx}_direccion`] = a.acreedorDireccion || '';
      result[`acr_${idx}_ciudad`] = a.acreedorCiudad || '';
      result[`acr_${idx}_correo`] = a.acreedorCorreo || '';
      result[`acr_${idx}_telefono`] = a.acreedorTelefono || '';
      result[`acr_${idx}_tipo_obligacion`] = a.tipoObligacion || '';
      result[`acr_${idx}_numero_obligacion`] = a.numeroObligacion || '';
      result[`acr_${idx}_fecha_otorgamiento`] = a.fechaOtorgamiento
        ? formatShortDate(a.fechaOtorgamiento)
        : '';
      result[`acr_${idx}_fecha_vencimiento`] = a.fechaVencimiento
        ? formatShortDate(a.fechaVencimiento)
        : '';
      result[`acr_${idx}_dias_mora`] = a.diasMora?.toString() || '';
      result[`acr_${idx}_capital`] = formatCurrency(a.valorCapital);
      result[`acr_${idx}_intereses_corrientes`] = formatCurrency(
        a.valorInteresesCorrientes,
      );
      result[`acr_${idx}_intereses_mora`] = formatCurrency(
        a.valorInteresesMora,
      );
      result[`acr_${idx}_gastos_cobranza`] = formatCurrency(
        a.valorGastosCobranza,
      );
      result[`acr_${idx}_total`] = formatCurrency(a.valorTotalObligacion);
      result[`acr_${idx}_naturaleza`] = a.naturalezaCredito || '';
      result[`acr_${idx}_codeudores`] = boolToSiNo(a.obligacionCodeudores);
      result[`acr_${idx}_nombre_codeudores`] = a.nombreCodeudores || '';
      result[`acr_${idx}_garantia`] = boolToSiNo(a.garantiaAsociada);
      result[`acr_${idx}_tipo_garantia`] = a.tipoGarantia || '';
      result[`acr_${idx}_proceso_judicial`] = boolToSiNo(
        a.procesoJudicialEnCurso,
      );
      result[`acr_${idx}_juzgado`] = a.juzgadoNombre || '';
      result[`acr_${idx}_radicado`] = a.procesoJudicialRadicado || '';
    } else {
      result[`acr_${idx}_nombre`] = '';
      result[`acr_${idx}_capital`] = '';
      result[`acr_${idx}_total`] = '';
    }
  }

  // Totals
  const totalCapitalAcr = acreedores.reduce(
    (sum, a) => sum + (Number(a.valorCapital) || 0),
    0,
  );
  const totalObligaciones = acreedores.reduce(
    (sum, a) => sum + (Number(a.valorTotalObligacion) || 0),
    0,
  );
  result['total_capital_acreedores'] = formatCurrency(totalCapitalAcr);
  result['total_obligaciones_acreedores'] = formatCurrency(totalObligaciones);
  result['numero_acreedores_definitivo'] = acreedores.length.toString();

  return result;
}

// Map Bienes (formulario definitivo)
export function mapBienesDefinitivo(
  caseData: CaseWithRelations,
): PlaceholderMap {
  const result: PlaceholderMap = {};
  const bienes = caseData.bienes || [];

  for (let i = 0; i < 10; i++) {
    const b = bienes[i];
    const idx = i + 1;

    if (b) {
      result[`bien_${idx}_tipo`] = b.bienTipo || '';
      result[`bien_${idx}_descripcion`] = b.bienDescripcion || '';
      result[`bien_${idx}_ubicacion`] = b.bienUbicacion || '';
      result[`bien_${idx}_matricula`] = b.bienMatriculaInmobiliaria || '';
      result[`bien_${idx}_placa`] = b.bienPlaca || '';
      result[`bien_${idx}_entidad`] = b.bienEntidadFinanciera || '';
      result[`bien_${idx}_valor_comercial`] = formatCurrency(
        b.bienValorComercial,
      );
      result[`bien_${idx}_valor_catastral`] = formatCurrency(
        b.bienValorCatastral,
      );
      result[`bien_${idx}_gravamenes`] = boolToSiNo(b.bienGravamenes);
      result[`bien_${idx}_embargado`] = boolToSiNo(b.bienEmbargado);
      result[`bien_${idx}_vivienda_familiar`] = boolToSiNo(
        b.bienAfectadoViviendaFamiliar,
      );
      result[`bien_${idx}_leasing`] = boolToSiNo(b.bienEnLeasing);
    } else {
      result[`bien_${idx}_tipo`] = '';
      result[`bien_${idx}_valor_comercial`] = '';
    }
  }

  const totalBienes = bienes.reduce(
    (sum, b) => sum + (Number(b.bienValorComercial) || 0),
    0,
  );
  result['total_bienes_definitivo'] = formatCurrency(totalBienes);
  result['numero_bienes_definitivo'] = bienes.length.toString();

  return result;
}

// Map Procesos Judiciales (formulario definitivo)
export function mapProcesosJudicialesDefinitivo(
  caseData: CaseWithRelations,
): PlaceholderMap {
  const result: PlaceholderMap = {};
  const procesos = caseData.procesosJudiciales || [];

  for (let i = 0; i < 10; i++) {
    const p = procesos[i];
    const idx = i + 1;

    if (p) {
      result[`pj_${idx}_tipo`] = p.tipoProceso || '';
      result[`pj_${idx}_juzgado`] = p.juzgadoNombre || '';
      result[`pj_${idx}_ciudad`] = p.juzgadoCiudad || '';
      result[`pj_${idx}_radicado`] = p.procesoJudicialRadicado || '';
      result[`pj_${idx}_demandante`] = p.demandanteNombre || '';
      result[`pj_${idx}_demandado`] = p.demandadoNombre || '';
      result[`pj_${idx}_cuantia`] = formatCurrency(p.cuantiaProceso);
      result[`pj_${idx}_estado`] = p.estadoProceso || '';
    } else {
      result[`pj_${idx}_tipo`] = '';
      result[`pj_${idx}_juzgado`] = '';
    }
  }

  result['numero_procesos_judiciales'] = procesos.length.toString();
  return result;
}

// Map Formulario Definitivo Case fields (cónyuge, laboral, cesación, declaraciones, propuesta, apoderado, radicación)
export function mapFormularioDefinitivoFields(
  caseData: CaseWithRelations,
): PlaceholderMap {
  const debtor = caseData.debtor;

  return {
    // Sección I: Deudor (campos extendidos)
    deudor_tipo_identificacion:
      debtor.deudorTipoIdentificacion || debtor.idType || '',
    deudor_identificacion: debtor.deudorIdentificacion || debtor.idNumber || '',
    deudor_primer_nombre: debtor.deudorPrimerNombre || '',
    deudor_segundo_nombre: debtor.deudorSegundoNombre || '',
    deudor_primer_apellido: debtor.deudorPrimerApellido || '',
    deudor_segundo_apellido: debtor.deudorSegundoApellido || '',
    deudor_nombre_completo: debtor.deudorNombreCompleto || debtor.name || '',
    deudor_fecha_nacimiento: debtor.deudorFechaNacimiento
      ? formatShortDate(debtor.deudorFechaNacimiento)
      : '',
    deudor_lugar_nacimiento: debtor.deudorLugarNacimiento || '',
    deudor_nacionalidad: debtor.deudorNacionalidad || '',
    deudor_estado_civil: debtor.deudorEstadoCivil || debtor.maritalStatus || '',
    deudor_regimen_matrimonial: debtor.deudorRegimenMatrimonial || '',
    sociedad_conyugal_vigente: boolToSiNo(debtor.sociedadConyugalVigente),
    existe_capitulaciones: boolToSiNo(debtor.existeCapitulaciones),
    deudor_direccion_residencia:
      debtor.deudorDireccionResidencia || debtor.address || '',
    deudor_ciudad_form: debtor.deudorCiudad || debtor.city || '',
    deudor_departamento_form:
      debtor.deudorDepartamento || debtor.department || '',
    deudor_codigo_postal: debtor.deudorCodigoPostal || '',
    deudor_telefono_fijo: debtor.deudorTelefonoFijo || '',
    deudor_telefono_celular: debtor.deudorTelefonoCelular || debtor.phone || '',
    deudor_correo_electronico:
      debtor.deudorCorreoElectronico || debtor.email || '',

    // Sección II: Cónyuge
    conyuge_tipo_identificacion: caseData.conyugeTipoIdentificacion || '',
    conyuge_identificacion: caseData.conyugeIdentificacion || '',
    conyuge_primer_nombre: caseData.conyugePrimerNombre || '',
    conyuge_segundo_nombre: caseData.conyugeSegundoNombre || '',
    conyuge_primer_apellido: caseData.conyugePrimerApellido || '',
    conyuge_segundo_apellido: caseData.conyugeSegundoApellido || '',
    conyuge_nombre_completo: caseData.conyugeNombreCompleto || '',
    conyuge_telefono: caseData.conyugeTelefono || '',
    conyuge_correo: caseData.conyugeCorreo || '',
    sociedad_conyugal_disuelta: boolToSiNo(caseData.sociedadConyugalDisuelta),

    // Sección III: Información Laboral y Económica
    deudor_ocupacion: caseData.deudorOcupacion || '',
    deudor_profesion: caseData.deudorProfesion || '',
    deudor_actividad_economica: caseData.deudorActividadEconomica || '',
    deudor_tipo_vinculacion: caseData.deudorTipoVinculacion || '',
    deudor_nombre_empleador: caseData.deudorNombreEmpleador || '',
    deudor_nit_empleador: caseData.deudorNitEmpleador || '',
    ingreso_principal_mensual: formatCurrency(caseData.ingresoPrincipalMensual),
    otros_ingresos_mensuales: formatCurrency(caseData.otrosIngresosMensuales),
    total_ingresos_mensuales: formatCurrency(caseData.totalIngresosMensuales),
    ingresos_variables_promedio: formatCurrency(
      caseData.ingresosVariablesPromedio,
    ),
    ingresos_no_operacionales: formatCurrency(caseData.ingresosNoOperacionales),
    gastos_vivienda: formatCurrency(caseData.gastosVivienda),
    gastos_alimentacion: formatCurrency(caseData.gastosAlimentacion),
    gastos_servicios_publicos: formatCurrency(caseData.gastosServiciosPublicos),
    gastos_transporte: formatCurrency(caseData.gastosTransporte),
    gastos_educacion: formatCurrency(caseData.gastosEducacion),
    gastos_salud: formatCurrency(caseData.gastosSalud),
    otros_gastos: formatCurrency(caseData.otrosGastos),
    total_gastos_mensuales: formatCurrency(caseData.totalGastosMensuales),
    capacidad_pago_estimada: formatCurrency(caseData.capacidadPagoEstimada),
    patrimonio_total_estimado: formatCurrency(caseData.patrimonioTotalEstimado),
    pasivo_total_estimado: formatCurrency(caseData.pasivoTotalEstimado),

    // Sección IV: Cesación de Pagos
    cesacion_pagos: boolToSiNo(caseData.cesacionPagos),
    fecha_cesacion_pagos: caseData.fechaCesacionPagos
      ? formatShortDate(caseData.fechaCesacionPagos)
      : '',
    numero_acreedores_actual: caseData.numeroAcreedoresActual?.toString() || '',
    porcentaje_pasivo_en_mora:
      caseData.porcentajePasivoEnMora?.toString() || '',
    obligaciones_en_mora_90_dias: boolToSiNo(caseData.obligacionesEnMora90Dias),
    procesos_ejecutivos_vigentes: boolToSiNo(
      caseData.procesosEjecutivosVigentes,
    ),

    // Sección VIII: Declaraciones
    declaracion_veracidad: boolToSiNo(caseData.declaracionVeracidadInformacion),
    manifestacion_buena_fe: boolToSiNo(caseData.manifestacionBuenaFe),
    manifestacion_no_ocultamiento: boolToSiNo(
      caseData.manifestacionNoOcultamientoBienes,
    ),
    autorizacion_notificaciones_correo: boolToSiNo(
      caseData.autorizacionNotificacionesCorreo,
    ),
    autorizacion_centrales_riesgo: boolToSiNo(
      caseData.autorizacionConsultaCentralesRiesgo,
    ),
    autorizacion_tratamiento_datos: boolToSiNo(
      caseData.autorizacionTratamientoDatos,
    ),

    // Sección IX: Propuesta Inicial
    propuesta_plazo_meses: caseData.propuestaPlazoMeses?.toString() || '',
    propuesta_periodicidad: caseData.propuestaPeriodicidadPago || '',
    propuesta_tasa_interes: caseData.propuestaTasaInteres?.toString() || '',
    propuesta_quita_promedio: caseData.propuestaQuitaPromedio?.toString() || '',
    propuesta_fecha_inicio: caseData.propuestaFechaInicioPago
      ? formatShortDate(caseData.propuestaFechaInicioPago)
      : '',
    propuesta_observaciones: caseData.propuestaObservaciones || '',

    // Sección X: Documentos Anexos
    anexa_soporte_ingresos: boolToSiNo(caseData.anexaSoporteIngresos),
    anexa_extractos_bancarios: boolToSiNo(caseData.anexaExtractosBancarios),
    anexa_certificados_deuda: boolToSiNo(caseData.anexaCertificadosDeuda),
    anexa_certificado_tradicion: boolToSiNo(caseData.anexaCertificadoTradicion),
    anexa_relacion_procesos: boolToSiNo(caseData.anexaRelacionProcesos),
    anexa_declaracion_renta: boolToSiNo(caseData.anexaDeclaracionRenta),
    anexa_documento_identidad: boolToSiNo(caseData.anexaDocumentoIdentidad),

    // Sección XI: Apoderado
    apoderado_nombre_completo: caseData.apoderadoNombreCompleto || '',
    apoderado_tipo_identificacion: caseData.apoderadoTipoIdentificacion || '',
    apoderado_identificacion: caseData.apoderadoIdentificacion || '',
    apoderado_tarjeta_profesional: caseData.apoderadoTarjetaProfesional || '',
    apoderado_direccion: caseData.apoderadoDireccion || '',
    apoderado_telefono: caseData.apoderadoTelefono || '',
    apoderado_correo: caseData.apoderadoCorreo || '',
    existe_poder_otorgado: boolToSiNo(caseData.existePoderOtorgado),

    // Sección XII: Radicación Interna
    expediente_numero: caseData.expedienteNumero || '',
    expediente_anio: caseData.expedienteAnio?.toString() || '',
    fecha_radicacion_interna: caseData.fechaRadicacion
      ? formatShortDate(caseData.fechaRadicacion)
      : '',
    centro_conciliacion: caseData.centroConciliacionNombre || '',
    conciliador_asignado: caseData.conciliadorAsignado || '',
    ciudad_radicacion: caseData.ciudadRadicacion || '',
  };
}
