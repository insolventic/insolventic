# Diccionario de Placeholders — INSOLVENTIC

> Catálogo normalizado de los *placeholders* (`DEUDOR_NOMBRE`, `ACREEDOR_1_VALOR`...) que se inyectan en las plantillas HTML al generar un documento. Fuente: `src/features/document/placeholder-mapper.ts`. Para el modelo de datos de la base de datos (tablas, columnas, tipos, relaciones) ver `docs/DICCIONARIO_DATOS.md`.

## Convenciones de Naming

### Reglas Obligatorias
1. **Todo en MAYÚSCULAS** con SNAKE_CASE
2. **Prefijos por categoría** (ver tabla abajo)
3. **Sin caracteres especiales** (tildes, ñ → n)
4. **Números al final** para arrays (ACREEDOR_1, ACREEDOR_2...)
5. **Sufijos estándar**: _NOMBRE, _CEDULA, _DIRECCION, _EMAIL, _TELEFONO, _VALOR, _FECHA

### Prefijos por Categoría
| Prefijo | Categoría | Ejemplo |
|---------|-----------|---------|
| `DEUDOR_` | Datos del deudor | DEUDOR_NOMBRE, DEUDOR_CEDULA |
| `ACREEDOR_` | Datos de acreedores | ACREEDOR_1_NOMBRE |
| `OPERADOR_` | Datos del operador | OPERADOR_NOMBRE |
| `CASO_` | Información del caso | CASO_RADICADO |
| `FECHA_` | Todas las fechas | FECHA_RADICACION |
| `HORA_` | Todas las horas | HORA_AUDIENCIA |
| `BIEN_` | Bienes del deudor | BIEN_INMUEBLE_VALOR |
| `PROCESO_` | Procesos judiciales | PROCESO_1_JUZGADO |
| `LIBRANZA_` | Info de libranzas | LIBRANZA_PAGADOR |
| `SERVICIO_` | Servicios suspendidos | SERVICIO_ACREEDOR |
| `CONYUGE_` | Info del cónyuge | CONYUGE_NOMBRE |
| `PROPUESTA_` | Propuesta de pago | PROPUESTA_PLAZO |
| `ZOOM_` | Datos de Zoom | ZOOM_ID |
| `NOTIF_` | Notificaciones | NOTIF_EMAIL |
| `CHECK_` | Valores SI/NO del checklist | CHECK_TIENE_BIENES |

---

## SECCIÓN 1: DATOS DEL DEUDOR

| Variable Normalizada | Variable Anterior | Fuente Prisma | Tipo | Obligatorio |
|---------------------|-------------------|---------------|------|-------------|
| `DEUDOR_NOMBRE` | NOMBRE_DEUDOR, deudor_nombre, NOMBRE_DEUDOR_COMPLETO | debtor.name | string | ✅ |
| `DEUDOR_CEDULA` | CEDULA_DEUDOR, deudor_cedula, NUMERO_CEDULA | debtor.idNumber | string | ✅ |
| `DEUDOR_TIPO_ID` | - | debtor.idType | string | ✅ |
| `DEUDOR_DIRECCION` | DIRECCION_DEUDOR | debtor.address | string | ✅ |
| `DEUDOR_CIUDAD` | CIUDAD_DEUDOR, CIUDAD | debtor.city | string | ✅ |
| `DEUDOR_DEPARTAMENTO` | - | debtor.department | string | ❌ |
| `DEUDOR_EMAIL` | EMAIL_DEUDOR, CORREO_ELECTRONICO | debtor.email | string | ✅ |
| `DEUDOR_TELEFONO` | TELEFONO_DEUDOR, NUMERO_TELEFONO | debtor.phone | string | ✅ |
| `DEUDOR_GENERO` | GENERO_DEUDOR | derived from name | "El señor"/"La señora" | ✅ |
| `DEUDOR_GENERO_SINGULAR` | GENERO_DEUDOR_SINGULAR | derived | "señor"/"señora" | ❌ |
| `DEUDOR_FECHA_NACIMIENTO` | - | debtor.birthDate | date | ❌ |
| `DEUDOR_ESTADO_CIVIL` | - | debtor.maritalStatus | string | ❌ |
| `DEUDOR_OCUPACION` | - | debtor.occupation | string | ❌ |
| `DEUDOR_NIVEL_EDUCATIVO` | - | debtor.educationLevel | string | ❌ |

