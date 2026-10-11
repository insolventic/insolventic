'use client';

import * as React from 'react';
import {
  useController,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form';

import { Input } from '@/components/ui/input';
import {
  formatearMientrasEscribe,
  formatearMonto,
  parsearMonto,
} from '@/features/case/monto';

/**
 * Campo de dinero con separador de miles mientras se escribe.
 *
 * POR QUÉ NO ES UN `<input type="number">`. Un input numérico nativo **rechaza
 * el punto**: el navegador no deja escribirlo y el valor queda inválido, así
 * que `1.500.000` es imposible de mostrar. Por eso esto es `type="text"` con
 * `inputMode="numeric"`, que además levanta el teclado numérico en celular.
 *
 * LO QUE VIAJA AL FORMULARIO ES EL TEXTO FORMATEADO, no el número. Suena raro,
 * pero es lo correcto acá: el schema ya acepta string y lo parsea
 * (`montoOpcional`), el parseo es uno solo y está testeado, y así el campo no
 * pelea con quien escribe —si guardáramos el número tendríamos que reformatear
 * en cada tecla y el cursor saltaría—. `parsearMonto` es quien decide qué
 * significa cada punto y cada coma; su docblock tiene la regla.
 *
 * Funciona con los dos patrones que hay en el formulario: las secciones que
 * usan `useFormContext` (no hace falta pasar `control`) y las que tienen su
 * propio `useForm` (`income-section`, `debts-tab`), que lo pasan explícito.
 *
 * NO usar para campos numéricos que no son dinero —edad, meses, porcentaje,
 * días de mora—: ésos siguen siendo `type="number"`, no llevan separador y su
 * punto significa decimal sin ambigüedad.
 */
type PropsBase = Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'value' | 'onChange' | 'defaultValue' | 'name'
>;

/** La forma mínima del campo que necesita: la que dan `useController` y `Controller`. */
export interface CampoDeMonto {
  name: string;
  value: unknown;
  onChange: (valor: unknown) => void;
  onBlur: () => void;
  ref: React.Ref<HTMLInputElement>;
}

/**
 * La versión que recibe el campo ya resuelto, para los call sites que ya están
 * dentro de un `<FormField render={({ field }) => …}>`: ahí el campo lo provee
 * el `Controller` de afuera y volver a llamar `useController` sería registrar
 * dos veces el mismo nombre.
 */
export function MoneyInputField({
  field,
  ...props
}: PropsBase & { field: CampoDeMonto }) {
  const [texto, setTexto] = React.useState(() => formatearMonto(field.value));

  // Resincronizar cuando el valor cambia DESDE AFUERA (cargar un expediente,
  // un `reset`, un cálculo automático). Se compara por valor parseado y no por
  // texto: si no, el formateo propio dispararía el efecto y el campo se pelea
  // con quien está escribiendo.
  const valorDelForm = field.value;
  React.useEffect(() => {
    const aMostrar = formatearMonto(valorDelForm);
    setTexto((actual) =>
      parsearMonto(actual) === parsearMonto(aMostrar) ? actual : aMostrar,
    );
  }, [valorDelForm]);

  return (
    <Input
      {...props}
      name={field.name}
      ref={field.ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={texto}
      onBlur={field.onBlur}
      onChange={(e) => {
        const formateado = formatearMientrasEscribe(e.target.value);
        setTexto(formateado);
        field.onChange(formateado);
      }}
    />
  );
}

/**
 * La versión por nombre, para los call sites que usan `register`. Resuelve el
 * campo sola: con `control` si el formulario es propio de la sección, o por
 * contexto si no.
 */
export function MoneyInput<T extends FieldValues = FieldValues>({
  name,
  control,
  ...props
}: PropsBase & { name: string; control?: Control<T> }) {
  // Genérico en el tipo del formulario porque los `Control<T>` de RHF son
  // invariantes: un `Control<FormDeBienes>` no es asignable a
  // `Control<FieldValues>`, y las pestañas de edición tienen cada una el suyo.
  const { field } = useController({ name: name as Path<T>, control });
  return <MoneyInputField field={field as unknown as CampoDeMonto} {...props} />;
}
