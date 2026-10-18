// smartbits-ebay-extension/background.js
// Sincronizador en segundo plano de compras de eBay y tracking literal de couriers USA

const FIREBASE_API_KEY = "AIzaSyC9g1nrEMFZfG8u8wzYhViktyJmuvPD-bA";
const FIREBASE_PROJECT_ID = "smartbits-catalog";

// Crear alarma para sincronización periódica desatendida cada 60 minutos
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('sync_ebay_purchases_alarm', {
    periodInMinutes: 60
  });
  console.log('[Smartbits Background] Alarma de sincronización programada cada 60 minutos.');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync_ebay_purchases_alarm') {
    ejecutarSincronizacionFondo().catch(err => {
      console.warn('[Smartbits Background] Error en sincronización periódica:', err);
    });
  }
});

// Escuchar peticiones desde el panel Admin (externally_connectable)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request && request.action === 'sync_ebay_purchases') {
    ejecutarSincronizacionFondo()
      .then(res => sendResponse({ success: true, ...res }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Respuesta asíncrona
  }
  if (request && request.action === 'query_liberty') {
    consultarLibertyDirecto(request.guide)
      .then(res => sendResponse({ success: true, ...res }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// También escuchar mensajes internos del popup o content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === 'trigger_background_sync') {
    ejecutarSincronizacionFondo()
      .then(res => sendResponse({ success: true, ...res }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (request && request.action === 'query_liberty') {
    consultarLibertyDirecto(request.guide)
      .then(res => sendResponse({ success: true, ...res }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (request && request.action === 'sync_ups_status') {
    actualizarTrackingUpsDirecto(request.trackingNumber, request.status, request.rawStatus)
      .then(res => sendResponse({ success: true, ...res }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/**
 * Actualiza el estatus de un tracking de UPS directamente en Firestore
 */
async function actualizarTrackingUpsDirecto(trackingNumber, status = 'Delivered', rawStatus = '') {
  const cleanTrack = String(trackingNumber || '').trim().replace(/[\s-]/g, '').toUpperCase();
  if (!cleanTrack) throw new Error('Tracking vacío');

  const token = await getValidToken();
  if (!token) {
    console.warn('[Smartbits Background] Sesión no iniciada en la extensión. No se puede escribir en Firestore.');
    return { success: false, error: 'Sesión no iniciada' };
  }

  let actualizadosCompras = 0;
  let actualizadosTrackings = 0;

  // 1. Actualizar en compras_ebay
  try {
    const queryComprasUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
    const compResp = await fetch(queryComprasUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'compras_ebay' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'tracking_usa' },
              op: 'EQUAL',
              value: { stringValue: cleanTrack }
            }
          }
        }
      })
    });

    if (compResp.ok) {
      const compResults = await compResp.json();
      for (const item of compResults) {
        if (item && item.document && item.document.name) {
          const docPath = item.document.name;
          const patchFields = {
            tracking_usa_entregado: { booleanValue: true },
            tracking_usa_ultimo_estado: { stringValue: rawStatus || status || 'Delivered' },
            isDelivered: { booleanValue: true },
            shipping_status: { stringValue: 'delivered' },
            courier_usa: { stringValue: 'ups' }
          };
          const updateMask = [
            'updateMask.fieldPaths=tracking_usa_entregado',
            'updateMask.fieldPaths=tracking_usa_ultimo_estado',
            'updateMask.fieldPaths=isDelivered',
            'updateMask.fieldPaths=shipping_status',
            'updateMask.fieldPaths=courier_usa'
          ];
          const patchUrl = `https://firestore.googleapis.com/v1/${docPath}?${updateMask.join('&')}`;
          await fetch(patchUrl, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields: patchFields })
          });
          actualizadosCompras++;
        }
      }
    }
  } catch (err) {
    console.warn('[Smartbits Background] Error actualizando compras_ebay por UPS:', err);
  }

  // 2. Actualizar en trackings
  try {
    const queryTrkUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
    const trkResp = await fetch(queryTrkUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'trackings' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'tracking_usa' },
              op: 'EQUAL',
              value: { stringValue: cleanTrack }
            }
          }
        }
      })
    });

    if (trkResp.ok) {
      const trkResults = await trkResp.json();
      for (const item of trkResults) {
        if (item && item.document && item.document.name) {
          const docPath = item.document.name;
          const currentFields = item.document.fields || {};
          const currentEstado = currentFields.estado?.stringValue || '';

          const patchFields = {
            tracking_usa_entregado: { booleanValue: true },
            tracking_usa_ultimo_estado: { stringValue: rawStatus || status || 'Delivered' }
          };
          const updateMask = [
            'updateMask.fieldPaths=tracking_usa_entregado',
            'updateMask.fieldPaths=tracking_usa_ultimo_estado'
          ];

          if (currentEstado === 'por_prealertar' || currentEstado === 'prealertado') {
            patchFields.estado = { stringValue: 'en_miami' };
            updateMask.push('updateMask.fieldPaths=estado');
          }

          const patchUrl = `https://firestore.googleapis.com/v1/${docPath}?${updateMask.join('&')}`;
          await fetch(patchUrl, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields: patchFields })
          });
          actualizadosTrackings++;
        }
      }
    }
  } catch (errTrk) {
    console.warn('[Smartbits Background] Error actualizando trackings por UPS:', errTrk);
  }

  return {
    success: true,
    actualizadosCompras,
    actualizadosTrackings
  };
}