---

## SECCIÓN 2: DATOS DEL CASO

| Variable Normalizada | Variable Anterior | Fuente Prisma | Tipo | Obligatorio |
|---------------------|-------------------|---------------|------|-------------|
| `CASO_RADICADO` | RADICADO, NUMERO_TRAMITE | case.caseNumber | string | ✅ |
| `CASO_NUMERO` | NUMERO_RADICADO | case.caseNumber (sin letras) | string | ✅ |
| `CASO_TIPO` | - | case.type | string | ✅ |
| `CASO_FASE` | - | case.phase | string | ❌ |
| `CASO_CIUDAD` | - | case.city | string | ❌ |
| `CASO_ANO` | ANO_TRAMITE, ANO_RADICADO | derived from caseNumber | string | ✅ |

---

## SECCIÓN 3: FECHAS DEL PROCESO

### Fechas Principales (MANUAL - No autogenerar)
| Variable Normalizada | Variable Anterior | Fuente Prisma | Formato | Manual |
|---------------------|-------------------|---------------|---------|--------|
| `FECHA_RADICACION` | FECHA_RADICACION | case.filingDate | "DD de MES de YYYY" | 🔵 |
| `FECHA_DESIGNACION` | FECHA_DESIGNACION | case.designationDate | "DD de MES de YYYY" | 🔵 |
| `FECHA_ACEPTACION` | FECHA_ACEPTACION | case.positionAcceptanceDate | "DD de MES de YYYY" | 🔵 |
| `FECHA_ADMISION` | FECHA_ADMISION | case.admissionDate | "DD de MES de YYYY" | 🔵 |
| `FECHA_AUDIENCIA` | FECHA_AUDIENCIA | case.firstHearingDate | "DD de MES de YYYY" | 🔵 |
| `HORA_AUDIENCIA` | HORA_AUDIENCIA | case.firstHearingTime | "HH:MM" | 🔵 |

### Componentes de Fecha (Derivados automáticamente)
| Variable Normalizada | Variable Anterior | Derivado de | Formato |
|---------------------|-------------------|-------------|---------|
| `FECHA_AUDIENCIA_DIA` | DIA_AUDIENCIA | FECHA_AUDIENCIA | "15" |
| `FECHA_AUDIENCIA_DIA_LETRAS` | - | FECHA_AUDIENCIA | "quince" |
| `FECHA_AUDIENCIA_MES` | MES_AUDIENCIA | FECHA_AUDIENCIA | "febrero" |
| `FECHA_AUDIENCIA_ANO` | ANO_AUDIENCIA | FECHA_AUDIENCIA | "2025" |
| `FECHA_ADMISION_DIA` | DIA_ACEPTACION | FECHA_ADMISION | "15" |
| `FECHA_ADMISION_MES` | MES_ACEPTACION | FECHA_ADMISION | "febrero" |
| `FECHA_ADMISION_ANO` | ANO_ACEPTACION | FECHA_ADMISION | "2025" |

### Fecha Actual (Generación del documento)
| Variable Normalizada | Variable Anterior | Cálculo | Formato |
|---------------------|-------------------|---------|---------|
| `HOY_DIA` | NUMERO_DIA | new Date().getDate() | "8" |
| `HOY_DIA_LETRAS` | NUMERO_DIA_LETRAS | toWords(day) | "ocho" |
| `HOY_MES` | NOMBRE_MES | getMonthName() | "febrero" |
| `HOY_ANO` | ANO | getFullYear() | "2025" |
| `HOY_FECHA_COMPLETA` | FECHA_COMPLETA | - | "8 de febrero de 2025" |

### Próxima Audiencia
| Variable Normalizada | Variable Anterior | Fuente |
|---------------------|-------------------|--------|
| `PROXIMA_DIA` | DIA_PROXIMA | manual |
| `PROXIMA_MES` | MES_PROXIMA | manual |
| `PROXIMA_HORA` | HORA_PROXIMA | manual |

---

## SECCIÓN 4: ACREEDORES (Array, hasta 10)

