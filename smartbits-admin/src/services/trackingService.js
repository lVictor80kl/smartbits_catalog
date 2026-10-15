// src/services/trackingService.js
// Servicio automatizado de rastreo de envíos y detección de guías VZLA (Liberty Express / Couriers USA)

import { doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

/**
 * Normaliza un número de tracking eliminando espacios y guiones.
 */
export function cleanTrackingNumber(str) {
  if (!str) return '';
  const s = String(str).trim();
  // Preservar guiones en códigos tipo WR01-502771879, WRTMP-502794637, LIB-1234
  if (/^[A-Za-z0-9]+-[A-Za-z0-9]+$/i.test(s)) {
    return s.replace(/\s+/g, '').toUpperCase();
  }
  return s.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Parsea el HTML devuelto por Liberty Express (iQPack).
 * Compatible tanto con DOMParser en navegador como con regex de respaldo.
 */
export function parseLibertyHtml(html, trackingBuscado = '') {
  if (!html || typeof html !== 'string') {
    return {
      found: false,
      trackingVzla: null,
      ultimoEstado: null,
      fechaEstado: null,
      sucursal: null,
      historial: [],
      isDelivered: false,
      isPrealertOnly: false,
      isInMiami: false,
      hasMovements: false
    };
  }

  let docParsed = null;
  if (typeof window !== 'undefined' && window.DOMParser) {
    try {
      const parser = new window.DOMParser();
      docParsed = parser.parseFromString(html, 'text/html');
    } catch (_) {}
  }

  // 1. Detección de Guía VZLA (ID de seguimiento)
  let trackingVzla = null;
  if (docParsed) {
    const summaryP = docParsed.querySelector('.tr-summary p, section[aria-label="Estado actual"] p');
    if (summaryP) {
      const strongEl = summaryP.querySelector('strong');
      if (strongEl && strongEl.textContent.trim()) {
        trackingVzla = strongEl.textContent.trim();
      } else {
        const match = summaryP.textContent.match(/ID de seguimiento:\s*([A-Za-z0-9_-]+)/i);
        if (match) trackingVzla = match[1].trim();
      }
    }
  }

  if (!trackingVzla) {
    const idRegex = /(?:ID de seguimiento|N[úu]mero de gu[íi]a|Gu[íi]a):\s*<[^>]*>([A-Za-z0-9_-]+)<\/[^>]*>/i;
    const match = html.match(idRegex);
    if (match) trackingVzla = match[1].trim();
    else {
      const plainMatch = html.match(/ID de seguimiento:\s*([A-Za-z0-9_-]+)/i);
      if (plainMatch) trackingVzla = plainMatch[1].trim();
    }
  }

  // 2. Detección del Último Estatus LITERAL tal como lo reporta el courier
  let ultimoEstado = null;
  if (docParsed) {
    const h2 = docParsed.querySelector('.tr-summary h2, section[aria-label="Estado actual"] h2');
    if (h2 && h2.textContent.trim()) {
      ultimoEstado = h2.textContent.trim();
    }
  }

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#xED;/gi, 'í')
    .replace(/&#xE1;/gi, 'á')
    .replace(/&#xE9;/gi, 'é')
    .replace(/&#xF3;/gi, 'ó')
    .replace(/&#xFA;/gi, 'ú')
    .replace(/&#xF1;/gi, 'ñ')
    .replace(/&iacute;/gi, 'í')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

  if (!ultimoEstado) {
    const h2Regex = /<section[^>]*class=["'][^"']*tr-summary[^"']*["'][^>]*>[\s\S]*?<h2>([^<]+)<\/h2>/i;
    const matchH2 = html.match(h2Regex);
    if (matchH2) ultimoEstado = matchH2[1].trim();
  }

  if (ultimoEstado) {
    ultimoEstado = decodeHtmlEntities(ultimoEstado);
  }

  // Si no se encuentra estatus explícito en el resumen, buscar en título o timeline
  if (!ultimoEstado && html.includes('Sin movimientos registrados')) {
    ultimoEstado = 'Sin movimientos registrados en Liberty';
  }

  // 3. Historial de eventos y fecha más reciente
  const historial = [];
  let fechaEstado = null;

  if (docParsed) {
    const items = docParsed.querySelectorAll('.tr-timeline li');
    items.forEach((li, idx) => {
      const timeEl = li.querySelector('time');
      const h3El = li.querySelector('h3');
      const descEl = li.querySelector('.tr-details, p');

      const fecha = timeEl ? timeEl.textContent.trim() : '';
      const titulo = h3El ? h3El.textContent.trim() : '';
      const detalle = descEl ? descEl.textContent.trim() : '';

      if (fecha || titulo) {
        historial.push({ fecha, titulo, detalle });
        if (idx === 0 && fecha) fechaEstado = fecha;
      }
    });

    // Sucursal de entrega o destino
    const contactH3 = docParsed.querySelector('.tr-contact h3, .tr-contact p');
    if (contactH3) {
      sucursal = contactH3.textContent.trim();
    }
  } else {
    // Regex fallback para timeline
    const timelineRegex = /<li[^>]*>[\s\S]*?<time[^>]*>([^<]+)<\/time>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/gi;
    let m;
    while ((m = timelineRegex.exec(html)) !== null) {
      historial.push({ fecha: m[1].trim(), titulo: m[2].trim(), detalle: '' });
      if (!fechaEstado) fechaEstado = m[1].trim();
    }
  }

  let sucursal = null;
  const sucursalMatch = html.match(/(?:Sucursal|Agencia|Destino):\s*<[^>]*>([^<]+)<\/[^>]*>/i);
  if (sucursalMatch) sucursal = sucursalMatch[1].trim();

  // 4. Analizar indicadores clave (Prealerta / Delivered / Miami / Tránsito VZLA)
  const fullTextUpper = `${ultimoEstado || ''} ${historial.map(h => `${h.titulo} ${h.detalle}`).join(' ')}`.toUpperCase();

  const isSinMovimientos = (
    fullTextUpper.includes('SIN MOVIMIENTOS') ||
    fullTextUpper.includes('EL NÚMERO DE LA GUÍA NO EXISTE') ||
    fullTextUpper.includes('NO EXISTE, POR FAVOR INGRESE') ||
    fullTextUpper.includes('NO EXISTE') ||
    html.includes('tr-empty')
  );

  const hasMovements = historial.length > 0 || (!isSinMovimientos && Boolean(ultimoEstado) && !ultimoEstado.includes('no existe'));

  // Indicador de solo pre-alertado (aún viajando con el courier USA hacia Miami)
  const isPrealertOnly = (
    fullTextUpper.includes('GUÍA PRE ALERTADA') ||
    fullTextUpper.includes('GUIA PRE ALERTADA') ||
    fullTextUpper.includes('ESPERANDO PAQUETE') ||
    (Boolean(trackingVzla && trackingVzla.startsWith('WRTMP-')) && !fullTextUpper.includes('RECIBIDO EN') && !fullTextUpper.includes('CENTRO DE DISTRIBUCION'))
  );

  const isDelivered = (
    fullTextUpper.includes('ENTREGAD') ||
    fullTextUpper.includes('ENTREGA REALIZADA') ||
    fullTextUpper.includes('RETIRADO POR') ||
    fullTextUpper.includes('RETIRADO EN AGENCIA') ||
    fullTextUpper.includes('PAQUETE RETIRADO') ||
    fullTextUpper.includes('FACTURAD')
  );

  const isDisponible = (
    fullTextUpper.includes('DISPONIBLE EN AGENCIA') ||
    fullTextUpper.includes('DISPONIBLE EN SUCURSAL') ||
    fullTextUpper.includes('LISTO PARA RETIRO') ||
    (fullTextUpper.includes('DISPONIBLE') && !fullTextUpper.includes('NO DISPONIBLE'))
  );

  const isTransitoVzla = (
    fullTextUpper.includes('A BORDO') ||
    fullTextUpper.includes('TRANSPORTADO A SU DESTINO') ||
    fullTextUpper.includes('LISTO PARA SER EMBARCADO') ||
    fullTextUpper.includes('EMBARCADO') ||
    fullTextUpper.includes('EMPACADO') ||
    fullTextUpper.includes('EN VUELO') ||
    fullTextUpper.includes('EN BARCO') ||
    fullTextUpper.includes('DESPACHADO A VENEZUELA') ||
    fullTextUpper.includes('DESPACHADO') ||
    fullTextUpper.includes('TRANSITO INTERNACIONAL') ||
    fullTextUpper.includes('TRANSITO A VENEZUELA') ||
    fullTextUpper.includes('EN ADUANA') ||
    fullTextUpper.includes('NACIONALIZACION')
  );

  // Físicamente recibido en almacén Miami (SOLO si NO es únicamente prealerta en espera)
  const isInMiami = !isPrealertOnly && (
    isDelivered ||
    isDisponible ||
    isTransitoVzla ||
    fullTextUpper.includes('RECIBIDO EN CENTRO DE DISTRIBUCION') ||
    fullTextUpper.includes('CENTRO DE DISTRIBUCION') ||
    fullTextUpper.includes('RECIBIDO EN SEDE') ||
    fullTextUpper.includes('RECIBIDO EN ALMACEN') ||
    fullTextUpper.includes('RECIBIDO EN MIAMI') ||
    fullTextUpper.includes('ALMACEN MIAMI') ||
    fullTextUpper.includes('PROCESADO MIAMI') ||
    fullTextUpper.includes('MIAMI')
  );

  // Se considera encontrado si tiene guía real o si presenta movimientos y no es mensaje de error
  const found = (Boolean(trackingVzla && trackingVzla !== 'WRTMP-000000') || hasMovements || isInMiami || isPrealertOnly) && !isSinMovimientos;

  return {
    found,
    trackingBuscado,
    trackingVzla: trackingVzla || (found && trackingBuscado ? trackingBuscado : null),
    ultimoEstado: ultimoEstado || (found ? (isTransitoVzla ? 'A bordo, para ser transportado a su destino' : (isInMiami ? 'Recibido en Almacén Miami' : (isPrealertOnly ? 'Guía pre alertada, esperando paquete' : 'Registrado en Liberty Express'))) : 'Sin movimientos'),
    fechaEstado: fechaEstado || (historial[0]?.fecha || null),
    sucursal,
    historial,
    isDelivered,
    isDisponible,
    isTransitoVzla,
    isPrealertOnly,
    isInMiami,
    hasMovements
  };
}

/**
 * Consulta a Liberty Express (iQPack) utilizando la guía o el Tracking USA.
 * Soporta endpoint proxy de Vite (/api/liberty/query) con fallback directo.
 */
export async function consultarLibertyTracking(trackingNumber) {
  const clean = cleanTrackingNumber(trackingNumber);
  if (!clean) {
    return { success: false, error: 'Número de guía o tracking vacío' };
  }

  // 1. Probar el endpoint unificado de proxy local de Vite (/api/liberty/query?guide=...)
  try {
    const proxyQueryUrl = `/api/liberty/query?guide=${encodeURIComponent(clean)}`;
    const resp = await fetch(proxyQueryUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data && data.html) {
        const parsed = parseLibertyHtml(data.html, clean);
        return {
          success: true,
          ...parsed,
          source: 'vite-proxy'
        };
      }
    }
  } catch (err) {
    // Si no está disponible el proxy, continuar al fallback
  }

  // 2. Fallback de 2 pasos con manejo de cookies y token
  const endpoints = [
    { base: '/api/liberty', isProxy: true },
    { base: 'https://iqpack.libertyexpress.com', isProxy: false }
  ];

  let lastError = null;

  for (const ep of endpoints) {
    try {
      const trackingPageUrl = `${ep.base}/Tracking`;
      const getResp = await fetch(trackingPageUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      if (!getResp.ok) {
        throw new Error(`HTTP ${getResp.status} al cargar página de Tracking`);
      }

      const getHtml = await getResp.text();
      const tokenMatch = getHtml.match(/name=["']__RequestVerificationToken["']\s+type=["']hidden["']\s+value=["']([^"']+)["']/i) ||
                         getHtml.match(/value=["']([^"']+)["']\s+name=["']__RequestVerificationToken["']/i);
      const token = tokenMatch ? tokenMatch[1] : '';

      const searchUrl = `${ep.base}/SearchGuide`;
      const formData = new URLSearchParams();
      if (token) formData.append('__RequestVerificationToken', token);
      formData.append('FromMobileApp', 'False');
      formData.append('FromReactApp', 'True');
      formData.append('hreflang', '');
      formData.append('NGuia', clean);

      const postResp = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        body: formData.toString()
      });

      if (!postResp.ok) {
        throw new Error(`HTTP ${postResp.status} al consultar SearchGuide`);
      }

      const postHtml = await postResp.text();
      const parsed = parseLibertyHtml(postHtml, clean);

      return {
        success: true,
        ...parsed,
        source: ep.isProxy ? 'proxy' : 'direct'
      };
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  return {
    success: false,
    error: lastError ? lastError.message : 'No se pudo conectar con Liberty Express'
  };
}

/**
 * Normaliza y analiza un tracking de Courier de USA (USPS, UPS, FedEx, DHL, Amazon).
 */
export function consultarTrackingUsa(trackingNumber, courierId = 'usps') {
  const clean = cleanTrackingNumber(trackingNumber);
  if (!clean) {
    return {
      success: false,
      statusKey: 'pending',
      estadoNormalizado: 'Sin Tracking USA',
      deliveredInMiami: false
    };
  }

  // Detección automática del courier si es 'otro' o indefinido
  let detectedCourier = courierId;
  if (!detectedCourier || detectedCourier === 'otro') {
    if (/^1Z[0-9A-Z]{16}$/i.test(clean)) detectedCourier = 'ups';
    else if (/^(?:7489[0-9]{16,22}|96[0-9]{18,22}|[0-9]{12}|[0-9]{15}|DT[0-9]{12})$/i.test(clean)) detectedCourier = 'fedex';
    else if (/^(?:94|93|92|95|91|420|03|82|23)[0-9]{16,28}$/.test(clean) || /^[0-9]{20,24}$/.test(clean) || /^(?:ESUS|EEUS|UPAA)[0-9A-Z]+$/i.test(clean)) detectedCourier = 'usps';
    else if (/^[0-9]{10}$/.test(clean)) detectedCourier = 'dhl';
    else detectedCourier = 'usps';
  }

  return {
    success: true,
    trackingNumber: clean,
    courier: detectedCourier,
    url: null
  };
}

/**
 * Sincronizador maestro de Envíos y Detección de Guías VZLA.
 * Ejecuta en segundo plano la consulta de Liberty Express para todos los paquetes activos:
 * 1. Paquetes con tracking_usa pero sin tracking_vzla: busca la guía de Liberty en Miami.
 * 2. Paquetes en tránsito: verifica si ya fueron entregados para marcar en_taller: true y bajar prioridad.
 *
 * @param {Object} params
 * @param {Firestore} params.db - Instancia de Firestore
 * @param {Array} params.trackings - Lista de paquetes en trackings
 * @param {Array} params.compras - Lista de compras de eBay
 * @param {Array} params.laptops - Lista de laptops en inventario
 * @param {Array} params.componentes - Lista de componentes en inventario
 * @param {Function} [params.onProgress] - Callback de progreso (current, total, msg)
 * @returns {Promise<Object>} Resumen de resultados sincronizados
 */
export async function sincronizarTrackingsConCouriers({
  db,
  trackings = [],
  compras = [],
  laptops = [],
  componentes = [],
  onProgress = () => {}
}) {
  const resultSummary = {
    totalProcesados: 0,
    vzlaDetectados: [],
    entregadosTaller: [],
    pendientesFlete: [],
    errores: []
  };

  // Filtrar trackings que ameritan consulta automática (excluir ya recogidos, en taller o facturados/entregados)
  const candidatos = trackings.filter(t => {
    if (t.estado === 'ya_recogido' || t.en_taller) return false;
    const vzlaUpper = (t.tracking_vzla_ultimo_estado || '').toUpperCase();
    if (
      vzlaUpper.includes('FACTURAD') ||
      vzlaUpper.includes('ENTREGAD') ||
      vzlaUpper.includes('RETIRADO EN AGENCIA') ||
      vzlaUpper.includes('ENTREGA REALIZADA') ||
      vzlaUpper.includes('PAQUETE RETIRADO')
    ) {
      return false;
    }
    const cleanUsa = cleanTrackingNumber(t.tracking_usa);
    const cleanVzla = cleanTrackingNumber(t.tracking_vzla);
    return Boolean(cleanUsa || cleanVzla);
  });

  const total = candidatos.length;
  if (total === 0) {
    onProgress(0, 0, 'No hay paquetes activos para sincronizar.');
    return resultSummary;
  }

  for (let i = 0; i < total; i++) {
    const trk = candidatos[i];
    const cleanUsa = cleanTrackingNumber(trk.tracking_usa);
    const cleanVzla = cleanTrackingNumber(trk.tracking_vzla);

    onProgress(i + 1, total, `Consultando ${cleanVzla || cleanUsa}...`);

    try {
      // 1. Si no tiene tracking_vzla o tiene guía temporal WRTMP-, consultar con el tracking_usa en Liberty
      // 2. Si ya tiene tracking_vzla definitivo, consultar con el tracking_vzla para verificar estado en VZLA
      const numeroAConsultar = (cleanVzla && !cleanVzla.startsWith('WRTMP-')) ? cleanVzla : (cleanUsa || cleanVzla);
      const res = await consultarLibertyTracking(numeroAConsultar);

      const batch = writeBatch(db);
      let huboCambios = false;
      const updatesTrk = {
        fecha_actualizacion: serverTimestamp()
      };

      // Buscar compras de eBay vinculadas a este tracking
      const itemsEnTracking = Array.isArray(trk.items) ? trk.items : [];
      const comprasVinculadas = compras.filter(c => {
        if (c.tracking_id === trk.id) return true;
        const cUsa = cleanTrackingNumber(c.tracking_usa);
        if (cUsa && cleanUsa && cUsa === cleanUsa) return true;
        if (itemsEnTracking.some(it => it.id === c.id || it.id === c.inventario_id)) return true;
        return false;
      });

      // Verificar si el courier en USA (UPS, FedEx, USPS) ya entregó el paquete según eBay
      const courierUsaYaEntrego = comprasVinculadas.some(c => 
        c.isDelivered || 
        c.shipping_status === "delivered" || 
        c.tracking_usa_entregado
      );

      if (res && res.success && res.found) {
        // A) SÓLO si Liberty confirma que FÍSICAMENTE lo recibió en almacén Miami (no solo pre-alerta en espera):
        if (res.isInMiami) {
          updatesTrk.tracking_usa_entregado = true;
          if (!trk.tracking_usa_ultimo_estado || trk.tracking_usa_ultimo_estado.includes("viaje") || trk.tracking_usa_ultimo_estado.includes("tránsito") || trk.tracking_usa_ultimo_estado.includes("esperando")) {
            updatesTrk.tracking_usa_ultimo_estado = "Entregado en Almacén Miami";
          }
        } else if (res.isPrealertOnly) {
          // Si está prealertado en Liberty esperando el paquete, marcar como prealertado pero NO como entregado en Miami
          if (trk.estado === 'por_prealertar') {
            updatesTrk.estado = 'prealertado';
            updatesTrk.prealertado = true;
            huboCambios = true;
          }
          if (res.trackingVzla && res.trackingVzla.startsWith('WRTMP-') && !trk.prealerta_id) {
            updatesTrk.prealerta_id = res.trackingVzla;
            huboCambios = true;
          }
        }

        // B) DETECCIÓN Y ACTUALIZACIÓN DE GUÍA VZLA:
        // Caso 1: No tenía guía y se detectó una nueva
        // Caso 2: Tenía guía temporal (WRTMP-...) y ahora Liberty emitió la guía definitiva (WR01-..., LIB-...)
        const tieneGuiaTemporal = cleanVzla && cleanVzla.startsWith('WRTMP-');
        const esNuevaGuiaDefinitiva = res.trackingVzla && !res.trackingVzla.startsWith('WRTMP-');

        if ((!cleanVzla && res.trackingVzla) || (tieneGuiaTemporal && esNuevaGuiaDefinitiva)) {
          updatesTrk.tracking_vzla = res.trackingVzla;
          updatesTrk.courier_vzla = "liberty";
          updatesTrk.auto_detectado_vzla = true;
          if (tieneGuiaTemporal) {
            updatesTrk.prealerta_id = cleanVzla;
          }
          updatesTrk.tracking_vzla_ultimo_estado = res.ultimoEstado;
          updatesTrk.tracking_vzla_fecha_estado = res.fechaEstado || null;

          huboCambios = true;
          resultSummary.vzlaDetectados.push({
            trackingId: trk.id,
            trackingUsa: cleanUsa,
            trackingVzla: res.trackingVzla,
            estado: res.ultimoEstado,
            eraPrealerta: tieneGuiaTemporal
          });
        }

        // C) Actualizar último estado descriptivo literal de Liberty
        if (res.ultimoEstado && res.ultimoEstado !== trk.tracking_vzla_ultimo_estado) {
          updatesTrk.tracking_vzla_ultimo_estado = res.ultimoEstado;
          huboCambios = true;
        }
        if (res.fechaEstado && res.fechaEstado !== trk.tracking_vzla_fecha_estado) {
          updatesTrk.tracking_vzla_fecha_estado = res.fechaEstado;
          huboCambios = true;
        }

        // D) TRANSICIÓN INTELIGENTE DE ESTADO SEGÚN LIBERTY:
        if (res.isDelivered && trk.estado !== "ya_recogido") {
          // Si Liberty dice Facturado / Retirado / Entregado -> Pasa a Taller y ya recogido
          updatesTrk.estado = "ya_recogido";
          updatesTrk.en_taller = true;
          updatesTrk.tracking_vzla_entregado = true;
          updatesTrk.fecha_recogido = serverTimestamp();
          huboCambios = true;
          resultSummary.entregadosTaller.push({
            trackingId: trk.id,
            trackingUsa: cleanUsa,
            trackingVzla: res.trackingVzla || cleanVzla,
            estado: res.ultimoEstado
          });
        } else if (res.isDisponible && trk.estado !== "ya_recogido") {
          if (trk.estado !== "disponible_agencia") {
            updatesTrk.estado = "disponible_agencia";
            huboCambios = true;
          }
        } else if (res.isTransitoVzla && trk.estado !== "ya_recogido" && trk.estado !== "disponible_agencia") {
          // Ejemplo: "A bordo, para ser transportado a su destino"
          if (trk.estado !== "transito_vzla") {
            updatesTrk.estado = "transito_vzla";
            huboCambios = true;
          }
        } else if (res.isInMiami && trk.estado !== "ya_recogido" && trk.estado !== "disponible_agencia" && trk.estado !== "transito_vzla") {
          if (trk.estado !== "en_miami") {
            updatesTrk.estado = "en_miami";
            huboCambios = true;
          }
        }
      } else if (courierUsaYaEntrego) {
        // Si Liberty aún no lo procesa, pero UPS/USPS ya lo entregó en Miami
        if (!trk.tracking_usa_entregado) {
          updatesTrk.tracking_usa_entregado = true;
          updatesTrk.tracking_usa_ultimo_estado = "Entregado por Courier USA (Miami)";
          if (trk.estado === "por_prealertar" || trk.estado === "prealertado") {
            updatesTrk.estado = "en_miami";
          }
          huboCambios = true;
        }
      }

      if (huboCambios) {
        batch.update(doc(db, "trackings", trk.id), updatesTrk);

        for (const c of comprasVinculadas) {
          const updatesCompra = {
            fecha_actualizacion: serverTimestamp()
          };
          if (updatesTrk.tracking_usa_entregado) {
            updatesCompra.tracking_usa_entregado = true;
            updatesCompra.tracking_usa_ultimo_estado = updatesTrk.tracking_usa_ultimo_estado || "Entregado en Almacén Miami";
          }
          if (updatesTrk.tracking_vzla && !c.tracking_vzla) {
            updatesCompra.tracking_vzla = updatesTrk.tracking_vzla;
            updatesCompra.courier_vzla = "liberty";
            updatesCompra.auto_detectado_vzla = true;
          }
          if (updatesTrk.tracking_vzla_ultimo_estado) {
            updatesCompra.tracking_vzla_ultimo_estado = updatesTrk.tracking_vzla_ultimo_estado;
          }
          if (updatesTrk.tracking_vzla_fecha_estado) {
            updatesCompra.tracking_vzla_fecha_estado = updatesTrk.tracking_vzla_fecha_estado;
          }
          if (res && res.isDelivered) {
            updatesCompra.en_taller = true;
          }
          batch.update(doc(db, "compras_ebay", c.id), updatesCompra);
        }

        // Propagar a laptops / componentes si está entregado en taller
        if (res && res.isDelivered) {
          for (const it of itemsEnTracking) {
            if (it.tipo === "componente") {
              const compMatch = componentes.find(cmp => cmp.id === it.id);
              if (compMatch) {
                batch.update(doc(db, "componentes", compMatch.id), {
                  en_taller: true,
                  actualizadoEn: serverTimestamp()
                });
              }
            } else {
              const lapMatch = laptops.find(l => l.id === it.id || l.ebay_compra_id === it.id);
              if (lapMatch) {
                batch.update(doc(db, "laptops", lapMatch.id), {
                  en_taller: true,
                  actualizadoEn: serverTimestamp()
                });
              }
            }
          }
        }

        await batch.commit();
      }

      resultSummary.totalProcesados++;

      // Pequeña pausa de 350ms entre consultas para evitar saturar el servidor
      await new Promise(resolve => setTimeout(resolve, 350));
    } catch (err) {
      console.warn(`Error procesando tracking ${trk.id}:`, err);
      resultSummary.errores.push({ id: trk.id, error: err.message });
    }
  }

  onProgress(total, total, 'Sincronización completada.');
  return resultSummary;
}
