# Smartbits — Resumen del problema de Capital de Socios y plan de corrección

**Preparado para:** Ysmael y Víctor
**Fecha:** 04-nov-2026
**Estado:** Documento de análisis y propuesta. **No se ha modificado nada en el sistema todavía.** Se espera el visto bueno de Víctor para ejecutar.

---

## 1. Resumen en una página

Al revisar la base de datos y los cálculos del módulo de Finanzas encontramos que el **“Capital Total”** que muestra el panel **no es la suma del capital de los dos socios**.

| | Monto |
|---|---:|
| Capital Total del negocio (caja + inventario) | **$24.307,33** |
| Suma del capital neto de Ysmael y Víctor | **$16.569,74** |
| **Diferencia** | **$7.737,59** |

La diferencia **no viene de las ganancias ni de los retiros**. El **98,1 %** de esa diferencia ($7.590,89) **nació el 30 de agosto, al ejecutar el corte contable**, porque se registrandos cifras que no cuadraban entre sí y el sistema no avisó. Solo **$146,70** se ha generado después del corte.

La buena noticia: **el modelo de reparto 50/50 con retiros individuales ya funciona exactamente como se diseñó** (el retiro de un socio solo afecta a ese socio). Lo que falta es cerrar la cuenta de apertura y organizar el cierre de mes.

**Propuesta:** repartir la diferencia de $7.737,59 en partes iguales (50/50), con lo cual el capital de cada socio queda cuadrando exactamente con la caja real + el inventario, y montar el cierre mensual automático para saber mes a mes cuánto gana y pierde cada uno.

---

## 2. El problema

### 2.1 Las dos tarjetas de arriba miden cosas distintas

| Tarjeta | Qué mide realmente | De dónde sale |
|---|---|---|
| **“Capital Total (Negocio)”** (tarjeta oscura) | **Activos**: el dinero en caja + el inventario | `caja/saldos` + costo de laptops y componentes disponibles |
| **“Capital Neto Actual”** (Ysmael / Víctor) | **Patrimonio**: lo que le corresponde a cada socio | Corte inicial + aportes + 50 % de las ganancias − retiros propios |

Nunca se iban a sumar si la contabilidad está completa. La pregunta correcta es: **¿por qué no cuadran?**

### 2.2 La causa raíz: el corte contable del 30-ago-2026

Al ejecutar el corte se guardaron dos bloques de datos por separado:

**Paso 2 — Activos (lo que realmente existe):**

| Concepto | Monto |
|---|---:|
| Caja inicial (USD + Bs a la tasa de 935) | $16.738,22 |
| Inventario inicial | $5.258,68 |
| **Total activos** | **$21.996,89** |

**Paso 3 — Patrimonio (a quién pertenece):**

| Concepto | Monto |
|---|---:|
| Capital inicial Ysmael | $4.282,00 |
| Capital inicial Víctor | $10.124,00 |
| **Total socios** | **$14.406,00** |

```
Activos iniciales   $21.996,89
Capital de socios   $14.406,00
                    ─────────────
Sin asignar          $ 7.590,89
```

Se guardaron ambas cifras **sin validar que cuadraran**. Nada en el sistema avisó ni impidió que quedara esa diferencia.

### 2.3 Composición exacta de la diferencia actual

| Componente | Monto | % del total |
|---|---:|---:|
| Nació en el corte (capital no asignado) | $7.590,89 | **98,1 %** |
| Generado después del corte | $146,70 | 1,9 % |
| **Diferencia total** | **$7.737,59** | 100 % |

El detalle del $146,70 (muy menor) viene de:

- Ajustes manuales de cuenta que movieron caja sin registro de origen.
- 9 ventas “rápidas” (servicios, licencias) registradas sin documento de venta asociado.
- Diferencias entre el costo de los equipos y el costo registrado en su venta.
- Cambio de tasa Bs/USD (935 → 997,92) sobre las cuentas en bolívares.

---

## 3. La razón: por qué pasa y por qué no lo detectamos