### Tabla Resumen
| Variable Normalizada | Variable Anterior | Fuente Prisma |
|---------------------|-------------------|---------------|
| `ACREEDOR_{N}_NOMBRE` | ACREEDOR_1...10 | debts[n].creditor.name |
| `ACREEDOR_{N}_VALOR` | VALOR_1...10 | formatCurrency(debts[n].amount) |
| `ACREEDOR_{N}_LIBRANZA` | LIBRANZA_1...10 | debts[n].hasActiveLibranza ? "SI" : "NO" |
| `ACREEDOR_{N}_CLASE` | CLASE_1...10 | debts[n].creditorClass |
| `ACREEDOR_{N}_PORCENTAJE` | PORCENTAJE_1...10 | debts[n].percentageOfTotal |
| `ACREEDOR_{N}_DIAS_MORA` | DIAS_1...10 | debts[n].daysOverdue |

### Detalle por Acreedor (AC{N}_*)
| Variable Normalizada | Variable Anterior | Fuente Prisma |
|---------------------|-------------------|---------------|
| `AC{N}_NOMBRE` | AC1_NOMBRE...AC10_NOMBRE | debts[n].creditor.name |
| `AC{N}_DOMICILIO` | AC1_DOMICILIO | debts[n].creditorCity |
| `AC{N}_DIRECCION` | AC1_DIRECCION | debts[n].creditorAddress |
| `AC{N}_EMAIL` | AC1_EMAIL | debts[n].creditorEmail |
| `AC{N}_CAPITAL` | AC1_CAPITAL | formatCurrency(debts[n].capitalAmount) |
| `AC{N}_INTERESES` | AC1_INTERESES | formatCurrency(debts[n].interestAmount) |
| `AC{N}_POSTERGADO` | AC1_POSTERGADO | debts[n].isDeferred ? "SI" : "NO" |
| `AC{N}_TASA` | AC1_TASA | debts[n].interestRate + "%" |
| `AC{N}_DOCUMENTO` | AC1_DOCUMENTO | debts[n].documentType |
| `AC{N}_FECHA_OTORGAMIENTO` | AC1_FECHA_OTORGAMIENTO | formatDate(debts[n].grantDate) |
| `AC{N}_FECHA_VENCIMIENTO` | AC1_FECHA_VENCIMIENTO | formatDate(debts[n].dueDate) |
| `AC{N}_CLASIFICACION` | AC1_CLASIFICACION | debts[n].creditClassification |
| `AC{N}_CODEUDOR_NOMBRE` | AC1_CODEUDOR_NOMBRE | debts[n].coDebtorName |
| `AC{N}_CODEUDOR_DOMICILIO` | AC1_CODEUDOR_DOMICILIO | debts[n].coDebtorCity |
| `AC{N}_CODEUDOR_DIRECCION` | AC1_CODEUDOR_DIRECCION | debts[n].coDebtorAddress |

### Totales
| Variable Normalizada | Variable Anterior | Cálculo |
|---------------------|-------------------|---------|
| `TOTAL_ACREENCIAS` | TOTAL_ACREENCIAS | sum(debts.amount) |
| `TOTAL_CAPITAL` | PROPUESTA_TOTAL_CAPITAL | sum(debts.capitalAmount) |

---

## SECCIÓN 5: BIENES

### Inmuebles
| Variable Normalizada | Variable Anterior | Fuente Prisma |
|---------------------|-------------------|---------------|
| `INMUEBLE_TIPO` | INMUEBLE_TIPO | assets.find(INMUEBLE).propertyType |
| `INMUEBLE_DIRECCION` | INMUEBLE_DIRECCION | assets.find(INMUEBLE).address |
| `INMUEBLE_MATRICULA` | INMUEBLE_MATRICULA | assets.find(INMUEBLE).registrationNumber |
| `INMUEBLE_VALOR` | INMUEBLE_VALOR | formatCurrency(value) |
| `INMUEBLE_GRAVAMEN` | INMUEBLE_GRAVAMEN | assets.find(INMUEBLE).encumbrance |
| `INMUEBLE_AFECTACION` | INMUEBLE_AFECTACION | assets.find(INMUEBLE).affectation |
| `INMUEBLE_MEDIDA` | INMUEBLE_MEDIDA | assets.find(INMUEBLE).precautionaryMeasure |
| `INMUEBLE_VIVIENDA_FAMILIAR` | INMUEBLE_VIVIENDA_FAMILIAR | isFamilyHome ? "SI" : "NO" |
| `INMUEBLE_PATRIMONIO_FAMILIA` | INMUEBLE_PATRIMONIO_FAMILIA | isInalienablePatrimony ? "SI" : "NO" |
| `INMUEBLE_DOCUMENTO` | INMUEBLE_DOCUMENTO | assets.find(INMUEBLE).proofDocument |

