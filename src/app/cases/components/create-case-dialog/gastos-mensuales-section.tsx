'use client';

import { useRef } from 'react';
import {
  useFieldArray,
  useFormContext,
  useFormState,
  useWatch,
  type FieldErrors,
} from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PesosInput } from '@/components/ui/pesos-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CONCEPTOS_GASTO,
  GRUPOS_GASTO,
  MAX_LARGO_CONCEPTO_OTRO,
  MAX_OTROS_GASTOS,
  equivalenteMensual,
  periodicidadDe,
  pesosOIndefinido,
  totalEnVivo,
  type ConceptoGasto,
  type EntradaGastos,
} from '@/features/case/gastos-mensuales';
import type { CreateCaseFormInput } from '@/features/case/schemas';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

/** Texto que acompaña al valor digitado cuando no es mensual. */
function etiquetaDelValor(concepto: ConceptoGasto, periodicidadId: string) {
  const p = periodicidadDe(concepto, periodicidadId);
  if (p.divisor === 1) return 'Valor mensual';
  if (p.divisor === 12) return 'Valor anual';
  if (p.divisor === 6) return 'Valor semestral';
  return `Valor por ${p.divisor} meses`;
}

type ErroresGastosForm = FieldErrors<
  NonNullable<CreateCaseFormInput['gastosMensuales']>
>;

function mensajeDe(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message;
    return typeof m === 'string' ? m : undefined;
  }
  return undefined;
}

function MensajeError({ id, mensaje }: { id: string; mensaje?: string }) {
  if (!mensaje) return null;
  return (
    <p id={`${id}-error`} className="text-destructive text-sm">
      {mensaje}
    </p>
  );
}

/**
 * Bloque "Gastos mensuales" de la Sección III: un valor por concepto, agrupado,
 * con prorrateo donde aplica, una lista libre de "Otros" y el total en vivo.
 *
 * El total de acá es solo para la vista: el servidor lo recalcula con la misma
 * función (`calcularGastos`) y es el que se guarda y va a los documentos.
 */
