# Branding por centro en las plantillas — revisión del material de Armonía

> Revisión del 2026-09-30 sobre `Escritorio/imagenes para plantillas armonia`.
> **Nada implementado.** Esto es el inventario, el diagnóstico y el plan.

## 0. Antes que nada: no encontré el diseño técnico aprobado

Busqué en `docs/`, en los issues (abiertos y cerrados), en los PRs y en el
código: **no hay ningún documento que describa el diseño aprobado del branding
por centro**. Lo único escrito sobre Armonía en el repo es su configuración de
tenant (`centro-conciliacion.ts`, `tenant-theme.ts`, `prisma.ts`), que es para
la UI, no para los documentos.

Así que no puedo decir "el material alcanza para el diseño aprobado" sin
inventarme contra qué lo comparo. Lo que hice en su lugar: medir el material
entregado contra **lo que las plantillas usan hoy** —que es un diseño real,
funcionando y verificable— y contra los tamaños a los que el CSS las renderiza.
Si el diseño aprobado está en otro lado, decime dónde y rehago la comparación
contra él; el inventario y las mediciones de abajo sirven igual.

## 1. El hallazgo que cambia la pregunta

**Hoy no existe branding por centro. Las 63 plantillas tienen el logo de
Constructores de Paz escrito a mano en el HTML.**

```
63 plantillas → ../insolvency/img/Logo y titulo constructores de paz.png
55 plantillas → ../insolvency/img/Logo construpaz.png
54 plantillas → ../insolvency/img/firma abogada.png
 1 plantilla  → ../insolvency/img/Firma abogado.jpg
```

No hay ninguna rama por tenant en la generación: `getTemplateAssetsBaseDir()`
resuelve por **tipo de caso** (`INSOLVENCY` / `CONCILIATION` / …), nunca por
centro. El campo `Tenant.logoUrl` existe pero apunta a los íconos de la UI
(`/images/toucan.png`, 48×48 px) y **no lo lee nadie** en el módulo de
documentos.

**Consecuencia directa, y creo que es la respuesta a tu pregunta pendiente:**
todo documento generado para el tenant `armonia` sale, hoy, con el logo y la
firma de Constructores de Paz. No es un riesgo a futuro: es el comportamiento
actual del código. Lo que no puedo decir desde acá es **cuántos** expedientes de
Armonía ya se generaron así — eso se responde con una consulta a la base
(`Document where tenantId='armonia' and isGenerated=true`), que no toqué porque
Neon está fuera de alcance.

Un detalle más en la misma línea: la subcarpeta **`MINUTAS DR. MAXIMILIANO`**,
dentro de la carpeta llamada "imagenes para plantillas armonia", trae **branding
de Constructores de Paz**, no de Armonía — el banner azul y amarillo
"CONSTRUCTORES DE PAZ — CENTRO DE CONCILIACIÓN Y ARBITRAJE" y una foto en blanco
y negro del mismo logo. Cinco `.docx`. Si esas minutas son el modelo de lo que
Armonía va a emitir, el logo que traen es el del otro centro.

## 2. Qué hay en la carpeta

