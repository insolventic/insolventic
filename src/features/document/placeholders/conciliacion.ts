/**
 * Conciliación: contexto de bloques + campos escalares (Paso 7 de la división
 * de `placeholder-mapper.ts`; ver el plan en `docs/PLAN_DIVISION_MAPPER.md`).
 *
 * Se mueven aquí, SIN cambiar su código, `buildConciliationContext` y
 * `mapConciliationFields`. A diferencia de los pasos 2, 3, 5 y 6, este grupo
 * SÍ colisiona —`NOMBRE_CONVOCANTE` con `basePlaceholders` y
 * `DIA_DESISTIMIENTO`/`MES_DESISTIMIENTO`/`ANO_DESISTIMIENTO`/`ANO_CONSTANCIA`
 * con `mapExtendedDates`—, pero ninguna de las dos contrapartes es movible
 * junto con este paso: `basePlaceholders` es el literal de
 * `mapCaseToPlaceholders`, que se queda siempre en `placeholder-mapper.ts`
 * (es el punto de fusión), y `mapExtendedDates` es del Paso 9. El criterio de
 * "mover junto con la contraparte" del plan aplica a colisiones entre DOS
 * sub-mappers movibles (los pares del Paso 9); acá no hay nada que ganar
 * juntándolos, así que el plan programó este paso suelto de todos modos
 * ("Bloqueado por: nada"). El contrato de orden de fusión
 * (`mapper-merge-order.test.ts`) sigue viendo la colisión igual: su
 * `collectFunctions` ya sabe seguir `./placeholders/*`.
 *
 * `buildConciliationContext` es la primera función movida en todo el plan que
 * tiene consumidores externos directos —media docena de tests la importan de
 * `@/features/document/placeholder-mapper`, no solo `mapCaseToPlaceholders`—,
 * así que `placeholder-mapper.ts` la re-exporta (ver el comentario ahí) para
 * no tener que tocar esos tests.
 *
 * `mapApoyoFields` (Paso 8) queda físicamente ENTRE las dos funciones de este
 * paso en `placeholder-mapper.ts` — este movimiento no es de un bloque
 * contiguo, son dos bloques separados por una función que se queda.
 */

import { escapePlaceholder } from './escape';
import {
  formatCurrency,
  formatDate,
  getDayNumber,
  getMonthName,
  getYear,
} from './format';
import { nowColombia } from '@/lib/date-colombia';
import type { CaseWithRelations } from '../../case/schemas';
import type { PlaceholderMap } from '../placeholder-mapper';

/**
 * Builds the non-string context (flags + arrays) used by handlebars-lite
 * for conciliation templates. Kept separate from `mapConciliationFields`
 * so the existing PlaceholderMap (string-only) API stays backward-compatible.
 */