export function GastosMensualesSection() {
  const { control, register, setValue } = useFormContext<CreateCaseFormInput>();
  const gastos = useWatch({ control, name: 'gastosMensuales' }) as
    | EntradaGastos
    | undefined;
  const { errors } = useFormState({ control, name: 'gastosMensuales' });
  const erroresGastos = errors.gastosMensuales as ErroresGastosForm | undefined;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'gastosMensuales.otros',
  });
  const botonAgregarRef = useRef<HTMLButtonElement>(null);

  const total = totalEnVivo(gastos);

  const quitarOtro = (index: number) => {
    remove(index);
    // El foco no se pierde: pasa al botón de quitar de la fila que ocupa el
    // lugar, o al de "Agregar gasto" si era la última.
    requestAnimationFrame(() => {
      const siguiente = document.getElementById(`gasto-otro-quitar-${index}`);
      (siguiente ?? botonAgregarRef.current)?.focus();
    });
  };

  return (
    <div>
      <h4 className="text-muted-foreground mb-3 text-sm font-medium">
        Gastos mensuales
      </h4>

      <div className="space-y-4">
        {GRUPOS_GASTO.filter((g) => g.id !== 'OTROS').map((grupo) => (
          <fieldset key={grupo.id} className="rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">
              {grupo.titulo}
            </legend>
            <div className="space-y-3">
              {CONCEPTOS_GASTO.filter((c) => c.grupo === grupo.id).map(
                (concepto) => {
                  const linea = gastos?.conceptos?.[concepto.clave];
                  const periodicidadId = periodicidadDe(
                    concepto,
                    linea?.periodicidad,
                  ).id;
                  const divisor = periodicidadDe(
                    concepto,
                    periodicidadId,
                  ).divisor;
                  const id = `gasto-${concepto.clave}`;
                  const error = mensajeDe(
                    erroresGastos?.conceptos?.[concepto.clave]?.valor,
                  );
                  const valor = pesosOIndefinido(linea?.valor);
                  const tieneSelector = concepto.periodicidades.length > 1;

                  return (
                    <div
                      key={concepto.clave}
                      className="grid grid-cols-1 items-start gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] md:gap-4"
                    >
                      <Label htmlFor={id} className="pt-2.5">
                        {concepto.etiqueta}
                      </Label>

                      <div>
                        {tieneSelector ? (
                          <Select
                            value={periodicidadId}
                            onValueChange={(v) =>
                              setValue(
                                `gastosMensuales.conceptos.${concepto.clave}.periodicidad`,
                                v,
                                { shouldDirty: true },
                              )
                            }
                          >
                            <SelectTrigger
                              id={`${id}-periodicidad`}
                              aria-label={`Tipo de ${concepto.etiqueta.toLowerCase()}`}
                              className="w-full"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {concepto.periodicidades.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.etiqueta}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : divisor !== 1 ? (
                          <p className="text-muted-foreground pt-2.5 text-xs">
                            {etiquetaDelValor(concepto, periodicidadId)}
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-1">
                        <PesosInput
                          id={id}
                          name={`gastosMensuales.conceptos.${concepto.clave}.valor`}
                          aria-describedby={
                            divisor !== 1 ? `${id}-mensual` : undefined
                          }
                        />
                        <MensajeError id={id} mensaje={error} />
                      </div>

                      <div>
                        {divisor !== 1 && (
                          <p
                            id={`${id}-mensual`}
                            className="text-muted-foreground pt-2.5 text-sm"
                            data-testid={`${id}-mensual`}
                          >
                            <span className="sr-only">
                              {etiquetaDelValor(concepto, periodicidadId)};
                              equivalente mensual:{' '}
                            </span>
                            {formatCurrency(
                              valor === undefined
                                ? 0
                                : equivalenteMensual(valor, divisor),
                            )}{' '}
                            <span className="text-xs">/ mes (÷ {divisor})</span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </fieldset>
        ))}

        {/* Otros: lista libre */}
        <fieldset className="rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold">Otros</legend>
          {fields.length === 0 ? (
            <p className="text-muted-foreground mb-3 text-sm">
              Sin otros gastos. Use el botón para agregar uno (por ejemplo,
              gas).
            </p>
          ) : (
            <div className="mb-3 space-y-3">
              {fields.map((field, index) => {
                const idConcepto = `gasto-otro-${index}-concepto`;
                const idValor = `gasto-otro-${index}-valor`;
                const errorConcepto = mensajeDe(
                  erroresGastos?.otros?.[index]?.concepto,
                );
                const errorValor = mensajeDe(
                  erroresGastos?.otros?.[index]?.valor,
                );
                return (
                  <div
                    key={field.id}
                    className="grid grid-cols-1 items-start gap-2 md:grid-cols-[minmax(0,3.2fr)_minmax(0,1.5fr)_auto_minmax(0,1.5fr)] md:gap-4"
                  >
                    <div className="space-y-1">
                      <Label htmlFor={idConcepto} className="sr-only">
                        Concepto del gasto {index + 1}
                      </Label>
                      <Input
                        id={idConcepto}
                        placeholder="Concepto (ej: Gas)"
                        maxLength={MAX_LARGO_CONCEPTO_OTRO}
                        aria-invalid={errorConcepto ? true : undefined}
                        aria-describedby={
                          errorConcepto ? `${idConcepto}-error` : undefined
                        }
                        {...register(`gastosMensuales.otros.${index}.concepto`)}
                      />
                      <MensajeError id={idConcepto} mensaje={errorConcepto} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={idValor} className="sr-only">
                        Valor mensual del gasto {index + 1}
                      </Label>
                      <PesosInput
                        id={idValor}
                        name={`gastosMensuales.otros.${index}.valor`}
                      />
                      <MensajeError id={idValor} mensaje={errorValor} />
                    </div>
                    <Button
                      id={`gasto-otro-quitar-${index}`}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => quitarOtro(index)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                      aria-label={`Quitar gasto ${index + 1}${
                        gastos?.otros?.[index]?.concepto
                          ? `: ${gastos.otros[index]?.concepto}`
                          : ''
                      }`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div />
                  </div>
                );
              })}
            </div>
          )}
          <Button
            ref={botonAgregarRef}
            type="button"
            variant="outline"
            size="sm"
            disabled={fields.length >= MAX_OTROS_GASTOS}
            onClick={() =>
              append(
                { concepto: '', valor: '' },
                {
                  shouldFocus: true,
                  focusName: `gastosMensuales.otros.${fields.length}.concepto`,
                },
              )
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar gasto
          </Button>
        </fieldset>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)] md:items-center">
          <Label htmlFor="gasto-total" className="font-semibold">
            Total gastos mensuales
          </Label>
          <Input
            id="gasto-total"
            type="text"
            readOnly
            className="bg-muted font-semibold"
            value={formatCurrency(total)}
            aria-live="polite"
          />
        </div>
      </div>
    </div>
  );
}
