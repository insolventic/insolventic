# Procedimiento interno — solicitudes ARCO

**Última actualización:** 2026-10-18
**Documento interno** (no público) — el canal de entrada para el titular está
en `/privacidad` (público, sin sesión). Este documento es el "después": qué
hace el equipo del centro cuando llega una solicitud por ese canal.

**Este documento es un borrador operativo, no una política legal aprobada.**
No afirma cumplimiento de la Ley 1581 de 2012 ni de ninguna otra norma, y no
cita plazos legales que no se hayan verificado con la abogada — donde el
procedimiento necesita un plazo, queda marcado como pendiente (§5).

---

## 1. Qué solicitudes cubre

Las cuatro que `/privacidad` ofrece al titular:

| Solicitud | Qué pide el titular |
| --- | --- |
| **Conocer** | Saber qué datos suyos están registrados y para qué se usan |
| **Actualizar** | Corregir un dato que cambió (dirección, teléfono, etc.) |
| **Rectificar** | Corregir un dato que está mal, incompleto o genera confusión |
| **Suprimir** | Que se eliminen sus datos |

Las tres primeras son operativamente sencillas: el dato se busca, se muestra
o se corrige en el expediente. La cuarta (**supresión**) es la que tiene el
conflicto sin resolver — ver §4.

## 2. Quién responde

**⟨COMPLETAR: a quién, dentro de cada centro, le llega el correo del canal
ARCO y quién tiene la autoridad de aprobar una corrección o una
supresión⟩.**

Mientras ese dato no se llene, la regla operativa mínima es: nadie distinto
del **administrador del centro** (o a quien el administrador delegue por
escrito) ejecuta una supresión. Una actualización o rectificación simple
—corregir un teléfono, una dirección— puede hacerla el operador asignado al
expediente, con el mismo criterio que ya aplica para editar cualquier otro
dato del caso.

## 3. Pasos

### 3.1 Conocer

1. Verificar la identidad de quien solicita (ver §3.5) y ubicar el
   expediente por nombre o número de cédula.
2. Revisar en el sistema qué datos del titular están registrados: pestaña
   del deudor (datos personales, ingresos, bienes) y, si aplica, la fila de
   acreedor.
3. Responder al titular con un resumen de esos datos y para qué se usan
   (ver `/privacidad` §3, "Finalidad del tratamiento") — no es necesario
   adjuntar una copia literal del expediente completo, basta confirmar qué
   categorías de datos hay y su propósito.

### 3.2 Actualizar / Rectificar

1. Verificar identidad (§3.5).
2. Ubicar el expediente y el campo a corregir.
3. Editar el dato desde el formulario de edición del deudor o del acreedor,
   según corresponda (los mismos formularios que usa el operador en su
   trabajo diario — no hay una pantalla separada para esto).
4. El cambio queda en el registro de auditoría del caso (quién lo hizo y
   cuándo) por el mecanismo normal de auditoría del sistema — no hace falta
   nada adicional para que esto quede trazado.
5. Confirmar al titular que el dato fue corregido.

### 3.3 Suprimir

1. Verificar identidad (§3.5).
2. **Antes de borrar nada:** revisar si el expediente corresponde a un
   trámite ya terminado o a uno en curso, y si hay una obligación de
   conservación documental vigente sobre ese expediente — ver el conflicto
   sin resolver en §4. Si hay dudas, **no se ejecuta la supresión**; se
   escala a quien tenga la autoridad del §2 y, si el conflicto no tiene
   respuesta clara, a la abogada.
3. Si se determina que la supresión es procedente: el borrado de un
   expediente en el sistema es el mismo que usa `deleteCase` — borra el caso
   y (por las relaciones del modelo) todo lo que cuelga de él. **Es
   irreversible**: no hay una papelera ni una forma de recuperar un
   expediente borrado hoy.
4. Confirmar al titular que sus datos fueron suprimidos (o, si no procedió,
   explicarle por qué).

### 3.4 Qué no cubre este procedimiento

- Una solicitud de un **acreedor** sobre sus propios datos (nombre, NIT,
  contacto) sigue el mismo procedimiento que un deudor — el titular puede
  ser cualquiera de los dos.
- Una solicitud sobre los datos de un **operador** (empleado del centro) no
  es una solicitud ARCO de este canal — es un asunto laboral/de recursos
  humanos del centro, fuera del alcance de este documento.

### 3.5 Verificación de identidad

**⟨COMPLETAR: qué se exige para confirmar que quien escribe es realmente el
titular (o su apoderado) y no un tercero suplantándolo⟩.** Sin esto definido,
no hay un procedimiento mínimo seguro para responder una solicitud que
involucra datos personales — es el primer vacío a llenar antes de que este
documento pueda usarse en la práctica.

## 4. El conflicto sin resolver: supresión vs. conservación del expediente legal

**Esto es una decisión pendiente para la abogada. Este documento NO la
resuelve — la deja planteada con la mayor precisión posible.**

Un expediente de insolvencia, conciliación o acuerdo de apoyo es, en sí
mismo, el registro de un trámite ante un centro de conciliación. Es
razonable que exista una obligación de conservar ese registro durante un
tiempo después de terminado el trámite — por ejemplo, para que el deudor, un
acreedor o una autoridad puedan consultarlo más adelante, o para que el
centro pueda defenderse de un reclamo sobre cómo se llevó el trámite.

Si esa obligación existe y está vigente, **entra en conflicto directo** con
el derecho del titular a suprimir sus datos: no se pueden cumplir las dos
cosas a la vez sobre el mismo expediente.

Las preguntas concretas que la abogada necesita responder para que este
documento se pueda completar:

1. ¿Existe una obligación legal o reglamentaria de conservar el expediente
   de un trámite de insolvencia/conciliación/acuerdo de apoyo después de
   terminado? ¿Por cuánto tiempo?
2. Si existe, ¿esa obligación prevalece sobre una solicitud de supresión
   mientras esté vigente? ¿Hay alguna excepción (por ejemplo, datos que no
   son necesarios para la obligación de conservar, aunque estén en el mismo
   expediente)?
3. Si NO existe esa obligación (o ya venció para un expediente concreto),
   ¿el procedimiento de §3.3 es suficiente, o falta algo?

Hasta que estas preguntas tengan respuesta, la regla operativa de este
documento es la más conservadora: **ante cualquier duda, no se suprime** —
se escala (§3.3, paso 2).

## 5. Plazos

**⟨COMPLETAR: en cuántos días hábiles responde el centro a cada tipo de
solicitud⟩.** No se fija un número acá porque no se verificó con la abogada
cuál es el plazo legal aplicable — afirmar un plazo sin esa verificación
sería exactamente el tipo de cosa que este documento, y la política de
`/privacidad`, se comprometen a no hacer.

## 6. Qué registrar de cada solicitud atendida

Mínimo, para poder demostrar que el canal funciona si algún día se audita:
fecha de la solicitud, tipo (conocer/actualizar/rectificar/suprimir),
expediente(s) afectado(s), quién la atendió, qué se hizo, y fecha de
respuesta al titular. **⟨COMPLETAR: dónde se registra esto⟩** — el sistema
no tiene hoy una pantalla dedicada a esto; puede ser tan simple como una
hoja de cálculo interna del centro, pero debe decidirse.
