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

async function initSyncScanning() {
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

function renderOrders(orders) {
  detectedOrders = orders || [];
  ordersCountLabel.innerText = `${detectedOrders.length} compras`;

  if (detectedOrders.length === 0) {
    ordersContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 45px 15px; font-size: 12px; line-height: 1.5;">
        No se encontraron pedidos en la vista actual.<br>
        Asegúrate de estar en <strong>Purchase History</strong> de eBay.
      </div>
    `;
    btnSync.disabled = true;
    return;
  }

  ordersContainer.innerHTML = '';
  detectedOrders.forEach((order, index) => {
    const card = document.createElement('div');
    card.className = 'order-card selected';
    card.id = `card-order-${index}`;

    const placeholderImg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="%2364748b" stroke-width="1.5"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>';

    card.innerHTML = `
      <input type="checkbox" class="order-chk" data-index="${index}" checked style="cursor: pointer;" />
      <img class="order-img" src="${order.foto_url || placeholderImg}" onerror="this.src='${placeholderImg}'" alt="" />
      <div class="order-info">
        <div class="order-title" title="${order.titulo}">${order.titulo}</div>
        <div class="order-meta">
          <span class="price-tag">$${Number(order.precio).toFixed(2)}</span>
          <span>📅 ${order.fecha_compra || 'Reciente'}</span>
          ${order.tracking_usa ? `<span class="tracking-tag">📦 ${order.courier_usa.toUpperCase()}: ${order.tracking_usa}</span>` : ''}
        </div>
      </div>
    `;

    const chk = card.querySelector('.order-chk');

    // Click on card toggles checkbox
    card.addEventListener('click', (e) => {
      if (e.target !== chk) {
        chk.checked = !chk.checked;
      }
      if (chk.checked) card.classList.add('selected');
      else card.classList.remove('selected');
      updateSyncButtonState();
    });

    ordersContainer.appendChild(card);
  });

  updateSyncButtonState();
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
  return {
    orderId: { stringValue: String(order.orderId || '') },
    itemId: { stringValue: String(order.itemId || '') },
    titulo: { stringValue: String(order.titulo || '') },
    precio: { doubleValue: Number(order.precio || 0) },
    fecha_compra: { stringValue: String(order.fecha_compra || '') },
    vendedor: { stringValue: String(order.vendedor || '') },
    foto_url: { stringValue: String(order.foto_url || '') },
    item_url: { stringValue: String(order.item_url || '') },
    tracking_usa: { stringValue: String(order.tracking_usa || '') },
    courier_usa: { stringValue: String(order.courier_usa || 'otro') },
    fecha_sincronizacion: { timestampValue: new Date().toISOString() }
  };
}

async function syncOrderToFirestore(order) {
  const uniqueKey = order.uniqueKey || (order.itemId ? `${order.orderId}_${order.itemId}` : `${order.orderId || 'ord'}`);
  const safeDocKey = String(uniqueKey).replace(/[^a-zA-Z0-9_-]/g, '_');
  const docId = `ebay_${safeDocKey}`;
  const docUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/compras_ebay/${docId}`;

  // 1. Verificar si ya existe para no sobrescribir inventario
  const getRes = await fetch(docUrl, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${currentToken}` }
  });

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

    const postUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/compras_ebay?documentId=${docId}`;
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

    const fieldPaths = ['titulo', 'precio', 'fecha_compra', 'vendedor', 'foto_url', 'item_url', 'fecha_sincronizacion'];
    if (order.tracking_usa && (!existingTracking || existingTracking !== order.tracking_usa)) {
      fieldPaths.push('tracking_usa');
      fieldPaths.push('courier_usa');
    }

    const maskParams = fieldPaths.map(f => `updateMask.fieldPaths=${f}`).join('&');
    const patchUrl = `${docUrl}?${maskParams}`;

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

btnReextract.addEventListener('click', () => {
  initSyncScanning();
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
