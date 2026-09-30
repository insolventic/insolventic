/**
 * @jest-environment jsdom
 */

/**
 * Bug: el formulario de "agregar bien" del diálogo de edición quedaba a medio
 * limpiar al pasar de un bien al siguiente.
 *
 * Tras agregar un bien con éxito se llamaba `newAssetForm.reset({...})` con SOLO
 * 5 de las 22 claves del formulario. La clave del asunto es que `reset(values)`
 * de react-hook-form NO vuelve a los `defaultValues`: reemplaza el estado por
 * `values`, así que las 17 claves omitidas desaparecían del estado.
 *
 * Lo que eso producía, medido (no supuesto) — los tres tests del grupo 1:
 *
 *  - las 5 claves del reset: limpias, correcto;
 *  - las 2 casillas: pasaban a `undefined`. Radix las pinta desmarcadas, así que
 *    en pantalla se veían bien, pero el estado dejaba de ser booleano;
 *  - los 15 campos de texto: el `<Input>` registrado CONSERVABA en el DOM el
 *    texto del bien anterior, mientras el estado del formulario ya no tenía la
 *    clave. Pantalla y dato guardado se contradecían.
 *
 * El arreglo es una sola fuente (`emptyAssetForm`) para `defaultValues` y para el
 * `reset`, así que ningún campo puede quedar fuera.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';
import { useForm } from 'react-hook-form';
import { Prisma } from '@prisma/client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { addAssetToCaseSchema } from '@/features/case/schemas';

const SOURCE = fs.readFileSync(
  path.join(
    process.cwd(),
    'src/app/cases/components/edit-case-dialog/assets-tab.tsx',
  ),
  'utf-8',
);

/** Claves del formulario de bien, leídas del schema que lo valida. */
const FORM_FIELDS = Object.keys(addAssetToCaseSchema.shape);

/**
 * Claves booleanas del formulario: las columnas `Boolean` de `Asset` que el
 * formulario expone. Se cruzan las dos fuentes en vez de escribir la lista a
 * mano, para que un booleano nuevo aparezca acá solo.
 */
function booleanFormFields(): string[] {
  const assetModel = Prisma.dmmf.datamodel.models.find(
    (m) => m.name === 'Asset',
  );
  const booleanColumns = new Set(
    (assetModel?.fields ?? [])
      .filter((f) => f.type === 'Boolean')
      .map((f) => f.name),
  );
  return FORM_FIELDS.filter((key) => booleanColumns.has(key)).sort();
}

/** El bloque `emptyAssetForm` del componente, como texto. */
function emptyFormBlock(): string {
  const start = SOURCE.indexOf('function emptyAssetForm');
  expect(start).toBeGreaterThan(-1);
  return SOURCE.slice(start, SOURCE.indexOf('\n}', start));
}

/** Nombres de propiedad (`clave:`) que aparecen en un fragmento de código. */
function keysIn(block: string): Set<string> {
  return new Set(
    [...block.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*[:,]/gm)].map((m) => m[1]),
  );
}

/**
 * Claves que el `reset` deja efectivamente en blanco.
 *
 * Resuelve las dos formas posibles, para que el test siga siendo un guard si
 * alguien cambia el helper por un objeto literal (o al revés):
 *  - `reset(emptyAssetForm(caseId))` → las claves del helper;
 *  - `reset({ ...literal })`         → las claves del literal.
 */
function effectiveResetKeys(): Set<string> {
  const call = SOURCE.indexOf('newAssetForm.reset(');
  expect(call).toBeGreaterThan(-1);
  const arg = SOURCE.slice(call, SOURCE.indexOf(';', call));

  if (arg.includes('emptyAssetForm')) return keysIn(emptyFormBlock());
  return keysIn(arg);
}