### Muebles por Categoría
| Variable Normalizada | Variable Anterior | Descripción |
|---------------------|-------------------|-------------|
| `MUEBLE_ELECTRONICO_DESC` | MUEBLE_ELECTRONICO_DESC | Equipos electrónicos |
| `MUEBLE_ELECTRONICO_VALOR` | MUEBLE_ELECTRONICO_VALOR | Valor equipos |
| `MUEBLE_ENSERES_DESC` | MUEBLE_ENSERES_DESC | Muebles y enseres |
| `MUEBLE_ENSERES_VALOR` | MUEBLE_ENSERES_VALOR | Valor muebles |
| `MUEBLE_VEHICULO_DESC` | MUEBLE_VEHICULO_DESC | Marca modelo placa |
| `MUEBLE_VEHICULO_VALOR` | MUEBLE_VEHICULO_VALOR | Valor vehículo |
| `MUEBLE_JOYAS_DESC` | MUEBLE_JOYAS_DESC | Descripción joyas |
| `MUEBLE_JOYAS_VALOR` | MUEBLE_JOYAS_VALOR | Valor joyas |
| `MUEBLE_EFECTIVO_DESC` | MUEBLE_EFECTIVO_DESC | Dinero en efectivo |
| `MUEBLE_EFECTIVO_VALOR` | MUEBLE_EFECTIVO_VALOR | Valor efectivo |
| `MUEBLE_ACCIONES_DESC` | MUEBLE_ACCIONES_DESC | Acciones/inversiones |
| `MUEBLE_ACCIONES_VALOR` | MUEBLE_ACCIONES_VALOR | Valor acciones |
| `MUEBLE_CUENTAS_DESC` | MUEBLE_CUENTAS_DESC | Cuentas por cobrar |
| `MUEBLE_CUENTAS_VALOR` | MUEBLE_CUENTAS_VALOR | Valor cuentas |

### Totales de Bienes
| Variable Normalizada | Variable Anterior | Cálculo |
|---------------------|-------------------|---------|
| `TOTAL_INMUEBLES` | TOTAL_INMUEBLES | sum(inmuebles.value) |
| `TOTAL_MUEBLES` | TOTAL_MUEBLES | sum(muebles.value) |
| `TOTAL_BIENES` | TOTAL_BIENES | TOTAL_INMUEBLES + TOTAL_MUEBLES |
| `DECLARACION_BIENES` | DECLARACION_BIENES | texto condicional |

---

## SECCIÓN 6: INGRESOS Y GASTOS

| Variable Normalizada | Variable Anterior | Fuente Prisma | Formato |
|---------------------|-------------------|---------------|---------|
| `INGRESO_PRINCIPAL` | INGRESO_PRINCIPAL | case.monthlyIncome | currency |
| `INGRESO_OTROS_DESC` | OTROS_INGRESOS_DETALLE | case.otherIncomeDescription | string |
| `INGRESO_OTROS_VALOR` | OTROS_INGRESOS_VALOR | case.otherIncomeAmount | currency |
| `INGRESO_TOTAL` | TOTAL_INGRESOS | monthlyIncome + otherIncome | currency |
| `TIENE_CERTIFICACION_EMPLEADOR` | CERTIFICACION_EMPLEADOR | case.hasEmployerCertification | "SI"/"NO" |
| `GASTOS_MENSUALES` | GASTOS_MENSUALES | case.monthlyExpenses | currency |
| `DISPONIBLE_MENSUAL` | RECURSOS_DISPONIBLE | income - expenses | currency |

---

## SECCIÓN 7: OBLIGACIONES ALIMENTARIAS (Array, hasta 5)

| Variable Normalizada | Variable Anterior | Fuente Prisma |
|---------------------|-------------------|---------------|
| `DEPENDIENTE_{N}_NOMBRE` | OBL_ALIM_1_NOMBRE | dependents[n].name |
| `DEPENDIENTE_{N}_EDAD` | OBL_ALIM_1_EDAD | dependents[n].age |
| `DEPENDIENTE_{N}_PARENTESCO` | OBL_ALIM_1_PARENTESCO | dependents[n].relationship |

---

## SECCIÓN 8: PROCESOS JUDICIALES (Array, hasta 5)

