'use client';

import { useEffect, useState } from 'react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ASSET_CATEGORIES,
  MOVABLE_ASSET_TYPES,
  PROPERTY_TYPE_OPTIONS,
  categoryForAssetType,
  type AssetCategory,
} from '@/features/case/asset-category-types';

interface AssetTypeSelectorProps {
  /** `Asset.type` actual — `'INMUEBLE'` o uno de `MOVABLE_ASSET_TYPES`. */
  type: string;
  /** `Asset.propertyType` actual — solo aplica cuando la categoría es Inmueble. */
  propertyType: string;
  onTypeChange: (type: string) => void;
  onPropertyTypeChange: (propertyType: string) => void;
}

/**
 * Selector de bienes en dos niveles: Categoría (Inmueble | Mueble) y Tipo,
 * filtrado por la categoría. Sin binding a ningún form en particular —
 * `create-case-dialog/assets-section.tsx` (react-hook-form vía
 * `useFormContext`) y `edit-case-dialog/assets-tab.tsx` (su propio
 * `useForm`) lo usan cada uno con sus propios callbacks.
 *
 * La categoría no es un campo propio del formulario (no existe en el
 * schema): se deriva de `type`/`propertyType` en cada render
 * (`categoryForAssetType`). El único estado local es para el momento
 * transitorio entre elegir "Mueble" y elegir su tipo — ahí `type` queda en
 * blanco a propósito (obliga a elegir el tipo, no asume uno) y no hay de
 * dónde derivar la categoría todavía.
 */
export function AssetTypeSelector({
  type,
  propertyType,
  onTypeChange,
  onPropertyTypeChange,
}: Readonly<AssetTypeSelectorProps>) {
  const derivedCategory = categoryForAssetType(type);
  const [pendingCategory, setPendingCategory] = useState<
    AssetCategory | undefined
  >(undefined);

  // En cuanto `type` trae una categoría derivable (se eligió el tipo de
  // mueble, o el `type` llegó de afuera ya con valor — p. ej. al cargar un
  // bien existente), el estado transitorio deja de hacer falta.
  useEffect(() => {
    if (derivedCategory) setPendingCategory(undefined);
  }, [derivedCategory]);

  const category = derivedCategory ?? pendingCategory;

  const handleCategoryChange = (next: AssetCategory) => {
    if (next === 'INMUEBLE') {
      setPendingCategory(undefined);
      onTypeChange('INMUEBLE');
    } else {
      setPendingCategory('MUEBLE');
      onTypeChange('');
      onPropertyTypeChange('');
    }
  };

  return (
    <>
      <div className="space-y-2">
        <Label>
          Categoría <span className="text-red-500">*</span>
        </Label>
        <Select value={category ?? ''} onValueChange={handleCategoryChange}>
          <SelectTrigger aria-label="Categoría">
            <SelectValue placeholder="Seleccione categoría" />
          </SelectTrigger>
          <SelectContent>
            {ASSET_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>
          Tipo <span className="text-red-500">*</span>
        </Label>
        {category === 'INMUEBLE' ? (
          <Select value={propertyType} onValueChange={onPropertyTypeChange}>
            <SelectTrigger aria-label="Tipo">
              <SelectValue placeholder="Seleccione tipo de inmueble" />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={type}
            onValueChange={onTypeChange}
            disabled={!category}
          >
            <SelectTrigger aria-label="Tipo">
              <SelectValue placeholder="Seleccione tipo de mueble" />
            </SelectTrigger>
            <SelectContent>
              {MOVABLE_ASSET_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </>
  );
}
