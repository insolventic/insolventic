/**
 * Normalización de `Asset.type` al cargar el formulario de edición
 * (`edit-case-dialog.tsx`), TAREA 3 del selector de bienes en dos niveles.
 *
 * Un bien ya guardado con un valor viejo (EQUIPO, MUEBLE, JOYA, DINERO,
 * ACCION, CUENTA_COBRAR — de antes del selector de dos niveles) tiene que
 * mostrarse con la categoría/tipo correctos al abrir el diálogo de editar
 * un caso. `normalizeAssetType` ya está probada exhaustivamente
 * (`tests/unit/cases/asset-category-types.test.ts`) — lo que falta cubrir es
 * que el diálogo la USE en el único punto donde carga los bienes del caso
 * al formulario (`fullCase.assets.map(...)`), sin escribir nada en la base
 * hasta que el operador guarde.
 *
 * `EditCaseDialog` es un componente grande (deudores, operadores, acreedores,
 * ~230 columnas escalares) que no vale la pena montar completo solo para
 * esto — se verifica por inspección de código, mismo patrón que ya usa este
 * repo para lógica embebida en diálogos
 * (`tests/unit/components/asset-type-switch.test.tsx`).
 */

import fs from 'fs';
import path from 'path';

const SOURCE = fs.readFileSync(
  path.join(
    process.cwd(),
    'src/app/cases/components/edit-case-dialog.tsx',
  ),
  'utf-8',
);

describe('edit-case-dialog.tsx — normalización de bienes viejos al cargar', () => {
  it('importa normalizeAssetType', () => {
    expect(SOURCE).toMatch(
      /import\s*\{\s*normalizeAssetType\s*\}\s*from\s*['"]@\/features\/case\/asset-category-types['"]/,
    );
  });

  it('el mapeo de assets al formulario usa normalizeAssetType(asset.type), no asset.type crudo', () => {
    const assetsMapMatch = SOURCE.match(
      /assets:\s*\(fullCase\.assets[\s\S]*?\)\.map\(\(asset\)\s*=>\s*\(\{[\s\S]*?\}\)\),/,
    );
    expect(assetsMapMatch).not.toBeNull();

    const block = assetsMapMatch![0];
    expect(block).toContain('type: normalizeAssetType(asset.type)');
    // No debe quedar también la asignación cruda en el mismo bloque (que
    // ganaría si viniera después, o sería una segunda clave `type`
    // duplicada).
    expect(block).not.toMatch(/type:\s*asset\.type[,\s]/);
  });

  it('no escribe nada en la base: el mapeo vive dentro del reset del formulario, no de una server action', () => {
    // La única forma en que esto podría escribir algo sería llamando a
    // updateCase/addAssetToCase en el mismo bloque — no debería.
    const assetsMapMatch = SOURCE.match(
      /assets:\s*\(fullCase\.assets[\s\S]*?\)\.map\(\(asset\)\s*=>\s*\(\{[\s\S]*?\}\)\),/,
    );
    const block = assetsMapMatch![0];
    expect(block).not.toMatch(/updateCase|addAssetToCase|await /);
  });
});