describe('formulario de bienes (edición) — limpieza entre un bien y el siguiente', () => {
  describe('1. el mecanismo del bug (medido)', () => {
    it('reset() parcial deja las claves omitidas en undefined, no en su default', () => {
      const { result } = renderHook(() =>
        useForm({
          defaultValues: {
            caseId: 'c1',
            name: '',
            isFamilyHome: false,
            licensePlate: '',
          },
        }),
      );

      act(() => {
        result.current.setValue('isFamilyHome', true);
        result.current.setValue('licensePlate', 'ABC123');
      });
      expect(result.current.getValues('isFamilyHome')).toBe(true);

      act(() => {
        // El reset viejo: solo las claves "de texto" básicas.
        result.current.reset({ caseId: 'c1', name: '' } as never);
      });

      expect(result.current.getValues('isFamilyHome')).toBeUndefined();
      expect(result.current.getValues('licensePlate')).toBeUndefined();
    });

    it('una casilla con checked=undefined se pinta desmarcada (no se queda marcada)', () => {
      // Se deja escrito porque es contraintuitivo: el riesgo de las casillas no
      // era visual, era que el estado dejaba de ser booleano.
      function Harness() {
        const [checked, setChecked] = React.useState<boolean | undefined>(
          false,
        );
        return (
          <>
            <Checkbox
              aria-label="casilla"
              checked={checked}
              onCheckedChange={(v) => setChecked(!!v)}
            />
            <button onClick={() => setChecked(undefined)}>a-undefined</button>
          </>
        );
      }

      render(<Harness />);
      const casilla = screen.getByRole('checkbox', { name: 'casilla' });

      fireEvent.click(casilla);
      expect(casilla).toHaveAttribute('data-state', 'checked');

      fireEvent.click(screen.getByText('a-undefined'));
      expect(casilla).toHaveAttribute('data-state', 'unchecked');
    });

    it('un input de texto omitido del reset SÍ conserva el valor anterior en el DOM', () => {
      // Este era el daño real: la pantalla mostraba la placa del bien anterior.
      function Harness() {
        const form = useForm({
          defaultValues: { caseId: 'c1', name: '', licensePlate: '' },
        });
        return (
          <>
            <Input aria-label="placa" {...form.register('licensePlate')} />
            <Input aria-label="nombre" {...form.register('name')} />
            <button
              onClick={() => form.reset({ caseId: 'c1', name: '' } as never)}
            >
              reset-viejo
            </button>
          </>
        );
      }

      render(<Harness />);
      const placa = screen.getByRole('textbox', {
        name: 'placa',
      }) as HTMLInputElement;
      const nombre = screen.getByRole('textbox', {
        name: 'nombre',
      }) as HTMLInputElement;

      fireEvent.change(placa, { target: { value: 'ABC123' } });
      fireEvent.change(nombre, { target: { value: 'Camioneta' } });

      fireEvent.click(screen.getByText('reset-viejo'));

      expect(nombre.value).toBe(''); // estaba en el reset
      expect(placa.value).toBe('ABC123'); // omitida → se quedó pegada
    });
  });

  describe('2. el alcance real, leído del código', () => {
    it('las casillas conocidas están entre las columnas booleanas del formulario', () => {
      // Aserción de subconjunto a propósito, no de igualdad: agregar una casilla
      // nueva al formulario es un cambio legítimo y no tiene por qué romper este
      // test. Lo que no puede pasar es que una casilla quede FUERA del reset, y
      // eso lo cubren los dos tests de abajo, que derivan la lista sola.
      expect(booleanFormFields()).toEqual(
        expect.arrayContaining(['isFamilyHome', 'isInalienablePatrimony']),
      );
      expect(booleanFormFields().length).toBeGreaterThanOrEqual(2);
    });

    it('el reset deja en blanco TODAS las claves del formulario', () => {
      // La garantía de fondo, y el guard de la regresión: si el reset vuelve a
      // cubrir solo una parte, este test nombra exactamente las que faltan.
      const cubiertas = effectiveResetKeys();
      const faltantes = FORM_FIELDS.filter((key) => !cubiertas.has(key));
      expect(faltantes).toEqual([]);
    });

    it('las casillas se limpian a false, no a undefined ni a cadena vacía', () => {
      const block = emptyFormBlock();
      for (const field of booleanFormFields()) {
        expect(block).toContain(`${field}: false`);
      }
    });

    it('defaultValues y el reset salen de la misma fuente', () => {
      // Dos listas separadas es cómo se originó el bug: una se actualizó y la
      // otra no.
      expect(SOURCE).toContain('defaultValues: emptyAssetForm(caseId)');
      expect(SOURCE).toContain('newAssetForm.reset(emptyAssetForm(caseId))');
    });
  });

  describe('3. reproducción de punta a punta', () => {
    /**
     * El formulario real en miniatura: mismas claves, mismas casillas conectadas
     * con `watch` + `setValue`, mismos `<Input>` registrados. Montar `AssetsTab`
     * entero exigiría el `FormProvider` del caso completo y el `Select` de Radix,
     * que no aportan nada a lo que se prueba acá.
     *
     * `resetKeys` es lo que se le pasa a `reset`, para poder ejercer el reset
     * viejo y el nuevo con el mismo componente.
     */
    const RESET_VIEJO = {
      caseId: 'c1',
      name: '',
      type: '',
      value: '',
      description: '',
    };

    const RESET_NUEVO = {
      ...RESET_VIEJO,
      isFamilyHome: false,
      isInalienablePatrimony: false,
      licensePlate: '',
    };

    function AssetForm({ resetKeys }: { resetKeys: Record<string, unknown> }) {
      const form = useForm({
        defaultValues: {
          caseId: 'c1',
          name: '',
          type: 'INMUEBLE',
          value: '',
          description: '',
          isFamilyHome: false,
          isInalienablePatrimony: false,
          licensePlate: '',
        },
      });

      return (
        <div>
          <Checkbox
            aria-label="Vivienda Familiar"
            checked={form.watch('isFamilyHome')}
            onCheckedChange={(v) => form.setValue('isFamilyHome', !!v)}
          />
          <Checkbox
            aria-label="Patrimonio de familia"
            checked={form.watch('isInalienablePatrimony')}
            onCheckedChange={(v) =>
              form.setValue('isInalienablePatrimony', !!v)
            }
          />
          <Input aria-label="placa" {...form.register('licensePlate')} />
          <button onClick={() => form.reset(resetKeys as never)}>
            Agregar bien
          </button>
          <output data-testid="valores">
            {JSON.stringify({
              isFamilyHome: form.watch('isFamilyHome') ?? null,
              isInalienablePatrimony:
                form.watch('isInalienablePatrimony') ?? null,
              licensePlate: form.watch('licensePlate') ?? null,
            })}
          </output>
        </div>
      );
    }

    function llenarPrimerBien() {
      fireEvent.click(
        screen.getByRole('checkbox', { name: 'Vivienda Familiar' }),
      );
      fireEvent.click(
        screen.getByRole('checkbox', { name: 'Patrimonio de familia' }),
      );
      fireEvent.change(screen.getByRole('textbox', { name: 'placa' }), {
        target: { value: 'ABC123' },
      });
    }

    it('con el reset VIEJO queda basura del bien anterior', () => {
      render(<AssetForm resetKeys={RESET_VIEJO} />);
      llenarPrimerBien();

      fireEvent.click(screen.getByText('Agregar bien'));

      // La placa sigue visible en pantalla para el bien siguiente…
      expect(
        (screen.getByRole('textbox', { name: 'placa' }) as HTMLInputElement)
          .value,
      ).toBe('ABC123');
      // …pero el estado del formulario ya no la tiene: se contradicen.
      expect(screen.getByTestId('valores')).toHaveTextContent(
        '"licensePlate":null',
      );
      // Y las casillas dejaron de ser booleanas.
      expect(screen.getByTestId('valores')).toHaveTextContent(
        '"isFamilyHome":null',
      );
    });

    it('con el reset NUEVO el formulario queda realmente en blanco', async () => {
      render(<AssetForm resetKeys={RESET_NUEVO} />);
      llenarPrimerBien();

      const vivienda = screen.getByRole('checkbox', {
        name: 'Vivienda Familiar',
      });
      const patrimonio = screen.getByRole('checkbox', {
        name: 'Patrimonio de familia',
      });
      expect(vivienda).toHaveAttribute('data-state', 'checked');
      expect(patrimonio).toHaveAttribute('data-state', 'checked');

      fireEvent.click(screen.getByText('Agregar bien'));

      await waitFor(() => {
        expect(vivienda).toHaveAttribute('data-state', 'unchecked');
      });
      expect(patrimonio).toHaveAttribute('data-state', 'unchecked');
      expect(
        (screen.getByRole('textbox', { name: 'placa' }) as HTMLInputElement)
          .value,
      ).toBe('');

      // Y los valores son false/'' de verdad, no undefined.
      expect(screen.getByTestId('valores')).toHaveTextContent(
        '{"isFamilyHome":false,"isInalienablePatrimony":false,"licensePlate":""}',
      );
    });
  });
});