| Variable Normalizada | Variable Anterior | Fuente Prisma |
|---------------------|-------------------|---------------|
| `PROCESO_{N}_TIPO` | PROCESO_1_TIPO | legalProcesses[n].processType |
| `PROCESO_{N}_DEMANDANTE` | PROCESO_1_DEMANDANTE | legalProcesses[n].plaintiff |
| `PROCESO_{N}_JUZGADO` | PROCESO_1_JUZGADO | legalProcesses[n].court |
| `PROCESO_{N}_EXPEDIENTE` | PROCESO_1_EXPEDIENTE | legalProcesses[n].fileNumber |
| `PROCESO_{N}_MEDIDA` | PROCESO_1_MEDIDA | legalProcesses[n].precautionaryMeasure |

---

## SECCIÓN 9: LIBRANZAS

| Variable Normalizada | Variable Anterior | Fuente Prisma |
|---------------------|-------------------|---------------|
| `LIBRANZA_PAGADOR` | LIBRANZA_PAGADOR | libranzas[0].payerName |
| `LIBRANZA_DIRECCION` | LIBRANZA_DIRECCION | libranzas[0].payerAddress |
| `LIBRANZA_EMAIL` | LIBRANZA_EMAIL | libranzas[0].payerEmail |
| `LIBRANZA_TELEFONO` | LIBRANZA_TELEFONO | libranzas[0].payerPhone |
| `LIBRANZA_SUMA` | LIBRANZA_SUMA | formatCurrency(libranzas[0].deductedAmount) |
| `LIBRANZA_PRODUCTO` | LIBRANZA_PRODUCTO | libranzas[0].productAndCreditor |

---

## SECCIÓN 10: SERVICIOS SUSPENDIDOS

| Variable Normalizada | Variable Anterior | Fuente Prisma |
|---------------------|-------------------|---------------|
| `SERVICIO_ACREEDOR` | SERVICIOS_ACREEDOR | suspendedServices[0].creditorName |
| `SERVICIO_DIRECCION` | SERVICIOS_DIRECCION | suspendedServices[0].address |
| `SERVICIO_EMAIL` | SERVICIOS_EMAIL | suspendedServices[0].email |
| `SERVICIO_TELEFONO` | SERVICIOS_TELEFONO | suspendedServices[0].phone |
| `SERVICIO_PRODUCTO` | SERVICIOS_PRODUCTO | suspendedServices[0].suspendedProduct |
| `SERVICIO_VALOR` | SERVICIOS_VALOR | formatCurrency(suspendedServices[0].amountOwed) |

---

## SECCIÓN 11: CÓNYUGE

| Variable Normalizada | Variable Anterior | Fuente Prisma |
|---------------------|-------------------|---------------|
| `CONYUGE_NOMBRE` | CONYUGE_NOMBRE | case.spouseName |
| `CONYUGE_CEDULA` | CONYUGE_CC | case.spouseIdNumber |
| `CONYUGE_DIRECCION` | CONYUGE_DIRECCION | case.spouseAddress |
| `CONYUGE_TELEFONO` | CONYUGE_TELEFONO | case.spousePhone |
| `CONYUGE_EMAIL` | CONYUGE_EMAIL | case.spouseEmail |

---

## SECCIÓN 12: PROPUESTA DE PAGO

