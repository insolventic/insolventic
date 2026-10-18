# Manual de Usuario — INSOLVENTIC

> Dirigido a operadores, administradores y personal de los centros de conciliación (Armonía, Constructores de Paz).

---

## 1. Ingreso al sistema

1. Ir a la URL del centro (ej. `https://insolventic.vercel.app`).
2. Seleccionar el **centro de conciliación** correspondiente.
3. Ingresar email y contraseña.
4. Si es tu primer ingreso, el sistema te forzará a **cambiar tu contraseña** antes de continuar.

**Olvidaste tu contraseña:** link "¿Olvidaste tu contraseña?" envía un email con token válido por 1 hora.

---

## 2. Roles y permisos

Los 5 roles con los que arranca cada centro (`src/prisma/seed.ts`):

| Rol                      | Alcance                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| **Administrador**        | Acceso total: casos, usuarios, roles, reportes, auditoría, eliminar casos/deudores/acreedores |
| **Operadora de Insolvencia** | Crear y editar casos, acreedores y deudores; generar documentos. No elimina casos ni administra usuarios/roles |
| **Abogado**              | Crear y editar casos (ve también los casos propios); genera documentos. No elimina nada  |
| **Asistente Legal**      | Solo consulta de casos (propios y en general) y de acreedores/deudores; genera documentos |
| **Secretaria**           | Solo consulta de casos y documentos — sin crear, editar ni generar                        |

Los permisos son configurables por rol desde **Configuración → Roles**.

---

## 3. Dashboard

Al ingresar verás:

- **KPIs principales:** total de casos, activos, por fase, con acuerdos vigentes.
- **Casos recientes** del último mes.
- **Alertas:** audiencias próximas, plazos por vencer, notificaciones sin leer.

---

## 4. Gestión de casos

### 4.1 Crear un caso

`Casos → + Nuevo Caso`

**Secciones del formulario (insolvencia):**

1. **Identificación del solicitante** — datos personales, documento, dirección, contacto.
2. **Cónyuge** — si aplica (sociedad conyugal vigente/disuelta).
3. **Información laboral y económica** — ingresos, gastos, capacidad de pago, patrimonio.
4. **Cesación de pagos** — fecha, número de acreedores, % de pasivo en mora.
5. **Acreedores y deudas** — monto, garantía, clase (laboral, fiscal, quirografario, privilegiado).
6. **Bienes** — muebles, inmuebles, vehículos, con avalúo.
7. **Procesos judiciales en curso** — si los hay.
8. **Declaraciones** — veracidad, buena fe, no ocultamiento, autorizaciones.
9. **Propuesta de pago** — plazo, cuota mensual, período de gracia, etc.

**Para un caso de Conciliación**, el formulario cambia: asunto y cuantía,
audiencia virtual (Zoom: ID, código de acceso, enlace), convocante/convocado
y sus apoderados, fechas reales del trámite (solicitud, citación,
desistimiento), menores de edad (alimentos/unión marital), cláusulas del
acuerdo, causa de terminación anormal, resultado del informe del
conciliador, y — si aplica el trámite — los datos de la Aclaración de Acta
(qué campo tenía el error, valor incorrecto/correcto) y de las referencias
del acta de unión marital que se disuelve o aclara.

El sistema guarda como **borrador** al avanzar entre secciones.

**Montos en pesos:** todo campo de dinero (ingresos, gastos, deudas,
cuantía) muestra el separador de miles mientras se escribe —`1.500.000`, no
`1500000`— para que sea más fácil verificar que el monto es el correcto.

### 4.2 Filtrar y buscar casos

En el listado puedes filtrar por:

- Estado (activo / cerrado / todos)
- Fase (Solicitud / Admisión / Negociación / Terminación)
- **Tipo de servicio** (Insolvencia / Conciliación / Acuerdo de Apoyo)
- Texto libre (número de caso, nombre del deudor, cédula)

### 4.3 Editar un caso

Abrir el caso → **Editar**. El sistema protege contra ediciones concurrentes:

> ⚠️ **Si dos usuarios editan el mismo caso al tiempo**, quien guarde último recibirá el mensaje _"Este caso fue modificado por otro usuario. Recargue y vuelva a intentarlo."_ — el dialog se cerrará automáticamente.

### 4.4 Transiciones de fase

El expediente tiene 13 fases (`Inicial` → `Terminado`). En el detalle del
caso solo aparecen los botones de las transiciones **válidas desde la fase
actual** — el sistema no deja saltar fases.