/**
 * Consulta directa a Liberty Express desde la extensión sin bloqueos de CORS
 */
async function consultarLibertyDirecto(guide) {
  const cleanGuide = String(guide || '').trim().replace(/\s+/g, '').toUpperCase();
  if (!cleanGuide) throw new Error('Guía vacía');

  const fetchHeaders = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8'
  };

  // 1. GET directo si ya es formato de guía Liberty (WR01-, WRTMP-, LIB-)
  if (/^(?:WR|LIB|VE)[0-9A-Z_-]+$/i.test(cleanGuide)) {
    try {
      const directUrl = `https://iqpack.libertyexpress.com/Tracking?nGuia=${encodeURIComponent(cleanGuide)}`;
      const directResp = await fetch(directUrl, { headers: fetchHeaders });
      if (directResp.ok) {
        const directHtml = await directResp.text();
        if (directHtml.includes('tr-summary') || directHtml.includes('tr-timeline')) {
          return { success: true, html: directHtml, guide: cleanGuide };
        }
      }
    } catch (_) {}
  }

  // 2. SearchGuide POST con token y cookie
  const getResp = await fetch('https://iqpack.libertyexpress.com/SearchGuide', { headers: fetchHeaders });
  const getHtml = await getResp.text();
  const tokenMatch = getHtml.match(/name=["']__RequestVerificationToken["'][^>]*value=["']([^"']+)["']/i) ||
                     getHtml.match(/value=["']([^"']+)["'][^>]*name=["']__RequestVerificationToken["']/i);
  const token = tokenMatch ? tokenMatch[1] : '';

  const formData = new URLSearchParams();
  if (token) formData.append('__RequestVerificationToken', token);
  formData.append('FromMobileApp', 'False');
  formData.append('FromReactApp', 'True');
  formData.append('hreflang', '');
  formData.append('NGuia', cleanGuide);

  const postResp = await fetch('https://iqpack.libertyexpress.com/SearchGuide', {
    method: 'POST',
    headers: {
      ...fetchHeaders,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://iqpack.libertyexpress.com/SearchGuide',
      'Origin': 'https://iqpack.libertyexpress.com'
    },
    body: formData.toString()
  });

  const finalHtml = await postResp.text();
  return {
    success: postResp.status >= 200 && postResp.status < 400,
    html: finalHtml,
    guide: cleanGuide
  };
}

/**
 * Refresca el token de Firebase si está vencido
 */
async function getValidToken() {
  const session = await chrome.storage.local.get(['sb_token', 'sb_refresh_token', 'sb_expires_at']);
  if (!session.sb_token || !session.sb_refresh_token) {
    return null;
  }

  const now = Date.now();
  if (session.sb_expires_at && now > session.sb_expires_at - 60000) {
    try {
      const url = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(session.sb_refresh_token)}`
      });
      if (resp.ok) {
        const data = await resp.json();
        const expiresAt = Date.now() + parseInt(data.expires_in) * 1000;
        await chrome.storage.local.set({
          sb_token: data.id_token,
          sb_refresh_token: data.refresh_token,
          sb_expires_at: expiresAt
        });
        return data.id_token;
      }
    } catch (e) {
      console.warn('[Smartbits Background] No se pudo refrescar token:', e);
      return null;
    }
  }

  return session.sb_token;
}

/**
 * Consulta EXCLUSIVAMENTE https://www.ebay.com/mye/myebay/purchase
 * y procesa únicamente órdenes reales con formato XX-XXXXX-XXXXX.
 */
async function ejecutarSincronizacionFondo() {
  const token = await getValidToken();
  if (!token) {
    console.log('[Smartbits Background] Sesión no iniciada en la extensión. Omitiendo.');
    return { actualizados: 0, reason: 'unauthenticated' };
  }

  console.log('[Smartbits Background] Iniciando lectura de compras en eBay...');
  
  // 1. Fetch silencioso a la página oficial de compras de eBay con credenciales
  const purchaseUrl = 'https://www.ebay.com/mye/myebay/purchase';
  const resp = await fetch(purchaseUrl, {
    credentials: 'include',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': navigator.userAgent
    }
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} al cargar compras de eBay`);
  }

  const html = await resp.text();
  if (!html || html.includes('signin.ebay.com') || html.includes('Sign in to eBay')) {
    console.log('[Smartbits Background] La sesión de eBay no está iniciada en este navegador.');
    return { actualizados: 0, reason: 'ebay_session_inactive' };
  }

  // 2. Extraer órdenes estrictamente con formato de orden XX-XXXXX-XXXXX
  // y capturar el tracking y el estatus literal
  const orderRegex = /\b([0-9]{2}-[0-9]{5}-[0-9]{5})\b/g;
  const matches = [...new Set(html.match(orderRegex) || [])];

  if (matches.length === 0) {
    console.log('[Smartbits Background] No se detectaron órdenes de compra en el HTML.');
    return { actualizados: 0, totalEncontradas: 0 };
  }

  let totalActualizados = 0;

  // Analizar bloques de órdenes
  for (const orderId of matches) {
    try {
      // Localizar la porción del HTML que corresponde a esta orden
      const orderIdx = html.indexOf(orderId);
      if (orderIdx === -1) continue;
      
      const snippet = html.slice(Math.max(0, orderIdx - 1500), Math.min(html.length, orderIdx + 4500));

      // Extraer tracking USA si está presente en el snippet
      let trackingUsa = '';
      const upsMatch = snippet.match(/\b(1Z[0-9A-Z]{16})\b/i);
      const uspsMatch = snippet.match(/\b(9[1-5][0-9\s-]{18,26})\b/);
      const fedexMatch = snippet.match(/(?:fedex|carrier\s*:\s*fedex|tracking)[\s:#=-]+([0-9]{12,15})\b/i);

      if (upsMatch) trackingUsa = upsMatch[1].replace(/[\s-]/g, '').toUpperCase();
      else if (uspsMatch) trackingUsa = uspsMatch[1].replace(/[\s-]/g, '');
      else if (fedexMatch) trackingUsa = fedexMatch[1].replace(/[\s-]/g, '');

      // Extraer estatus literal del courier reportado por eBay
      let literalStatus = '';
      const statusPatterns = [
        /\b(delivered(?:\s+on\s+[A-Za-z]+,?\s+[0-9]{1,2})?)\b/i,
        /\b(on\s+the\s+way(?:\s*-\s*[A-Za-z\s0-9]+)?)\b/i,
        /\b(out\s+for\s+delivery)\b/i,
        /\b(in\s+transit)\b/i,
        /\b(shipped(?:\s+on\s+[A-Za-z]+,?\s+[0-9]{1,2})?)\b/i,
        /\b(entregado(?:\s+el\s+[0-9]{1,2}(?:\s+de\s+[A-Za-z]+)?)?)\b/i,
        /\b(en\s+camino|en\s+reparto|en\s+tr[áa]nsito)\b/i
      ];

      for (const pat of statusPatterns) {
        const m = snippet.match(pat);
        if (m && m[1]) {
          literalStatus = m[1].trim();
          break;
        }
      }

      if (!literalStatus && (snippet.includes('Delivered') || snippet.includes('delivered'))) {
        literalStatus = 'Delivered';
      }

      if (literalStatus || trackingUsa) {
        // Consultar compras en Firestore por orderId para actualizar tracking_usa_ultimo_estado
        const queryUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
        const queryResp = await fetch(queryUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'compras_ebay' }],
              where: {
                fieldFilter: {
                  field: { fieldPath: 'orderId' },
                  op: 'EQUAL',
                  value: { stringValue: orderId }
                }
              }
            }
          })
        });

        if (queryResp.ok) {
          const results = await queryResp.json();
          for (const item of results) {
            if (item && item.document && item.document.name) {
              const docPath = item.document.name;
              const currentFields = item.document.fields || {};
              const currentStatus = currentFields.tracking_usa_ultimo_estado?.stringValue || '';
              const currentTrack = currentFields.tracking_usa?.stringValue || '';

              // Solo actualizar si hay un cambio real
              if ((literalStatus && literalStatus !== currentStatus) || (trackingUsa && !currentTrack)) {
                const patchFields = {};
                const updateMask = [];

                if (literalStatus) {
                  patchFields.tracking_usa_ultimo_estado = { stringValue: literalStatus };
                  updateMask.push('updateMask.fieldPaths=tracking_usa_ultimo_estado');
                  if (/delivered|entregado/i.test(literalStatus)) {
                    patchFields.isDelivered = { booleanValue: true };
                    patchFields.shipping_status = { stringValue: 'delivered' };
                    updateMask.push('updateMask.fieldPaths=isDelivered');
                    updateMask.push('updateMask.fieldPaths=shipping_status');
                  }
                }
                if (trackingUsa && !currentTrack) {
                  patchFields.tracking_usa = { stringValue: trackingUsa };
                  updateMask.push('updateMask.fieldPaths=tracking_usa');
                  if (trackingUsa.startsWith('1Z')) {
                    patchFields.courier_usa = { stringValue: 'ups' };
                    updateMask.push('updateMask.fieldPaths=courier_usa');
                  }
                }

                if (updateMask.length > 0) {
                  const patchUrl = `https://firestore.googleapis.com/v1/${docPath}?${updateMask.join('&')}`;
                  await fetch(patchUrl, {
                    method: 'PATCH',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ fields: patchFields })
                  });
                  totalActualizados++;
                }
              }
            }
          }
        }
      }
    } catch (orderErr) {
      console.warn(`[Smartbits Background] Error procesando orden ${orderId}:`, orderErr);
    }
  }

  console.log(`[Smartbits Background] Sincronización completada. ${totalActualizados} compras actualizadas.`);
  return { actualizados: totalActualizados, totalEncontradas: matches.length };
}