export function buildConciliationContext(
  caseData: CaseWithRelations,
): Record<string, unknown> {
  const raw = caseData as Record<string, unknown>;

  // --- Arrays (stored as JSON columns — may be null/missing) ---
  // Los items alimentan bloques {{#each}} de handlebars-lite y se insertan
  // en el HTML sin más procesamiento, así que sus strings se escapan aquí.
  const asArray = <T = Record<string, unknown>>(v: unknown): T[] =>
    Array.isArray(v)
      ? (v as unknown[]).map((item) =>
          item && typeof item === 'object'
            ? (Object.fromEntries(
                Object.entries(item as Record<string, unknown>).map(
                  ([k, val]) => [
                    k,
                    typeof val === 'string' ? escapePlaceholder(val) : val,
                  ],
                ),
              ) as T)
            : (item as T),
        )
      : [];

  const menoresAlimentos = asArray<{ NOMBRE_MENOR: string }>(
    raw.concMenoresAlimentos,
  );
  const menoresUnion = asArray<{ NOMBRE_MENOR_UNION: string }>(
    raw.concMenoresUnion,
  );
  const clausulasAdicionalesAlimentos = asArray<{
    NUMERO_CLAUSULA_ADICIONAL: string;
    TEXTO_CLAUSULA_ADICIONAL: string;
  }>(raw.concClausulasAdicionalesAlimentos);
  const clausulasAdicionalesUnion = asArray(raw.concClausulasAdicionalesUnion);
  const clausulasAdicionalesDisolucion = asArray(
    raw.concClausulasAdicionalesDisolucion,
  );
  const clausulasAcuerdo = asArray<{
    NUMERO_CLAUSULA: string;
    TEXTO_CLAUSULA: string;
  }>(raw.concClausulasAcuerdo);

  // CLAUSULAS_ALIMENTOS is a fixed block (primero/segundo/tercero). The
  // template's {{#each CLAUSULAS_ALIMENTOS}} wraps the same 3 cláusulas —
  // we feed it a single-element array to render the block exactly once.
  const clausulasAlimentosSentinel =
    raw.concClausulaPrimeroAlimentos || raw.concClausulaSegundoAlimentos
      ? [{}]
      : [];

  // --- Conditional flags (derived from data; zero hand-editing required) ---
  const hasApoderadoConvocante = !!raw.concApoderadoConvocanteName;
  const hasApoderadoConvocado = !!raw.concApoderadoConvocadoName;
  const hasRepresentanteLegal = !!raw.concRepLegalName;
  const hasApoderadoDesistimiento = !!raw.concApoderadoDesistimientoName;
  const hasOtroMedio = !!raw.concOtroMedioComunicacion;
  const hasInfoAdicional = !!raw.concInfoAdicional;
  const hasAcuerdoLibre = !!raw.concAcuerdoConciliatorio;
  const hasMenoresUnion = menoresUnion.length > 0;
  const hasClausulasNumeradas = clausulasAcuerdo.length > 0;
  const hasClausulasAdicionalesAlimentos =
    clausulasAdicionalesAlimentos.length > 0;
  const hasClausulasAdicionalesUnion = clausulasAdicionalesUnion.length > 0;
  const hasClausulasAdicionalesDisolucion =
    clausulasAdicionalesDisolucion.length > 0;

  // Causa (terminación anormal) — mutually exclusive radio in the form
  const causa = (raw.concCausaTerminacion as string) || '';
  // Resultado del informe — mutually exclusive
  const resultado = (raw.concResultadoInforme as string) || '';

  return {
    // Arrays
    MENORES_ALIMENTOS: menoresAlimentos,
    MENORES_UNION: menoresUnion,
    CLAUSULAS_ALIMENTOS: clausulasAlimentosSentinel,
    CLAUSULAS_ADICIONALES_ALIMENTOS: clausulasAdicionalesAlimentos,
    CLAUSULAS_ADICIONALES_UNION: clausulasAdicionalesUnion,
    CLAUSULAS_ADICIONALES_DISOLUCION: clausulasAdicionalesDisolucion,
    CLAUSULAS_ACUERDO: clausulasAcuerdo,

    // Flags
    HAS_APODERADO_CONVOCANTE: hasApoderadoConvocante,
    HAS_APODERADO_CONVOCADO: hasApoderadoConvocado,
    HAS_REPRESENTANTE_LEGAL: hasRepresentanteLegal,
    HAS_APODERADO_DESISTIMIENTO: hasApoderadoDesistimiento,
    HAS_OTRO_MEDIO: hasOtroMedio,
    HAS_INFO_ADICIONAL: hasInfoAdicional,
    HAS_ACUERDO_LIBRE: hasAcuerdoLibre,
    HAS_MENORES_UNION: hasMenoresUnion,
    HAS_CLAUSULAS_NUMERADAS: hasClausulasNumeradas,
    HAS_CLAUSULAS_ADICIONALES_ALIMENTOS: hasClausulasAdicionalesAlimentos,
    HAS_CLAUSULAS_ADICIONALES_UNION: hasClausulasAdicionalesUnion,
    HAS_CLAUSULAS_ADICIONALES_DISOLUCION: hasClausulasAdicionalesDisolucion,

    // Causa terminación anormal
    CAUSA_PARTES_NO_ASISTIERON: causa === 'PARTES_NO_ASISTIERON',
    CAUSA_NO_SOLICITARON_RETIRO: causa === 'NO_SOLICITARON_RETIRO',
    CAUSA_OTRA: causa === 'OTRA',

    // Resultado informe conciliador
    RESULTADO_INASISTENCIA_CONVOCANTE: resultado === 'INASISTENCIA_CONVOCANTE',
    RESULTADO_INASISTENCIA_CONVOCADO: resultado === 'INASISTENCIA_CONVOCADO',
    RESULTADO_OTRO: resultado === 'OTRO',
  };
}

