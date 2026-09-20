# Runbook — Rotación de credenciales de Google Drive (OAuth)

Cómo regenerar el `refresh_token` de Google Drive, qué variables de Vercel
actualizar y cómo evitar que el token vuelva a morir a los 7 días.

Complementa a `docs/RUNBOOK.md` (§3.4 y §5 remiten aquí). La rotación de la
contraseña de la base de datos está en `docs/RUNBOOK_ENV_VARS.md`.

> Verificado contra el código el 2026-09-19: `src/lib/google-drive.ts`,
> `src/features/document/generate-documents.ts`, `.env.example`. Los datos
> de Google están contrastados con su documentación oficial (OAuth 2.0 y
> OAuth 2.0 Playground). Lo que no se puede comprobar desde el repositorio
> (estado actual del consent screen, scope del token vigente, valores en
> Vercel) está marcado `⟨VERIFICAR⟩`.

---

## 0. Estado de la documentación previa (corrección)

Antes de este documento **el flujo de rotación no estaba escrito en ningún
lado del repo**:

- `.env.example` remitía a "`docs/ARQUITECTURA.md` sección 9 para rotación",
  pero la §9 es _Observabilidad y alertas proactivas_.
- `docs/RUNBOOK.md §3.4` remitía a "la sección de Google Drive" de
  `ARQUITECTURA.md`, que tampoco contiene el procedimiento.
- `docs/ARQUITECTURA.md §11` dice "Alerta proactiva **pendiente de
  implementar**". Lo pendiente es la **alerta** (aviso antes de que el token
  expire), **no** el procedimiento de rotación. La alerta sigue sin existir:
  hoy la única señal de que el token murió es que fallen las subidas.

---

## 1. Cómo usa el sistema estas credenciales

`src/lib/google-drive.ts` construye un cliente OAuth2 con cuatro valores del
entorno y crea un singleton (`googleDriveService`) al cargar el módulo:

| Variable                     | Qué es                                                                                                                    | Cuándo cambia                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `GOOGLE_DRIVE_CLIENT_ID`     | ID del cliente OAuth (Google Cloud Console)                                                                               | Solo si se crea un cliente OAuth nuevo (§6, escenario C)       |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Secreto de ese cliente                                                                                                    | Si se compromete el secreto (§6, escenario B)                  |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | Credencial de larga duración de la cuenta `insolvenic@gmail.com`; con ella la librería obtiene sola access tokens de ~1 h | **En una rotación normal, solo esta** (§6, escenario A)        |
| `GOOGLE_DRIVE_FOLDER_ID`     | ID de la carpeta raíz donde se crean las carpetas por caso                                                                | **No cambia al rotar el token.** Ver advertencia abajo         |
| `GOOGLE_DRIVE_REDIRECT_URI`  | Redirect del flujo OAuth inicial                                                                                          | No interviene al renovar access tokens; puede quedar como está |

Consecuencias operativas:

- Un refresh token está **atado al `CLIENT_ID`/`CLIENT_SECRET` con el que se
  emitió**. Hay que generarlo con el mismo cliente OAuth que tiene cargado
  Vercel.
- El singleton lee las variables al cargarse el módulo, así que un cambio de
  variables **solo se ve tras un deployment nuevo** (Vercel no aplica cambios
  de variables a deployments existentes).
- Preview y Production comparten la misma cuenta de Google y, si las
  variables coinciden, **la misma carpeta real de Drive** `⟨VERIFICAR si
Preview tiene valores propios⟩`. Un Preview que genera documentos escribe
  en el Drive real.

> ⚠️ **No cambiar `GOOGLE_DRIVE_FOLDER_ID` ni la cuenta de Google por
> impulso.** La base guarda IDs de carpeta por caso (`Case.driveFolderId`) y
> las URLs de los documentos ya generados. Mover el almacenamiento a otra
> carpeta o cuenta deja esos enlaces rotos y requiere un plan de migración:
> es una decisión operativa/de negocio, no parte de una rotación de token.

---

## 2. Cuándo hay que rotar

**Síntomas** de token muerto:

- Documentos que quedan en `FAILED` / `COMPLETED_WITH_ERRORS` en
  `document_generation_requests` (ver `RUNBOOK.md §3.3`).
- En **Vercel → Logs (Runtime)**: `invalid_grant` (los `console.error` de
  `google-drive.ts` conservan el error original de Google).