**Las 5 fases que distinguen el desenlace de la negociación**, en vez de
caer todas a `Fracaso` con el mismo paquete de documentos:

| Fase | Cuándo se usa |
| --- | --- |
| **Rechazo** | La solicitud se rechaza de entrada, antes de admitir — no es un fracaso de negociación |
| **Retiro** | El solicitante se retira **antes** de que el caso sea admitido |
| **Desistimiento** | El deudor abandona el trámite **después** de admitido. Pide un subtipo: *No pago de tarifas* o *Abandono total* |
| **Acuerdo impugnado** | Hay una impugnación pendiente ante el juez sobre un acuerdo ya aprobado |
| **Acuerdo reformado** | El juez ordena corregir el acuerdo y se corrige dentro del plazo |

**Fracaso** (la fase que ya existía) pide un subtipo de entre 13 — por
ejemplo *Inasistencia del deudor*, *Incumplimiento*, *Impugnación del
acuerdo*, *Muerte del deudor* — porque cada uno genera un paquete de
documentos distinto.

Otros botones contextuales que verás:

- **Admitir** (desde Inicial) → exige fecha de admisión, operador designado, fecha de aceptación.
- **Programar primera audiencia** (desde Admisión).
- **Registrar resultado** (desde En negociación / Audiencia programada) → Acuerdo aprobado, Desistimiento o Fracaso.
- **Cerrar caso** (Terminado) → marca `resultDate` y bloquea edición.

Cada transición queda registrada en el **Audit Log**.

> `Rechazo`, `Retiro`, `Acuerdo impugnado` y `Acuerdo reformado` todavía no
> tienen su propio paquete de documentos (pendiente del abogado, ver
> `docs/DISENO_FASES_NUEVAS_2026-09-11.md` §3) — hoy, al generar documentos
> para un caso en una de esas 4 fases, el sistema usa el Paquete 1 por
> defecto.

---

## 5. Deudores, acreedores, apoderados

Módulos independientes con CRUD. Al crear un caso puedes vincular un deudor existente o crear uno nuevo al vuelo.

**En conciliación:** hay dos roles — **Convocante** (solicitante) y **Convocado** (contraparte). Se gestionan como acreedores bilaterales.

---

## 6. Generación de documentos

`Documentos → Generar documentos`

1. **Seleccionar caso.**
2. **Seleccionar paquete** — el número de documentos de cada opción se
   calcula en vivo contra las plantillas reales, así que puede variar si se
   agrega o quita una plantilla:
   - Todos los paquetes
   - Paquete 1 — Solicitud
   - Paquete 2 — Admisión y Apertura
   - Paquete 3 — Negociación y Acuerdo
   - Paquete 4 — Terminación Normal
   - Paquete 5 — Fracaso
3. **Seleccionar formato:** Solo PDF / Solo Word / Ambos.
4. **Generar documentos.**

**Lotes grandes (Todos los paquetes, o Paquete 5) se generan por tandas.**
El botón muestra *"Generando tanda X de Y..."* mientras corre — es normal
que un lote grande tarde más que uno chico, y no se puede volver a hacer
clic hasta que termine. Si una tanda falla a mitad de camino (por ejemplo,
un corte de red), las tandas que ya terminaron **no se pierden**: aparece
un botón **"Reintentar"** que retoma solo la tanda que faltó, no el lote
completo desde el principio.

El sistema:

- Valida que el caso tenga los campos requeridos (muestra faltantes).
- Sube automáticamente los archivos a la carpeta del caso en **Google Drive**.
- Guarda un registro en la pestaña _Documentos_ del caso con link directo.
- Usa el membrete y la firma propios del centro de conciliación del caso
  (logo, nombre del centro, firma de la conciliadora) — cada centro ve sus
  documentos con su propia identidad, no una genérica.

**Alertas que puedes ver:**

- ⚠️ _Este caso ya tiene N documentos generados. Al generar nuevamente se crearán adicionales sin reemplazar los existentes._
- ❌ _Error leyendo plantilla:_ significa que la plantilla base tiene un problema — contacta a soporte.
- ⚠️ _No se generó por datos incompletos:_ el documento se salta (no cuenta como error) porque al caso le falta un dato obligatorio para esa plantilla — complétalo y vuelve a generar.

---

## 7. Vista de documentos del caso

En el detalle de caso → pestaña **Documentos**:

