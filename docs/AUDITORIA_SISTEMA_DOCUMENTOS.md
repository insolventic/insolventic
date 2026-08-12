# AUDITORÍA COMPLETA DEL SISTEMA DE GENERACIÓN DE DOCUMENTOS - INSOLVENTIC

## Fecha: Febrero 2025
## Versión: 1.0

---

# PARTE 1: AUDITORÍA TÉCNICA

## 1.1 Resumen del Inventario

| Fuente | Cantidad |
|--------|----------|
| Variables en templates HTML | **322 únicas** (821 apariciones) |
| Campos en modelo Prisma (Case) | **98 campos** |
| Placeholders mapeados | **~200 variables** |
| Archivos HTML de templates | **50 archivos** |

## 1.2 Variables Huérfanas (En HTML pero NO mapeadas)

Las siguientes variables existen en los templates HTML pero **NO tienen mapeo** en `placeholder-mapper.ts`:

### Variables de Fechas/Años (NO MAPEADAS)
| Variable | Archivo | Estado |
|----------|---------|--------|
| `{{ANO_BILATERAL}}` | Solicitud de Insolvencia | ❌ No mapeada |
| `{{ANO_CONSTANCIA}}` | Múltiples | ❌ No mapeada |
| `{{ANO_DESISTIMIENTO}}` | Auto Desistimiento | ❌ No mapeada |
| `{{ANO_FRACASO}}` | Solicitud de Insolvencia | ❌ No mapeada |
| `{{ANO_INICIO_PAGO}}` | Solicitud de Insolvencia | ❌ No mapeada |
| `{{ANO_RADICADO}}` | 12 archivos | ❌ No mapeada |
| `{{ANO_TRAMITE}}` | Múltiples | ❌ No mapeada |
| `{{ANO_VIGENCIA}}` | Solicitud de Insolvencia | ❌ No mapeada |
| `{{ANO}}` | Edicto, Inadmisión | ❌ No mapeada |
| `{{DIA_DESISTIMIENTO}}` | Auto Desistimiento | ❌ No mapeada |
| `{{DIA_FRACASO}}` | Solicitud de Insolvencia | ❌ No mapeada |
| `{{DIA}}` | Inadmisión | ❌ No mapeada |
| `{{MES_DESISTIMIENTO}}` | Auto Desistimiento | ❌ No mapeada |
| `{{MES_FRACASO}}` | Solicitud de Insolvencia | ❌ No mapeada |
| `{{MES}}` | Inadmisión | ❌ No mapeada |

### Variables de Certificado de Ingresos (NO MAPEADAS)
| Variable | Descripción | Estado |
|----------|-------------|--------|
| `{{ACTIVIDAD_ECONOMICA}}` | Actividad económica del declarante | ❌ No mapeada |
| `{{CEDULA_DECLARANTE}}` | Cédula del declarante | ❌ No mapeada |
| `{{CIUDAD_DOMICILIO}}` | Ciudad de domicilio | ❌ No mapeada |
| `{{CORREO_DECLARANTE}}` | Correo del declarante | ❌ No mapeada |
| `{{INGRESO_MENSUAL}}` | Ingreso mensual declarado | ❌ No mapeada |
| `{{NOMBRE_DECLARANTE}}` | Nombre del declarante | ❌ No mapeada |
| `{{TELEFONO_DECLARANTE}}` | Teléfono del declarante | ❌ No mapeada |

### Variables de Sentido del Voto (NO MAPEADAS - **DILIGENCIAMIENTO MANUAL**)
| Variable | Descripción | Estado |
|----------|-------------|--------|
| `{{apoderado_cedula}}` | Cédula del apoderado votante | 🔵 Manual |
| `{{apoderado_nombre}}` | Nombre del apoderado votante | 🔵 Manual |
| `{{correo_electronico}}` | Correo votante | 🔵 Manual |
| `{{deudor_cedula}}` | Cédula deudor (contexto voto) | 🔵 Manual |
| `{{deudor_nombre}}` | Nombre deudor (contexto voto) | 🔵 Manual |
| `{{entidad_representada}}` | Entidad que representa | 🔵 Manual |
| `{{fecha_documento}}` | Fecha del documento de voto | 🔵 Manual |
| `{{fecha_inicio_pago}}` | Fecha inicio pago propuesto | 🔵 Manual |
| `{{firma_votante}}` | Firma del votante | 🔵 Manual |
| `{{forma_pago}}` | Forma de pago propuesta | 🔵 Manual |
| `{{numero_cuotas}}` | Número de cuotas | 🔵 Manual |
| `{{observaciones}}` | Observaciones del voto | 🔵 Manual |
| `{{tarjeta_profesional}}` | Tarjeta profesional | 🔵 Manual |
| `{{telefono_contacto}}` | Teléfono de contacto | 🔵 Manual |
| `{{tramite_interno}}` | Número trámite interno | 🔵 Manual |
| `{{valor_cuota}}` | Valor de la cuota | 🔵 Manual |
| `{{votacion}}` | Sentido del voto | 🔵 Manual |