1. **El corte acepta dos números libres.** En el paso 2 se cargan los saldos reales de cada cuenta y el inventario; en el paso 3 se escriben a mano los capitales de cada socio. No hay ninguna comprobación de que ambos sumen lo mismo. Ahí se coló la diferencia.
2. **El sistema nunca muestra la conciliación.** Existe un cálculo en el código (`capitalTotalSocios`) que suma ambos capitales, pero **nunca se muestra en pantalla**. Por eso nadie veía que la ecuación no cerraba.
3. **Las tarjetas usan conceptos distintos sin aclarar.** “Capital Total (Negocio)” suena a que es el capital de los socios, pero son activos. Genera la confusión de que “falta plata” o de que “el retiro de Ysmael le restó a Víctor”.
4. **El ajuste manual de cuenta solo tocaba la caja.** Al corregir el saldo de una cuenta porque no coincidía con el banco, el capital de los socios no se enteraba: la caja cambiaba y el patrimonio no. Cada corrección de ese tipo abría un hueco nuevo.
5. **El cierre mensual usa otro libro de cuentas.** `capital_acum_ysmael/victor` arranca desde cero y nunca incluye el capital inicial del corte, por eso hoy muestra $271,14 y $1.804,38 en lugar de los capitales reales.

---

## 4. El modelo que YA funciona (y que no se toca)

Esto es importante: **el reparto 50/50 y los retiros individuales ya están bien implementados**.

```
Capital Ysmael = capital inicial + aportes de Ysmael + 50 % de la utilidad − retiros de Ysmael
Capital Víctor  = capital inicial + aportes de Víctor  + 50 % de la utilidad − retiros de Víctor
```

Ejemplo con los números de hoy (ya con la diferencia repartida):

```
Ysmael  $8.390,56   Víctor $15.916,78   Activos $24.307,34

Ysmael retira $100:
   → capital de Ysmael  $8.290,56   (−$100)
   → capital de Víctor   $15.916,78  (sin cambios)  ✔
   → caja / activos      $24.207,34
   → suma de capitales   $24.207,34   (sigue cuadrando)
```

Un retiro de un socio **nunca** afecta al otro. Un gasto operativo (publicidad, gasolina, software) sí se reparte 50/50 porque es una decisión del negocio.

---

## 5. La solución propuesta

### 5.1 Repartir la diferencia 50/50 (una sola vez)

Se registra un **asiento de apertura** (no toca la caja; solo asigna a los socios los activos que ya existen):

| Componente | Monto | Ysmael | Víctor |
|---|---:|---:|---:|
| Capital no asignado del corte | $7.590,89 | +$3.795,45 | +$3.795,45 |
| Diferencia residual posterior al corte | $146,70 | +$73,35 | +$73,35 |
| **Total** | **$7.737,59** | **+$3.868,80** | **+$3.868,80** |

**Resultado:**

| | Ysmael | Víctor | Suma |
|---|---:|---:|---:|
| Capital actual antes del ajuste | $4.521,76 | $12.047,98 | $16.569,74 |
| Ajuste 50/50 | +$3.868,80 | +$3.868,80 | +$7.737,59 |
| **Capital actual corregido** | **$8.390,56** | **$15.916,78** | **$24.307,34** |

Diferencia final: **$0,00**. El capital de los socios queda igual a caja + inventario.

### 5.2 Cierre de mes automático + capital “cerrado” y “aproximado”

Cada mes se verá:

- **Capital cerrado** (al cierre del mes anterior).
- **El mes en curso**: ganancia de ventas, gastos operativos, diferencial cambiario, ajustes de conciliación, aportes y retiros de cada socio.
- **Resultado del mes** (cuánto ganó/perdió cada uno) y **capital aproximado de hoy**.

Con los datos reales, así queda:

| Período | Resultado Ysmael | Resultado Víctor |
|---|---:|---:|
| Base corregida al 30-ago | $8.150,80 | $13.992,80 |
| Agosto (30–31, parcial) | +$23,44 | +$29,81 |
| Septiembre | +$1.111,59 | +$1.146,87 |
| Octubre | −$700,66 | +$797,30 |
| **Capital cerrado al 31-oct** | **$8.585,17** | **$15.966,78** |
| Noviembre (1–3) | −$194,62 | −$50,00 |
| **Capital aproximado hoy (04-nov)** | **$8.390,55** | **$15.916,78** |

El cierre del día 1 se guarda con identificador único, de modo que **nunca se duplica** aunque el sistema se abra varias veces.

### 5.3 El ajuste manual de cuenta queda simple