- **Árbol de carpetas** por sección (01-Generados, 02-Adjuntos, 03-Evidencias, 04-Historial).
- **Vista previa inline** para PDFs e imágenes (click en el ícono de ojo+documento).
- **Descargar** (click en el ícono de ojo) abre el archivo en Drive.
- **Subir adjunto** (permiso requerido).

---

## 8. Trazabilidad de pagos

### 8.1 Generar cronograma

En la pestaña **Pagos** del caso, botón **"Generar cronograma"** crea las cuotas según la propuesta de pago aprobada.

### 8.2 Registrar un pago

Botón **"Registrar pago"** (o "Pagar" en una cuota):

- Monto
- Fecha de pago
- Método (Transferencia, Efectivo, Cheque, PSE, Otro)
- Observaciones
- **Comprobante** (PDF / JPG / PNG, máx. 10 MB)

El comprobante se sube automáticamente a `{caso}/Comprobantes/` en Drive.

### 8.3 Estados de pago

| Estado      | Significado                           |
| ----------- | ------------------------------------- |
| `pendiente` | Cuota programada, sin pago registrado |
| `pagado`    | Pago completo recibido                |
| `parcial`   | Pago menor al monto esperado          |
| `vencido`   | `dueDate` superada sin pago           |

### 8.4 Reporte de trazabilidad

`Reportes → Trazabilidad de Pagos`:

- Filtros: estado, fechas, tiene comprobante, búsqueda.
- Summaries: total recaudado, pendiente, vencido, casos con pagos.
- Tabla expandible por caso con barra de progreso `pagado / obligación total`.

---

## 9. Reportes

| Reporte                   | Contenido                                                          |
| ------------------------- | ------------------------------------------------------------------ |
| **Estado de Casos**       | Distribución por tipo, fase, operador. Montos solo en Insolvencia. |
| **Trazabilidad de Pagos** | Ver sección 8.4                                                    |

Los reportes se exportan a Excel/CSV (próximamente).

---

## 10. Gestión de usuarios y roles

`Usuarios` (permiso requerido):

- Crear usuario (email, nombre, rol, tenant).
- Asignar rol.
- Activar / desactivar.
- **Forzar cambio de contraseña en próximo login**.

`Configuración → Roles`:

- Crear rol nuevo.
- Marcar permisos por módulo.

---

## 11. Auditoría

`Auditoría` (permiso requerido): bitácora cronológica de acciones críticas:

- Login / logout
- Creación, edición, eliminación de casos/deudores/acreedores
- Cambios de fase
- Generación de documentos
- Registro de pagos
- Cambios de rol/permisos

Filtrable por usuario, acción, fecha.

---

## 12. Notificaciones

Icono de campana en la barra superior muestra notificaciones internas. Dos fuentes:

**Eventos del sistema (tiempo real):**

- Caso creado / actualizado / eliminado
- Acreedor, deudor, usuario, rol (alta/modificación/baja)

**Alertas proactivas (se generan automáticamente cada día a las 08:00 UTC):**

- **Audiencia próxima** (ícono calendario, ámbar): aparece 48h antes de la fecha de audiencia del caso que tengas asignado.
- **Pago vencido** (ícono triángulo, rojo): aparece cuando un pago programado pasa su fecha límite sin registrarse. El estado del pago pasa automáticamente a "vencido".

Al hacer click se marcan como leídas. Si tu administrador activa `ALERTS_EMAIL_ENABLED`, también recibirás un correo.

---

## 13. Cambio de centro (multi-tenant)

Si tu usuario tiene acceso a varios centros, en el perfil aparece **Cambiar centro**. El sistema:

1. Revalida tu sesión.
2. Revalida `mustChangePassword`.
3. Emite un nuevo token con el `tenantId` del centro destino.
4. Te redirige al dashboard del nuevo centro.

---

## 14. Preguntas frecuentes

**¿Por qué no puedo editar un caso?**

- Puede estar cerrado (`resultDate` ya fijado).
- No tienes el permiso "Editar casos".
- Tu rol solo tiene permiso "Ver casos".

**El documento generado dice "Error leyendo plantilla":**
Contacta a soporte. La plantilla `.docx` base puede estar corrupta o faltar.

**Subí un comprobante pero no aparece el link:**
Google Drive puede tardar unos segundos en propagar permisos. Recarga la pestaña.

**¿Puedo recuperar un caso eliminado?**
No directamente desde la UI. Contacta a un administrador — la auditoría conserva evidencia y se puede restaurar desde backup.

---

© 2025–2026 INSOLVENTIC
