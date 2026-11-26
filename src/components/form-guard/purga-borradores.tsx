'use client';

import { useEffect } from 'react';

import { identidadDeSesion } from '@/hooks/use-borrador-formulario';
import {
  almacenamientoLocal,
  hayBorradores,
  purgarBorradores,
} from '@/lib/borradores';

/**
 * Limpieza de borradores al cargar la app: borra los vencidos (48 h) y, si hay
 * sesión, los de cualquier otro usuario o centro guardados en este navegador.
 *
 * Solo consulta la sesión si hay algún borrador guardado: en el caso normal no
 * hace ninguna petición. Sin sesión (p. ej. en /login) borra solo los vencidos:
 * un borrador propio sobrevive a una expiración de sesión.
 */
export function PurgaBorradores() {
  useEffect(() => {
    const storage = almacenamientoLocal();
    if (!storage || !hayBorradores(storage)) return;
    purgarBorradores(storage, null);
    let cancelado = false;
    void identidadDeSesion().then((identidad) => {
      // Sin sesión verificable no se toca nada más.
      if (cancelado || !identidad) return;
      purgarBorradores(storage, identidad);
    });
    return () => {
      cancelado = true;
    };
  }, []);
  return null;
}