- Tú escribes el **saldo real** que dice el banco → el sistema actualiza la cuenta.
- La diferencia se reparte **50/50** en el capital de los socios y queda auditada (quién, cuándo, motivo).
- Si el motivo **sí** se conoce (un gasto, un retiro, un aporte, una transferencia), se registra en la pestaña **Movimientos** con las acciones que ya existen, y cada una afecta a quien corresponde.
- En el modal se agrega la nota: *“Si conoces el motivo, regístralo en Movimientos. Este ajuste es solo para diferencias sin explicación.”*

### 5.4 Ventas: siempre a una cuenta

A partir de ahora **ninguna venta puede quedar sin cuenta**: si no se elige cuenta, la venta no se guarda. Esto elimina la bolsa “ventas no asignadas” ($6.085) que hoy es dinero invisible dentro de la caja y que ya estaba duplicado en cuentas reales.

### 5.5 Gastos de garantía y arreglo (postventa)

- La ganancia de la venta se registra cuando se vende.
- El cambio de cargador, arreglo o garantía se registra como **gasto operativo del mes** y se **vincula al equipo vendido**.
- En “Inteligencia de Ventas” se verá por equipo: ganancia de la venta, costos postventa y **margen real del equipo**.
- El gasto se cuenta una sola vez en el mes y una sola vez en el margen del equipo.

---

## 6. Hallazgos adicionales (se corrigen de paso)

| # | Hallazgo | Impacto | Qué se hará |
|---|---|---|---|
| 1 | `ventas_no_asignadas` = $6.085 dentro de la caja pero fuera de las cuentas | Dinero duplicado e invisible | Se limpia (ya está en las cuentas reales) y se bloquean ventas sin cuenta |
| 2 | Campo fantasma `"efectivo, binance"` = −$470 | No es una cuenta; nació de un rollback fallido al borrar una venta | Se borra el campo y se corrige el código para que no vuelva a pasar |
| 3 | El cierre de octubre usó otra fórmula (utilidad $2.938,61 vs $3.218,20) | Los cierres no cuadran con las tarjetas | Se unifica la fórmula y se recalculan septiembre y octubre |
| 4 | 9 ventas “rápidas” sin documento de venta | $261,68 de ganancia sin costo ni ficha | Se conservan (son servicios), pero quedan visibles en el reporte |
| 5 | Inventario: compras − costo de ventas = $1.044,02, pero el inventario real subió $676,78 | $367,24 de diferencia de costo | Se revisa equipo por equipo |
| 6 | Ingresos: histórico $19.206,84 vs ventas $19.405,20; ganancia $6.376,22 vs $6.295,00 | $198,36 y $81,22 de diferencia | Se revisa con el reporte de ganancia por venta |
| 7 | `capital_acum_*` del cierre mensual arranca en 0 | Libro paralelo inútil | Se elimina; el capital cerrado queda como única fuente |
| 8 | 37 ajustes manuales post-corte (neto +$1.302,90 USD y +322.960,42 Bs) | No afectan al capital de los socios | Los del pasado quedan absorbidos en el ajuste de apertura; los futuros sí se reparten 50/50 |

---

## 7. Lo que NO se va a tocar (garantía)

- **Los saldos de las cuentas de caja.** La caja actual es la verdad: ni más ni menos.
- **El inventario.** Se suma al costo registrado de cada equipo.
- **El ajuste de $7.737,59** es un asiento del lado del patrimonio: no entra ni sale dinero, solo asigna a los socios los activos que ya existen.
- Los únicos campos que se limpian en `caja/saldos` son dos que **no son cuentas** (`ventas_no_asignadas` y `"efectivo, binance"`), y ninguno de los dos modifica los saldos reales.

---

## 8. Cambios a ejecutar

### Fase 1 — Corrección de datos (primero, para que los números sean reales)

1. Crear el asiento de apertura de $3.868,80 por socio (capital no asignado + residual).
2. Limpiar `ventas_no_asignadas` y el campo fantasma `"efectivo, binance"` (sin tocar saldos de cuentas).
3. Recalcular los cierres de septiembre y octubre con la fórmula unificada (ganancia registrada por venta).

### Fase 2 — Motor de capital y cierre mensual