### Variables de Check List (NO MAPEADAS)
| Variable | Uso |
|----------|-----|
| `{{NO_150}}`, `{{SI_150}}` | ¿Más de 150 acreedores? |
| `{{NO_40}}`, `{{SI_40}}` | ¿Menos de 40 SMMLV? |
| `{{NO_ACREEDORES}}`, `{{SI_ACREEDORES}}` | ¿Tiene acreedores? |
| `{{NO_ALIMENTARIAS}}`, `{{SI_ALIMENTARIAS}}` | ¿Obligaciones alimentarias? |
| `{{NO_APODERADO}}`, `{{SI_APODERADO}}` | ¿Actúa con apoderado? |
| `{{NO_BIENES}}`, `{{SI_BIENES}}` | ¿Tiene bienes? |
| `{{NO_CAUSAS}}`, `{{SI_CAUSAS}}` | ¿Identifica causas? |
| `{{NO_CONYUGAL}}`, `{{SI_CONYUGAL}}` | ¿Tiene sociedad conyugal? |
| `{{NO_INGRESOS}}`, `{{SI_INGRESOS}}` | ¿Tiene ingresos? |
| `{{NO_MAS_150}}`, `{{SI_MAS_150}}` | ¿Más de 150 SMMLV? |
| `{{NO_PC}}`, `{{SI_PC}}` | ¿Es pequeño comerciante? |
| `{{NO_PROCESOS}}`, `{{SI_PROCESOS}}` | ¿Tiene procesos judiciales? |
| `{{NO_PROPUESTA}}`, `{{SI_PROPUESTA}}` | ¿Presenta propuesta? |
| `{{NO_RECURSOS}}`, `{{SI_RECURSOS}}` | ¿Tiene recursos? |
| `{{NO_SOLICITUD}}`, `{{SI_SOLICITUD}}` | ¿Solicitud completa? |
| `{{NO_VALOR_BIENES}}`, `{{SI_VALOR_BIENES}}` | ¿Declara valor bienes? |
| `{{OK}}` | Marca de verificación |

### Variables de Cuadros/Tablas Dinámicas (NO MAPEADAS)
| Variable | Descripción |
|----------|-------------|
| `{{CUADRO_ACUERDO_BILATERAL}}` | Tabla de acuerdo bilateral |
| `{{CUADRO_CALIFICACION_FIRMADO}}` | Calificación con firmas |
| `{{CUADRO_FRACASO_NEGOCIACION}}` | Tabla de fracaso |
| `{{CUADRO_TOTAL_ACREEDORES}}` | Resumen total acreedores |
| `{{INVENTARIO_BIENES}}` | Inventario completo |
| `{{LISTA_ACREEDORES}}` | Lista para edicto |
| `{{PROPUESTA_REFORMA_PAGO}}` | Propuesta de reforma |
| `{{PROYECTO_CALIFICACION_GRADUACION}}` | Proyecto de C&G |

### Variables de Entidades Externas (NO MAPEADAS)
| Variable | Descripción |
|----------|-------------|
| `{{NOMBRE_ENTIDAD_PAGADORA}}` | Nombre del pagador (libranzas) |
| `{{NOMBRE_JUZGADO}}` | Nombre del juzgado |
| `{{NUMERO_JUZGADO}}` | Número del juzgado |
| `{{NOMBRE_DEMANDANTE}}` | Nombre del demandante |
| `{{TIPO_PROCESO}}` | Tipo de proceso judicial |
| `{{RADICADO_BILATERAL}}` | Radicado del acuerdo bilateral |

