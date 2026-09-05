const FIREBASE_API_KEY = "AIzaSyC9g1nrEMFZfG8u8wzYhViktyJmuvPD-bA";
const FIREBASE_PROJECT_ID = "smartbits-catalog";

// Limpiar cualquier regla dinámica residual para usar el origen autorizado de la extensión
if (chrome?.declarativeNetRequest?.updateDynamicRules) {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [101, 1]
  }).catch(() => {});
}

// DOM Elements
const viewLogin = document.getElementById('view-login');
const viewSync = document.getElementById('view-sync');
const userHeader = document.getElementById('user-header');
const userEmailLabel = document.getElementById('user-email-label');
const btnLogout = document.getElementById('btn-logout');

const loginEmail = document.getElementById('login-email');
const loginPass = document.getElementById('login-pass');
const btnLogin = document.getElementById('btn-login');
const loginAlert = document.getElementById('login-alert');

const notEbayAlert = document.getElementById('not-ebay-alert');
const btnGotoEbay = document.getElementById('btn-goto-ebay');
const syncAlert = document.getElementById('sync-alert');
const ordersCountLabel = document.getElementById('orders-count-label');
const btnSelectAll = document.getElementById('btn-select-all');
const btnReextract = document.getElementById('btn-reextract');
const ordersContainer = document.getElementById('orders-container');
const btnSync = document.getElementById('btn-sync');
const syncSpinner = document.getElementById('sync-spinner');
const syncBtnText = document.getElementById('sync-btn-text');

let detectedOrders = [];
let currentToken = null;
let currentEmail = null;

// --- AUTHENTICATION FUNCTIONS ---

async function checkAuthSession() {
  const session = await chrome.storage.local.get(['sb_token', 'sb_refresh_token', 'sb_email', 'sb_expires_at']);
  if (!session.sb_token || !session.sb_refresh_token) {
    showLoginView();
    return false;
  }

  const now = Date.now();
  if (session.sb_expires_at && now > session.sb_expires_at - 60000) {
    // Token por expirar, refrescar
    try {
      const refreshed = await refreshAuthToken(session.sb_refresh_token);
      currentToken = refreshed.id_token;
      currentEmail = session.sb_email;
      await chrome.storage.local.set({
        sb_token: refreshed.id_token,
        sb_refresh_token: refreshed.refresh_token,
        sb_expires_at: Date.now() + parseInt(refreshed.expires_in) * 1000
      });
      showSyncView(currentEmail);
      return true;
    } catch (e) {
      console.warn('Error refreshing session:', e);
      showLoginView();
      return false;
    }
  }

  currentToken = session.sb_token;
  currentEmail = session.sb_email;
  showSyncView(currentEmail);
  return true;
}

async function loginAdmin(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      password: password,
      returnSecureToken: true
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Credenciales incorrectas');
  }

  const expiresAt = Date.now() + parseInt(data.expiresIn) * 1000;
  await chrome.storage.local.set({
    sb_token: data.idToken,
    sb_refresh_token: data.refreshToken,
    sb_email: data.email,
    sb_expires_at: expiresAt
  });

  currentToken = data.idToken;
  currentEmail = data.email;
  showSyncView(data.email);
}

