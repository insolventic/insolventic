# Capturas del manual de usuario

Genera las figuras de [`docs/MANUAL_USUARIO.md`](../../docs/MANUAL_USUARIO.md)
con Playwright, para regenerarlas cuando cambie la UI. Nada se edita a mano:
datos, recortes y anotaciones salen de este script.

## Reglas que el script hace cumplir

- **Solo base local, destino exacto.** Aborta si `DATABASE_URL` (o
  `DIRECT_URL`) no apunta exactamente a **`127.0.0.1:54330/insolventic_manual_test`**
  (`guarda-base.ts`). Esa base se borra y se recrea en cada corrida: antes del
  reset el script imprime host, puerto y base efectivos y vuelve a validarlos,
  y le pasa a Prisma `DATABASE_URL`/`DIRECT_URL` explícitas (nada sale de
  `.env` ni `.env.local`). Nunca producción, nunca Preview, nunca la base de
  desarrollo ni la de los E2E (127.0.0.1:54329).
- **Datos 100 % sintéticos** (`datos.ts`): personas, cédulas, NIT, montos y
  fechas ficticios, correos en el dominio reservado `.test`. No usa el seed de
  la aplicación, que crea usuarios con nombres del equipo.
- **Sin servicios externos.** El servidor arranca con las credenciales de
  Google Drive, Sentry, SMTP y Upstash vacías, y con `HTTP(S)_PROXY` apuntando
  a un puerto cerrado, para los clientes que respetan esa variable (el de
  Google, entre ellos). La generación y subida de documentos falla en local a
  propósito. Las figuras que muestran documentos o comprobantes ya guardados
  usan registros sembrados con enlaces `https://example.invalid/…`.
- **La contraseña** de los usuarios ficticios se genera en cada corrida, solo
  vive en memoria y no se imprime.

## Requisitos

1. Dependencias instaladas (`npm ci`, **sin** `--omit=optional`) y el
   Chromium de Playwright (`npx playwright install chromium`). La
   optimización de PNG usa `sharp`, que Next.js instala como dependencia
   opcional: no está en `package.json` y no hay que agregarlo. Si falta, el
   script se detiene con un mensaje que lo explica.
2. Un Postgres local para la base de capturas. Con Docker:

   ```bash
   docker run -d --name insolventic-manual-pg -e POSTGRES_USER=manual -e POSTGRES_PASSWORD=manual -e POSTGRES_DB=insolventic_manual_test -p 127.0.0.1:54330:5432 postgres:16-alpine
   ```

3. `DATABASE_URL` apuntando a esa base, en la misma terminal:

   ```bash
   export DATABASE_URL=postgresql://manual:manual@127.0.0.1:54330/insolventic_manual_test
   ```

   En PowerShell: `$env:DATABASE_URL = "postgresql://manual:manual@127.0.0.1:54330/insolventic_manual_test"`.

## Uso

```bash
npx tsx scripts/manual-capturas/capturar.ts --build
```

- `--build` compila la app (`next build`). Hace falta la primera vez y cada
  vez que cambie el código de la UI. Sin la opción se reutiliza el build que
  haya en `.next/`.
- `--seccion 4.1` limita la corrida a una sección (admite varias separadas por
  comas). Sin la opción corren todas.

Las figuras quedan en `docs/manual-usuario/img/<NN-seccion>/`, con nombres
`NN-seccion-descripcion.png` en kebab-case. Al terminar, el script detiene el
servidor. Para borrar la base: `docker rm -f insolventic-manual-pg`.

Para re-optimizar figuras que ya están en disco (no hace falta tras una
corrida normal, que las guarda optimizadas):

```bash
npx tsx scripts/manual-capturas/optimizar.ts [archivo.png ...]
```

El log de la app va a `manual-capturas-app.log` en la carpeta temporal del
sistema (el script imprime la ruta). Es normal que registre fallos de Drive y
de SMTP: no hay credenciales, a propósito. Si una anotación cae fuera de la
vista, el script se detiene y deja una captura del estado en
`manual-capturas-error.png`, en esa misma carpeta.

