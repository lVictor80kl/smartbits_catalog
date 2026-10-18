/**
 * Smartbits - Detector y Sincronizador de Entregas UPS
 * Captura el estatus de entrega en https://www.ups.com/track y lo sincroniza en tiempo real
 * con el panel administrativo de Smartbits (marcando el paquete como entregado en Miami).
 */

(function () {
  if (window.__SMARTBITS_UPS_TRACKING_LOADED__) return;
  window.__SMARTBITS_UPS_TRACKING_LOADED__ = true;

  // 1. Obtener número de tracking de UPS
  function getTrackingNumber() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paramTrack = urlParams.get('tracknum') || urlParams.get('trackNumbers');
      if (paramTrack) return paramTrack.trim().toUpperCase();

      const matchUrl = window.location.href.match(/tracknum=([A-Za-z0-9]+)/i);
      if (matchUrl) return matchUrl[1].trim().toUpperCase();

      // Buscar 1Z en el DOM
      const textMatch = document.body?.innerText?.match(/\b(1Z[0-9A-Z]{16})\b/i);
      if (textMatch) return textMatch[1].trim().toUpperCase();
    } catch (_) {}
    return null;
  }

  // 2. Buscar el elemento de estatus según el selector oficial y XPath de UPS
  function getStatusElement() {
    // A. XPath exacto provisto por el usuario
    try {
      const xpath = '/html/body/div[3]/div/div/div/div/div/div/div/main/div[2]/div/app-root/div/app-track-details/div[1]/div[2]/div/app-header-tile/div/div/span';
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (result && result.singleNodeValue && result.singleNodeValue.textContent.trim()) {
        return result.singleNodeValue;
      }
    } catch (_) {}

    // B. Selectores CSS de la aplicación Angular de UPS
    const selectors = [
      'app-track-details app-header-tile div div span',
      'app-track-details app-header-tile span',
      'app-header-tile .ups-header_tile-status',
      'app-header-tile div div span',
      '[data-testid="header-status"]',
      '.ups-card .ups-header_tile-status',
      '.ups-status-badge'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        return el;
      }
    }

    return null;
  }

  // 3. Mostrar banner flotante en la pestaña de UPS
  function showNotification(msg, isSuccess = true) {
    if (document.getElementById('smartbits-ups-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'smartbits-ups-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.zIndex = '999999';
    toast.style.padding = '12px 18px';
    toast.style.borderRadius = '12px';
    toast.style.backgroundColor = isSuccess ? '#0f172a' : '#881337';
    toast.style.color = '#ffffff';
    toast.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)';
    toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    toast.style.fontSize = '13px';
    toast.style.fontWeight = '600';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    toast.style.border = isSuccess ? '1px solid #10b981' : '1px solid #f43f5e';
    toast.style.transition = 'all 0.3s ease';

    toast.innerHTML = `
      <span style="font-size: 16px;">${isSuccess ? '⚡' : '⚠️'}</span>
      <span>${msg}</span>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 400);
    }, 7000);
  }

  let yaSincronizado = false;

  function verificarEstatusUps() {
    if (yaSincronizado) return;

    const trackingNumber = getTrackingNumber();
    const statusEl = getStatusElement();

    if (!trackingNumber || !statusEl) return;

    const rawText = statusEl.textContent.trim();
    const cleanLower = rawText.toLowerCase();

    // Comprobar si UPS indica entregado
    if (cleanLower.includes('delivered') || cleanLower.includes('entregado')) {
      yaSincronizado = true;

      chrome.runtime.sendMessage({
        action: 'sync_ups_status',
        trackingNumber: trackingNumber,
        status: 'Delivered',
        rawStatus: rawText
      }, (resp) => {
        if (resp && resp.success) {
          showNotification(`Smartbits: Tracking ${trackingNumber} sincronizado como Entregado en Miami.`);
        } else {
          showNotification(`Smartbits: Detectado Delivered en UPS (${trackingNumber}).`, true);
        }
      });
    }
  }

  // Ejecutar de inmediato y observar cambios en el DOM de Angular
  verificarEstatusUps();

  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    verificarEstatusUps();
    if (yaSincronizado || attempts > 20) {
      clearInterval(interval);
    }
  }, 1000);

  const observer = new MutationObserver(() => {
    verificarEstatusUps();
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
})();