async function refreshAuthToken(refreshToken) {
  const url = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${refreshToken}`
  });
  if (!response.ok) throw new Error('Refresh token falló');
  return await response.json();
}

function showLoginView() {
  viewLogin.style.display = 'flex';
  viewSync.style.display = 'none';
  userHeader.style.display = 'none';
}

function showSyncView(email) {
  viewLogin.style.display = 'none';
  viewSync.style.display = 'flex';
  userHeader.style.display = 'flex';
  userEmailLabel.innerText = email.split('@')[0];
  initSyncScanning();
}

// --- SCANNING EBAY ORDERS ---

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function initSyncScanning(forceReinject = false) {
  ordersContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px; font-size: 12px;">Analizando compras de eBay...</div>';
  syncAlert.style.display = 'none';
  btnSync.disabled = true;

  const tab = await getActiveTab();
  if (!tab || !tab.url || !tab.url.includes('ebay.com')) {
    notEbayAlert.style.display = 'flex';
    ordersContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px; font-size: 12px;">Abre tu Historial de Compras de eBay en esta pestaña para continuar.</div>';
    ordersCountLabel.innerText = '0 compras';
    return;
  }

  notEbayAlert.style.display = 'none';

  if (forceReinject) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (_) {}
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_EBAY_ORDERS' });
    if (response && response.success) {
      renderOrders(response.orders);
    } else {
      throw new Error('No se recibieron compras');
    }
  } catch (err) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      const retryResponse = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_EBAY_ORDERS' });
      if (retryResponse && retryResponse.success) {
        renderOrders(retryResponse.orders);
      } else {
        renderOrders([]);
      }
    } catch (injectErr) {
      console.error('Error comunicando con pestaña de eBay:', injectErr);
      ordersContainer.innerHTML = '<div style="text-align: center; color: #f87171; padding: 30px; font-size: 12px;">No se pudo leer la página de eBay. Asegúrate de estar en <strong>Purchase History</strong> y recarga la pestaña.</div>';
      ordersCountLabel.innerText = '0 compras';
    }
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const placeholderImg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NDc0OGIiIHN0cm9rZS13aWR0aD0iMS41Ij48cmVjdCB3aWR0aD0iMjAiIGhlaWdodD0iMTQiIHg9IjIiIHk9IjUiIHJ4PSIyIi8+PHBhdGggZD0iTTIgMTBoMjAiLz48L3N2Zz4=';

function isValidTrackingNumber(str, excludedIds = []) {
  if (!str || typeof str !== 'string') return false;
  const clean = str.trim();

  // Rechazar si coincide con algún itemId u orderId excluido
  if (excludedIds && excludedIds.length > 0) {
    for (const ex of excludedIds) {
      if (!ex) continue;
      const cleanEx = String(ex).replace(/[\s-]/g, '').trim();
      if (cleanEx && (clean === cleanEx || clean.includes(cleanEx) || cleanEx.includes(clean))) {
        return false;
      }
    }
  }

  // Rechazar si coincide con formato de ID de orden de eBay con guiones (XX-XXXXX-XXXXX)
  if (/^[0-9]{2}-[0-9]{5}-[0-9]{5}$/.test(clean)) {
    return false;
  }

  // Rechazar cadenas con formato JSON, llaves o telemetría interna de eBay
  if (clean.startsWith('{') || clean.startsWith('[') || clean.includes('EVENTFAMILY') || clean.includes('eventFamily') || clean.includes('"') || clean.includes(':')) {
    return false;
  }
  // Rechazar palabras comunes de botones, estados o parámetros de eBay (como 'experience')
  if (/^(order|item|pack|track|date|view|details|click|nav|actn|true|false|null|undefined|delivered|entregado|comprado|shipped|enviado|experience|delivery|status|button)/i.test(clean)) {
    return false;
  }

  // Un número de tracking legítimo en USA DEBE tener dígitos numéricos (al menos 4)
  const digitsOnly = clean.replace(/\D/g, '');
  if (digitsOnly.length < 4) {
    return false;
  }

  if (!/^[A-Za-z0-9_-]{8,40}$/.test(clean)) {
    return false;
  }
  return true;
}

function detectCourier(tracking) {
  if (!tracking || !isValidTrackingNumber(tracking)) return 'otro';
  const clean = tracking.replace(/[\s-]/g, '').toUpperCase();
  if (/^1Z[0-9A-Z]{16}$/i.test(clean)) return 'ups';
  if (/^(94|93|92|95|91|420|03|82|23)[0-9]{16,28}$/.test(clean) || /^[0-9]{20,24}$/.test(clean)) return 'usps';
  if (/^(ESUS|EEUS|UPAA|LVS)[0-9A-Z]+$/i.test(clean) || /^[A-Z]{2}[0-9]{9}US$/i.test(clean)) return 'usps';
  if (/^[0-9]{12}$/.test(clean) || /^[0-9]{15}$/.test(clean) || /^7489[0-9]{16,22}$/.test(clean)) return 'fedex';
  if (/^[0-9]{10}$/.test(clean)) return 'dhl';
  return 'otro';
}

async function fetchTrackingForOrder(order) {
  if (!order || !order.orderId) return null;
  const rawItemId = String(order.itemId || '').replace(/_u[0-9]+$/, '').trim();
  const rawOrderId = String(order.orderId || '').replace(/[\s-]/g, '').trim();
  const excluded = [rawItemId, order.orderId, rawOrderId].filter(Boolean);

  const urls = [];
  if (order.trackHref) {
    let fullTrackHref = order.trackHref;
    if (fullTrackHref.startsWith('/')) fullTrackHref = `https://www.ebay.com${fullTrackHref}`;
    if (fullTrackHref.startsWith('http') && !fullTrackHref.includes('/ord/show')) {
      urls.push(fullTrackHref);
    }
  }
  if (/^[0-9]{2}-[0-9]{5}-[0-9]{5}$/.test(order.orderId)) {
    // NUNCA consultar order.ebay.com/ord/show porque activa el limitexceeded de facturas de eBay
    urls.push(`https://www.ebay.com/cnt/TrackPackage?orderId=${encodeURIComponent(order.orderId)}`);
    if (rawItemId) {
      urls.push(`https://www.ebay.com/cnt/TrackPackage?orderId=${encodeURIComponent(order.orderId)}&itemId=${encodeURIComponent(rawItemId)}`);
    }
    urls.push(`https://www.ebay.com/mye/myebay/v2/purchase/tracking?orderId=${encodeURIComponent(order.orderId)}`);
  }

  // Priorizar patrones estrictos de courier antes de capturas de etiquetas genéricas
  const patterns = [
    /\b(1Z[0-9A-Z]{16})\b/gi,
    /\b(9[1-5][0-9\s-]{18,28})\b/g,
    /\b([0-9]{4}\s+[0-9]{4}\s+[0-9]{4}\s+[0-9]{4}\s+[0-9]{4}\s+[0-9]{2,4})\b/g,
    /\b(ESUS[0-9A-Za-z]{6,20}|EEUS[0-9A-Za-z]{6,20}|UPAA[0-9A-Za-z]{6,20})\b/gi,
    /\b([A-Z]{2}[0-9]{9}US)\b/gi,
    /(?:fedex(?:[\s\w-]{0,35})?|carrier\s*:\s*fedex[^\d]{0,20})[\s:#=-]+([0-9]{12,15})\b/gi,
    /\b(7489[\s-]?[0-9\s-]{16,22})\b/g,
    // Labeled matches: NUNCA bare 'track=' (que capturaba palabras como 'experience')
    /(?:tracking(?:_?num(?:ber)?|_?no|_?id|_?code)?|track(?:_?num(?:ber)?|_?no|_?id)|shipmentTracking(?:Number)?|carrierTrackingNumber|deliveryTrackingNumber|trknbr|tracknumbers?)["':=\s]+["']?([A-Za-z0-9_-]{8,40})["']?/gi
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (res.status === 429 || (res.url && res.url.includes('limitexceeded'))) {
        return { rateLimited: true };
      }
      if (!res.ok) continue;

      const html = await res.text();
      if (html.includes('limitexceeded') || html.includes('exceeded the number of requests')) {
        return { rateLimited: true };
      }

      // Enlaces a ups.com
      if (/ups\.com/i.test(html)) {
        const upsMatches = html.matchAll(/(?:ups\.com\/[^\s"']*?(?:tracknum|tracknums|inquirynumber\d*|tracknumbers?)=([0-9A-Za-z]+))/gi);
        for (const um of upsMatches) {
          if (isValidTrackingNumber(um[1], excluded)) {
            return {
              trackingNumber: um[1],
              courier: 'ups'
            };
          }
        }
      }

      // Enlaces a usps.com
      if (/usps\.com/i.test(html)) {
        const uspsMatches = html.matchAll(/(?:tools\.usps\.com\/[^\s"']*?(?:tLabels|origTrackNum)=([0-9A-Za-z+%-]+))/gi);
        for (const um of uspsMatches) {
          const cleanU = decodeURIComponent(um[1]).replace(/[\s+%-]/g, '');
          if (isValidTrackingNumber(cleanU, excluded)) {
            return {
              trackingNumber: cleanU,
              courier: 'usps'
            };
          }
        }
      }

      // Si la página menciona FedEx, buscar enlaces a fedex.com o 12 dígitos válidos
      if (/fedex/i.test(html)) {
        const fedexMatches = html.matchAll(/(?:fedex\.com\/[^\s"']*?(?:trknbr|tracknumbers?)=([0-9]{12,15}))/gi);
        for (const fm of fedexMatches) {
          if (isValidTrackingNumber(fm[1], excluded)) {
            return {
              trackingNumber: fm[1],
              courier: 'fedex'
            };
          }
        }
        const fMatches = html.matchAll(/(?:fedex[^\d]{0,25})([0-9]{12,15})\b/gi);
        for (const fm of fMatches) {
          if (isValidTrackingNumber(fm[1], excluded)) {
            return {
              trackingNumber: fm[1],
              courier: 'fedex'
            };
          }
        }
      }

      for (const p of patterns) {
        let match;
        while ((match = p.exec(html)) !== null) {
          const clean = (match[1] || match[0]).replace(/[\s-]/g, '');
          if (isValidTrackingNumber(clean, excluded)) {
            return {
              trackingNumber: clean,
              courier: detectCourier(clean)
            };
          }
        }
      }
    } catch (e) {
      console.warn(`[Smartbits] Error consultando tracking en ${url}:`, e);
    }
  }

  return null;
}

let isEnrichingTrackings = false;
async function enrichMissingTrackings() {
  if (isEnrichingTrackings) return;
  isEnrichingTrackings = true;

  try {
    const storageData = await chrome.storage.local.get(['sb_ebay_trackings_cache']);
    const cache = storageData.sb_ebay_trackings_cache || {};
    let cacheUpdated = false;

    // 1. Purgar entradas inválidas o contaminadas de la caché
    const trackingCounts = {};
    for (const ordId of Object.keys(cache)) {
      const trk = String(cache[ordId]?.trackingNumber || '').trim();
      // Eliminar palabras inválidas como 'experience', tracking sin dígitos o corruptos
      if (!trk || trk.toLowerCase() === 'experience' || trk.replace(/\D/g, '').length < 4 || !isValidTrackingNumber(trk)) {
        delete cache[ordId];
        cacheUpdated = true;
        continue;
      }
      trackingCounts[trk] = (trackingCounts[trk] || 0) + 1;
    }
    // Si un mismo tracking quedó guardado en múltiples órdenes distintas en la caché, purgar
    for (const ordId of Object.keys(cache)) {
      const trk = cache[ordId]?.trackingNumber;
      if (trk && trackingCounts[trk] > 1) {
        delete cache[ordId];
        cacheUpdated = true;
      }
    }

    // Identificar trackings confirmados presentes en el DOM de la página
    const activePageTrackings = new Map();
    detectedOrders.forEach(o => {
      if (o.tracking_usa && o.orderId) {
        activePageTrackings.set(o.tracking_usa, o.orderId);
      }
    });

    const missingIndices = [];
    detectedOrders.forEach((order, idx) => {
      const rawItemId = String(order.itemId || '').replace(/_u[0-9]+$/, '').trim();
      const rawOrderId = String(order.orderId || '').replace(/[\s-]/g, '').trim();

      // Si el pedido vino con un tracking erróneo igual a su itemId u orderId o 'experience', limpiarlo
      if (order.tracking_usa && (order.tracking_usa === rawItemId || order.tracking_usa === rawOrderId || order.tracking_usa.toLowerCase() === 'experience' || !isValidTrackingNumber(order.tracking_usa))) {
        order.tracking_usa = '';
        order.courier_usa = 'otro';
      }

      // Si la caché tenía guardado el itemId como tracking o tracking inválido, invalidar
      if (cache[order.orderId]) {
        const cachedTrk = String(cache[order.orderId].trackingNumber || '').trim();
        if (cachedTrk === rawItemId || cachedTrk === rawOrderId || cachedTrk.toLowerCase() === 'experience' || !isValidTrackingNumber(cachedTrk)) {
          delete cache[order.orderId];
          cacheUpdated = true;
        } else {
          // Si el tracking de la caché pertenece a otra orden confirmada en la página, invalidar para evitar contagio
          const owner = activePageTrackings.get(cachedTrk);
          if (owner && owner !== order.orderId) {
            delete cache[order.orderId];
            cacheUpdated = true;
          }
        }
      }

      if (!order.tracking_usa && order.orderId) {
        if (cache[order.orderId]) {
          order.tracking_usa = cache[order.orderId].trackingNumber;
          order.courier_usa = cache[order.orderId].courier;
          const badge = document.getElementById(`trk-badge-${idx}`);
          if (badge) {
            badge.className = 'tracking-tag';
            badge.style.cssText = 'background: #065f46; color: #a7f3d0; border: 1px solid #059669; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;';
            badge.innerText = `📦 ${order.courier_usa.toUpperCase()}: ${order.tracking_usa}`;
          }
        } else {
          // Protección estricta: NO bombardear eBay con peticiones automáticas para evitar limitexceeded
          const badge = document.getElementById(`trk-badge-${idx}`);
          if (badge) {
            badge.style.cssText = 'background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 2px 6px; border-radius: 4px; font-size: 10px;';
            badge.innerText = '⚪ Sin tracking en lista';
          }
        }
      }
    });

    if (cacheUpdated) {
      await chrome.storage.local.set({ sb_ebay_trackings_cache: cache });
    }
  } catch (err) {
    console.error('Error enriqueciendo trackings:', err);
  } finally {
    isEnrichingTrackings = false;
  }
}

function renderOrders(orders) {
  // Ordenar estrictamente por fecha de orden descendente (más reciente primero),
  // y por orden visual de aparición en la página de eBay para compras de la misma fecha
  detectedOrders = (orders || []).slice().sort((a, b) => {
    const timeA = a.fecha_compra ? new Date(a.fecha_compra).getTime() : 0;
    const timeB = b.fecha_compra ? new Date(b.fecha_compra).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;

    const cardA = a.cardIndex !== undefined ? a.cardIndex : 9999;
    const cardB = b.cardIndex !== undefined ? b.cardIndex : 9999;
    if (cardA !== cardB) return cardA - cardB;

    const itemA = a.itemIndex !== undefined ? a.itemIndex : 0;
    const itemB = b.itemIndex !== undefined ? b.itemIndex : 0;
    return itemA - itemB;
  });

  // Validación de seguridad: en eBay cada pedido diferente tiene su propio tracking.
  // Si el mismo tracking aparece en órdenes con orderId diferente, se invalida de inmediato.
  const trkOwners = new Map();
  for (const o of detectedOrders) {
    if (o.tracking_usa && o.orderId) {
      const owner = trkOwners.get(o.tracking_usa);
      if (owner && owner !== o.orderId) {
        trkOwners.set(o.tracking_usa, 'COLLISION');
      } else if (!owner) {
        trkOwners.set(o.tracking_usa, o.orderId);
      }
    }
  }
  for (const o of detectedOrders) {
    if (o.tracking_usa && trkOwners.get(o.tracking_usa) === 'COLLISION') {
      console.warn(`[Smartbits] Descartando tracking contaminado ${o.tracking_usa} en orden ${o.orderId}`);
      o.tracking_usa = '';
      o.courier_usa = 'otro';
    }
  }

  ordersCountLabel.innerText = `${detectedOrders.length} compras`;

  if (detectedOrders.length === 0) {
    ordersContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 30px 15px; font-size: 12px; line-height: 1.5;">
        <div style="font-size: 28px; margin-bottom: 8px;">🔍</div>
        <strong style="color: var(--text-main); font-size: 13px;">No se detectaron pedidos en esta pestaña</strong>
        <p style="margin-top: 6px; font-size: 11px;">Asegúrate de tener seleccionada la pestaña de <strong>Purchase History</strong> de eBay (o el detalle de una orden) y presiona <strong>F5</strong> para refrescar.</p>
        <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 8px; align-items: center;">
          <button id="btn-re-scan" style="background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 11px; font-weight: bold; cursor: pointer;">
            🔄 Reintentar Escaneo
          </button>
          <a href="https://www.ebay.com/mye/myebay/purchase" target="_blank" style="color: #60a5fa; text-decoration: underline; font-size: 11px;">
            Abrir Purchase History de eBay ↗
          </a>
        </div>
      </div>
    `;
    const btnReScan = document.getElementById('btn-re-scan');
    if (btnReScan) {
      btnReScan.onclick = () => initSyncScanning(true);
    }
    btnSync.disabled = true;
    syncBtnText.innerText = 'Selecciona al menos una compra';
    return;
  }

  ordersContainer.innerHTML = '';
  detectedOrders.forEach((order, index) => {
    const card = document.createElement('div');
    card.className = 'order-card selected';
    card.id = `card-order-${index}`;

    const safeTitle = escapeHtml(order.titulo);
    const safePrice = Number(order.precio || 0).toFixed(2);
    const safeDate = escapeHtml(order.fecha_compra || 'Reciente');
    const safeImg = (order.foto_url && order.foto_url.startsWith('http')) ? order.foto_url : placeholderImg;
    const safeTrackUrl = order.trackHref || (order.orderId ? `https://www.ebay.com/cnt/TrackPackage?orderId=${encodeURIComponent(order.orderId)}` : '');

    let trkBadgeHtml = '';
    const isAwaiting = Boolean(order.isAwaitingShipment || 
                               order.shipping_status === 'awaiting_shipment' || 
                               (!order.tracking_usa && !order.isDelivered && !order.trackHref));

    if (order.tracking_usa) {
      trkBadgeHtml = `
        <span class="tracking-tag" id="trk-badge-${index}" style="background: #065f46; color: #a7f3d0; border: 1px solid #059669; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">📦 ${(order.courier_usa || 'OTRO').toUpperCase()}: ${escapeHtml(order.tracking_usa)}</span>
        <button type="button" class="btn-edit-trk" data-index="${index}" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 11px; padding: 0 4px;" title="Editar tracking">✏️</button>
      `;
    } else if (isAwaiting) {
      trkBadgeHtml = `
        <span id="trk-badge-${index}" style="background: #451a03; color: #fde047; border: 1px solid #b45309; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;" title="El vendedor aún no ha emitido el tracking en eBay (Awaiting shipment)">⏳ Awaiting shipment</span>
        <button type="button" class="btn-edit-trk" data-index="${index}" style="background: #1e293b; border: 1px solid #475569; color: #60a5fa; cursor: pointer; font-size: 10px; padding: 1px 6px; border-radius: 4px;" title="Pegar número de guía manualmente si ya la tienes">✏️ Pegar</button>
      `;
    } else {
      trkBadgeHtml = `
        <span id="trk-badge-${index}" style="background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 2px 6px; border-radius: 4px; font-size: 10px;">⚪ Sin tracking en lista</span>
        ${safeTrackUrl ? `<a href="${safeTrackUrl}" target="_blank" class="btn-view-ebay" style="background: #1e293b; border: 1px solid #475569; color: #93c5fd; font-size: 10px; padding: 1px 6px; border-radius: 4px; text-decoration: none; display: inline-flex; align-items: center; gap: 2px;" title="Abrir en eBay para capturar guía automáticamente">🔍 Ver en eBay</a>` : ''}
        <button type="button" class="btn-edit-trk" data-index="${index}" style="background: #1e293b; border: 1px solid #475569; color: #60a5fa; cursor: pointer; font-size: 10px; padding: 1px 6px; border-radius: 4px;" title="Pegar número de guía manualmente">✏️ Pegar</button>
      `;
    }

    card.innerHTML = `
      <input type="checkbox" class="order-chk" data-index="${index}" checked style="cursor: pointer;" />
      <img class="order-img" src="${safeImg}" alt="" />
      <div class="order-info">
        <div class="order-title" title="${safeTitle}">${safeTitle}</div>
        <div class="order-meta">
          <span class="price-tag">$${safePrice}</span>
          <span>📅 ${safeDate}</span>
          ${trkBadgeHtml}
        </div>
      </div>
    `;

    const imgEl = card.querySelector('.order-img');
    if (imgEl) {
      imgEl.onerror = function() {
        if (this.src !== placeholderImg) {
          this.src = placeholderImg;
        }
      };
    }

    const chk = card.querySelector('.order-chk');
    const editBtn = card.querySelector('.btn-edit-trk');
    if (editBtn) {
      editBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const currentTrk = order.tracking_usa || '';
        const input = prompt(`Ingresa o pega el número de tracking para "${safeTitle}":`, currentTrk);
        if (input !== null) {
          const cleanTrk = input.trim().replace(/[\s-]/g, '');
          if (cleanTrk) {
            order.tracking_usa = cleanTrk;
            order.courier_usa = detectCourier(cleanTrk);

            // Guardar en caché persistente
            try {
              const data = await chrome.storage.local.get(['sb_ebay_trackings_cache']);
              const cache = data.sb_ebay_trackings_cache || {};
              cache[order.orderId] = {
                trackingNumber: order.tracking_usa,
                courier: order.courier_usa
              };
              await chrome.storage.local.set({ sb_ebay_trackings_cache: cache });
            } catch (_) {}

            const badge = document.getElementById(`trk-badge-${index}`);
            if (badge) {
              badge.className = 'tracking-tag';
              badge.style.cssText = 'background: #065f46; color: #a7f3d0; border: 1px solid #059669; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;';
              badge.innerText = `📦 ${order.courier_usa.toUpperCase()}: ${order.tracking_usa}`;
            }
          }
        }
      });
    }

    card.addEventListener('click', (e) => {
      if (e.target !== chk && !e.target.closest('.btn-edit-trk') && !e.target.closest('.btn-view-ebay')) {
        chk.checked = !chk.checked;
      }
      if (chk.checked) card.classList.add('selected');
      else card.classList.remove('selected');
      updateSyncButtonState();
    });

    ordersContainer.appendChild(card);
  });

  updateSyncButtonState();

  // Enriquecer en segundo plano los trackings de órdenes delivered o sin tracking directo
  enrichMissingTrackings();
}

function updateSyncButtonState() {
  const selectedCount = getSelectedOrders().length;
  btnSync.disabled = selectedCount === 0;
  syncBtnText.innerText = selectedCount > 0 
    ? `Sincronizar (${selectedCount}) con Smartbits` 
    : 'Selecciona al menos una compra';
}

function getSelectedOrders() {
  const checkboxes = ordersContainer.querySelectorAll('.order-chk:checked');
  const selected = [];
  checkboxes.forEach(chk => {
    const idx = parseInt(chk.getAttribute('data-index'));
    if (detectedOrders[idx]) {
      selected.push(detectedOrders[idx]);
    }
  });
  return selected;
}

// --- FIRESTORE SYNC ---

function formatFirestoreFields(order) {
  let cleanTracking = String(order.tracking_usa || '').trim();
  const rawItemId = String(order.itemId || '').replace(/_u[0-9]+$/, '').trim();
  const rawOrderId = String(order.orderId || '').replace(/[\s-]/g, '').trim();

  // Si el tracking coincide con el itemId u orderId, descartarlo
  if (cleanTracking === rawItemId || cleanTracking === rawOrderId) {
    cleanTracking = '';
  }

  if (cleanTracking.startsWith('{') || cleanTracking.startsWith('[') || cleanTracking.includes('EVENTFAMILY') || cleanTracking.includes('"') || cleanTracking.length > 40) {
    cleanTracking = '';
  }

  const fields = {
    orderId: { stringValue: String(order.orderId || '') },
    itemId: { stringValue: String(order.itemId || '') },
    titulo: { stringValue: String(order.titulo || '') },
    precio: { doubleValue: Number(order.precio || 0) },
    fecha_compra: { stringValue: String(order.fecha_compra || '') },
    vendedor: { stringValue: String(order.vendedor || '') },
    foto_url: { stringValue: String(order.foto_url || '') },
    item_url: { stringValue: String(order.item_url || '') },
    tracking_usa: { stringValue: cleanTracking },
    courier_usa: { stringValue: cleanTracking ? String(order.courier_usa || 'otro') : 'otro' },
    fecha_sincronizacion: { timestampValue: new Date().toISOString() }
  };

  if (order.isAwaitingShipment || order.shipping_status === 'awaiting_shipment') {
    fields.shipping_status = { stringValue: 'awaiting_shipment' };
  }

  return fields;
}

async function syncOrderToFirestore(order) {
  const uniqueKey = order.uniqueKey || (order.itemId ? `${order.orderId}_${order.itemId}` : `${order.orderId || 'ord'}`);
  const safeDocKey = String(uniqueKey).replace(/[^a-zA-Z0-9_-]/g, '_');
  const docId = `ebay_${safeDocKey}`;
  const docUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/compras_ebay/${docId}`;

  let actualDocUrl = docUrl;
  let targetDocId = docId;

  // 1. Verificar si ya existe con el nuevo formato de ID
  let getRes = await fetch(docUrl, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${currentToken}` }
  });

  // 2. Si no existe, comprobar si existía bajo el formato anterior ebay_{orderId} para no duplicar
  if (getRes.status === 404 && order.orderId) {
    const legacyDocId = `ebay_${String(order.orderId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    if (legacyDocId !== docId) {
      const legacyUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/compras_ebay/${legacyDocId}`;
      const legacyRes = await fetch(legacyUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (legacyRes.ok) {
        getRes = legacyRes;
        actualDocUrl = legacyUrl;
        targetDocId = legacyDocId;
      }
    }
  }

  if (!getRes.ok && getRes.status !== 404) {
    let errMsg = `Error HTTP ${getRes.status}`;
    try {
      const errJson = await getRes.json();
      errMsg = errJson.error?.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const fields = formatFirestoreFields(order);

  if (getRes.status === 404) {
    // Documento nuevo: estado pendiente
    fields.estado = { stringValue: 'pendiente' };
    fields.tipo_inventario = { stringValue: '' };
    fields.inventario_id = { stringValue: '' };
    fields.tracking_id = { stringValue: '' };

    const postUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/compras_ebay?documentId=${targetDocId}`;
    const createRes = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    });

    if (!createRes.ok) {
      let errMsg = `Error guardando (HTTP ${createRes.status})`;
      try {
        const errJson = await createRes.json();
        errMsg = errJson.error?.message || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }
    return 'created';
  } else {
    // Ya existe: actualizar datos manteniendo estado
    const existingDoc = await getRes.json();
    const existingTracking = existingDoc.fields?.tracking_usa?.stringValue;

    const rawItemId = String(order.itemId || '').replace(/_u[0-9]+$/, '').trim();
    const rawOrderId = String(order.orderId || '').replace(/[\s-]/g, '').trim();

    const fieldPaths = ['titulo', 'precio', 'fecha_compra', 'vendedor', 'foto_url', 'item_url', 'itemId', 'fecha_sincronizacion'];
    const isCorruptedExisting = existingTracking && (
      existingTracking.startsWith('{') || 
      existingTracking.includes('EVENTFAMILY') ||
      existingTracking === rawItemId ||
      existingTracking === rawOrderId
    );
    const safeOrderTracking = (order.tracking_usa || '').trim();
    if ((safeOrderTracking && safeOrderTracking !== existingTracking) || isCorruptedExisting) {
      fieldPaths.push('tracking_usa');
      fieldPaths.push('courier_usa');
    }

    const maskParams = fieldPaths.map(f => `updateMask.fieldPaths=${f}`).join('&');
    const patchUrl = `${actualDocUrl}?${maskParams}`;

    const updateRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${currentToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    });

    if (!updateRes.ok) {
      let errMsg = `Error actualizando (HTTP ${updateRes.status})`;
      try {
        const errJson = await updateRes.json();
        errMsg = errJson.error?.message || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }
    return 'updated';
  }
}

async function handleSyncClick() {
  const selected = getSelectedOrders();
  if (selected.length === 0) return;

  btnSync.disabled = true;
  syncSpinner.style.display = 'inline-block';
  syncBtnText.innerText = 'Sincronizando...';
  syncAlert.style.display = 'none';

  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  let firstError = '';

  for (let i = 0; i < selected.length; i++) {
    const order = selected[i];
    syncBtnText.innerText = `Sincronizando ${i + 1}/${selected.length}...`;
    try {
      const result = await syncOrderToFirestore(order);
      if (result === 'created') createdCount++;
      else updatedCount++;
    } catch (e) {
      console.error('Error sincronizando orden:', order, e);
      if (!firstError) firstError = e.message;
      errorCount++;
    }
  }

  syncSpinner.style.display = 'none';
  btnSync.disabled = false;
  syncBtnText.innerText = 'Sincronizar Seleccionadas con Smartbits';

  syncAlert.style.display = 'flex';
  if (errorCount === 0) {
    syncAlert.className = 'alert alert-success';
    syncAlert.innerHTML = `✅ ¡Sincronizado con éxito! <strong>${createdCount} nuevas</strong> añadidas y ${updatedCount} actualizadas.`;
  } else {
    syncAlert.className = 'alert alert-error';
    syncAlert.innerHTML = `⚠️ Sincronizados: ${createdCount + updatedCount}. Errores: ${errorCount}.<br><strong style="font-size:10px; margin-top:2px;">Detalle: ${firstError}</strong>`;
  }
}

// --- EVENT LISTENERS ---

btnLogin.addEventListener('click', async () => {
  const email = loginEmail.value;
  const pass = loginPass.value;
  if (!email || !pass) {
    loginAlert.style.display = 'block';
    loginAlert.innerText = 'Ingresa correo y contraseña';
    return;
  }

  loginAlert.style.display = 'none';
  btnLogin.disabled = true;
  btnLogin.innerText = 'Conectando...';

  try {
    await loginAdmin(email, pass);
  } catch (err) {
    loginAlert.style.display = 'block';
    loginAlert.innerText = 'Error: ' + err.message;
  } finally {
    btnLogin.disabled = false;
    btnLogin.innerText = 'Iniciar Sesión';
  }
});

btnLogout.addEventListener('click', async () => {
  await chrome.storage.local.remove(['sb_token', 'sb_refresh_token', 'sb_email', 'sb_expires_at']);
  currentToken = null;
  currentEmail = null;
  showLoginView();
});

btnGotoEbay.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.ebay.com/mye/buy/purchase-history' });
});

btnReextract.addEventListener('click', async () => {
  await chrome.storage.local.remove(['sb_ebay_trackings_cache']);
  initSyncScanning(true);
});

btnSelectAll.addEventListener('click', () => {
  const checkboxes = ordersContainer.querySelectorAll('.order-chk');
  const allChecked = Array.from(checkboxes).every(c => c.checked);
  checkboxes.forEach(c => {
    c.checked = !allChecked;
    const card = document.getElementById(`card-order-${c.getAttribute('data-index')}`);
    if (card) {
      if (!allChecked) card.classList.add('selected');
      else card.classList.remove('selected');
    }
  });
  btnSelectAll.innerText = allChecked ? 'Todas' : 'Ninguna';
  updateSyncButtonState();
});

btnSync.addEventListener('click', handleSyncClick);

// Initialize
checkAuthSession();