- En **Sentry**: `Error generating document` con `action:
'generate-documents'`. El mensaje que ve el usuario/la solicitud es
  genérico ("Error al subir documento al caso"); el motivo real está en los
  logs de Vercel.

> Corrección al `RUNBOOK.md` anterior: la búsqueda `action: 'drive-upload'`
> **no existe** en el código; ningún `logger` la emite.

**Causas** por las que Google invalida un refresh token (documentación
oficial de Google):

1. **Consent screen en modo "Testing" con usuarios externos: el token expira
   a los 7 días.** Es la causa más probable si el fallo reaparece
   sistemáticamente ~7 días después de cada rotación. Ver §3.
2. El usuario **revocó el acceso** de la app
   (<https://myaccount.google.com/permissions>).
3. El token **no se usó en 6 meses**.
4. La cuenta superó el **límite de 100 refresh tokens vivos por cliente
   OAuth**: al emitir uno nuevo, se invalida el más antiguo. Ojo si se
   regenera el token muchas veces "para probar".
5. Cambio de contraseña de la cuenta **solo si** el token incluye scopes de
   Gmail (no aplica a un token solo de Drive).
6. Política de administrador de Workspace (`admin_policy_enforced`); no aplica
   a una cuenta `@gmail.com` personal.

---

## 3. ⚠️ Modo "Testing" de Google: expiración a los 7 días

Si el proyecto de Google Cloud tiene el consent screen con **estado de
publicación "Testing"** y tipo de usuario **External** (el caso de una
cuenta `@gmail.com`), Google emite refresh tokens que **expiran a los 7
días**. La única excepción son las apps que piden solo los scopes
`openid`, `userinfo.email` y `userinfo.profile`, y esta app pide Drive.

Esto significa que **rotar el token sin cambiar el estado de publicación
solo compra una semana**.

### 3.1 Revisar el estado actual `⟨VERIFICAR⟩`

1. <https://console.cloud.google.com> → seleccionar el proyecto que contiene
   el cliente OAuth de Insolventic.
2. **Google Auth Platform → Audience** (en consolas antiguas: **APIs &
   Services → OAuth consent screen**).
3. Leer **Publishing status**:
   - `Testing` → el token expira a los 7 días. Pasar a producción (§3.2).
   - `In production` → no aplica la expiración de 7 días.

### 3.2 Pasar a "In production"

1. En la misma pantalla, **Publish app** → confirmar.
2. **Hacer esto ANTES de generar el token nuevo** (§4). Un token emitido
   mientras la app estaba en Testing puede conservar la expiración de 7 días;
   emitirlo después de publicar evita depender de ese detalle.
3. Como el scope de Drive es sensible/restringido y la app no está verificada
   por Google, el flujo de consentimiento va a mostrar la advertencia
   **"Google no verificó esta aplicación"**. Para uso interno con una sola
   cuenta propietaria es aceptable: **Avanzado → Ir a ⟨app⟩ (no seguro)**. No
   es un error.

> **Decisión que no es técnica:** publicar la app y aceptar que funcione sin
> verificación de Google (o iniciar la verificación formal del scope) es una
> decisión del titular de la cuenta/proyecto. Este runbook describe el
> procedimiento; no la toma.

---

## 4. Generar un refresh token nuevo (OAuth 2.0 Playground)

### Antes de empezar

- [ ] Tener a mano el `GOOGLE_DRIVE_CLIENT_ID` y `GOOGLE_DRIVE_CLIENT_SECRET`
      **vigentes en Vercel** (Vercel → Settings → Environment Variables; si
      están marcadas como Sensitive no se pueden releer: usar las de Google
      Cloud Console → Credentials → el cliente OAuth).
- [ ] Iniciar sesión en Google con la cuenta **dueña de la carpeta raíz**
      (`insolvenic@gmail.com`). Si se autoriza con otra cuenta, el token
      no verá la carpeta.
- [ ] Haber resuelto el estado de publicación (§3) **antes**.

### Paso 0 — Autorizar el redirect del Playground (una sola vez)

En Google Cloud Console → **Google Auth Platform → Clients** (o **APIs &
Services → Credentials**) → abrir el cliente OAuth (tipo _Web application_)
→ en **Authorized redirect URIs** debe figurar exactamente:

```
https://developers.google.com/oauthplayground
```

Sin eso, Google rechaza el flujo con `redirect_uri_mismatch`. Guardar
(puede tardar unos minutos en propagarse).

### Paso 1 — Configurar el Playground con credenciales propias

1. Abrir <https://developers.google.com/oauthplayground>.
2. Engranaje ⚙ (arriba a la derecha) → tildar **Use your own OAuth
   credentials** → pegar **OAuth Client ID** y **OAuth Client secret**
   (los de `GOOGLE_DRIVE_CLIENT_ID` / `GOOGLE_DRIVE_CLIENT_SECRET`).
3. Verificar que **Access type** esté en **Offline** (es el valor por
   defecto; sin él Google no devuelve refresh token). Si el Playground ofrece
   forzar el consentimiento ("Force prompt"), activarlo para asegurar que
   emita un refresh token nuevo aunque ya se haya autorizado antes.

### Paso 2 — Autorizar el scope de Drive

1. En "Step 1", en el campo de scopes (**Input your own scopes**) escribir:

   ```
   https://www.googleapis.com/auth/drive
   ```

   > ⟨VERIFICAR el scope del token actual⟩. El repo **no fija** el scope
   > (el token se emitió fuera del código). `drive` es el que corresponde a
   > lo que hace `google-drive.ts`: crear subcarpetas y subir/listar/mover/
   > borrar archivos dentro de una carpeta raíz **preexistente**. El scope
   > más acotado `drive.file` solo alcanza archivos creados por la propia
   > app y no vería esa carpeta raíz. Si se sabe con qué scope se emitió el
   > token vigente y funcionaba, usar el mismo.

2. **Authorize APIs** → elegir `insolvenic@gmail.com` → aceptar los permisos
   (si aparece "Google no verificó esta aplicación", ver §3.2, punto 3).

### Paso 3 — Canjear el código por tokens

1. "Step 2" → **Exchange authorization code for tokens**.
2. Copiar el valor de **Refresh token** (el access token dura ~1 h y no
   sirve). Debe existir; si el campo viene vacío, no se emitió refresh
   token: repetir desde el paso 1 con "Force prompt"/consentimiento
   forzado, o revocar antes el acceso de la app (§2, causa 2) y volver a
   autorizar.
3. El código de autorización caduca en minutos: hacer los pasos 2 y 3 de
   corrido.

> **El refresh token es una contraseña de larga duración.** No pegarlo en
> chats, issues, PRs, commits ni capturas. Si se filtra, revocarlo en
> <https://myaccount.google.com/permissions> y volver a rotar.

---

## 5. Actualizar Vercel y verificar

### 5.1 Variables (rotación normal, escenario A)

Vercel → Project → Settings → Environment Variables:

| Variable                     | Acción                          | Production |   Preview    | Development |
| ---------------------------- | ------------------------------- | :--------: | :----------: | :---------: |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | Reemplazar por el token nuevo   |     ✔     | ✔ si existe |  si existe  |
| `GOOGLE_DRIVE_CLIENT_ID`     | Sin cambio                      |     –      |      –       |      –      |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Sin cambio                      |     –      |      –       |      –      |
| `GOOGLE_DRIVE_FOLDER_ID`     | Sin cambio (ver advertencia §1) |     –      |      –       |      –      |

- [ ] Sin comillas ni espacios/saltos de línea al final del valor.
- [ ] Revisar si hay una entrada de Preview duplicada asignada a una rama
      específica (pisa a la general; ver `RUNBOOK_ENV_VARS.md §2`).

### 5.2 Redeploy (obligatorio)

Vercel aplica los cambios de variables solo a deployments nuevos, y el
singleton de Drive lee el token al cargarse.

- **Production:** Deployments → deploy vigente → `···` → **Redeploy**.
- **Preview:** push de un commit a la rama, o Redeploy del último deployment.

### 5.3 Verificación sin efectos secundarios (recomendada primero)

Comprueba el token y el acceso a la carpeta raíz **sin crear ni modificar
nada** en Drive. Pasar los valores por variables de entorno del shell, sin
escribirlos en el comando (evita el historial):

```bash
read -rs -p "REFRESH_TOKEN: " RT; echo
read -rs -p "CLIENT_SECRET: " CS; echo
CID="<GOOGLE_DRIVE_CLIENT_ID>"; FID="<GOOGLE_DRIVE_FOLDER_ID>"

# 1) Canje: debe devolver un access_token (si devuelve invalid_grant, el token no sirve)
AT=$(curl -s https://oauth2.googleapis.com/token \
  -d client_id="$CID" -d client_secret="$CS" \
  -d refresh_token="$RT" -d grant_type=refresh_token | jq -r '.access_token // empty')
[ -n "$AT" ] && echo "token OK" || echo "token INVÁLIDO"

# 2) Lectura de la carpeta raíz: debe devolver id, name y mimeType=application/vnd.google-apps.folder
curl -s -H "Authorization: Bearer $AT" \
  "https://www.googleapis.com/drive/v3/files/$FID?fields=id,name,mimeType&supportsAllDrives=true" | jq

unset RT CS AT
```

- Paso 1 devuelve `invalid_grant` → el token está mal copiado, fue emitido
  con otro cliente, o ya expiró (revisar §3).
- Paso 2 devuelve `404` → la cuenta que autorizó no ve esa carpeta
  (autorizó con otra cuenta) o el `FOLDER_ID` es incorrecto.

Para ver también el scope con el que se emitió, agregar al final:
`curl -s "https://oauth2.googleapis.com/tokeninfo?access_token=$AT" | jq .scope`
(antes del `unset`).

### 5.4 Verificación funcional

`/api/health` **solo prueba la base de datos**; no existe health check de
Drive. La comprobación funcional real es generar documentos de un caso
**de prueba** y confirmar que el archivo aparece en Drive. Como Production
opera sobre Drive real, hacerlo con un caso creado para ese fin y limpiarlo
después `⟨la política de casos de prueba en producción no está definida en
el repo; decidirla antes de usarla⟩`.

- [ ] Verificación 5.3 en verde (token + carpeta raíz).
- [ ] Después del Redeploy, en **Vercel → Logs**, sin `invalid_grant` en
      los últimos 15 minutos.
- [ ] Sentry sin `Error generating document` nuevos (`action:
    'generate-documents'`).
- [ ] Anotar en algún lado la **fecha de rotación** y el estado del consent
      screen (`Publishing status`) en ese momento.

---

## 6. Escenarios según qué se comprometió

| Escenario                                                          | Qué pasó                                      | Qué cambiar                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Token muerto/expirado/filtrado** (el habitual)                | `invalid_grant`, token filtrado, o expiración | Solo `GOOGLE_DRIVE_REFRESH_TOKEN` (§4 y §5). Si se filtró, revocar el token viejo en <https://myaccount.google.com/permissions>                                                                                                    |
| **B. Se filtró el client secret**                                  | Secreto expuesto                              | En Google Cloud Console generar un secreto nuevo del mismo cliente y deshabilitar el viejo; **generar un refresh token nuevo con el secreto nuevo** (§4) y actualizar `GOOGLE_DRIVE_CLIENT_SECRET` + `GOOGLE_DRIVE_REFRESH_TOKEN`  |
| **C. Cliente OAuth nuevo** (p. ej. proyecto de Google Cloud nuevo) | Nuevo `client_id`                             | `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET` **y** `GOOGLE_DRIVE_REFRESH_TOKEN`, generados juntos; hay que repetir §3 (publicación) y §4.0 (redirect) en el proyecto nuevo. Los tokens del cliente viejo dejan de servir |
| **D. Cambio de cuenta o de carpeta raíz**                          | Otro dueño/otro almacenamiento                | **Fuera de alcance de una rotación.** Toca `GOOGLE_DRIVE_FOLDER_ID` y deja enlaces viejos rotos (§1, advertencia). Decisión de negocio/operativa                                                                                   |

---

## 7. Prevención

Como no hay alerta proactiva (§0):

- [ ] Que el consent screen esté en **In production** (§3): elimina la causa
      más probable de expiración.
- [ ] Ninguna ventana de 6 meses sin usar el token: si el sistema pasara
      largos períodos sin generar documentos, hacer el canje de §5.3 al menos
      una vez al mes.
- [ ] Anotar la fecha de la última rotación y del último canje exitoso.
- [ ] Mejora pendiente (no implementada): un check de Drive en `/api/health`
      o en el cron de alertas que haga el canje de token y avise antes del
      fallo. Ver `docs/ARQUITECTURA.md §11`.