### Variables Especiales (NO MAPEADAS)
| Variable | Descripción |
|----------|-------------|
| `{{ACREEDORES_NEGATIVOS}}` | Acreedores que votaron NO |
| `{{PORCENTAJE_NEGATIVO}}` | % de votos negativos |
| `{{VALOR_PAGO}}` | Valor total de pago |
| `{{FECHA_COMPLETA}}` | Fecha en formato largo |
| `{{NUMERO_CONSTANCIA}}` | Número de constancia |
| `{{TIPO_SOLICITANTE}}` | Tipo de solicitante |
| `{{GENERO_DEUDOR_SINGULAR}}` | Género en singular |

---

## 1.3 Variables Duplicadas o Inconsistentes

### Inconsistencias de Naming
| Grupo | Variables | Problema |
|-------|-----------|----------|
| Nombre Deudor | `NOMBRE_DEUDOR`, `NOMBRE_DEUDOR_COMPLETO`, `deudor_nombre` | 3 formas distintas |
| Cédula Deudor | `CEDULA_DEUDOR`, `NUMERO_CEDULA`, `deudor_cedula` | 3 formas distintas |
| Correo | `CORREO_ELECTRONICO`, `correo_electronico`, `EMAIL_DEUDOR`, `NOTIF_EMAIL` | CamelCase vs lowercase vs underscore |
| Tarjeta Prof. | `TARJETA_PROFESIONAL`, `tarjeta_profesional` | Case inconsistente |

### Variables con Funcionalidad Similar
| Variable 1 | Variable 2 | Observación |
|------------|------------|-------------|
| `NUMERO_TRAMITE` | `RADICADO` | Mismo valor, diferente nombre |
| `NUMERO_RADICADO` | `NUMERO_ACUERDO` | Derivados del mismo campo |
| `INGRESO_PRINCIPAL` | `RECURSOS_INGRESOS` | Mismo valor, contexto diferente |
| `GASTOS_MENSUALES` | `RECURSOS_GASTOS` | Mismo valor, contexto diferente |
| `EMAIL_DEUDOR` | `NOTIF_EMAIL` | Pueden ser diferentes |

---

## 1.4 Campos del Formulario NO Usados en Documentos

Los siguientes campos existen en el formulario pero **NO aparecen en ningún template HTML**:

| Campo Formulario | Modelo Prisma | ¿Se usa en documentos? |
|------------------|---------------|------------------------|
| `siccacNumber` | Case.siccacNumber | ❌ No |
| `riskCenterCommunication` | Case.riskCenterCommunication | ❌ No |
| `phase` | Case.phase | ❌ No (es estado interno) |
| `driveFolderId` | Case.driveFolderId | ❌ No (es ID interno) |
| `operatorId` | Case.operatorId | Solo `NOMBRE_OPERADOR` |
| `resultType` | Case.resultType | ❌ No |
| `resultDate` | Case.resultDate | ❌ No |
| `resultDeliveryDate` | Case.resultDeliveryDate | ❌ No |

---

# PARTE 2: CAMPOS DE DILIGENCIAMIENTO MANUAL

## 2.1 Campos que NO Debe Generar el Sistema Automáticamente

Según las reglas del negocio, los siguientes campos **SOLO deben ser ingresados manualmente** por el operador en el momento procesal adecuado:

### Fechas Procesales (MANUAL)
| Campo | Momento de Diligenciamiento | Variable HTML |
|-------|---------------------------|---------------|
| Fecha de radicación | Al recibir la solicitud | `FECHA_RADICACION` |
| Fecha de designación | Al designar conciliador (+1 día) | `FECHA_DESIGNACION` |
| Fecha de aceptación del cargo | Al aceptar cargo (+2 días) | `FECHA_ACEPTACION` |
| Fecha de admisión | Al admitir el trámite | `FECHA_ADMISION` |
| Fecha primera audiencia | Al programar audiencia | `FECHA_AUDIENCIA` |
| Hora primera audiencia | Al programar audiencia | `HORA_AUDIENCIA` |