| Archivo                                | Formato real | Dimensiones | Peso    | Qué es                                                                                                                                                                                             |
| -------------------------------------- | ------------ | ----------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sello armonia.jpeg`                   | JPEG         | 277 × 271   | 24 KB   | Sello circular, tinta azul: "CENTRO DE CONCILIACIÓN / ARMONÍA CONCERTADA / NIT 900.993.198-4 / Resolución 858/2016" — **corregido el 2026-10-10**, ver §2.1                                                                                |
| `firma beatriz.jpeg`                   | JPEG         | 193 × 116   | 6,4 KB  | Firma manuscrita                                                                                                                                                                                   |
| `firma max.jpeg`                       | JPEG         | 124 × 87    | 3,6 KB  | Firma manuscrita                                                                                                                                                                                   |
| `En Blanco Armonia.docx`               | DOCX         | —           | 102 KB  | Membrete en blanco. Dentro: `image1.jpeg`, **1477 × 1477, JPEG** (152 KB) — el tucán, con el nombre del centro incrustado en la propia imagen. **Corregido el 2026-10-10**, ver §2.1                                  |
| `MINUTAS DR. MAXIMILIANO/` (5 `.docx`) | DOCX         | —           | ~1,3 MB | Minutas de conciliación. Dentro: logo **de Constructores de Paz** (386 × 386 PNG con alfa + banner 1280 × 291 JPEG) y una firma 334 × 225 JPEG que **ya está en el repo** como `Firma abogado.jpg` |

Las extensiones coinciden con el contenido real (verificado por magic bytes): no
hay ningún PNG disfrazado de JPEG ni al revés.

### 2.1 Corrección del 2026-10-10

Dos datos de la tabla de arriba estaban mal transcritos. Se dejan corregidos ahí
y anotados acá, porque **una de las tres conclusiones de §3 se cae con el dato
bueno**.

**El sello.** Decía «NIT 900.903.195-4 / Resolución 656/2016». Los datos
correctos son **NIT 900.993.198-4** y **Resolución 858/2016**, confirmados el
2026-10-10 contra el membrete oficial del centro, que coincide con el sello. La
transcripción vieja era un error de lectura de la imagen, no una discrepancia
entre documentos: el «656» que figuraba acá llegó a usarse como argumento para
dudar de la resolución 0858 en `PENDIENTES_DECISION_LEGAL.md` §5 — esa duda no
tenía fundamento.

**El tucán.** Decía «`image1.png`, 334 × 334, PNG sin canal alfa». Medido sobre
el archivo real dentro de `En Blanco Armonia.docx`: es
`word/media/image1.jpeg`, **JPEG de 1477 × 1477 px y 152 KB** (magic bytes
`ffd8ffe0`, SOF0 1477×1477).

**Qué cambia de las conclusiones de §3:**

- El problema 1 («el tucán puesto en 380 px se amplía, ≈84 DPI efectivos») **ya
  no existe**: 1477 px sobre un hueco de 380 px da ≈3,9× de sobra, bastante por
  encima del mínimo de 1188 px para 300 DPI. Lo que queda del problema 1 es solo
  la **forma**: el tucán es cuadrado y el hueco del encabezado es horizontal.
- El problema 2 sigue en pie, y por una razón distinta de la escrita: el tucán
  no es «PNG en RGB sin alfa» sino **JPEG**, formato que no puede tener
  transparencia. El síntoma es el mismo.
- El problema 3 (firmas chicas) no se toca.

El tucán trae además **el nombre del centro dentro de la imagen**, lo que decidió
el diseño del encabezado: Armonía usa solo la imagen, sin componer el nombre al
lado como texto HTML, para no duplicarlo (decisión del dueño del producto,
2026-10-10).

## 3. Lo que el CSS exige, y lo que el material da

Las plantillas renderizan a estos anchos (`templates/insolvency/CSS/styles-base.css`):

| Clase                                        | Ancho renderizado | Mínimo para 300 DPI | Constructores (hoy)                   | Armonía (entregado)           |
| -------------------------------------------- | ----------------- | ------------------- | ------------------------------------- | ----------------------------- |
| `.logo` / `.logo-institucional` (encabezado) | 380 px            | **1188 px**         | 1536 × 345, PNG **con alfa** ✅       | tucán 1477 × 1477, JPEG ⚠️    |
| `.logo-firma` (marca junto a la firma)       | 200 px            | **625 px**          | 1024 × 1024, PNG ✅                   | tucán 1477 × 1477, JPEG ⚠️    |
| `.firma-img` (firma manuscrita)              | 150 px            | **469 px**          | 235 × 128, PNG con alfa (≈150 DPI) ⚠️ | 193 × 116 y 124 × 87, JPEG ❌ |
| sello                                        | —                 | —                   | **no existe hoy**                     | 277 × 271, JPEG ⚠️            |

Tres problemas concretos, medidos:

1. **No hay banner de encabezado para Armonía.** Es el asset que usan **las 63
   plantillas**, el más visible. ⚠️ **Parcialmente corregido el 2026-10-10**
   (§2.1): el tucán tiene 1477 × 1477 px, no 334, así que **resolución no le
   falta** — en un hueco de 380 px sobra por 3,9×. Lo que no encaja es la
   forma: Constructores tiene una pieza horizontal de 1536 × 345 con el nombre
   al lado del símbolo, y el tucán es cuadrado con el nombre **adentro**. Por
   eso se decidió que Armonía use solo la imagen.

2. **Ningún asset de Armonía tiene transparencia.** Los tres `.jpeg` no pueden
   tenerla por formato, **y el tucán también es JPEG** (§2.1), así que tampoco.
   Una firma
   o un sello en JPEG pintan **un rectángulo blanco** sobre lo que haya debajo
   — que es exactamente el caso del sello, que por definición va encima del
   texto o de la firma. La firma actual de Constructores (`firma abogada.png`)
   tiene alfa justamente por esto.

3. **Las firmas están por debajo del piso actual.** `firma max.jpeg` (124 px)
   es más chica que el hueco donde va (150 px): se amplía. `firma beatriz.jpeg`
   (193 px) está apenas por encima. La de Constructores, que ya es la más floja
   de los assets de hoy, tiene 235 px.

## 4. Lo que falta, en una lista

Para que Armonía quede al nivel de lo que ya hay, sin inventar nada nuevo:

- [ ] **Banner de encabezado**, horizontal, símbolo + nombre del centro. PNG con
      transparencia, **≥ 1200 px de ancho**. Es el que más falta.
- [ ] **Logo cuadrado** para el bloque de firma. PNG con transparencia,
      **≥ 640 px**. El tucán tiene tamaño de sobra (1477 px, §2.1); lo que le
      falta es el canal alfa, por ser JPEG.
- [ ] **Firmas con fondo transparente**, **≥ 500 px de ancho**. PNG, no JPEG.
      Escaneadas sobre papel blanco y recortadas, o reexportadas desde el
      original si existe.
- [ ] **Sello con fondo transparente**, **≥ 600 px**. Y, antes que el archivo,
      **la decisión de dónde va**: hoy ninguna plantilla tiene un hueco para un
      sello. Agregarlo es tocar el HTML y el CSS de las plantillas que lo lleven,
      no solo poner el archivo.

Dos preguntas que no son técnicas y que no puedo resolver yo:

- **¿Cuál es el nombre que va en el membrete?** El tucán dice "Asociación para
  el Fomento de la Cultura, la Justicia y la Conciliación"; el sello dice
  "Centro de Conciliación Armonía Concertada". No son el mismo rótulo. En
  Constructores el banner dice "Centro de Conciliación y Arbitraje", o sea el
  rol, no la asociación.
- **¿Quién firma?** Llegaron dos firmas (Beatriz y Max) y las plantillas tienen
  **un** hueco. Esto ya lo tenías anotado como pendiente tuyo; lo dejo acá
  porque condiciona si hace falta un asset o dos, y si el nombre y el cargo
  bajo la firma pasan a ser por caso en vez de fijos.

## 5. El plan de implementación

### 5.1 Cómo se elige el asset: placeholders, no rutas fijas

Las plantillas pasan de tener la ruta escrita a tener un placeholder:

```html
<!-- antes -->
<img
  src="../insolvency/img/Logo y titulo constructores de paz.png"
  class="logo"