### Opciones SI/NO
| Variable Normalizada | Variable Anterior | Campo Prisma | Valor SI | Valor NO |
|---------------------|-------------------|--------------|----------|----------|
| `PROPUESTA_GRACIA_SI` | PROP_GRACIA_SI | gracePeriodRequested | "X" | "" |
| `PROPUESTA_GRACIA_NO` | PROP_GRACIA_NO | !gracePeriodRequested | "" | "X" |
| `PROPUESTA_GRACIA_MESES` | PROP_GRACIA_MESES | gracePeriodMonths | number | "" |
| `PROPUESTA_DACION_SI` | PROP_DACION_SI | paymentInKind | "X" | "" |
| `PROPUESTA_DACION_NO` | PROP_DACION_NO | !paymentInKind | "" | "X" |
| `PROPUESTA_DACION_DESC` | PROP_DACION_DESC | paymentInKindDescription | string | "" |
| `PROPUESTA_VENTA_SI` | PROP_VENTA_SI | assetSaleAuthorized | "X" | "" |
| `PROPUESTA_VENTA_NO` | PROP_VENTA_NO | !assetSaleAuthorized | "" | "X" |
| `PROPUESTA_VENTA_DESC` | PROP_VENTA_DESC | assetSaleDescription | string | "" |
| `PROPUESTA_FLUJO_SI` | PROP_FLUJO_SI | cashFlowPayment | "X" | "" |
| `PROPUESTA_FLUJO_NO` | PROP_FLUJO_NO | !cashFlowPayment | "" | "X" |
| `PROPUESTA_EXTRAORDINARIA_SI` | PROP_EXTRAORDINARIA_SI | extraordinaryPayment | "X" | "" |
| `PROPUESTA_EXTRAORDINARIA_NO` | PROP_EXTRAORDINARIA_NO | !extraordinaryPayment | "" | "X" |
| `PROPUESTA_QUITAS_SI` | PROP_QUITAS_SI | capitalReduction | "X" | "" |
| `PROPUESTA_QUITAS_NO` | PROP_QUITAS_NO | !capitalReduction | "" | "X" |
| `PROPUESTA_PRIVILEGIOS_SI` | PROP_PRIVILEGIOS_SI | hasClassPrivileges | "X" | "" |
| `PROPUESTA_PRIVILEGIOS_NO` | PROP_PRIVILEGIOS_NO | !hasClassPrivileges | "" | "X" |
| `PROPUESTA_TERCEROS_SI` | PROP_PAGO_TERCEROS_SI | thirdPartyPaymentAuth | "X" | "" |
| `PROPUESTA_TERCEROS_NO` | PROP_PAGO_TERCEROS_NO | !thirdPartyPaymentAuth | "" | "X" |
| `PROPUESTA_GARANTIAS_SI` | PROP_GARANTIAS_SI | guaranteeSubstitution | "X" | "" |
| `PROPUESTA_GARANTIAS_NO` | PROP_GARANTIAS_NO | !guaranteeSubstitution | "" | "X" |

### Valores Numéricos
| Variable Normalizada | Variable Anterior | Campo Prisma |
|---------------------|-------------------|--------------|
| `PROPUESTA_PLAZO` | PROP_PLAZO | paymentTermMonths |
| `PROPUESTA_CUOTA_MENSUAL` | PROP_CUOTA_MENSUAL | formatCurrency(monthlyPaymentAmount) |
| `PROPUESTA_CUOTA_VARIABLE` | PROP_CUOTA_VARIABLE | formatCurrency(variablePayment) |
| `PROPUESTA_EXTRA_FECHA` | PROP_EXTRA_FECHA | extraordinaryPaymentDate |
| `PROPUESTA_TASA_MENSUAL` | PROP_TASA_MENSUAL | calculated |
| `PROPUESTA_TASA_ANUAL` | PROP_TASA_ANUAL | calculated |
| `PROPUESTA_QUITAS_PORCENTAJE` | PROP_QUITAS_PORCENTAJE | capitalReductionPercent |
| `PROPUESTA_QUITAS_VALOR` | PROP_QUITAS_VALOR | calculated |

### Prelación de Pagos
| Variable Normalizada | Variable Anterior | Campo Prisma |
|---------------------|-------------------|--------------|
| `PROPUESTA_PRELACION_1` | PROP_PRELACION_1 | paymentOrder.primera |
| `PROPUESTA_PRELACION_2` | PROP_PRELACION_2 | paymentOrder.segunda |
| `PROPUESTA_PRELACION_3` | PROP_PRELACION_3 | paymentOrder.tercera |
| `PROPUESTA_PRELACION_4` | PROP_PRELACION_4 | paymentOrder.cuarta |
| `PROPUESTA_PRELACION_5` | PROP_PRELACION_5 | paymentOrder.quinta |

### Seguros
| Variable Normalizada | Variable Anterior | Condición |
|---------------------|-------------------|-----------|
| `PROPUESTA_SEGURO_INCENDIO` | PROP_SEGURO_INCENDIO | insuranceOffering.includes('incendio') |
| `PROPUESTA_SEGURO_VIDA` | PROP_SEGURO_VIDA | insuranceOffering.includes('vida') |

### Condonación de Intereses
| Variable Normalizada | Variable Anterior | Campo Prisma |
|---------------------|-------------------|--------------|
| `PROPUESTA_CONDONA_CAUSADO` | PROP_COND_CAUSADO | forgiveAccruedInterest ? "SI" : "NO" |
| `PROPUESTA_CONDONA_FUTURO` | PROP_COND_FUTURO | forgiveFutureInterest ? "SI" : "NO" |

