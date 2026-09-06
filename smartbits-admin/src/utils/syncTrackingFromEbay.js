import { collection, query, where, getDocs, getDoc, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

/**
 * Sincroniza o crea automáticamente un paquete en la colección `trackings`
 * a partir del tracking de USA obtenido en eBay y la laptop/componente vinculada o compra pendiente.
 *
 * @param {Firestore} db - Instancia de Firestore.
 * @param {Object} params - Parámetros de sincronización.
 * @param {Object} params.ebayItem - Datos del ítem de eBay (tracking_usa, courier_usa, orderId, titulo, etc.).
 * @param {Object} [params.inventoryItem] - Objeto del producto en inventario o preliminar.
 * @param {'laptop'|'componente'} [params.tipo='laptop'] - Tipo de producto.
 * @returns {Promise<{success: boolean, id: string|null, status: 'created'|'updated'|'skipped'|'error', error?: string}>}
 */
export async function syncTrackingFromEbay(db, { ebayItem, inventoryItem, tipo = 'laptop' }) {
  if (!ebayItem?.tracking_usa) {
    return { success: false, id: null, status: 'skipped', error: 'Sin tracking_usa' };
  }

  const rawTracking = String(ebayItem.tracking_usa || '').trim();
  if (!rawTracking) {
    return { success: false, id: null, status: 'skipped', error: 'Tracking vacío' };
  }

  const rawItemId = String(ebayItem.itemId || '').replace(/_u[0-9]+$/, '').trim();
  const rawOrderId = String(ebayItem.orderId || '').replace(/[\s-]/g, '').trim();

  // Rechazar si coincide con el Item ID de eBay o número de orden
  if ((rawItemId && rawTracking === rawItemId) || (rawOrderId && rawTracking === rawOrderId)) {
    console.warn('syncTrackingFromEbay: tracking_usa inválido ignorado (coincide con Item ID o N° de orden):', rawTracking);
    return { success: false, id: null, status: 'skipped', error: 'Tracking inválido (es el Item ID de eBay)' };
  }

  // Rechazar cadenas JSON de telemetría de eBay o números corruptos
  if (rawTracking.startsWith('{') || rawTracking.startsWith('[') || rawTracking.includes('EVENTFAMILY') || rawTracking.includes('"') || rawTracking.length > 40) {
    console.warn('syncTrackingFromEbay: tracking_usa inválido ignorado (telemetría/JSON):', rawTracking);
    return { success: false, id: null, status: 'skipped', error: 'Formato de tracking no válido' };
  }

  // Rechazar palabras no válidas (como 'experience') o strings que no contengan números
  const digitsOnly = rawTracking.replace(/\D/g, '');
  if (digitsOnly.length < 4 || /^(experience|delivered|tracking|shipped|package|order|null|undefined|true|false)$/i.test(rawTracking)) {
    console.warn('syncTrackingFromEbay: tracking_usa inválido ignorado (sin dígitos o palabra reservada):', rawTracking);
    return { success: false, id: null, status: 'skipped', error: 'Tracking no válido (sin formato de guía)' };
  }

  const trackingUsaClean = rawTracking.replace(/[\s-]/g, '').toUpperCase();
  
  // Detección inteligente de courier si viene como 'otro' o indefinido
  let courierUsa = ebayItem.courier_usa;
  if (!courierUsa || courierUsa === 'otro') {
    if (/^1Z[0-9A-Z]{16}$/i.test(trackingUsaClean)) {
      courierUsa = 'ups';
    } else if (/^7489[0-9]{16,22}$/.test(trackingUsaClean) || /^[0-9]{12}$/.test(trackingUsaClean) || /^[0-9]{15}$/.test(trackingUsaClean)) {
      courierUsa = 'fedex';
    } else if (/^(94|93|92|95|91|420|03|82|23)[0-9]{16,28}$/.test(trackingUsaClean) || /^[0-9]{20,24}$/.test(trackingUsaClean)) {
      courierUsa = 'usps';
    } else if (/^(ESUS|EEUS|UPAA|LVS)[0-9A-Z]+$/i.test(trackingUsaClean) || /^[A-Z]{2}[0-9]{9}US$/i.test(trackingUsaClean)) {
      courierUsa = 'usps';
    } else if (/^[0-9]{10}$/.test(trackingUsaClean)) {
      courierUsa = 'dhl';
    } else {
      courierUsa = 'usps';
    }
  }

  // Preparar datos del ítem evitando cualquier valor undefined
  const itemId = inventoryItem?.id || `ebay_${ebayItem.id || Date.now()}`;
  const itemNombre = (inventoryItem?.nombre || `${inventoryItem?.marca || ''} ${inventoryItem?.modelo || ''}`.trim() || ebayItem.titulo || 'Artículo eBay').trim();
  const itemModelo = inventoryItem?.modelo || '';
  const itemCosto = Number(inventoryItem?.precio_ebay || inventoryItem?.costo || ebayItem.precio) || 0;

  const itemToAdd = {
    id: itemId,
    tipo: tipo || 'laptop',
    nombre: itemNombre,
    modelo: itemModelo,
    costo: itemCosto,
  };

  try {
    // 1. Verificar si este ítem ya estaba asignado a un paquete en `trackings` que tenía una guía corrupta (ej. Item ID o número de orden)
    let corruptTrackDoc = null;
    if (ebayItem.tracking_id) {
      try {
        const trkSnap = await getDoc(doc(db, 'trackings', ebayItem.tracking_id));
        if (trkSnap.exists()) {
          const trkData = trkSnap.data();
          const trkUsa = String(trkData.tracking_usa || '').trim();
          if (trkUsa === rawItemId || trkUsa === rawOrderId || /^[0-9]{2}-[0-9]{5}-[0-9]{5}$/.test(trkUsa) || trkUsa.startsWith('{')) {
            corruptTrackDoc = { id: trkSnap.id, data: trkData };
          }
        }
      } catch (_) {}
    }

    if (!corruptTrackDoc) {
      // Búsqueda alternativa: revisar si en la colección trackings existe algún paquete con este ítem cuyo tracking_usa sea el Item ID
      try {
        const allTrkSnap = await getDocs(collection(db, 'trackings'));
        for (const d of allTrkSnap.docs) {
          const dData = d.data();
          const dItems = Array.isArray(dData.items) ? dData.items : [];
          if (dItems.some(it => it.id === itemId)) {
            const trkUsa = String(dData.tracking_usa || '').trim();
            if (trkUsa === rawItemId || trkUsa === rawOrderId || /^[0-9]{2}-[0-9]{5}-[0-9]{5}$/.test(trkUsa) || trkUsa.startsWith('{')) {
              corruptTrackDoc = { id: d.id, data: dData };
              break;
            }
          }
        }
      } catch (_) {}
    }

    // Si encontramos un paquete con guía corrupta asociada a este ítem, repararlo directamente
    if (corruptTrackDoc) {
      const currentItems = Array.isArray(corruptTrackDoc.data.items) ? corruptTrackDoc.data.items : [];
      const alreadyInList = currentItems.some(i => i.id === itemId);
      const updatedItems = alreadyInList ? currentItems : [...currentItems, itemToAdd];

      await updateDoc(doc(db, 'trackings', corruptTrackDoc.id), {
        tracking_usa: trackingUsaClean,
        courier_usa: courierUsa,
        items: updatedItems,
        fecha_actualizacion: serverTimestamp()
      });

      console.log(`[Smartbits] 🔧 Tracking corrupto reparado con éxito en paquete ${corruptTrackDoc.id}: ${courierUsa.toUpperCase()} ${trackingUsaClean}`);
      return { success: true, id: corruptTrackDoc.id, status: 'updated' };
    }

    // 2. Buscar si ya existe un paquete con este tracking_usa legítimo en Firestore (consolidación)
    const q = query(collection(db, 'trackings'), where('tracking_usa', '==', trackingUsaClean));
    const snap = await getDocs(q);

    if (!snap.empty) {
      // Ya existe el paquete (consolidado con otros artículos de este mismo envío)
      const existingDoc = snap.docs[0];
      const existingData = existingDoc.data();
      const currentItems = Array.isArray(existingData.items) ? existingData.items : [];

      // Verificar si el ítem ya está agregado a la lista para no duplicarlo
      const alreadyInList = currentItems.some(i => i.id === itemId);

      if (!alreadyInList) {
        const updatedItems = [...currentItems, itemToAdd];
        await updateDoc(doc(db, 'trackings', existingDoc.id), {
          items: updatedItems,
          fecha_actualizacion: serverTimestamp()
        });
      }

      return { success: true, id: existingDoc.id, status: 'updated' };
    } else {
      // 3. No existe: crear un nuevo paquete en estado 'por_prealertar'
      const newTrackingData = {
        tracking_usa: trackingUsaClean,
        courier_usa: courierUsa,
        prealertado: false,
        fecha_prealerta: null,
        casillero_cuenta: '',

        tracking_vzla: '',
        courier_vzla: 'liberty',
        courier_vzla_otro: '',

        estado: 'por_prealertar',
        items: [itemToAdd],
        notas: `Importado automáticamente desde eBay.\nOrden: #${ebayItem.orderId || 'S/N'}\nArtículo: ${itemNombre}`,

        fecha_creacion: serverTimestamp(),
        fecha_actualizacion: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'trackings'), newTrackingData);
      return { success: true, id: docRef.id, status: 'created' };
    }
  } catch (err) {
    console.error('Error en syncTrackingFromEbay:', err);
    return { success: false, id: null, status: 'error', error: err.message };
  }
}