/>
<!-- después -->
<img src="{{LOGO_ENCABEZADO_SRC}}" class="logo" />
```

Por qué así y no apuntando `assetsBaseDir` a una carpeta por centro:

- Las plantillas hoy usan rutas **relativas con `../`**, así que cambiar la base
  obliga igual a editar los 63 archivos. No se ahorra nada.
- Con placeholder, el valor queda **en el golden master**: si alguien cambia qué
  logo usa un centro, el golden se mueve y hay que mirarlo. Con una base
  implícita, el cambio es invisible para la red de seguridad.
- El **gate de placeholders sin resolver** pasa a cubrir el branding: si el
  mapper no produce la clave, la generación se bloquea en vez de subir a Drive
  un PDF sin logo.
- Son valores de atributo sin caracteres especiales, así que el escapado
  por defecto (`escapeAllUnlessHtml`) los deja intactos: **no hay que agregarlos
  a `HTML_PLACEHOLDERS_ALLOWLIST`**, que es el agujero que conviene no abrir.

El pipeline no se toca: `inlineAssets` ya convierte cada `<img src>` a un data
URI base64 resolviendo contra `docDir`, así que una ruta por centro funciona tal
cual.

### 5.2 Mapeo placeholder → archivo

Carpeta nueva por centro, al lado de la que ya existe:

```
templates/branding/
  constructores-paz/   logo-encabezado.png  logo-firma.png  firma-operador.png  sello.png
  armonia/             logo-encabezado.png  logo-firma.png  firma-operador.png  sello.png