---

## SECCIÓN 13: ZOOM

| Variable Normalizada | Variable Anterior | Fuente Prisma |
|---------------------|-------------------|---------------|
| `ZOOM_ID` | ZOOM_ID, ID_REUNION_ZOOM | case.zoomMeetingId |
| `ZOOM_CODIGO` | ZOOM_CODIGO, CODIGO_ACCESO_ZOOM | case.zoomPassword |
| `ZOOM_LINK` | ZOOM_LINK | case.zoomLink |

---

## SECCIÓN 14: OPERADOR

| Variable Normalizada | Variable Anterior | Fuente Prisma |
|---------------------|-------------------|---------------|
| `OPERADOR_NOMBRE` | NOMBRE_OPERADOR | case.operator.name |
| `OPERADOR_EMAIL` | EMAIL_OPERADOR | case.operator.email |

---

## SECCIÓN 15: NOTIFICACIONES

| Variable Normalizada | Variable Anterior | Fuente Prisma |
|---------------------|-------------------|---------------|
| `NOTIF_DIRECCION` | NOTIF_DIRECCION | case.notificationAddress ?? debtor.address |
| `NOTIF_TELEFONO` | NOTIF_TELEFONO | case.notificationPhone ?? debtor.phone |
| `NOTIF_EMAIL` | NOTIF_EMAIL, EMAIL_NOTIFICACIONES | case.notificationEmail ?? debtor.email |

---

## SECCIÓN 16: CAUSAS DE INSOLVENCIA

| Variable Normalizada | Variable Anterior | Etiqueta |
|---------------------|-------------------|----------|
| `CAUSA_1` | CAUSA_1 | SOBREENDEUDAMIENTO POR FALTA DE RECURSOS |
| `CAUSA_2` | CAUSA_2 | PERDIDA DE EMPLEO |
| `CAUSA_3` | CAUSA_3 | DIVORCIO |
| `CAUSA_4` | CAUSA_4 | ENFERMEDAD |
| `CAUSA_5` | CAUSA_5 | ACCIDENTE |
| `CAUSA_6` | CAUSA_6 | ESTAFA |
| `CAUSA_7` | CAUSA_7 | DISMINUCIÓN DE INGRESOS |
| `CAUSA_8` | CAUSA_8 | FALTA DE EDUCACIÓN FINANCIERA |
| `CAUSA_9` | CAUSA_9 | MUERTE DE CÓNYUGE |
| `CAUSA_10` | CAUSA_10 | NUEVOS CRÉDITOS PARA CUBRIR OTROS |
| `CAUSA_11` | CAUSA_11 | MALA INVERSIÓN |
| `CAUSA_12` | CAUSA_12 | OTROS |
| `CAUSA_12_DETALLE` | CAUSA_12_DETALLE | Descripción de "otros" |

---

## SECCIÓN 17: CHECK LIST (SI/NO)

| Variable Normalizada | Variable Anterior | Descripción |
|---------------------|-------------------|-------------|
| `CHECK_SOLICITUD` | SI_SOLICITUD / NO_SOLICITUD | ¿Solicitud completa? |
| `CHECK_ACREEDORES` | SI_ACREEDORES / NO_ACREEDORES | ¿Tiene acreedores? |
| `CHECK_BIENES` | SI_BIENES / NO_BIENES | ¿Tiene bienes? |
| `CHECK_VALOR_BIENES` | SI_VALOR_BIENES / NO_VALOR_BIENES | ¿Declara valor? |
| `CHECK_INGRESOS` | SI_INGRESOS / NO_INGRESOS | ¿Declara ingresos? |
| `CHECK_CAUSAS` | SI_CAUSAS / NO_CAUSAS | ¿Identifica causas? |
| `CHECK_PROPUESTA` | SI_PROPUESTA / NO_PROPUESTA | ¿Presenta propuesta? |
| `CHECK_RECURSOS` | SI_RECURSOS / NO_RECURSOS | ¿Tiene recursos? |
| `CHECK_PROCESOS` | SI_PROCESOS / NO_PROCESOS | ¿Tiene procesos? |
| `CHECK_ALIMENTARIAS` | SI_ALIMENTARIAS / NO_ALIMENTARIAS | ¿Obligaciones alimentarias? |
| `CHECK_CONYUGAL` | SI_CONYUGAL / NO_CONYUGAL | ¿Sociedad conyugal? |
| `CHECK_APODERADO` | SI_APODERADO / NO_APODERADO | ¿Actúa con apoderado? |
| `CHECK_PC` | SI_PC / NO_PC | ¿Es pequeño comerciante? |
| `CHECK_40_SMMLV` | SI_40 / NO_40 | ¿Menos de 40 SMMLV? |
| `CHECK_150_SMMLV` | SI_150 / NO_150 | ¿Más de 150 SMMLV? |
| `CHECK_MAS_150` | SI_MAS_150 / NO_MAS_150 | ¿Más de 150 acreedores? |

