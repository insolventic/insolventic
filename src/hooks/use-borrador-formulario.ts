'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

import {
  almacenamientoLocal,
  eliminarBorrador,
  claveBorrador,
  guardarBorrador,
  leerBorrador,
  type IdentidadBorrador,
  type SobreBorrador,
} from '@/lib/borradores';
import { logger } from '@/lib/logger';

/** Espera tras la última edición antes de guardar el borrador. */
export const DEBOUNCE_BORRADOR_MS = 1000;

export interface OpcionesBorrador<
  T extends FieldValues,
  C = unknown,
  TT extends FieldValues = T,
> {
  // El tercer genérico es el tipo transformado por el resolver (Zod): el
  // borrador solo lee y escribe valores crudos, así que acepta cualquiera.
  form: UseFormReturn<T, C, TT>;
  /** Nombre estable del formulario: `caso-nuevo:INSOLVENCY`, `deudor-edicion`… */
  formulario: string;
  /** Id del registro en los formularios de edición. */
  entidadId?: string | null;
  /** Versión del esquema del borrador: subirla descarta los borradores viejos. */
  version: number;
  /** El formulario está abierto y listo (datos de la entidad ya cargados). */
  activo: boolean;
  /**
   * Versión del registro editado (p. ej. `case.version`). Si el borrador se
   * guardó sobre otra versión, se descarta: restaurarlo pisaría cambios más
   * nuevos de otra persona.
   */
  versionEntidad?: string | null;
  /** Metadatos extra a guardar con cada borrador (nombres de adjuntos). */
  extra?: () => SobreBorrador['extra'] | undefined;
  /** Solo para tests: resolver la identidad sin pasar por el servidor. */
  resolverIdentidad?: () => Promise<IdentidadBorrador | null>;
}

export interface BorradorPendiente {
  guardadoEn: Date;
  adjuntos: string[];
}

export interface EstadoBorrador {
  /** Hay un borrador guardado esperando que el usuario decida. */
  pendiente: BorradorPendiente | null;
  /** Se descartó uno por ser de otra versión del registro o del esquema. */
  descartadoPorVersion: boolean;
  /** Existe un borrador guardado para este formulario (para "Descartar borrador"). */
  hayBorradorGuardado: boolean;
  /** Adjuntos que había al guardar el borrador restaurado (para avisar). */
  adjuntosPorRecargar: string[];
  restaurar: () => void;
  empezarDeCero: () => void;
  /** Borra el borrador y devuelve el formulario a sus valores iniciales. */
  descartar: () => void;
  /** Borra el borrador sin tocar el formulario (envío exitoso). */
  limpiar: () => void;
}

/**
 * Centro y usuario de la sesión, para la clave del borrador. Importación
 * diferida: el módulo de auth es de servidor (server actions) y solo hace falta
 * cuando se abre un formulario.
 */
export async function identidadDeSesion(): Promise<IdentidadBorrador | null> {
  try {
    const { validateSession } = await import('@/features/auth/actions');
    const r = await validateSession();
    return r.valid && r.user
      ? { userId: r.user.id, tenantId: r.user.tenantId }
      : null;
  } catch {
    return null;
  }
}

/**
 * Autoguardado de borrador de un formulario react-hook-form.
 *
 * - Guarda los valores con un debounce de 1 s, solo si el formulario tiene
 *   cambios y no hay un borrador anterior esperando decisión (para no pisarlo
 *   con el formulario vacío).
 * - Al activarse, si hay un borrador vigente lo ofrece (`pendiente`).
 * - Los borradores vencidos, de otra versión, corruptos o ajenos se descartan
 *   sin romper (ver `leerBorrador`).
 */
export function useBorradorFormulario<
  T extends FieldValues,
  C = unknown,
  TT extends FieldValues = T,