4. Nuevo cálculo del capital: base + resultado del mes + ajustes manuales 50/50 − retiros + aportes.
5. Cierre de mes automático el día 1, idempotente (no duplica), con historial.
6. Modal de ajuste manual: guardar diferencia en USD y repartir 50/50; nota para usar Movimientos cuando el motivo se conoce.
7. Calcular el capital cerrado (mes anterior) y el aproximado (hoy).

### Fase 3 — Interfaz

8. Tarjetas por socio: capital cerrado, desglose del mes en curso (ganancia, gastos, diferenciales, retiros, aportes), resultado del mes, capital aproximado.
9. Tarjeta superior: “Activos del negocio”, “Capital de socios (cerrado y aproximado)” y **“Diferencia por conciliar”** (debe quedar en $0).
10. Historial de cierres mensuales.

### Fase 4 — Inteligencia y preventative

11. Gasto operativo postventa vinculado al equipo + columna de margen real en Inteligencia de Ventas.
12. Validación de cuenta obligatoria en todas las ventas (DeliveryNote, ComponentDeliveryNote, VentasNotas, venta rápida).
13. Corrección del rollback de ventas (revertir por cada cuenta del detalle, nunca por un texto con coma).
14. Panel de conciliación: activos vs capital, ajustes del mes, ventas vs costo vs inventario.

---

## 9. Decisiones ya tomadas

| Decisión | Estado |
|---|---|
| La diferencia de $7.737,59 se reparte 50/50 entre los socios | Aprobado |
| La ganancia mensual se calcula con la ganancia registrada en cada venta | Aprobado |
| El cierre de mes se ejecuta automáticamente el día 1 | Aprobado |
| El ajuste manual de cuenta reparte 50/50 (sin clasificar tipos) | Aprobado |
| `ventas_no_asignadas` se limpia y toda venta debe caer en una cuenta | Aprobado |
| Los retiros afectan solo a su socio; las ganancias se reparten 50/50 | Ya funcionaba, se mantiene |
| La caja real y el inventario no se tocan | Regla del negocio |

---

## 10. Pendiente de confirmación

1. **Visto bueno de Víctor** a este documento y a las decisiones de la sección 9.
2. Si Víctor prefiere otra proporción para el reparto de $7.737,59 (por ejemplo, todo a un socio), se ajusta antes de ejecutar.
3. Definir si, en el futuro, las diferencias de revaluación por cambio de la tasa Bs/USD se reparten 50/50 al cierre o se muestran aparte. Por ahora, con las tasas actuales, el efecto es menor a $25.

---

## 11. Nota sobre el acceso a datos

Para este análisis se leyó la base de datos de Firestore **en modo solo lectura** (el código no escribió nada) con una clave de servicio temporal. **Esa clave debe revocarse** en Google Cloud → IAM y administración → Cuentas de servicio → eliminar la clave, y borrarse el archivo local.

---

## 12. Archivos del sistema que se van a modificar

| Archivo | Qué se toca |
|---|---|
| `smartbits-admin/src/pages/admin/finanzas/PanelPrincipal.jsx` | Tarjetas de capital, resultado del mes, capital cerrado/aproximado |
| `smartbits-admin/src/pages/admin/finanzas/ConfiguracionCorte.jsx` | Validación de que activos = capitales y registro del ajuste de apertura |
| `smartbits-admin/src/pages/admin/finanzas/Movimientos.jsx` | Rollback de ventas por cuenta, bloqueo de claves con coma |
| `smartbits-admin/src/pages/admin/finanzas/ReportesCierre.jsx` | Cierre mensual automático, fórmula unificada, capital cerrado |
| `smartbits-admin/src/pages/admin/finanzas/ResumenCaja.jsx` | Ajuste manual: diferencia en USD y reparto 50/50 |
| `smartbits-admin/src/pages/admin/finanzas/InteligenciaVentas.jsx` | Margen real por equipo (postventa) |
| `smartbits-admin/src/pages/admin/DeliveryNote.jsx` / `ComponentDeliveryNote.jsx` | Cuenta obligatoria en toda venta |
| `smartbits-admin/src/pages/admin/finanzas/VentasNotas.jsx` | Cuenta obligatoria al editar pagos de una venta |
| `smartbits-admin/src/utils/` (nuevo) | Lógica compartida de capital, cierres y conciliación |

**Ningún cambio en la base de datos sin que Víctor lo apruebe.**
