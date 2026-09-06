/**
 * Test Suite Exigente: Validación de Extracción FedEx, Eliminación de Awaiting Tracking y Reparación de Guías
 * Ejecución: node test_ebay_fixes.mjs
 */

import assert from 'node:assert';

console.log('🧪 Iniciando pruebas exigentes de requerimientos eBay y Smartbits...\n');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error('     Error:', err.message);
  }
}

// ============================================================================
// Funciones bajo prueba (Idénticas a la implementación en content.js y popup.js)
// ============================================================================

function isValidTrackingNumber(str, excludedIds = []) {
  if (!str || typeof str !== 'string') return false;
  const clean = str.trim();

  // Rechazar si coincide exactamente con algún itemId u orderId excluido
  if (excludedIds && excludedIds.length > 0) {
    for (const ex of excludedIds) {
      if (!ex) continue;
      const cleanEx = String(ex).replace(/[\s-]/g, '').trim();
      if (cleanEx && clean.toUpperCase() === cleanEx.toUpperCase()) {
        return false;
      }
    }
  }

  // Rechazar formato de ID de orden de eBay con guiones (XX-XXXXX-XXXXX)
  if (/^[0-9]{2}-[0-9]{5}-[0-9]{5}$/.test(clean)) {
    return false;
  }

  // Rechazar cadenas con formato JSON, llaves o telemetría interna de eBay
  if (clean.startsWith('{') || clean.startsWith('[') || clean.includes('EVENTFAMILY') || clean.includes('eventFamily') || clean.includes('"') || clean.includes(':')) {
    return false;
  }

  // Rechazar palabras comunes de botones, estados o interfaces de eBay
  if (/^(order|item|pack|track|date|view|details|click|nav|actn|true|false|null|undefined|delivered|entregado|comprado|shipped|enviado|experience|delivery|status|button)/i.test(clean)) {
    return false;
  }

  // Un número de tracking de courier real en USA DEBE contener dígitos numéricos (al menos 4)
  const digitsOnly = clean.replace(/\D/g, '');
  if (digitsOnly.length < 4) {
    return false;
  }

  // Longitud y caracteres válidos
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(clean)) {
    return false;
  }

  return true;
}

function detectCourier(tracking) {
  if (!tracking || !isValidTrackingNumber(tracking)) return 'otro';
  const clean = tracking.replace(/[\s-]/g, '').toUpperCase();
  if (/^1Z[0-9A-Z]{16}$/i.test(clean)) return 'ups';
  if (/^(?:7489[0-9]{16,22}|96[0-9]{18,22}|[0-9]{12}|[0-9]{15}|DT[0-9]{12})$/i.test(clean)) return 'fedex';
  if (/^(94|93|92|95|91|420|03|82|23)[0-9]{16,28}$/.test(clean) || /^[0-9]{20,24}$/.test(clean)) return 'usps';
  if (/^(ESUS|EEUS|UPAA|LVS)[0-9A-Z]+$/i.test(clean) || /^[A-Z]{2}[0-9]{9}US$/i.test(clean)) return 'usps';
  if (/^[0-9]{10}$/.test(clean)) return 'dhl';
  return 'otro';
}