---

## SECCIÓN 18: ÁMBITO DE APLICACIÓN

| Variable Normalizada | Variable Anterior | Condición |
|---------------------|-------------------|-----------|
| `AMBITO_NO_COMERCIANTE` | APLICACION_NO_COMERCIANTE | applicantScope.includes('PERSONA_NATURAL_NO_COMERCIANTE') ? "SI" : "NO" |
| `AMBITO_PEQUENO_COMERCIANTE` | APLICACION_PEQUENA_COMERCIANTE | applicantScope.includes('PERSONA_NATURAL_PEQUENA_COMERCIANTE') ? "SI" : "NO" |

---

## SECCIÓN 19: TABLAS DINÁMICAS (HTML generado)

| Variable Normalizada | Variable Anterior | Descripción |
|---------------------|-------------------|-------------|
| `TABLA_CALIFICACION_GRADUACION` | CUADRO_CALIFICACION_GRADUACION | Tabla HTML de C&G |
| `TABLA_PAGO_CAPITAL` | DETALLE_PAGO_CAPITAL | Detalle de pagos |
| `TABLA_FORMA_PAGO` | FORMA_PAGO_ACREEDORES | Forma de pago por acreedor |
| `TABLA_PROYECCION_PAGOS` | PROYECCION_PAGOS | Proyección de pagos |
| `TABLA_INVENTARIO_BIENES` | INVENTARIO_BIENES | Inventario completo |
| `LISTA_ACREEDORES_EDICTO` | LISTA_ACREEDORES | Lista para edicto |

---

## SECCIÓN 20: VARIABLES DE DILIGENCIAMIENTO MANUAL (Sentido del Voto)

Estas variables NO deben mapearse automáticamente. Se diligencian en un formulario separado durante la audiencia:

| Variable | Descripción | Formulario |
|----------|-------------|------------|
| `VOTO_APODERADO_NOMBRE` | apoderado_nombre | Sentido del Voto |
| `VOTO_APODERADO_CEDULA` | apoderado_cedula | Sentido del Voto |
| `VOTO_ENTIDAD_REPRESENTADA` | entidad_representada | Sentido del Voto |
| `VOTO_TARJETA_PROFESIONAL` | tarjeta_profesional | Sentido del Voto |
| `VOTO_TELEFONO` | telefono_contacto | Sentido del Voto |
| `VOTO_EMAIL` | correo_electronico | Sentido del Voto |
| `VOTO_SENTIDO` | votacion | Sentido del Voto |
| `VOTO_FORMA_PAGO` | forma_pago | Sentido del Voto |
| `VOTO_NUMERO_CUOTAS` | numero_cuotas | Sentido del Voto |
| `VOTO_VALOR_CUOTA` | valor_cuota | Sentido del Voto |
| `VOTO_FECHA_INICIO_PAGO` | fecha_inicio_pago | Sentido del Voto |
| `VOTO_OBSERVACIONES` | observaciones | Sentido del Voto |
| `VOTO_FECHA_DOCUMENTO` | fecha_documento | Sentido del Voto |
| `VOTO_FIRMA` | firma_votante | Sentido del Voto |

---

## FUNCIONES HELPER REQUERIDAS

```typescript
// Formatear moneda colombiana
function formatCurrency(value: number | null): string {
  if (!value) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(value);
}

// Formatear fecha larga
function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(date));
}

// Día en palabras
function getDayInWords(day: number): string {
  const words = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', ...];
  return words[day] || day.toString();
}

// Género del nombre
function getGenderPrefix(name: string): string {
  const lower = name.toLowerCase().trim();
  if (lower.endsWith('a') || lower.endsWith('ia')) {
    return 'La señora';
  }
  return 'El señor';
}
```