```

| Placeholder nuevo     | Archivo por centro                      | Clase CSS                      | Lo que reemplaza                                   | Plantillas             |
| --------------------- | --------------------------------------- | ------------------------------ | -------------------------------------------------- | ---------------------- |
| `LOGO_ENCABEZADO_SRC` | `branding/{centro}/logo-encabezado.png` | `.logo`, `.logo-institucional` | `Logo y titulo constructores de paz.png`           | **63**                 |
| `LOGO_FIRMA_SRC`      | `branding/{centro}/logo-firma.png`      | `.logo-firma`                  | `Logo construpaz.png`                              | **55**                 |
| `FIRMA_OPERADOR_SRC`  | `branding/{centro}/firma-operador.png`  | `.firma-img`                   | `firma abogada.png` (54) y `Firma abogado.jpg` (1) | **55**                 |
| `SELLO_CENTRO_SRC`    | `branding/{centro}/sello.png`           | `.sello-img` _(nueva)_         | — (no existe hoy)                                  | **las que se decidan** |

Para Constructores los cuatro archivos salen de mover los que ya están en
`templates/insolvency/img/` (el sello queda pendiente: tampoco lo tienen).
Para Armonía, de lo que falta en §4.

El sub-mapper que los produce va en `placeholders/branding.ts` —módulo nuevo,
dentro del plan de división (`docs/PLAN_DIVISION_MAPPER.md`)— y resuelve por
`tenantId`, no por el campo de texto libre `centroConciliacionNombre`, por la
misma razón que ya está escrita en `centro-conciliacion.ts`: ese campo lo
escribe el usuario y no sirve para elegir rutas.

### 5.3 Orden de trabajo

| #   | Paso                                                                                                                                                                       | Se puede hacer sin los assets nuevos |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | Crear `templates/branding/constructores-paz/` moviendo los 4 assets actuales; sub-mapper `branding.ts` resolviendo por tenant; **los dos centros apuntan a Constructores** | **Sí**                               |
| 2   | Reemplazar las rutas fijas por los placeholders en las 63 plantillas (script + revisión del golden)                                                                        | **Sí**                               |
| 3   | Test guardián: por cada centro y cada placeholder, `fs.access` del archivo                                                                                                 | **Sí**                               |
| 4   | Poner los assets reales de Armonía y cambiar su fila del mapa                                                                                                              | No                                   |
| 5   | Hueco del sello en las plantillas que lo lleven (HTML + CSS)                                                                                                               | No — falta la decisión de dónde va   |

Los pasos 1 a 3 son el 90 % del trabajo y **no dependen de que lleguen las
imágenes**: dejan el sistema listo para que cambiar el branding de un centro sea
cambiar cuatro archivos de una carpeta.

Un detalle que el paso 3 cubre y que hoy es un agujero: cuando una imagen no
existe, `inlineAssets` solo escribe un `console.warn` y **el documento se genera
igual, con la imagen rota**. Sin ese test, un asset mal nombrado en la carpeta de
un centro se descubre en un PDF ya subido a Drive, no en CI.

### 5.4 Un efecto lateral que conviene tener presente

Las imágenes se embeben en base64 dentro del HTML antes de pasarlas a Chromium.
El banner de Constructores pesa 189 KB → ~252 KB por documento ya inlineado, y
va en las 63 plantillas. Si los assets de Armonía se entregan a la resolución que
pido en §4, van a pesar parecido. Eso suma al problema del
**issue #3** (los lotes de 26 y 77 documentos no entran en `maxDuration=60s`).
No bloquea nada, pero si se van a optimizar los PNG, es el momento.
