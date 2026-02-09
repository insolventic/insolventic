# FORMULARIO MAESTRO DE SOLICITUD DE INSOLVENCIA

## Estructura General

El formulario está dividido en **10 pestañas** organizadas por flujo lógico del proceso:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Deudor  │  2. Caso  │  3. Acreedores  │  4. Bienes  │  ...  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    [CONTENIDO DE LA PESTAÑA]                    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                        [Cancelar] [Crear Caso]  │
└─────────────────────────────────────────────────────────────────┘
```

**IMPORTANTE**: Los botones de acción solo aparecen al final del formulario completo.

---

## TAB 1: DATOS DEL DEUDOR

### Sección 1.1: Selección de Deudor
| Campo | Tipo | Obligatorio | Validación | Variable |
|-------|------|-------------|------------|----------|
| Deudor | Select (búsqueda) | ✅ | Debe existir | debtorId |

*Si el deudor no existe, mostrar botón "Crear nuevo deudor" que abre modal.*

### Sección 1.2: Información Personal (Read-only si viene de deudor existente)
| Campo | Tipo | Obligatorio | Validación | Variable |
|-------|------|-------------|------------|----------|
| Nombre completo | Text (readonly) | ✅ | - | DEUDOR_NOMBRE |
| Tipo de documento | Select (readonly) | ✅ | CC, CE, NIT, PAS | - |
| Número de documento | Text (readonly) | ✅ | Numérico | DEUDOR_CEDULA |
| Email | Email (readonly) | ✅ | Formato email | DEUDOR_EMAIL |
| Teléfono | Tel (readonly) | ✅ | 10 dígitos | DEUDOR_TELEFONO |
| Dirección | Text (readonly) | ✅ | Min 10 chars | DEUDOR_DIRECCION |
| Ciudad | Text (readonly) | ✅ | - | DEUDOR_CIUDAD |
| Departamento | Select (readonly) | ❌ | - | DEUDOR_DEPARTAMENTO |

### Sección 1.3: Causas de Insolvencia
| Campo | Tipo | Obligatorio | Validación | Variable |
|-------|------|-------------|------------|----------|
| Causas | Checkbox múltiple | ✅ | Min 1 seleccionada | causes[] |

**Opciones:**
- [ ] Sobreendeudamiento por falta de recursos → CAUSA_1
- [ ] Pérdida de empleo → CAUSA_2
- [ ] Divorcio → CAUSA_3
- [ ] Enfermedad → CAUSA_4
- [ ] Accidente → CAUSA_5
- [ ] Estafa → CAUSA_6
- [ ] Disminución de ingresos → CAUSA_7
- [ ] Falta de educación financiera → CAUSA_8
- [ ] Muerte de cónyuge → CAUSA_9
- [ ] Nuevos créditos para cubrir otros → CAUSA_10
- [ ] Mala inversión → CAUSA_11
- [ ] Otros (especificar) → CAUSA_12

| Si "Otros" | Tipo | Obligatorio | Variable |
|------------|------|-------------|----------|
| Detalle | Textarea | ✅ si Otros | CAUSA_12_DETALLE |

### Sección 1.4: Ámbito de Aplicación
| Campo | Tipo | Obligatorio | Validación | Variable |
|-------|------|-------------|------------|----------|
| Ámbito | Radio | ✅ | Uno debe seleccionarse | applicantScope |

**Opciones:**
- ( ) Persona Natural No Comerciante → AMBITO_NO_COMERCIANTE
- ( ) Persona Natural Pequeña Comerciante → AMBITO_PEQUENO_COMERCIANTE

---

## TAB 2: INFORMACIÓN DEL CASO

### Sección 2.1: Datos del Trámite (READ-ONLY)
| Campo | Tipo | Obligatorio | Autogenerado | Variable |
|-------|------|-------------|--------------|----------|
| Número de radicado | Text (readonly) | ✅ | Sistema | CASO_RADICADO |
| Tipo de caso | Select (readonly) | ✅ | INSOLVENCIA | - |
| Operador asignado | Select (readonly) | ✅ | Usuario actual | OPERADOR_NOMBRE |

**Nota**: El número de radicado se genera automáticamente como `INS-{AÑO}-{CONSECUTIVO}`.

### Sección 2.2: Fechas Procesales (SOLO LECTURA INICIAL)

⚠️ **IMPORTANTE**: Estos campos NO se llenan al crear el caso. Se diligencian manualmente en etapas posteriores.

| Campo | Tipo | Cuándo se llena | Variable |
|-------|------|-----------------|----------|
| Fecha de radicación | Date | Al recibir solicitud | FECHA_RADICACION |
| Fecha de designación | Date | Al designar (+1 día) | FECHA_DESIGNACION |
| Fecha de aceptación | Date | Al aceptar cargo (+2 días) | FECHA_ACEPTACION |
| Fecha de admisión | Date | Al admitir trámite | FECHA_ADMISION |
| Fecha primera audiencia | Date | Al programar | FECHA_AUDIENCIA |
| Hora primera audiencia | Time | Al programar | HORA_AUDIENCIA |

*Mostrar como campos deshabilitados con texto "Se asignará posteriormente".*

### Sección 2.3: Información de Zoom (Opcional)
| Campo | Tipo | Obligatorio | Variable |
|-------|------|-------------|----------|
| ID de reunión | Text | ❌ | ZOOM_ID |
| Código de acceso | Text | ❌ | ZOOM_CODIGO |
| Link de la reunión | URL | ❌ | ZOOM_LINK |

---

## TAB 3: ACREEDORES

### Sección 3.1: Resumen de Deuda
| Campo | Tipo | Obligatorio | Calculado | Variable |
|-------|------|-------------|-----------|----------|
| Deuda total | Currency (readonly) | - | Suma de deudas | TOTAL_ACREENCIAS |
| Cantidad de acreedores | Number (readonly) | - | Count de deudas | - |

### Sección 3.2: Lista de Acreedores (Array dinámico)

**Botón**: [+ Agregar Acreedor]

Por cada acreedor:

#### Datos del Acreedor
| Campo | Tipo | Obligatorio | Variable |
|-------|------|-------------|----------|
| Nombre/Razón social | Text | ✅ | ACREEDOR_{N}_NOMBRE |
| Domicilio (ciudad) | Text | ✅ | AC{N}_DOMICILIO |
| Dirección | Text | ✅ | AC{N}_DIRECCION |
| Email | Email | ✅ | AC{N}_EMAIL |

#### Datos de la Deuda
| Campo | Tipo | Obligatorio | Variable |
|-------|------|-------------|----------|
| Valor capital | Currency | ✅ | AC{N}_CAPITAL |
| Valor intereses | Currency | ❌ | AC{N}_INTERESES |
| Tasa de interés (%) | Number | ❌ | AC{N}_TASA |
| ¿Está postergado? | Toggle | ❌ | AC{N}_POSTERGADO |
| Tipo de documento | Select | ❌ | AC{N}_DOCUMENTO |
| Fecha de otorgamiento | Date | ❌ | AC{N}_FECHA_OTORGAMIENTO |
| Fecha de vencimiento | Date | ❌ | AC{N}_FECHA_VENCIMIENTO |
| Clasificación del crédito | Select | ✅ | AC{N}_CLASIFICACION |
| ¿Tiene libranza activa? | Toggle | ❌ | ACREEDOR_{N}_LIBRANZA |
| Clase de acreedor | Select | ✅ | ACREEDOR_{N}_CLASE |
| Días de mora | Number | ❌ | ACREEDOR_{N}_DIAS_MORA |

**Opciones Clasificación del crédito:**
- Primera clase (gastos administración, salarios)
- Segunda clase (prendarios, retencionarios)
- Tercera clase (hipotecarios)
- Cuarta clase (fisco, especiales)
- Quinta clase (quirografarios)

**Opciones Clase de acreedor:**
- Garantizado
- Privilegiado
- Quirografario

#### Información del Codeudor (Opcional)
| Campo | Tipo | Obligatorio | Variable |
|-------|------|-------------|----------|
| Nombre codeudor | Text | ❌ | AC{N}_CODEUDOR_NOMBRE |
| Ciudad codeudor | Text | ❌ | AC{N}_CODEUDOR_DOMICILIO |
| Dirección codeudor | Text | ❌ | AC{N}_CODEUDOR_DIRECCION |

**Botón por cada acreedor**: [🗑️ Eliminar]

---

### Sección 3.3: Libranzas (Condicional)

*Mostrar solo si algún acreedor tiene "Tiene libranza activa" = true*

**Botón**: [+ Agregar Libranza]

| Campo | Tipo | Obligatorio | Variable |
|-------|------|-------------|----------|
| Nombre del pagador | Text | ✅ | LIBRANZA_PAGADOR |
| Dirección | Text | ✅ | LIBRANZA_DIRECCION |
| Email | Email | ✅ | LIBRANZA_EMAIL |
| Teléfono | Tel | ✅ | LIBRANZA_TELEFONO |
| Suma descontada | Currency | ✅ | LIBRANZA_SUMA |
| Producto y acreedor | Text | ✅ | LIBRANZA_PRODUCTO |

---

### Sección 3.4: Servicios Suspendidos (Opcional)

**Botón**: [+ Agregar Servicio Suspendido]

| Campo | Tipo | Obligatorio | Variable |
|-------|------|-------------|----------|
| Nombre acreedor | Text | ✅ | SERVICIO_ACREEDOR |
| Dirección | Text | ✅ | SERVICIO_DIRECCION |
| Email | Email | ✅ | SERVICIO_EMAIL |
| Teléfono | Tel | ✅ | SERVICIO_TELEFONO |
| Producto suspendido | Text | ✅ | SERVICIO_PRODUCTO |
| Valor adeudado | Currency | ✅ | SERVICIO_VALOR |

---

## TAB 4: BIENES

### Sección 4.1: Resumen de Patrimonio
| Campo | Tipo | Calculado | Variable |
|-------|------|-----------|----------|
| Total inmuebles | Currency (readonly) | Suma | TOTAL_INMUEBLES |
| Total muebles | Currency (readonly) | Suma | TOTAL_MUEBLES |
| **Total patrimonio** | Currency (readonly) | Suma | TOTAL_BIENES |

### Sección 4.2: Declaración de Bienes
| Campo | Tipo | Obligatorio | Variable |
|-------|------|-------------|----------|
| ¿Tiene bienes? | Radio | ✅ | - |

**Si NO tiene bienes:**
- Mostrar texto: "El deudor declara bajo juramento que no posee bienes a su nombre."
- → DECLARACION_BIENES = "que no posee bienes a su nombre."

**Si SÍ tiene bienes:**
- Habilitar secciones de bienes
- → DECLARACION_BIENES = "que posee los siguientes bienes:"

---

### Sección 4.3: Bienes Inmuebles (Condicional)

**Botón**: [+ Agregar Inmueble]

| Campo | Tipo | Obligatorio | Variable |
|-------|------|-------------|----------|
| Tipo de inmueble | Select | ✅ | INMUEBLE_TIPO |
| Dirección | Text | ✅ | INMUEBLE_DIRECCION |
| Matrícula inmobiliaria | Text | ✅ | INMUEBLE_MATRICULA |
| Valor comercial | Currency | ✅ | INMUEBLE_VALOR |
| Gravámenes | Text | ❌ | INMUEBLE_GRAVAMEN |
| Afectación | Text | ❌ | INMUEBLE_AFECTACION |
| Medida cautelar | Text | ❌ | INMUEBLE_MEDIDA |
| ¿Es vivienda familiar? | Toggle | ❌ | INMUEBLE_VIVIENDA_FAMILIAR |
| ¿Es patrimonio de familia? | Toggle | ❌ | INMUEBLE_PATRIMONIO_FAMILIA |
| Documento de prueba | Text | ✅ | INMUEBLE_DOCUMENTO |

**Opciones Tipo de inmueble:**
- Casa
- Apartamento
- Lote
- Local comercial
- Bodega
- Oficina
- Finca
- Otro

---

### Sección 4.4: Bienes Muebles (Condicional)

**Botón**: [+ Agregar Bien Mueble]

| Campo | Tipo | Obligatorio | Variable Desc | Variable Valor |
|-------|------|-------------|---------------|----------------|
| Categoría | Select | ✅ | - | - |
| Descripción | Text | ✅ | MUEBLE_{CAT}_DESC | - |
| Valor | Currency | ✅ | - | MUEBLE_{CAT}_VALOR |

**Categorías disponibles:**
- Electrónico → MUEBLE_ELECTRONICO_*
- Muebles/Enseres → MUEBLE_ENSERES_*
- Vehículo → MUEBLE_VEHICULO_*
- Joyas → MUEBLE_JOYAS_*
- Efectivo → MUEBLE_EFECTIVO_*
- Acciones → MUEBLE_ACCIONES_*
- Cuentas por cobrar → MUEBLE_CUENTAS_*

**Campos adicionales para Vehículo:**
| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| Marca | Text | ✅ |
| Modelo | Text | ✅ |
| Placa | Text | ✅ |
| Organismo de tránsito | Text | ❌ |
| Garantía a favor de | Text | ❌ |
| Valor garantía | Currency | ❌ |

---

### Sección 4.5: Documentos Adjuntos (Bienes)

| Documento | Tipo | Obligatorio | Condición |
|-----------|------|-------------|-----------|
| Cédula de ciudadanía | File (PDF/IMG) | ✅ | Siempre |
| REDAM | File (PDF) | ✅ | Siempre |
| Certificado tradición y libertad | File (PDF) | ✅ | Por cada inmueble |
| Matrícula mercantil | File (PDF) | ✅ | Si es pequeño comerciante |

---

## TAB 5: PROCESOS JUDICIALES

### Sección 5.1: Declaración
| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| ¿Tiene procesos judiciales? | Radio | ✅ |

**Si NO**: Ocultar sección de procesos.
**Si SÍ**: Mostrar lista de procesos.

---

### Sección 5.2: Lista de Procesos (Condicional)

**Botón**: [+ Agregar Proceso]

| Campo | Tipo | Obligatorio | Variable |
|-------|------|-------------|----------|
| Tipo de proceso | Select | ✅ | PROCESO_{N}_TIPO |
| Demandante | Text | ✅ | PROCESO_{N}_DEMANDANTE |
| Juzgado | Text | ✅ | PROCESO_{N}_JUZGADO |
| No. Expediente | Text | ✅ | PROCESO_{N}_EXPEDIENTE |
| Medida cautelar | Text | ❌ | PROCESO_{N}_MEDIDA |

**Opciones Tipo de proceso:**
- Ejecutivo singular
- Ejecutivo hipotecario
- Ejecutivo prendario
- Cobro coactivo
- Alimentos
- Restitución de inmueble
- Otro

---

## TAB 6: INGRESOS Y GASTOS

### Sección 6.1: Ingresos Mensuales
| Campo | Tipo | Obligatorio | Variable |
|-------|------|-------------|----------|
| Ingreso mensual principal | Currency | ✅ | INGRESO_PRINCIPAL |
| Otros ingresos - Descripción | Text | ❌ | INGRESO_OTROS_DESC |
| Otros ingresos - Valor | Currency | ❌ | INGRESO_OTROS_VALOR |
| **Total ingresos** | Currency (readonly) | - | INGRESO_TOTAL |
| ¿Tiene certificación de empleador? | Toggle | ❌ | TIENE_CERTIFICACION_EMPLEADOR |

**Si tiene certificación:**
| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| Archivo certificación | File (PDF) | ✅ |

---

### Sección 6.2: Gastos Mensuales
| Campo | Tipo | Obligatorio | Variable |
|-------|------|-------------|----------|
| Gastos mensuales totales | Currency | ✅ | GASTOS_MENSUALES |

---

### Sección 6.3: Disponible para Pago
| Campo | Tipo | Calculado | Variable |
|-------|------|-----------|----------|
| Ingresos | Currency (readonly) | INGRESO_TOTAL | RECURSOS_INGRESOS |
| Gastos | Currency (readonly) | GASTOS_MENSUALES | RECURSOS_GASTOS |
| **Disponible** | Currency (readonly) | Ingresos - Gastos | DISPONIBLE_MENSUAL |

⚠️ **Validación**: Si Disponible <= 0, mostrar advertencia (no bloquear).

---

### Sección 6.4: Obligaciones Alimentarias

**Botón**: [+ Agregar Dependiente]

| Campo | Tipo | Obligatorio | Variable |
|-------|------|-------------|----------|
| Nombre | Text | ✅ | DEPENDIENTE_{N}_NOMBRE |
| Edad | Number | ✅ | DEPENDIENTE_{N}_EDAD |
| Parentesco | Select | ✅ | DEPENDIENTE_{N}_PARENTESCO |

**Opciones Parentesco:**
- Hijo/a
- Cónyuge
- Padre/Madre
- Otro

---

## TAB 7: PROPUESTA DE PAGO

### Sección 7.1: Resumen Financiero (Read-only)
| Campo | Calculado | Variable |
|-------|-----------|----------|
| Total capital adeudado | Suma capital deudas | PROPUESTA_TOTAL_CAPITAL |
| Ingresos mensuales | Del tab anterior | PROPUESTA_INGRESOS |
| Gastos mensuales | Del tab anterior | PROPUESTA_GASTOS |
| Disponible mensual | Ingresos - Gastos | PROPUESTA_DISPONIBLE |

---

### Sección 7.2: Opciones de la Propuesta

#### 1. Período de Gracia
| Campo | Tipo | Variable |
|-------|------|----------|
| ¿Solicita período de gracia? | Toggle | PROPUESTA_GRACIA_SI/NO |
| Meses de gracia | Number (1-24) | PROPUESTA_GRACIA_MESES |

*Mostrar "Meses" solo si Toggle = SI*

---

#### 2. Dación en Pago
| Campo | Tipo | Variable |
|-------|------|----------|
| ¿Ofrece dación en pago? | Toggle | PROPUESTA_DACION_SI/NO |
| Descripción del bien | Textarea | PROPUESTA_DACION_DESC |

*Mostrar descripción solo si Toggle = SI*

---

#### 3. Venta de Bienes
| Campo | Tipo | Variable |
|-------|------|----------|
| ¿Autoriza venta de bienes? | Toggle | PROPUESTA_VENTA_SI/NO |
| Descripción del bien a vender | Textarea | PROPUESTA_VENTA_DESC |

*Mostrar descripción solo si Toggle = SI*

---

#### 4. Pago con Flujo de Caja
| Campo | Tipo | Variable |
|-------|------|----------|
| ¿Pagará con flujo de caja mensual? | Toggle | PROPUESTA_FLUJO_SI/NO |

---

#### 5. Plazo y Cuotas
| Campo | Tipo | Obligatorio | Variable |
|-------|------|-------------|----------|
| Plazo en meses | Number | ✅ | PROPUESTA_PLAZO |
| Valor cuota mensual | Currency (calculado) | - | PROPUESTA_CUOTA_MENSUAL |
| Valor cuota variable | Currency | ❌ | PROPUESTA_CUOTA_VARIABLE |

*Cuota mensual se calcula: Total Capital / Plazo*

---

#### 6. Cuotas Extraordinarias
| Campo | Tipo | Variable |
|-------|------|----------|
| ¿Pagará cuotas extraordinarias? | Toggle | PROPUESTA_EXTRAORDINARIA_SI/NO |
| Fecha/descripción | Text | PROPUESTA_EXTRA_FECHA |

---

#### 7. Tasa de Interés Ofrecida
| Campo | Tipo | Variable |
|-------|------|----------|
| Tasa mensual (%) | Number | PROPUESTA_TASA_MENSUAL |
| Tasa anual (%) | Number (calculado) | PROPUESTA_TASA_ANUAL |

---

#### 8. Quitas de Capital
| Campo | Tipo | Variable |
|-------|------|----------|
| ¿Solicita quita de capital? | Toggle | PROPUESTA_QUITAS_SI/NO |
| Porcentaje de reducción (%) | Number | PROPUESTA_QUITAS_PORCENTAJE |
| Valor a pagar (calculado) | Currency | PROPUESTA_QUITAS_VALOR |

---

#### 9. Seguros
| Campo | Tipo | Variable |
|-------|------|----------|
| [ ] Incendio/Terremoto | Checkbox | PROPUESTA_SEGURO_INCENDIO |
| [ ] Vida | Checkbox | PROPUESTA_SEGURO_VIDA |

---

#### 10. Condonación de Intereses
| Campo | Tipo | Variable |
|-------|------|----------|
| ¿Solicita condonar intereses causados? | Toggle | PROPUESTA_CONDONA_CAUSADO |
| ¿Solicita condonar intereses futuros? | Toggle | PROPUESTA_CONDONA_FUTURO |

---

### Sección 7.3: Orden de Prelación
| Posición | Campo | Tipo | Variable |
|----------|-------|------|----------|
| Primera | Clase de crédito | Select | PROPUESTA_PRELACION_1 |
| Segunda | Clase de crédito | Select | PROPUESTA_PRELACION_2 |
| Tercera | Clase de crédito | Select | PROPUESTA_PRELACION_3 |
| Cuarta | Clase de crédito | Select | PROPUESTA_PRELACION_4 |
| Quinta | Clase de crédito | Select | PROPUESTA_PRELACION_5 |

**Opciones:**
- Primera clase
- Segunda clase
- Tercera clase
- Cuarta clase
- Quinta clase

---

### Sección 7.4: Otras Opciones
| Campo | Tipo | Variable |
|-------|------|----------|
| ¿Mantiene privilegios de clase? | Toggle | PROPUESTA_PRIVILEGIOS_SI/NO |
| Descripción de privilegios | Textarea | PROPUESTA_PRIVILEGIOS_DESC |
| ¿Autoriza pago por terceros? | Toggle | PROPUESTA_TERCEROS_SI/NO |
| ¿Autoriza sustitución de garantías? | Toggle | PROPUESTA_GARANTIAS_SI/NO |

---

## TAB 8: SOCIEDAD CONYUGAL

### Sección 8.1: Estado Civil
| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| Estado civil | Select | ✅ |

**Opciones:**
- Soltero/a
- Casado/a
- Unión libre
- Divorciado/a
- Viudo/a

**Si es Casado/a o Unión libre:** Mostrar sección del cónyuge.

---

### Sección 8.2: Datos del Cónyuge (Condicional)
| Campo | Tipo | Obligatorio | Variable |
|-------|------|-------------|----------|
| Nombre completo | Text | ✅ | CONYUGE_NOMBRE |
| Cédula | Text | ✅ | CONYUGE_CEDULA |
| Dirección | Text | ✅ | CONYUGE_DIRECCION |
| Teléfono | Tel | ✅ | CONYUGE_TELEFONO |
| Email | Email | ✅ | CONYUGE_EMAIL |

---

## TAB 9: INFORMACIÓN LEGAL

### Sección 9.1: Apoderado (Opcional)
| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| ¿Actúa mediante apoderado? | Toggle | - |

**Si actúa con apoderado:**
| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| Nombre del abogado | Text | ✅ |
| Cédula | Text | ✅ |
| Tarjeta profesional | Text | ✅ |
| Email | Email | ✅ |
| Teléfono | Tel | ✅ |

| Documento | Tipo | Obligatorio |
|-----------|------|-------------|
| Poder (notariado o correo) | File | ✅ |

---

### Sección 9.2: Datos de Notificación
| Campo | Tipo | Obligatorio | Variable |
|-------|------|-------------|----------|
| Dirección para notificaciones | Text | ✅ | NOTIF_DIRECCION |
| Teléfono | Tel | ✅ | NOTIF_TELEFONO |
| Email | Email | ✅ | NOTIF_EMAIL |

*Por defecto, copiar los datos del deudor. Permitir editar.*

---

### Sección 9.3: Firma del Solicitante
| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| Nombre del firmante | Text | ✅ |
| Cédula del firmante | Text | ✅ |
| Firma digital o imagen | Signature/File | ✅ |

---

## TAB 10: DOCUMENTOS ADJUNTOS

### Sección 10.1: Documentos Obligatorios

| Documento | Estado | Acción |
|-----------|--------|--------|
| ✅ Cédula de ciudadanía | Cargado | [Ver] [Reemplazar] |
| ❌ REDAM | Pendiente | [Cargar] |
| ✅ Certificado de ingresos | Cargado | [Ver] [Reemplazar] |
| ❌ Certificado tradición (Inmueble 1) | Pendiente | [Cargar] |
| ⚠️ Matrícula mercantil | No aplica | - |
| ❌ Poder | Pendiente | [Cargar] |

*Mostrar ❌ rojo si falta, ✅ verde si está, ⚠️ gris si no aplica*

---

### Sección 10.2: Documentos Opcionales

| Documento | Estado | Acción |
|-----------|--------|--------|
| Extractos bancarios | ❌ No cargado | [Cargar] |
| Recibos de gastos | ❌ No cargado | [Cargar] |
| Historial de procesos | ❌ No cargado | [Cargar] |
| Mandamientos de pago | ❌ No cargado | [Cargar] |
| Certificados de deuda | ❌ No cargado | [Cargar] |
| Pagarés/Letras/Cheques | ❌ No cargado | [Cargar] |

---

## BARRA DE ACCIONES (SOLO AL FINAL)

```
┌────────────────────────────────────────────────────────────────────┐
│  ⚠️ 3 documentos obligatorios pendientes                           │
│                                                                    │
│  [Cancelar]                              [Guardar Borrador] [Crear Caso] │
└────────────────────────────────────────────────────────────────────┘
```

### Lógica de los Botones:

**[Cancelar]**
- Pregunta confirmación: "¿Está seguro? Se perderán los datos no guardados."
- Si confirma: Cierra el formulario sin guardar.

**[Guardar Borrador]**
- Guarda el caso con status="BORRADOR"
- No valida campos obligatorios
- Muestra toast: "Borrador guardado"

**[Crear Caso]**
- Valida TODOS los campos obligatorios
- Valida documentos obligatorios
- Si hay errores: Muestra resumen de errores y navega al primer tab con error
- Si todo OK:
  1. Crea el caso en BD
  2. Genera documentos de ETAPA 1 (Solicitud)
  3. Crea carpeta en Drive
  4. Sube documentos adjuntos
  5. Muestra resumen de éxito con links a documentos

---

## RESUMEN DE VALIDACIONES

### Validación por Tab

| Tab | Campos Obligatorios |
|-----|---------------------|
| 1. Deudor | debtorId, causes (min 1), applicantScope |
| 2. Caso | Solo lectura (autogenerado) |
| 3. Acreedores | Min 1 acreedor con: nombre, domicilio, dirección, email, capital, clasificación, clase |
| 4. Bienes | Declaración (SI/NO). Si SI: al menos 1 bien |
| 5. Procesos | Declaración (SI/NO). Si SI: al menos 1 proceso |
| 6. Ingresos | monthlyIncome, monthlyExpenses |
| 7. Propuesta | paymentTermMonths |
| 8. Cónyuge | Si casado: todos los campos del cónyuge |
| 9. Legal | notificationAddress, notificationPhone, notificationEmail, firma |
| 10. Documentos | Cédula, REDAM, Certificado ingresos |

### Validaciones de Coherencia

```typescript
// Ingresos vs Gastos
if (monthlyExpenses > monthlyIncome) {
  showWarning("Los gastos superan los ingresos");
}

// Deuda vs Ingresos
const ratio = totalDebt / (monthlyIncome * 12);
if (ratio > 10) {
  showWarning("La deuda es muy alta respecto a los ingresos anuales");
}

// Plazo de pago
const minMonths = Math.ceil(totalDebt / availableMonthly);
if (paymentTermMonths < minMonths) {
  showError("El plazo es insuficiente para pagar la deuda con el disponible mensual");
}

// Inmuebles sin certificado
assets.filter(a => a.type === 'INMUEBLE').forEach(inmueble => {
  if (!hasDocument(`certificado_${inmueble.id}`)) {
    showError(`Falta certificado de tradición para: ${inmueble.address}`);
  }
});
```