export function mapConciliationFields(
  caseData: CaseWithRelations,
): PlaceholderMap {
  const raw = caseData as Record<string, unknown>;
  const debtor = caseData.debtor;

  // Convocante = solicitante/deudor (the person requesting conciliation)
  const convocanteName = (raw.concConvocanteName as string) || debtor.name;
  const convocanteTipoId = (raw.concConvocanteTipoId as string) || 'CC';
  const convocanteId = (raw.concConvocanteId as string) || debtor.idNumber;
  const convocanteDir =
    (raw.concConvocanteDireccion as string) || debtor.address;
  const convocanteCiudad =
    (raw.concConvocanteCiudad as string) || debtor.city || '';
  const convocanteCorreo = (raw.concConvocanteCorreo as string) || debtor.email;
  const convocanteCel = (raw.concConvocanteCel as string) || debtor.phone;

  // Convocado = contraparte (the responding party)
  const convocadoName = (raw.concConvocadoName as string) || '';
  const convocadoTipoId = (raw.concConvocadoTipoId as string) || 'CC';
  const convocadoId = (raw.concConvocadoId as string) || '';
  const convocadoDir = (raw.concConvocadoDireccion as string) || '';
  const convocadoCiudad = (raw.concConvocadoCiudad as string) || '';
  const convocadoCorreo = (raw.concConvocadoCorreo as string) || '';
  const convocadoCel = (raw.concConvocadoCel as string) || '';

  // Representante legal (optional)
  const repLegalName = (raw.concRepLegalName as string) || '';
  const repLegalTipoId = (raw.concRepLegalTipoId as string) || 'CC';
  const repLegalId = (raw.concRepLegalId as string) || '';
  const repLegalDir = (raw.concRepLegalDireccion as string) || '';
  const repLegalCiudad = (raw.concRepLegalCiudad as string) || '';
  const repLegalCorreo = (raw.concRepLegalCorreo as string) || '';
  const repLegalCel = (raw.concRepLegalCel as string) || '';

  // Apoderado convocante (attorney for requesting party)
  const apodConvocanteName = (raw.concApoderadoConvocanteName as string) || '';
  const apodConvocanteTipoId =
    (raw.concApoderadoConvocanteTipoId as string) || 'CC';
  const apodConvocanteId = (raw.concApoderadoConvocanteId as string) || '';
  const apodConvocanteDir =
    (raw.concApoderadoConvocanteDireccion as string) || '';
  const apodConvocanteCiudad =
    (raw.concApoderadoConvocanteCiudad as string) || '';
  const apodConvocanteCorreo =
    (raw.concApoderadoConvocanteCorreo as string) || '';
  const apodConvocanteCel = (raw.concApoderadoConvocanteCel as string) || '';
  const apodConvocanteTP = (raw.concApoderadoConvocanteTP as string) || '';

  // Apoderado convocado (attorney for responding party)
  const apodConvocadoName = (raw.concApoderadoConvocadoName as string) || '';
  const apodConvocadoTipoId =
    (raw.concApoderadoConvocadoTipoId as string) || 'CC';
  const apodConvocadoId = (raw.concApoderadoConvocadoId as string) || '';
  const apodConvocadoCorreo =
    (raw.concApoderadoConvocadoCorreo as string) || '';
  const apodConvocadoCel = (raw.concApoderadoConvocadoCel as string) || '';
  const apodConvocadoTP = (raw.concApoderadoConvocadoTP as string) || '';

  // Conciliadora (operator/conciliator)
  const conciliadoraName =
    (raw.concConciliadoraName as string) || caseData.operator?.name || '';
  // LIMITACION (hallazgo A6): la cedula no tiene respaldo. `User` no guarda
  // ninguna identificacion —su unico numero es la tarjeta profesional— y
  // usarla tambien aca imprimiria el mismo numero en dos renglones que dicen
  // cosas distintas, en un documento legal. Queda en blanco hasta que exista
  // el dato.
  const conciliadoraCC = (raw.concConciliadoraCC as string) || '';
  // La tarjeta profesional si tiene respaldo: es exactamente
  // `User.professionalCard` del operador asignado al caso.
  const conciliadoraTP =
    (raw.concConciliadoraTP as string) ||
    caseData.operator?.professionalCard ||
    '';

  // Solicitud content
  const asunto = (raw.concAsunto as string) || '';
  const hechos = (raw.concDescripcionHechos as string) || '';
  const pretensiones = (raw.concPretensiones as string) || '';
  const cuantiaPesos = (raw.concCuantiaPesos as string) || '';
  const cuantiaLetras = (raw.concCuantiaLetras as string) || '';
  const pruebas = (raw.concRelacionPruebas as string) || '';

  // Agreement/Acta
  const acuerdoConciliatorio = (raw.concAcuerdoConciliatorio as string) || '';
  const infoAdicional = (raw.concInfoAdicional as string) || '';

  // Alimentos specific
  const clausulaPrimero = (raw.concClausulaPrimeroAlimentos as string) || '';
  const clausulaSegundo = (raw.concClausulaSegundoAlimentos as string) || '';
  const clausulaTercero = (raw.concClausulaTerceroAlimentos as string) || '';

  // Union marital specific
  const situacionBienes = (raw.concSituacionBienes as string) || '';
  const situacionAlimentos = (raw.concSituacionAlimentos as string) || '';

  // Aclaracion specific
  const campoConError = (raw.concCampoConError as string) || '';
  const descripcionError = (raw.concDescripcionError as string) || '';
  const valorIncorrecto = (raw.concValorIncorrecto as string) || '';
  const valorCorrecto = (raw.concValorCorrecto as string) || '';

  // Informe conciliador
  const descripcionResultado = (raw.concDescripcionResultado as string) || '';
  const tipoConstancia = (raw.concTipoConstanciaSolicitada as string) || '';

  // Terminacion anormal
  const descripcionCausaAnormal =
    (raw.concDescripcionCausaAnormal as string) || '';
  const horaProgramada = (raw.concHoraProgramada as string) || '';

  // Desistimiento
  const tipoSolicitanteDesistimiento =
    (raw.concTipoSolicitanteDesistimiento as string) || '';
  const apoderadoDesistimiento =
    (raw.concApoderadoDesistimientoName as string) || '';

  // Dates (citacion, solicitud, constancia, disolucion, union)
  const now = nowColombia();

  return {
    // Convocante
    NOMBRE_CONVOCANTE: convocanteName,
    TIPO_ID_CONVOCANTE: convocanteTipoId,
    ID_CONVOCANTE: convocanteId,
    DIRECCION_CONVOCANTE: convocanteDir,
    CIUDAD_CONVOCANTE: convocanteCiudad,
    CORREO_CONVOCANTE: convocanteCorreo,
    CEL_CONVOCANTE: convocanteCel,

    // Solicitante (alias for convocante in solicitud)
    NOMBRE_SOLICITANTE: convocanteName,
    TIPO_ID_SOLICITANTE: convocanteTipoId,
    ID_SOLICITANTE: convocanteId,
    DIRECCION_SOLICITANTE: convocanteDir,
    CIUDAD_SOLICITANTE: convocanteCiudad,
    CORREO_SOLICITANTE: convocanteCorreo,
    CEL_SOLICITANTE: convocanteCel,
    FECHA_NACIMIENTO_SOLICITANTE: (raw.concFechaNacimiento as string) || '',
    CORREO_NOTIFICACION: convocanteCorreo,
    OTRO_MEDIO_COMUNICACION: (raw.concOtroMedioComunicacion as string) || '',

    // Convocado
    NOMBRE_CONVOCADO: convocadoName,
    TIPO_ID_CONVOCADO: convocadoTipoId,
    ID_CONVOCADO: convocadoId,
    DIRECCION_CONVOCADO: convocadoDir,
    CIUDAD_CONVOCADO: convocadoCiudad,
    CORREO_CONVOCADO: convocadoCorreo,
    CEL_CONVOCADO: convocadoCel,
    TELEFONO_CONVOCADO: convocadoCel,

    // Representante legal
    NOMBRE_REPRESENTANTE_LEGAL: repLegalName,
    TIPO_ID_REPRESENTANTE_LEGAL: repLegalTipoId,
    ID_REPRESENTANTE_LEGAL: repLegalId,
    DIRECCION_REPRESENTANTE_LEGAL: repLegalDir,
    CIUDAD_REPRESENTANTE_LEGAL: repLegalCiudad,
    CORREO_REPRESENTANTE_LEGAL: repLegalCorreo,
    CEL_REPRESENTANTE_LEGAL: repLegalCel,

    // Apoderado convocante
    NOMBRE_APODERADO_CONVOCANTE: apodConvocanteName,
    TIPO_ID_APODERADO_CONVOCANTE: apodConvocanteTipoId,
    ID_APODERADO_CONVOCANTE: apodConvocanteId,
    DIRECCION_APODERADO_CONVOCANTE: apodConvocanteDir,
    CIUDAD_APODERADO_CONVOCANTE: apodConvocanteCiudad,
    CORREO_APODERADO_CONVOCANTE: apodConvocanteCorreo,
    CEL_APODERADO_CONVOCANTE: apodConvocanteCel,
    TP_APODERADO_CONVOCANTE: apodConvocanteTP,

    // Apoderado convocado
    NOMBRE_APODERADO_CONVOCADO: apodConvocadoName,
    TIPO_ID_APODERADO_CONVOCADO: apodConvocadoTipoId,
    ID_APODERADO_CONVOCADO: apodConvocadoId,
    CORREO_APODERADO_CONVOCADO: apodConvocadoCorreo,
    CEL_APODERADO_CONVOCADO: apodConvocadoCel,
    TP_APODERADO_CONVOCADO: apodConvocadoTP,

    // Conciliadora
    NOMBRE_CONCILIADORA: conciliadoraName,
    CC_CONCILIADORA: conciliadoraCC,
    TP_CONCILIADORA: conciliadoraTP,

    // Case/process identification
    NUMERO_ACTA: caseData.caseNumber || '',
    ANO_ACTA: getYear(now),
    ASUNTO: asunto,

    // Solicitud content
    DESCRIPCION_HECHOS: hechos,
    PRETENSIONES: pretensiones,
    CUANTIA_PESOS: cuantiaPesos
      ? formatCurrency(Number(cuantiaPesos) || 0)
      : '',
    CUANTIA_LETRAS: cuantiaLetras,
    RELACION_PRUEBAS: pruebas,

    // Agreement/Acta
    ACUERDO_CONCILIATORIO: acuerdoConciliatorio,
    INFO_ADICIONAL: infoAdicional,

    // Alimentos
    CLAUSULA_PRIMERO_ALIMENTOS: clausulaPrimero,
    CLAUSULA_SEGUNDO_ALIMENTOS: clausulaSegundo,
    CLAUSULA_TERCERO_ALIMENTOS: clausulaTercero,
    NOMBRE_MENOR: (raw.concNombreMenor as string) || '________________',
    NOMBRE_MENOR_UNION: (raw.concNombreMenor as string) || '________________',

    // Cláusulas adicionales (texto libre — modelo simple, multi-cláusula = futuro)
    NUMERO_CLAUSULA: (raw.concNumeroClausula as string) || 'CUARTO',
    TEXTO_CLAUSULA: (raw.concTextoClausula as string) || '',
    NUMERO_CLAUSULA_ADICIONAL:
      (raw.concNumeroClausulaAdicional as string) || 'CUARTO',
    TEXTO_CLAUSULA_ADICIONAL: (raw.concTextoClausulaAdicional as string) || '',

    // Union marital
    DIA_INICIO_UNION: (raw.concDiaInicioUnion as string) || '____',
    MES_INICIO_UNION: (raw.concMesInicioUnion as string) || '____________',
    ANO_INICIO_UNION: (raw.concAnoInicioUnion as string) || '______',

    // Disolucion union
    DIA_DECLARACION_UNION: (raw.concDiaDeclaracionUnion as string) || '____',
    MES_DECLARACION_UNION:
      (raw.concMesDeclaracionUnion as string) || '____________',
    ANO_DECLARACION_UNION: (raw.concAnoDeclaracionUnion as string) || '______',
    NUMERO_ACTA_UNION_REF: (raw.concNumeroActaUnionRef as string) || '',
    NUMERO_TRAMITE_UNION_REF: (raw.concNumeroTramiteUnionRef as string) || '',
    DIA_DISOLUCION: (raw.concDiaDisolucion as string) || '____',
    MES_DISOLUCION: (raw.concMesDisolucion as string) || '____________',
    ANO_DISOLUCION: (raw.concAnoDisolucion as string) || '______',
    SITUACION_BIENES: situacionBienes,
    SITUACION_ALIMENTOS: situacionAlimentos,

    // Aclaracion
    DIA_ACTA_ORIGINAL: (raw.concDiaActaOriginal as string) || '____',
    MES_ACTA_ORIGINAL: (raw.concMesActaOriginal as string) || '____________',
    ANO_ACTA_ORIGINAL: (raw.concAnoActaOriginal as string) || '______',
    CAMPO_CON_ERROR: campoConError,
    DESCRIPCION_ERROR: descripcionError,
    VALOR_INCORRECTO: valorIncorrecto,
    VALOR_CORRECTO: valorCorrecto,
    FECHA_SOLICITUD: formatDate(now),

    // Citation dates
    DIA_CITACION: (raw.concDiaCitacion as string) || getDayNumber(now),
    MES_CITACION: (raw.concMesCitacion as string) || getMonthName(now),
    ANO_CITACION: (raw.concAnoCitacion as string) || getYear(now),

    // Solicitud dates
    DIA_SOLICITUD: (raw.concDiaSolicitud as string) || getDayNumber(now),
    MES_SOLICITUD: (raw.concMesSolicitud as string) || getMonthName(now),
    ANO_SOLICITUD: (raw.concAnoSolicitud as string) || getYear(now),

    // Constancia/document issuance dates
    DIA_CONSTANCIA: getDayNumber(now),
    MES_CONSTANCIA: getMonthName(now),
    ANO_CONSTANCIA: getYear(now),

    // Informe conciliador
    DESCRIPCION_RESULTADO: descripcionResultado,
    TIPO_CONSTANCIA_SOLICITADA: tipoConstancia,

    // Terminacion anormal
    HORA_PROGRAMADA: horaProgramada,
    DESCRIPCION_CAUSA_ANORMAL: descripcionCausaAnormal,

    // Desistimiento
    DIA_DESISTIMIENTO:
      (raw.concDiaDesistimiento as string) || getDayNumber(now),
    MES_DESISTIMIENTO:
      (raw.concMesDesistimiento as string) || getMonthName(now),
    ANO_DESISTIMIENTO: (raw.concAnoDesistimiento as string) || getYear(now),
    TIPO_SOLICITANTE_DESISTIMIENTO: tipoSolicitanteDesistimiento,
    NOMBRE_APODERADO_DESISTIMIENTO: apoderadoDesistimiento,
  };
}