### Información de Juzgados (MANUAL)
| Campo | Momento de Diligenciamiento | Variable HTML |
|-------|---------------------------|---------------|
| Nombre del juzgado | Al generar suspensión | `NOMBRE_JUZGADO` |
| Número del juzgado | Al generar suspensión | `NUMERO_JUZGADO` |
| Nombre demandante | Al generar suspensión | `NOMBRE_DEMANDANTE` |
| Tipo de proceso | Al generar suspensión | `TIPO_PROCESO` |

### Sentido del Voto (MANUAL - Formulario Independiente)
| Campo | Responsable | Variable HTML |
|-------|-------------|---------------|
| Propuesta aceptada | Votante/Acreedor | `votacion` |
| Forma de pago | Votante/Acreedor | `forma_pago` |
| Número de cuotas | Votante/Acreedor | `numero_cuotas` |
| Valor cuota | Votante/Acreedor | `valor_cuota` |
| Observaciones | Votante/Acreedor | `observaciones` |
| Firma | Votante/Acreedor | `firma_votante` |

### Control de Legalidad (MANUAL)
| Campo | Momento | Observación |
|-------|---------|-------------|
| Fecha control legalidad | Post-audiencia | No existe variable aún |
| Lugar control legalidad | Post-audiencia | No existe variable aún |
| Hechos 1-3 | Durante audiencia | `HECHO_1`, `HECHO_2`, `HECHO_3` |
| Descripción pruebas | Durante audiencia | `DESCRIPCION_PRUEBAS` |

### Vigencia del Acuerdo (MANUAL)
| Campo | Momento | Variable HTML |
|-------|---------|---------------|
| Día inicio vigencia | Post-acuerdo | `DIA_VIGENCIA` |
| Mes inicio vigencia | Post-acuerdo | `MES_VIGENCIA` |
| Año inicio vigencia | Post-acuerdo | `ANO_VIGENCIA` |
| Día inicio pago | Post-acuerdo | `DIA_INICIO_PAGO` |
| Mes inicio pago | Post-acuerdo | `MES_INICIO_PAGO` |
| Año inicio pago | Post-acuerdo | `ANO_INICIO_PAGO` |

---

# PARTE 3: DOCUMENTOS ADJUNTOS REQUERIDOS

## 3.1 Documentos Obligatorios (Validación Estricta)

| Documento | Descripción | Validación |
|-----------|-------------|------------|
| **Cédula** | Cédula de ciudadanía del deudor | PDF/imagen, obligatorio |
| **REDAM** | Certificado del Registro de Deudores Alimentarios | PDF, obligatorio |
| **Certificado de Ingresos** | Certificación de ingresos del deudor | PDF, obligatorio |
| **Certificado Tradición** | Para cada inmueble declarado | PDF, obligatorio si tiene inmuebles |
| **Matrícula Mercantil** | Solo si es pequeño comerciante | PDF, obligatorio si aplica |
| **Poder** | Notariado o correo con aceptación | PDF/imagen, obligatorio si actúa apoderado |

## 3.2 Documentos Opcionales (Soportes)

| Documento | Descripción | Cuándo es útil |
|-----------|-------------|----------------|
| Extractos bancarios | Últimos 3 meses | Si tiene cuentas bancarias |
| Recibos de gastos | Agua, luz, gas | Para soportar gastos |
| Historial procesos | Antecedentes judiciales | Si tiene procesos |
| Mandamientos de pago | De procesos activos | Si tiene embargos |
| Certificados de deuda | De cada acreedor | Para verificar montos |
| Pagarés/Letras/Cheques | Títulos valores | Si existen |

---

# PARTE 4: CORRECCIONES AL FORMULARIO

## 4.1 Errores de UX Identificados

| Error | Ubicación | Corrección |
|-------|-----------|------------|
| Botón Cancelar/Guardar en cada tab | Todas las pestañas | Mover solo al final |
| Permite enviar con campos vacíos | Validación frontend | Bloquear envío si incompleto |
| Campo "Trámite" editable | Tab Detalles | Hacer read-only, autoasignar |
| "Estado del proceso" en formulario | Tab Fechas | Eliminar (es dinámico) |
| Certificado empleador editable | Tab Ingresos | Cambiar a file upload |

## 4.2 Validaciones Faltantes