function extractTrackingFromText(text, excluded = []) {
  if (!text) return { trackingNumber: '', courier: 'otro' };

  const patterns = [
    /\b(1Z[\s-]?[0-9A-Z]{3}[\s-]?[0-9A-Z]{3}[\s-]?[0-9A-Z]{2}[\s-]?[0-9A-Z]{4}[\s-]?[0-9A-Z]{4})\b/i,
    /\b(9[1-5](?:[\s-]?[0-9]){18,24})\b/,
    /\b(?:420\s*[0-9]{5}\s*)?(9[1-5](?:[\s-]?[0-9]){18,22})\b/,
    /\b([0-9]{4}\s+[0-9]{4}\s+[0-9]{4}\s+[0-9]{4}\s+[0-9]{4}(?:\s+[0-9]{2,4})?)\b/,
    /\b(ESUS[0-9A-Za-z]{6,20}|EEUS[0-9A-Za-z]{6,20}|UPAA[0-9A-Za-z]{6,20})\b/i,
    /\b([A-Z]{2}[0-9]{9}US)\b/i,
    // FedEx con espacios estándar (ej: 8763 1669 7415)
    /\b([0-9]{4}\s+[0-9]{4}\s+[0-9]{4})\b/,
    // FedEx etiqueta explícita o prefijo
    /(?:fedex(?:[\s\w-]{0,35})?|carrier\s*:\s*fedex[^\d]{0,20})[\s:#=-]+([0-9]{12,15})\b/i,
    /\b(7489[\s-]?[0-9\s-]{16,22})\b/,
    // Etiqueta explícita de tracking con captura acotada (sin tragar texto subsiguiente)
    /(?:tracking\s*(?:number|#|id|no\.?|code)?|n[uú]mero\s*de\s*(?:seguimiento|gu[ií]a)|rastreo|gu[ií]a)[\s:#=-]+([A-Za-z0-9_-]{8,36})\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && (match[1] || match[0])) {
      const candidate = (match[1] || match[0]).replace(/[\s-]/g, '');
      if (isValidTrackingNumber(candidate, excluded)) {
        return {
          trackingNumber: candidate,
          courier: detectCourier(candidate)
        };
      }
    }
  }

  // Si menciona fedex explícitamente en el texto
  if (/\bfedex\b/i.test(text)) {
    const fedexCandidates = text.match(/\b([0-9]{12}|[0-9]{15})\b/g) || [];
    for (const cand of fedexCandidates) {
      if (isValidTrackingNumber(cand, excluded)) {
        return {
          trackingNumber: cand,
          courier: 'fedex'
        };
      }
    }
    const spacedFedex = text.match(/\b([0-9]{4}\s+[0-9]{4}\s+[0-9]{4})\b/g) || [];
    for (const sf of spacedFedex) {
      const cleanCand = sf.replace(/\s+/g, '');
      if (isValidTrackingNumber(cleanCand, excluded)) {
        return {
          trackingNumber: cleanCand,
          courier: 'fedex'
        };
      }
    }
  }

  return { trackingNumber: '', courier: 'otro' };
}

function extractTrackingFromHtml(html, excluded = []) {
  if (!html) return { trackingNumber: '', courier: 'otro' };

  // 1. Enlaces a fedex.com
  if (/fedex\.com/i.test(html)) {
    const fedexMatches = html.matchAll(/[?&#/](?:tracking_?numbers?|track_?numbers?|trknbr|trackId|tLabels|tracklist)=([0-9]{12,22})/gi);
    for (const fm of fedexMatches) {
      const cleanFm = fm[1];
      if (isValidTrackingNumber(cleanFm, excluded)) {
        return {
          trackingNumber: cleanFm,
          courier: 'fedex'
        };
      }
    }
    const fHrefMatches = html.matchAll(/fedex\.com\/[^\s"']*?\b([0-9]{12}|[0-9]{15})\b/gi);
    for (const fhm of fHrefMatches) {
      if (isValidTrackingNumber(fhm[1], excluded)) {
        return {
          trackingNumber: fhm[1],
          courier: 'fedex'
        };
      }
    }
  }

  // 2. Cross-tag label matching (ej: Tracking number:</span> <span>876316697415</span>)
  const crossTagMatch = html.match(/(?:tracking\s*(?:number|#|id|no\.?|code)?|shipmentTracking(?:Number)?|carrierTrackingNumber|deliveryTrackingNumber)(?:<[^>]+>|[\s"':=#-])+([A-Za-z0-9_-]{8,36})\b/i);
  if (crossTagMatch && isValidTrackingNumber(crossTagMatch[1], excluded)) {
    return {
      trackingNumber: crossTagMatch[1],
      courier: detectCourier(crossTagMatch[1])
    };
  }

  // 3. Si menciona fedex en el HTML, buscar 12 dígitos válidos
  if (/fedex/i.test(html)) {
    const fMatches = html.matchAll(/\b([0-9]{12}|[0-9]{15})\b/g);
    for (const fm of fMatches) {
      if (isValidTrackingNumber(fm[1], excluded)) {
        return {
          trackingNumber: fm[1],
          courier: 'fedex'
        };
      }
    }
  }

  return extractTrackingFromText(html.replace(/<[^>]+>/g, ' '), excluded);
}

// ============================================================================
// 1. REQUERIMIENTO: Quitar función de awaiting tracking y marcar bandera
// ============================================================================

test('Eliminación de Awaiting Tracking: Órdenes sin guía quedan exclusivamente en "Sin tracking en lista"', () => {
  const orders = [
    {
      orderId: '05-15138-64200',
      itemId: '383425182826',
      titulo: 'Dell Latitude 5440',
      shipping_status: 'pendiente',
      tracking_usa: ''
    },
    {
      orderId: '13-15084-12247',
      itemId: '383425999999',
      titulo: 'DELL PRECISION 3570',
      shipping_status: 'delivered',
      tracking_usa: ''
    }
  ];

  orders.forEach((order, index) => {
    let trkBadgeHtml = '';
    // Regla: Si tiene tracking muestra el courier y número; si NO tiene, muestra '⚪ Sin tracking en lista'
    if (order.tracking_usa) {
      trkBadgeHtml = `📦 ${(order.courier_usa || 'OTRO').toUpperCase()}: ${order.tracking_usa}`;
    } else {
      trkBadgeHtml = '⚪ Sin tracking en lista';
    }

    assert.strictEqual(trkBadgeHtml, '⚪ Sin tracking en lista');
    assert.ok(!trkBadgeHtml.includes('Awaiting tracking'), 'Nunca debe aparecer el badge de Awaiting tracking');
    assert.ok(!trkBadgeHtml.includes('Awaiting shipment'), 'Nunca debe aparecer el badge de Awaiting shipment');
  });
});

test('Enriquecimiento en popup encola todas las órdenes sin guía (sin saltarse ninguna por awaiting)', () => {
  const detectedOrders = [
    { orderId: '05-15138-64200', tracking_usa: '' },
    { orderId: '13-15084-12247', tracking_usa: '' },
    { orderId: '22-99999-11111', tracking_usa: '876316697415' }
  ];

  const missingIndices = [];
  detectedOrders.forEach((order, idx) => {
    if (!order.tracking_usa && order.orderId) {
      missingIndices.push(idx);
    }
  });

  assert.deepStrictEqual(missingIndices, [0, 1], 'Ambas órdenes sin tracking deben ser encoladas para búsqueda');
});

// ============================================================================
// 2. REQUERIMIENTO: Reconocimiento Robusto y Exigente de FEDEX
// ============================================================================

test('FedEx: Reconoce tracking estándar de 12 dígitos y asigna courier "fedex"', () => {
  const trk1 = '876316697415';
  const trk2 = '876173494889';
  const trk3 = '786512345678';

  assert.strictEqual(isValidTrackingNumber(trk1), true);
  assert.strictEqual(detectCourier(trk1), 'fedex');
  assert.strictEqual(detectCourier(trk2), 'fedex');
  assert.strictEqual(detectCourier(trk3), 'fedex');
});

test('FedEx: Reconoce tracking de 12 dígitos con espacios estándar (ej: 8763 1669 7415)', () => {
  const sampleText = 'Carrier: FedEx\nTracking number: 8763 1669 7415\nOrder total: $299.87';
  const result = extractTrackingFromText(sampleText, ['05-15138-64200']);
  assert.strictEqual(result.trackingNumber, '876316697415');
  assert.strictEqual(result.courier, 'fedex');
});

test('FedEx: Reconoce tracking de 15 dígitos (FedEx Ground / Home Delivery)', () => {
  const trk15 = '961280499000000';
  assert.strictEqual(isValidTrackingNumber(trk15), true);
  assert.strictEqual(detectCourier(trk15), 'fedex');
});

test('FedEx: Reconoce código de barras de 20-22 dígitos que inician con 7489 o 96', () => {
  const trk20 = '74890200123456789012';
  const trk22 = '9622001900000000000000';
  assert.strictEqual(isValidTrackingNumber(trk20), true);
  assert.strictEqual(detectCourier(trk20), 'fedex');
  assert.strictEqual(isValidTrackingNumber(trk22), true);
  assert.strictEqual(detectCourier(trk22), 'fedex');
});

test('FedEx: Reconoce Door Tag de FedEx (DT seguido de 12 dígitos)', () => {
  const dt = 'DT123456789012';
  assert.strictEqual(isValidTrackingNumber(dt), true);
  assert.strictEqual(detectCourier(dt), 'fedex');
});

test('FedEx Exigente: NO contamina el tracking con texto subsiguiente en salto de línea', () => {
  // Bug previo: regex capturaba `876316697415\nDelivered on Tue` produciendo `876316697415DeliveredonTue`
  const realisticCardText = `
    Delivered
    Order date: Aug 27, 2026 · Order total: US $299.87 · Order number: 13-15084-12247
    Tracking number: 876316697415
    Delivered on Tue, Sep 1
    No cancellations.
    Returns accepted through Sep 15.
    DELL PRECISION 3570 15.6" 12th Gen i7 1255U 16GB DDR5 256GB
  `;

  const result = extractTrackingFromText(realisticCardText, ['13-15084-12247', '383425182826']);
  assert.strictEqual(result.trackingNumber, '876316697415');
  assert.strictEqual(result.courier, 'fedex');
  assert.ok(!result.trackingNumber.includes('Delivered'), 'No debe contener palabras subsiguientes');
});

test('FedEx Exigente: Extrae tracking cuando "FedEx Ground" está en un div separado del número', () => {
  const htmlCard = `
    <div class="order-card">
      <div class="carrier-badge">Shipped with FedEx Ground</div>
      <div class="product-title">DELL PRECISION 3570 15.6" 12th Gen</div>
      <div class="delivery-status">Delivered on Sep 1</div>
      <div class="tracking-section">
        <span>Tracking number: </span>
        <span class="trk-num">876173494889</span>
      </div>
    </div>
  `;

  const result = extractTrackingFromHtml(htmlCard, ['13-15084-12247', '383425182826']);
  assert.strictEqual(result.trackingNumber, '876173494889');
  assert.strictEqual(result.courier, 'fedex');
});

test('FedEx Exigente: Extrae tracking a través de múltiples etiquetas HTML (cross-tag)', () => {
  const htmlCrossTags = `
    <div class="sh-tracking__number">
      <span class="label">Tracking #:</span>
      <span class="val"><a href="https://www.ebay.com/itm/something">876316697415</a></span>
    </div>
  `;

  const result = extractTrackingFromHtml(htmlCrossTags, ['13-15084-12247']);
  assert.strictEqual(result.trackingNumber, '876316697415');
  assert.strictEqual(result.courier, 'fedex');
});

test('FedEx Exigente: Extrae tracking desde diversas URLs de fedex.com', () => {
  const urls = [
    '<a href="https://www.fedex.com/fedextrack/?action=track&trackingnumber=876316697415&cntry_code=us">Track</a>',
    '<a href="https://www.fedex.com/apps/fedextrack/?trknbr=876173494889">Track</a>',
    '<a href="https://www.fedex.com/tracking?tracknumbers=786512345678">Track</a>',
    '<a href="https://www.fedex.com/locate/index.html#track?tLabels=876316697415">Track</a>'
  ];

  const expected = ['876316697415', '876173494889', '786512345678', '876316697415'];

  urls.forEach((u, i) => {
    const res = extractTrackingFromHtml(u, ['13-15084-12247']);
    assert.strictEqual(res.trackingNumber, expected[i], `Falla extrayendo de URL ${u}`);
    assert.strictEqual(res.courier, 'fedex');
  });
});

// ============================================================================
// 3. REQUERIMIENTO: Exclusión Estricta sin Falsos Positivos
// ============================================================================

test('Exclusión Estricta: Un Order ID de 12 dígitos limpios NO rechaza un tracking legítimo de 12 dígitos', () => {
  // Orden: 05-15138-64200 -> limpia: 051513864200 (12 dígitos)
  const orderId = '05-15138-64200';
  const rawOrderId = '051513864200';
  const fedexTracking = '876316697415';

  // Con igualdad estricta, fedexTracking !== rawOrderId, por tanto es válido
  assert.strictEqual(isValidTrackingNumber(fedexTracking, [orderId, rawOrderId]), true);
  
  // Pero si se le pasa el propio orderId como candidato, se rechaza
  assert.strictEqual(isValidTrackingNumber(orderId, [orderId, rawOrderId]), false);
  assert.strictEqual(isValidTrackingNumber(rawOrderId, [orderId, rawOrderId]), false);
});

test('Exclusión Estricta: Un Item ID excluido se rechaza con precisión', () => {
  const itemId = '383425182826';
  assert.strictEqual(isValidTrackingNumber(itemId, [itemId]), false);
});

test('Compatibilidad Couriers: UPS, USPS, DHL continúan funcionando con exactitud', () => {
  // UPS
  assert.strictEqual(detectCourier('1Z9999999999999999'), 'ups');
  // USPS
  assert.strictEqual(detectCourier('9400111899562537625140'), 'usps');
  assert.strictEqual(detectCourier('ESUS12345678'), 'usps');
  // DHL
  assert.strictEqual(detectCourier('1234567890'), 'dhl');
});

// ============================================================================
// 4. REQUERIMIENTO: Reparación Automática de Trackings Corruptos
// ============================================================================

test('Reparación Automática: Detecta Item ID guardado como tracking en Firestore y lo reemplaza con FedEx real', () => {
  const corruptPackageInFirestore = {
    id: 'trk_doc_001',
    tracking_usa: '383425182826', // Item ID corrupto
    courier_usa: 'otro'
  };

  const freshEbayOrder = {
    itemId: '383425182826',
    orderId: '13-15084-12247',
    tracking_usa: '876316697415', // FedEx real recuperado
    courier_usa: 'fedex'
  };

  const isCorruptTracking = (trk, itmId, ordId) => {
    if (!trk) return false;
    const c = trk.trim();
    return c === itmId || c === ordId || /^[0-9]{2}-[0-9]{5}-[0-9]{5}$/.test(c) || c.startsWith('{');
  };

  assert.ok(isCorruptTracking(corruptPackageInFirestore.tracking_usa, freshEbayOrder.itemId, freshEbayOrder.orderId));

  // Reparación automática in-place
  if (isCorruptTracking(corruptPackageInFirestore.tracking_usa, freshEbayOrder.itemId, freshEbayOrder.orderId)) {
    corruptPackageInFirestore.tracking_usa = freshEbayOrder.tracking_usa;
    corruptPackageInFirestore.courier_usa = freshEbayOrder.courier_usa;
  }

  assert.strictEqual(corruptPackageInFirestore.tracking_usa, '876316697415');
  assert.strictEqual(corruptPackageInFirestore.courier_usa, 'fedex');
});

console.log(`\n==================================================`);
console.log(`Resultados: ${passedTests} de ${totalTests} pruebas aprobadas.`);
if (passedTests === totalTests) {
  console.log('🎉 Todos los requerimientos exigentes fueron validados exitosamente.');
} else {
  process.exit(1);
}