>(opciones: OpcionesBorrador<T, C, TT>): EstadoBorrador {
  const {
    form,
    formulario,
    entidadId,
    version,
    activo,
    versionEntidad,
    extra,
    resolverIdentidad = identidadDeSesion,
  } = opciones;

  const [identidad, setIdentidad] = useState<IdentidadBorrador | null>(null);
  const [pendiente, setPendiente] = useState<BorradorPendiente | null>(null);
  const [descartadoPorVersion, setDescartadoPorVersion] = useState(false);
  const [hayBorradorGuardado, setHayBorradorGuardado] = useState(false);
  const [adjuntosPorRecargar, setAdjuntosPorRecargar] = useState<string[]>([]);
  const datosPendientesRef = useRef<T | null>(null);
  // Mientras haya un borrador por decidir no se autoguarda.
  const decidiendoRef = useRef(false);
  const extraRef = useRef(extra);
  extraRef.current = extra;
  // Leer isDirty en el render suscribe el formulario a ese estado (react-hook-form
  // solo lo calcula si alguien lo lee); el autoguardado lo consulta en un timer.
  void form.formState.isDirty;

  // 1) Al activarse: resolver identidad y buscar borrador.
  useEffect(() => {
    if (!activo) {
      setPendiente(null);
      setDescartadoPorVersion(false);
      setAdjuntosPorRecargar([]);
      decidiendoRef.current = false;
      return;
    }
    let cancelado = false;
    void resolverIdentidad().then((id) => {
      if (cancelado || !id) return;
      setIdentidad(id);
      const storage = almacenamientoLocal();
      if (!storage) return;
      const lectura = leerBorrador<T>(
        storage,
        id,
        formulario,
        entidadId,
        version,
      );
      if (lectura.estado === 'descartado') {
        if (lectura.motivo === 'version') setDescartadoPorVersion(true);
        setHayBorradorGuardado(false);
        return;
      }
      if (lectura.estado !== 'vigente') {
        setHayBorradorGuardado(false);
        return;
      }
      const sobre = lectura.sobre;
      const versionGuardada = sobre.extra?.versionEntidad ?? null;
      if (
        versionEntidad != null &&
        versionGuardada != null &&
        versionGuardada !== versionEntidad
      ) {
        eliminarBorrador(storage, claveBorrador(id, formulario, entidadId));
        setDescartadoPorVersion(true);
        setHayBorradorGuardado(false);
        return;
      }
      datosPendientesRef.current = sobre.datos;
      decidiendoRef.current = true;
      setHayBorradorGuardado(true);
      setPendiente({
        guardadoEn: new Date(sobre.guardadoEn),
        adjuntos: sobre.extra?.adjuntos ?? [],
      });
    });
    return () => {
      cancelado = true;
    };
  }, [
    activo,
    formulario,
    entidadId,
    version,
    versionEntidad,
    resolverIdentidad,
  ]);

  // 2) Autoguardado con debounce. `useWatch` (no `form.watch(callback)`):
  //    re-renderiza con cada cambio de valores, venga de una tecla, de un
  //    `setValue` o de un evento sintético, y el efecto reinicia la espera.
  const valores = useWatch({ control: form.control });
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const guardarAhora = () => {
    if (!identidad || decidiendoRef.current || !form.formState.isDirty) return;
    const storage = almacenamientoLocal();
    if (!storage) return;
    const ok = guardarBorrador(
      storage,
      identidad,
      formulario,
      entidadId,
      version,
      form.getValues(),
      {
        ...(extraRef.current?.() ?? {}),
        ...(versionEntidad != null ? { versionEntidad } : {}),
      },
    );
    if (ok) setHayBorradorGuardado(true);
    else
      logger.warn('No se pudo guardar el borrador', {
        action: 'borrador-formulario',
        formulario,
      });
  };
  const guardarAhoraRef = useRef(guardarAhora);
  guardarAhoraRef.current = guardarAhora;

  // Al cerrar o desmontar el formulario, lo pendiente se guarda ya: cerrar
  // antes de que venza la espera no debe perder lo último escrito. Va antes
  // del efecto del debounce para que su limpieza corra primero.
  useEffect(() => {
    if (!activo) return;
    return () => {
      if (temporizadorRef.current) {
        clearTimeout(temporizadorRef.current);
        temporizadorRef.current = null;
        guardarAhoraRef.current();
      }
    };
  }, [activo]);

  useEffect(() => {
    if (!activo || !identidad) return;
    temporizadorRef.current = setTimeout(() => {
      temporizadorRef.current = null;
      guardarAhoraRef.current();
    }, DEBOUNCE_BORRADOR_MS);
    return () => {
      if (temporizadorRef.current) {
        clearTimeout(temporizadorRef.current);
        temporizadorRef.current = null;
      }
    };
  }, [valores, activo, identidad]);

  const borrar = useCallback(() => {
    const storage = almacenamientoLocal();
    if (storage && identidad) {
      eliminarBorrador(
        storage,
        claveBorrador(identidad, formulario, entidadId),
      );
    }
    setHayBorradorGuardado(false);
  }, [identidad, formulario, entidadId]);

  const restaurar = useCallback(() => {
    const datos = datosPendientesRef.current;
    if (datos) {
      // keepDefaultValues: el formulario queda "con cambios" respecto de sus
      // valores iniciales, así la X pide confirmación y el autoguardado sigue.
      form.reset(datos, { keepDefaultValues: true });
    }
    setAdjuntosPorRecargar(pendiente?.adjuntos ?? []);
    datosPendientesRef.current = null;
    decidiendoRef.current = false;
    setPendiente(null);
  }, [form, pendiente]);

  const empezarDeCero = useCallback(() => {
    borrar();
    datosPendientesRef.current = null;
    decidiendoRef.current = false;
    setPendiente(null);
  }, [borrar]);

  const descartar = useCallback(() => {
    borrar();
    datosPendientesRef.current = null;
    decidiendoRef.current = false;
    setPendiente(null);
    setAdjuntosPorRecargar([]);
    form.reset();
    // Los campos registrados sin valor inicial vuelven a registrarse con ''
    // frente a un default `undefined`, y react-hook-form los contaría como
    // cambios: el formulario quedaría "con cambios" sin que nadie tocara nada.
    // En el siguiente ciclo, lo que quedó pasa a ser el estado inicial.
    setTimeout(() => form.reset(form.getValues()), 0);
  }, [borrar, form]);

  const limpiar = useCallback(() => {
    borrar();
    datosPendientesRef.current = null;
    decidiendoRef.current = false;
    setPendiente(null);
  }, [borrar]);

  return {
    pendiente,
    descartadoPorVersion,
    hayBorradorGuardado,
    adjuntosPorRecargar,
    restaurar,
    empezarDeCero,
    descartar,
    limpiar,
  };
}