## Qué es estable entre corridas y qué no

El navegador corre con el reloj congelado en la **fecha ancla 2026-11-16
10:00 (America/Bogota)** (`config.ts`) y todas las fechas del seed se calculan
a partir de ella. Dos corridas seguidas producen imágenes idénticas byte a
byte (verificado en la sección 4.1), salvo lo que el servidor calcula con su
propio reloj:

- **"Casos este Mes"** y **"Audiencias Próximas"** del dashboard. Coinciden con
  el seed solo si se regeneran en noviembre de 2026. En otro mes, esos dos
  números cambian.
- La **fecha de radicación de un caso creado desde la UI** (sección 4.1) es la
  del día en que se corre el script.

## Cómo está organizado

| Archivo          | Qué hace                                                               |
| ---------------- | ---------------------------------------------------------------------- |
| `capturar.ts`    | Punto de entrada: guarda, seed, servidor, navegador y secciones        |
| `guarda-base.ts` | Aborta si la base no es `127.0.0.1:54330/insolventic_manual_test`      |
| `optimizar.ts`   | Paleta de 256 colores con `sharp`; también se puede correr solo        |
| `seed.ts`        | Recrea el esquema (`prisma db push --force-reset`) y siembra los datos |
| `datos.ts`       | Los datos sintéticos y la historia del caso de ejemplo                 |
| `anotaciones.ts` | CSS de captura, marcos y badges numerados, recorte y guardado          |
| `config.ts`      | Fecha ancla, centro, viewport, color de anotación, rutas               |
| `secciones/`     | Un archivo por sección del manual                                      |

### Estilo de las figuras

- Viewport 1440×900 a escala 2, tema claro, sin animaciones, sin la marca de
  versión. Los avisos emergentes se ocultan salvo cuando la figura los muestra.
- Anotaciones en verde azulado (`#0B8577`, del logo): un marco alrededor del
  elemento y un badge numerado, como máximo 5 por figura. Los números coinciden
  con la leyenda que va bajo la figura en el manual.
- Pantalla completa solo la primera vez que aparece un módulo; el resto son
  recortes de la región que el paso describe.

### Formato de archivo: PNG con paleta de 256 colores

Cada figura se guarda como PNG de paleta (`sharp`, libimagequant, calidad 90)
y sin metadatos. **Por qué paleta:** las capturas de Playwright ya vienen bien
comprimidas, y una recompresión sin pérdida no baja ni un 1 %. Con paleta,
las 12 figuras de la sección 4.1 pasaron de 2.040 KB a 756 KB (−63 %), y la
mayor quedó en 106 KB (objetivo orientativo: ≤ 300 KB por figura).

**Qué se pierde:** los píxeles que cambian están en bordes suavizados y en
sombras muy tenues. Comparado a 2x en el piloto (Figuras 4.1, 4.6 y 4.9), el
texto y los colores no se distinguen del original. A 6x, la sombra más tenue
bajo una tarjeta muestra un tramado fino en vez de un degradado continuo; no
se ve a tamaño normal y no forma bandas.

**Idempotente:** la cuantización es determinista (misma captura, mismos
bytes), un PNG que ya es de paleta no se vuelve a cuantizar, y un archivo que
ya tiene esos bytes no se reescribe. Cambiar las opciones de `OPCIONES_PNG`
en `optimizar.ts` cambia los bytes de todas las figuras.

### Agregar una sección

1. Crear `secciones/NN-x-nombre.ts` exportando `(ctx: Contexto) => Promise<void>`.
2. Registrarla en `SECCIONES` de `capturar.ts`.
3. Usar `anotar()` y `capturar()` de `anotaciones.ts`. No dibujar nada fuera
   de esas funciones, para que el estilo siga siendo uno solo.
