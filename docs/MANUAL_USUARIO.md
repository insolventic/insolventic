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

| Rol               | Alcance                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| **Administrador** | Acceso total: casos, usuarios, roles, reportes, auditoría              |
| **Operador**      | Crear y gestionar casos asignados, generar documentos, registrar pagos |
| **Asistente**     | Consulta + captura básica; sin eliminación ni cambios de fase          |
| **Auditor**       | Solo lectura + acceso a reportes y bitácora                            |

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

El sistema guarda como **borrador** al avanzar entre secciones.

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

En el detalle del caso verás los botones contextuales:

- **Admitir** (desde Solicitud) → exige fecha de admisión, operador designado, fecha de aceptación.
- **Programar primera audiencia** (desde Admisión).
- **Registrar resultado** (desde Negociación) → Acuerdo o Fracaso.
- **Cerrar caso** → marca `resultDate` y bloquea edición.

Cada transición queda registrada en el **Audit Log**.

---

## 5. Deudores, acreedores, apoderados

Módulos independientes con CRUD. Al crear un caso puedes vincular un deudor existente o crear uno nuevo al vuelo.

**En conciliación:** hay dos roles — **Convocante** (solicitante) y **Convocado** (contraparte). Se gestionan como acreedores bilaterales.

---

## 6. Generación de documentos

`Documentos → Generar documentos`

1. **Seleccionar caso.**
2. **Seleccionar paquete:**
   - Todos (49 docs)
   - Paquete 1 — Solicitud (6 docs)
   - Paquete 2 — Admisión (7 docs)
   - Paquete 3 — Negociación (6 docs)
   - Paquete 4 — Terminación (3 docs)
   - Paquete 5 — Fracaso (27 docs)
3. **Seleccionar formato:** Solo PDF / Solo Word / Ambos.
4. **Generar documentos.**

El sistema:

- Valida que el caso tenga los campos requeridos (muestra faltantes).
- Sube automáticamente los archivos a la carpeta del caso en **Google Drive**.
- Guarda un registro en la pestaña _Documentos_ del caso con link directo.

**Alertas que puedes ver:**

- ⚠️ _Este caso ya tiene N documentos generados. Al generar nuevamente se crearán adicionales sin reemplazar los existentes._
- ❌ _Error leyendo plantilla:_ significa que la plantilla base tiene un problema — contacta a soporte.

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
