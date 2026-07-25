const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// 1. Trigger al marcar laptop como vendida (fallback para ventas manuales)
exports.onLaptopSold = functions.firestore
  .document("laptops/{laptopId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Detectar si acaba de ser vendida
    if (!before.fecha_venta && after.fecha_venta) {
      const costo_total = after.costo_total || 0;
      const precio_final_venta = after.precio_final_venta || 0;
      
      const ganancia = precio_final_venta - costo_total;
      const porcentaje_ganancia = costo_total > 0 ? (ganancia / costo_total) * 100 : 0;
      
      let dias_en_inventario = 0;
      if (after.fecha_compra && after.fecha_venta) {
        const ms_diferencia = after.fecha_venta.toDate().getTime() - after.fecha_compra.toDate().getTime();
        dias_en_inventario = Math.floor(ms_diferencia / (1000 * 60 * 60 * 24));
      }

      await change.after.ref.update({
        ganancia,
        porcentaje_ganancia,
        dias_en_inventario
      });

      // Si el frontend ya escribio metodos_pago, el registro en caja/historico/ventas
      // ya fue creado desde DeliveryNote.jsx. Solo recalculamos capital.
      // Si NO hay metodos_pago (venta manual), usamos fallback a ventas_no_asignadas.
      if (!after.metodos_pago || after.metodos_pago.length === 0) {
        const cajaRef = db.collection("caja").doc("saldos");
        const cajaDoc = await cajaRef.get();
        if (cajaDoc.exists) {
          await cajaRef.update({
            ventas_no_asignadas: admin.firestore.FieldValue.increment(precio_final_venta),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        await db.collection("historico_ingresos").add({
          fecha: admin.firestore.FieldValue.serverTimestamp(),
          concepto: `Venta de ${after.marca || 'Laptop'} ${after.modelo || ''}`,
          monto: precio_final_venta,
          ganancia: ganancia,
          laptopId: context.params.laptopId,
          tipo: 'venta_laptop'
        });
      }
    }
    
    // Disparar recalculo de capital si cambia costo o estado de venta
    if (before.fecha_venta !== after.fecha_venta || before.costo_total !== after.costo_total) {
      await recalculateCapital();
    }
  });


// 2. Trigger de recalculo cuando cambia la caja
exports.onCajaChanged = functions.firestore
  .document("caja/saldos")
  .onWrite(async (change, context) => {
    await recalculateCapital();
  });

// 3. Trigger de recalculo cuando cambian los gastos personales
exports.onGastosPersonalesChanged = functions.firestore
  .document("gastos_personales/{gastoId}")
  .onWrite(async (change, context) => {
    await recalculateCapital();
  });

// Función central de cálculo
async function recalculateCapital() {
  const finanzasRef = db.collection("finanzas").doc("config");
  const configDoc = await finanzasRef.get();
  
  if (!configDoc.exists) return; // Si no hay config, no podemos calcular
  
  const config = configDoc.data();
  const prestamo_mama = config.prestamo_mama || 0;
  const inversion_ysmael = config.inversion_ysmael || 0;
  
  // 1. caja_total = suma de saldos USD en /caja (excluye cuentas Bs y metadata)
  const BS_KEYS = ['venezuela', 'bolivares_bs'];
  const EXCLUDE_KEYS = ['tasa_cambio', 'updated_at', 'caja_envios'];
  let caja_total = 0;
  const cajaDoc = await db.collection("caja").doc("saldos").get();
  if (cajaDoc.exists) {
    const saldos = cajaDoc.data();
    for (const key of Object.keys(saldos)) {
      if (typeof saldos[key] === 'number' && !EXCLUDE_KEYS.includes(key) && !BS_KEYS.includes(key)) {
        caja_total += saldos[key];
      }
    }
  }

  // 2. inventario = suma de costo_total de laptops con fecha_venta = null
  let inventario = 0;
  const laptopsSnapshot = await db.collection("laptops")
    .where("fecha_venta", "==", null)
    .get();
    
  laptopsSnapshot.forEach(doc => {
    const data = doc.data();
    inventario += (data.costo_total || 0);
  });

  // 3. capital_total = caja_total + inventario
  const capital_total = caja_total + inventario;

  // 4. capital_smartbits = capital_total - prestamo_mama
  const capital_smartbits = capital_total - prestamo_mama;

  // 5 & 6. gastos por socio
  let gastos_ysmael = 0;
  let gastos_victor = 0;
  
  const gastosSnapshot = await db.collection("gastos_personales").get();
  gastosSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.socio === "ysmael") gastos_ysmael += (data.monto || 0);
    if (data.socio === "victor") gastos_victor += (data.monto || 0);
  });

  // 7. capital_base = capital_smartbits - inversion_ysmael + gastos_ysmael + gastos_victor
  const capital_base = capital_smartbits - inversion_ysmael + gastos_ysmael + gastos_victor;

  // 8. mitad_cada_uno = capital_base / 2
  const mitad_cada_uno = capital_base / 2;

  // 9. capital_ysmael = mitad_cada_uno - gastos_ysmael
  const capital_ysmael = mitad_cada_uno - gastos_ysmael;

  // 10. capital_victor = mitad_cada_uno - gastos_victor
  const capital_victor = mitad_cada_uno - gastos_victor;

  // Guardar resultados en config para lectura en tiempo real
  await finanzasRef.update({
    capital_total,
    capital_smartbits,
    gastos_ysmael,
    gastos_victor,
    capital_base,
    mitad_cada_uno,
    capital_ysmael,
    capital_victor,
    caja_total,
    inventario,
    last_recalc: admin.firestore.FieldValue.serverTimestamp()
  });
}
