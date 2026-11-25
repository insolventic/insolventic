'use client';

import * as React from 'react';
import { useController, useFormContext } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import {
  pesosAlSalir,
  pesosMientrasEscribe,
} from '@/features/case/gastos-mensuales';

type PropsBase = Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'value' | 'onChange' | 'defaultValue' | 'name' | 'onBlur'
>;

/**
 * Campo de pesos ENTEROS (gastos mensuales), con separador de miles.
 *
 * Diferencia con `MoneyInput`: aquel interpreta la coma como decimal mientras
 * se escribe, así que `1,234,567` pegado se volvía `1,23`. Acá se aceptan los
 * dos separadores de miles y solo los decimales reales dan error; la regla
 * vive en `leerPesosEnteros` y es la misma que aplica el servidor. Lo que
 * viaja al formulario es el texto, igual que en `MoneyInput`.
 *
 * Accesibilidad: se marca `aria-invalid` y se enlaza el mensaje de error con
 * `aria-describedby` (el `<p>` lo renderiza quien usa el campo, con el id
 * `${id}-error`).
 */
export function PesosInput({
  name,
  id,
  ...props
}: PropsBase & { name: string; id: string }) {
  const { control } = useFormContext();
  const { field, fieldState } = useController({ name, control });
  const [texto, setTexto] = React.useState(() =>
    pesosAlSalir(String(field.value ?? '')),
  );

  // Resincronizar cuando el valor cambia desde afuera (reset al abrir, datos
  // de prueba). Se compara contra el texto propio para no pelear con quien
  // escribe.
  const valorDelForm = String(field.value ?? '');
  React.useEffect(() => {
    setTexto((actual) => (actual === valorDelForm ? actual : valorDelForm));
  }, [valorDelForm]);

  const invalido = Boolean(fieldState.error);

  return (
    <Input
      {...props}
      id={id}
      name={field.name}
      ref={field.ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="$0"
      value={texto}
      aria-invalid={invalido || undefined}
      aria-describedby={
        [props['aria-describedby'], invalido ? `${id}-error` : undefined]
          .filter(Boolean)
          .join(' ') || undefined
      }
      onChange={(e) => {
        const siguiente = pesosMientrasEscribe(e.target.value, texto);
        setTexto(siguiente);
        field.onChange(siguiente);
      }}
      onBlur={() => {
        const normalizado = pesosAlSalir(texto);
        if (normalizado !== texto) {
          setTexto(normalizado);
          field.onChange(normalizado);
        }
        field.onBlur();
      }}
    />
  );
}