### Validaciones Frontend (Inmediatas)
```typescript
// Campos numéricos
totalDebt: z.number().positive("Debe ser mayor a 0"),
monthlyIncome: z.number().nonnegative(),
monthlyExpenses: z.number().nonnegative(),

// Campos obligatorios
debtorId: z.string().min(1, "Debe seleccionar un deudor"),
causes: z.array(z.string()).min(1, "Debe seleccionar al menos una causa"),
applicantScope: z.array(z.string()).min(1, "Debe seleccionar ámbito"),

// Al menos un acreedor
debts: z.array(debtSchema).min(1, "Debe agregar al menos un acreedor"),

// Coherencia
monthlyExpenses <= monthlyIncome (advertencia, no bloqueo)
totalDebt > 0 si hay acreedores
```

### Validaciones Backend (Seguridad)
```typescript
// Verificar que el deudor existe
const debtor = await prisma.debtor.findUnique({...});
if (!debtor) throw new Error("Deudor no encontrado");

// Verificar permisos
if (!user.permissions.includes('Crear casos')) throw new Error("Sin permisos");

// Verificar unicidad de radicado
const existing = await prisma.case.findFirst({where: {caseNumber}});
if (existing) throw new Error("Radicado ya existe");

// Validar documentos adjuntos obligatorios
if (!hasRequiredDocuments(input)) throw new Error("Faltan documentos obligatorios");
```

## 4.3 Lógica Condicional del Formulario

| Condición | Efecto en UI |
|-----------|--------------|
| `applicantScope.includes('PEQUENA_COMERCIANTE')` | Mostrar campo Matrícula Mercantil |
| `hasLegalProcesses === true` | Mostrar sección Procesos Judiciales |
| `assets.length === 0` | Ocultar sección detalle de bienes |
| `debts.some(d => d.hasActiveLibranza)` | Mostrar sección Libranzas |
| `maritalStatus === 'CASADO'` | Mostrar sección Cónyuge |
| `gracePeriodRequested === true` | Mostrar campo Meses de Gracia |
| `paymentInKind === true` | Mostrar descripción Dación en Pago |
| `assetSaleAuthorized === true` | Mostrar descripción Venta de Bienes |
| `extraordinaryPayment === true` | Mostrar fecha Pago Extraordinario |
| `capitalReduction === true` | Mostrar porcentaje Reducción |
| `hasClassPrivileges === true` | Mostrar descripción Privilegios |

---

# PARTE 5: FLUJO DE GENERACIÓN DOCUMENTAL

## 5.1 Generación por Etapas (NO Todo a la Vez)

### ETAPA 1: SOLICITUD (Al crear caso)
Documentos que se generan automáticamente:
| Documento | Condiciones |
|-----------|-------------|
| ✅ Solicitud de Insolvencia | Siempre |
| ✅ Check List | Siempre |
| ✅ Certificado de Ingresos | Siempre |
| ✅ Declaración Juramentada Domicilio | Siempre |
| ✅ Hoja Guía | Siempre |

### ETAPA 2: ADMISIÓN (Al admitir trámite)
Documentos que se generan cuando `admissionDate` se establece:
| Documento | Condiciones |
|-----------|-------------|
| ⏳ Auto Admisión del Trámite | Requiere fechas procesales |
| ⏳ Designación del Conciliador | Requiere fecha designación |
| ⏳ Aceptación del Cargo | Requiere fecha aceptación |
| ⏳ Notificación a Acreedores | Requiere lista validada |
| ⏳ Edicto Emplazatorio | Requiere acreedores |
| ⏳ Suspensión Juzgados | Si tiene procesos |
| ⏳ Suspensión Garantía Mobiliaria | Si aplica |
| ⏳ Envío Pagador Suspensión | Si tiene libranzas |

### ETAPA 3: AUDIENCIA (Durante/después de audiencia)
| Documento | Condiciones |
|-----------|-------------|
| 🔵 Trámite Audiencia | Manual durante audiencia |
| 🔵 CYG Trámite | Manual, calificación créditos |
| 🔵 Sentido del Voto | Manual por cada acreedor |

### ETAPA 4: RESULTADO (Al cerrar trámite)
| Documento | Condiciones |
|-----------|-------------|
| ⏳ Acuerdo de Pago | Si hay acuerdo |
| ⏳ Acuerdo Bilateral | Si aplica |
| ⏳ Remisión Resultado | Siempre al cerrar |
| ⏳ Fracaso Trámite | Si fracasa |
| ⏳ Auto Desistimiento | Si desiste |
| ⏳ Auto Cierre por Inasistencia | Si aplica |

## 5.2 Validación Pre-Generación

Antes de generar cualquier documento, el sistema debe verificar:

```typescript
async function validateDocumentGeneration(caseId: string, documentType: string): Promise<ValidationResult> {
  const caseData = await getCaseWithRelations(caseId);

  const requiredFields = getRequiredFieldsForDocument(documentType);
  const missingFields = requiredFields.filter(field => !caseData[field]);

  if (missingFields.length > 0) {
    return {
      canGenerate: false,
      missingFields,
      message: `Faltan campos obligatorios: ${missingFields.join(', ')}`
    };
  }

  return { canGenerate: true };
}
```

## 5.3 Campos Obligatorios por Documento

### Solicitud de Insolvencia
```
OBLIGATORIOS:
- NOMBRE_DEUDOR
- CEDULA_DEUDOR
- DIRECCION_DEUDOR
- EMAIL_DEUDOR
- TELEFONO_DEUDOR
- Al menos 1 acreedor (ACREEDOR_1, VALOR_1)
- TOTAL_ACREENCIAS
- Al menos 1 causa (CAUSA_1..12)
- APLICACION_NO_COMERCIANTE o APLICACION_PEQUENA_COMERCIANTE
- INGRESO_PRINCIPAL
- GASTOS_MENSUALES
- PROPUESTA_DISPONIBLE
```

### Auto Admisión del Trámite
```
OBLIGATORIOS:
- NOMBRE_DEUDOR
- CEDULA_DEUDOR
- RADICADO
- FECHA_ADMISION
- FECHA_AUDIENCIA
- HORA_AUDIENCIA
- ZOOM_ID, ZOOM_CODIGO, ZOOM_LINK
- NOTIF_DIRECCION, NOTIF_EMAIL, NOTIF_TELEFONO
```

### Designación del Conciliador
```
OBLIGATORIOS:
- NOMBRE_DEUDOR
- CEDULA_DEUDOR
- FECHA_RADICACION
- FECHA_DESIGNACION
```

### Aceptación del Cargo
```
OBLIGATORIOS:
- NOMBRE_DEUDOR
- CEDULA_DEUDOR
- FECHA_RADICACION
- FECHA_DESIGNACION
- FECHA_ACEPTACION
```

---

# PARTE 6: RECOMENDACIONES TÉCNICAS

## 6.1 Cambios Urgentes (Prioridad Alta)

1. **Agregar mapeos faltantes** en `placeholder-mapper.ts`:
   - Todas las variables ANO_* (año de radicado, audiencia, etc.)
   - Variables del Certificado de Ingresos (ACTIVIDAD_ECONOMICA, etc.)
   - Variables del Check List (SI/NO)

2. **Separar formularios por etapa procesal**:
   - Formulario de Solicitud (ETAPA 1)
   - Formulario de Admisión (ETAPA 2)
   - Formulario de Audiencia (ETAPA 3)
   - Formulario de Resultado (ETAPA 4)

3. **Implementar validación pre-generación** para evitar documentos vacíos

## 6.2 Cambios Importantes (Prioridad Media)

1. **Normalizar naming de variables**:
   - Todo en MAYUSCULAS_SNAKE_CASE
   - Eliminar duplicados
   - Crear diccionario único

2. **Agregar campo `status` a documentos generados**:
   - BORRADOR, VALIDADO, FIRMADO, ENTREGADO

3. **Implementar regeneración selectiva** cuando cambian datos

## 6.3 Mejoras Futuras (Prioridad Baja)

1. Previsualización de documentos antes de generar
2. Historial de versiones de documentos
3. Firma digital integrada
4. Notificaciones automáticas a acreedores

---

# ANEXO: DICCIONARIO DE VARIABLES NORMALIZADAS

Ver archivo separado: `DICCIONARIO_PLACEHOLDERS.md` (renombrado desde `DICCIONARIO_VARIABLES.md`)
