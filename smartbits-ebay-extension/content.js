/**
 * Smartbits - eBay Purchase History Extractor (Soporte multi-artículo con precios y trackings independientes)
 */

function cleanText(str) {
  return str ? str.replace(/\s+/g, ' ').trim() : '';
}

/**
 * Limpia el título eliminando tags HTML, entidades y cualquier residuo de etiquetas img o atributos como '" alt="" />'
 */
function cleanTitle(str) {
  if (!str) return '';
  let s = String(str)
    // 1. Eliminar etiquetas HTML completas
    .replace(/<[^>]*>/g, '')
    // 2. Eliminar residuos de alt="", alt="/", comillas y cierres de tags
    .replace(/['"]*\s*alt\s*=\s*['"][^'"]*['"]\s*\/?\s*>?/gi, '')
    .replace(/['"]*\s*alt\s*=\s*\/?>?/gi, '')
    .replace(/['"]+\s*\/>/g, '')
    // 3. Eliminar caracteres no alfanuméricos al inicio (comillas, barras, cierres, espacios)
    .replace(/^[^a-zA-Z0-9$#]+/, '')
    // 4. Entidades HTML y espacios sobrantes
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

/**
 * Busca URLs de imágenes de alta resolución de eBay dentro de los scripts de la página
 */
function findImageInScripts(itemId, orderId) {
  const targets = [itemId, orderId].filter(Boolean);
  if (targets.length === 0) return '';

  const scripts = document.querySelectorAll('script');
  for (const s of scripts) {
    const text = s.textContent || '';
    if (!text) continue;

    for (const target of targets) {
      let pos = text.indexOf(target);
      let count = 0;
      while (pos !== -1 && count < 10) {
        count++;
        const start = Math.max(0, pos - 2000);
        const end = Math.min(text.length, pos + 6000);
        const chunk = text.slice(start, end);

        const imgMatch = chunk.match(/(?:imageUrl|image_url|pictureUrl|thumbnailUrl|image|photo)["':\s]+["'](https:\/\/[^"']*(?:ebayimg\.com|ebaystatic\.com)[^"']+)["']/i) ||
                         chunk.match(/["'](https:\/\/i\.ebayimg\.com\/(?:thumbs\/)?images\/g\/[a-zA-Z0-9_-]+\/[^"']+\.(?:jpg|png|webp|jpeg))["']/i);
        if (imgMatch && !imgMatch[1].includes('s_1x2.gif')) {
          return imgMatch[1].replace(/\\u002F/g, '/').replace(/\\/g, '').replace(/&amp;/g, '&');
        }

        pos = text.indexOf(target, pos + target.length);
      }
    }
  }
  return '';
}

function parsePrice(text) {
  if (!text) return 0;
  const match = text.match(/\$\s*([0-9,]+(?:\.[0-9]{2})?)/);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  return 0;
}

function getKnownItemIdsOnPage() {
  const ids = new Set();
  try {
    document.querySelectorAll('a[href*="/itm/"]').forEach(a => {
      const m = (a.href || '').match(/\/itm\/(?:[^\/]+\/)?([0-9]{9,15})/);
      if (m) ids.add(m[1]);
    });
  } catch (_) {}
  return ids;
}

function getKnownOrderIdsOnPage() {
  const ids = new Set();
  try {
    const bodyText = document.body ? (document.body.innerText || '') : '';
    const matches = bodyText.matchAll(/\b([0-9]{2}-[0-9]{5}-[0-9]{5})\b/g);
    for (const m of matches) {
      ids.add(m[1]);
      ids.add(m[1].replace(/-/g, ''));
    }
  } catch (_) {}
  return ids;
}

function isValidTrackingNumber(str, excludedIds = []) {
  if (!str || typeof str !== 'string') return false;
  const clean = str.trim();

  // Rechazar si coincide con algún itemId u orderId explícitamente excluido
  if (excludedIds && excludedIds.length > 0) {
    for (const ex of excludedIds) {
      if (!ex) continue;
      const cleanEx = String(ex).replace(/[\s-]/g, '').trim();
      if (cleanEx && (clean === cleanEx || clean.includes(cleanEx) || cleanEx.includes(clean))) {
        return false;
      }
    }
  }

  // Rechazar si coincide con algún número de artículo (item number de 12 dígitos) de eBay conocido en la página
  const knownItems = getKnownItemIdsOnPage();
  if (knownItems.has(clean)) {
    return false;
  }

  // Rechazar si coincide con algún ID de orden conocido en la página (con o sin guiones)
  const knownOrders = getKnownOrderIdsOnPage();
  if (knownOrders.has(clean)) {
    return false;
  }

  // Rechazar si coincide con formato de ID de orden de eBay con guiones (XX-XXXXX-XXXXX)
  if (/^[0-9]{2}-[0-9]{5}-[0-9]{5}$/.test(clean)) {
    return false;
  }

  // Rechazar cadenas con formato JSON, llaves o telemetría interna de eBay
  if (clean.startsWith('{') || clean.startsWith('[') || clean.includes('EVENTFAMILY') || clean.includes('eventFamily') || clean.includes('"') || clean.includes(':')) {
    return false;
  }

  // Rechazar palabras comunes de botones, navegación, estados o interfaces de eBay (como 'experience')
  if (/^(order|item|pack|track|date|view|details|click|nav|actn|true|false|null|undefined|delivered|entregado|comprado|shipped|enviado|experience|delivery|status|button)/i.test(clean)) {
    return false;
  }

  // Un número de tracking de courier real en USA DEBE contener dígitos numéricos (al menos 4)
  const digitsOnly = clean.replace(/\D/g, '');
  if (digitsOnly.length < 4) {
    return false;
  }

  // Un número de tracking de courier real es alfanumérico (ej: 1Z..., 9400..., ESUS..., 12 dígitos FedEx, etc.)
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

const trackingCache = new Map();

/**
 * Busca tracking dentro de scripts acotado inteligentemente a los límites de esta orden
 * (no cruza hacia órdenes previas o siguientes) para evitar colisiones.
 */
function findTrackingInScripts(orderId, itemId = '') {
  if (!orderId && !itemId) return null;
  const rawItemId = String(itemId || '').replace(/_u[0-9]+$/, '').trim();
  const orderIdClean = String(orderId || '').replace(/[\s-]/g, '').trim();
  const orderIdWithDashes = orderId && orderId.includes('-') 
    ? orderId 
    : (orderId && orderId.length === 12 ? `${orderId.slice(0, 2)}-${orderId.slice(2, 7)}-${orderId.slice(7)}` : orderId);
  
  // Excluir IDs de este pedido y de otros pedidos conocidos en la página para evitar contaminación
  const knownOrders = Array.from(getKnownOrderIdsOnPage());
  const knownItems = Array.from(getKnownItemIdsOnPage());
  const excluded = [
    rawItemId, 
    orderId, 
    orderIdClean,
    ...knownOrders.filter(id => id !== orderId && id !== orderIdClean),
    ...knownItems.filter(id => id !== rawItemId)
  ].filter(Boolean);

  const directTargets = [orderId, orderIdClean, orderIdWithDashes, rawItemId].filter(Boolean);

  const scripts = document.querySelectorAll('script');
  for (const s of scripts) {
    const text = s.textContent || '';
    if (!text) continue;

    for (const target of directTargets) {
      if (!text.includes(target)) continue;
      let pos = text.indexOf(target);
      let count = 0;
      while (pos !== -1 && count < 30) {
        count++;

        // Delimitar el chunk del pedido usando ventana acotada y límites con órdenes adyacentes distintas
        // Soporta tanto IDs formateados con guiones (XX-XXXXX-XXXXX) como planos de 12 dígitos
        let start = Math.max(0, pos - 2500);
        let end = Math.min(text.length, pos + 3500);

        const textAfter = text.slice(pos + target.length, end);
        const nextOrderMatch = textAfter.match(/(?:"orderId"|"legacyOrderId")\s*:\s*["']?([0-9-]{10,20})["']?/i) ||
                               textAfter.match(/\b[0-9]{2}-[0-9]{5}-[0-9]{5}\b/);
        if (nextOrderMatch && nextOrderMatch[1] && nextOrderMatch[1] !== orderId && nextOrderMatch[1] !== orderIdWithDashes && nextOrderMatch[1] !== orderIdClean) {
          end = pos + target.length + nextOrderMatch.index;
        }

        const chunk = text.slice(start, end);

        // 1. Detección prioritaria de patrones únicos de Couriers en el JSON del pedido:
        // A. UPS (1Z...)
        const upsJsonMatch = chunk.match(/\b(1Z[0-9A-Z]{16})\b/i);
        if (upsJsonMatch && isValidTrackingNumber(upsJsonMatch[1], excluded)) {
          return upsJsonMatch[1];
        }

        // B. USPS (9400..., 9200..., ESUS...)
        const uspsJsonMatch = chunk.match(/\b(9[1-5][0-9]{18,22})\b/) ||
                              chunk.match(/\b(ESUS[0-9A-Za-z]{6,20})\b/i);
        if (uspsJsonMatch && isValidTrackingNumber(uspsJsonMatch[1], excluded)) {
          return uspsJsonMatch[1];
        }

        // 2. Buscar en URLs de tracking (ej: ups.com, usps.com, fedex.com, TrackPackage con tracknumbers, etc.)
        const urlMatches = chunk.matchAll(/(?:trackingUrl|trackUrl|shipmentTrackingUrl|viewTrackingUrl|packageTrackingUrl)["':\s]+["']([^"']+)["']/gi);
        for (const um of urlMatches) {
          const rawUrl = um[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
          const m = rawUrl.match(/\b(1Z[0-9A-Z]{16})\b/i) ||
                    rawUrl.match(/ups\.com\/.*?(?:tracknum|tracknums|inquirynumber\d*|tracknumbers?)=([0-9A-Za-z]+)/i) ||
                    rawUrl.match(/usps\.com\/.*?(?:tLabels|origTrackNum)=([0-9A-Za-z]+)/i) ||
                    rawUrl.match(/fedex\.com\/.*?\b([0-9]{12,15})\b/i) ||
                    rawUrl.match(/(?:trackingNumber|tracknumbers?|trknbr|trackId|tLabels|tracknum)=([A-Za-z0-9_-]+)/i);
          if (m && isValidTrackingNumber(m[1], excluded)) {
            return m[1];
          }
        }

        // 3. Buscar etiquetas explícitas de tracking en el JSON (NUNCA bare 'track=' ni 'trackExperience')
        const labeledMatches = chunk.matchAll(/(?:tracking(?:_?num(?:ber)?|_?no|_?id|_?code)?|track(?:_?num(?:ber)?|_?no|_?id)|shipmentTracking(?:Number)?|carrierTrackingNumber|deliveryTrackingNumber|trknbr|tracknumbers?)["':\s]+["']?([A-Za-z0-9_-]{8,40})["']?/gi);
        for (const lm of labeledMatches) {
          const clean = lm[1].replace(/[\s-]/g, '');
          if (isValidTrackingNumber(clean, excluded)) {
            return clean;
          }
        }

        // 4. Si el bloque menciona FedEx, buscar únicamente números de 12 dígitos inmediatamente asociados a FedEx
        const fedexMatch = chunk.match(/(?:fedex(?:[\s\w-]{0,35})?|carrier\s*:\s*fedex[^\d]{0,20})["':\s=-]+([0-9]{12,15})\b/i);
        if (fedexMatch && isValidTrackingNumber(fedexMatch[1], excluded)) {
          return fedexMatch[1];
        }

        pos = text.indexOf(target, pos + target.length);
      }
    }
  }
  return null;
}

/**
 * Extrae número de tracking y courier desde un nodo del DOM
 */
function extractTrackingFromNode(node, itemId = '', orderId = '') {
  if (!node) return { trackingNumber: '', courier: 'otro', trackHref: '' };
  const rawItemId = String(itemId || '').replace(/_u[0-9]+$/, '').trim();
  const orderIdClean = String(orderId || '').replace(/[\s-]/g, '').trim();
  const excluded = [rawItemId, orderId, orderIdClean].filter(Boolean);

  let trackingNumber = '';
  let trackHref = '';

  // 1. Elementos y botones de rastreo o entrega
  const trackingElements = Array.from(node.querySelectorAll(
    'a[href*="TrackPackage" i], a[href*="track" i], a[href*="tracking" i], ' +
    'a[data-testid*="track" i], button[data-testid*="track" i], [class*="track" i], ' +
    'a[href*="usps.com" i], a[href*="ups.com" i], a[href*="fedex.com" i], a[href*="dhl.com" i]'
  ));

  const allActionButtons = Array.from(node.querySelectorAll('a, button, span[role="button"]'));
  for (const btn of allActionButtons) {
    const txt = ((btn.innerText || '') + ' ' + (btn.textContent || '')).toLowerCase();
    if (
      txt.includes('track') || 
      txt.includes('rastrear') || 
      txt.includes('seguimiento') || 
      txt.includes('delivered') || 
      txt.includes('entregado') || 
      txt.includes('enviado') || 
      txt.includes('shipped') ||
      txt.includes('delivery')
    ) {
      if (!trackingElements.includes(btn)) trackingElements.push(btn);
    }
  }

  for (const el of trackingElements) {
    let href = el.getAttribute('href') || el.href || '';
    if (!href) {
      const parentA = el.closest('a');
      const childA = el.querySelector('a');
      if (parentA) href = parentA.getAttribute('href') || parentA.href || '';
      else if (childA) href = childA.getAttribute('href') || childA.href || '';
    }
    if (!href) {
      href = el.getAttribute('data-href') || el.getAttribute('data-url') || el.getAttribute('data-link') || '';
    }
    if (href && href.startsWith('/')) {
      href = `https://www.ebay.com${href}`;
    }
    if (href && !trackHref && !href.startsWith('javascript:')) {
      trackHref = href;
    }

    // A. Si el enlace apunta directamente a ups.com
    if (href.includes('ups.com')) {
      const upsHrefMatch = href.match(/\b(1Z[0-9A-Z]{16})\b/i) ||
                           href.match(/(?:tracknum|tracknums|inquirynumber\d*|tracknumbers?)=([0-9A-Za-z]+)/i);
      if (upsHrefMatch && isValidTrackingNumber(upsHrefMatch[1], excluded)) {
        trackingNumber = upsHrefMatch[1];
        break;
      }
    }

    // B. Si el enlace apunta directamente a usps.com
    if (href.includes('usps.com')) {
      const uspsHrefMatch = href.match(/\b(9[1-5][0-9\s-]{18,24})\b/) ||
                            href.match(/(?:tLabels|origTrackNum)=([^&]+)/i);
      if (uspsHrefMatch) {
        const cleanUsps = decodeURIComponent(uspsHrefMatch[1]).replace(/[\s+%-]/g, '');
        if (isValidTrackingNumber(cleanUsps, excluded)) {
          trackingNumber = cleanUsps;
          break;
        }
      }
    }

    // C. Si el enlace apunta directamente a fedex.com
    if (href.includes('fedex.com')) {
      const fedexHrefMatch = href.match(/(?:tracknumbers?|trknbr|trackId|tLabels)=([0-9]{12,15})/i) ||
                             href.match(/\b([0-9]{12})\b/);
      if (fedexHrefMatch && isValidTrackingNumber(fedexHrefMatch[1], excluded)) {
        trackingNumber = fedexHrefMatch[1];
        break;
      }
    }

    // D. Buscar en parámetros de URL generales (NUNCA bare 'track=' que capture palabras como 'experience')
    const paramMatch = href.match(/(?:tracking(?:_?num(?:ber)?|_?no|_?id|_?code)?|track(?:_?num(?:ber)?|_?no|_?id)|shipmentTracking(?:Number)?|carrierTrackingNumber|deliveryTrackingNumber|trknbr|tracknumbers?|tLabels)=([^&]+)/i);
    if (paramMatch) {
      const rawParam = decodeURIComponent(paramMatch[1]).replace(/[\s-]/g, '');
      if (isValidTrackingNumber(rawParam, excluded)) {
        trackingNumber = rawParam;
        break;
      }
    }

    // E. Buscar en data-attributes
    const attrTracking = el.getAttribute('data-tracking-number') || el.getAttribute('data-track-number') || el.getAttribute('data-trk') || el.getAttribute('data-tracking-id') || el.getAttribute('data-tracknumber') || el.getAttribute('data-tracking');
    if (attrTracking) {
      const cleanAttr = attrTracking.replace(/[\s-]/g, '');
      if (isValidTrackingNumber(cleanAttr, excluded)) {
        trackingNumber = cleanAttr;
        break;
      }
    }

    // F. Buscar en aria-label, title o texto del enlace (priorizar UPS 1Z... y USPS 9400...)
    const labelText = ((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '') + ' ' + (el.innerText || '') + ' ' + (el.textContent || '')).replace(/\s+/g, ' ');
    const labelMatch = labelText.match(/\b(1Z[0-9A-Z]{16})\b/i) ||
                       labelText.match(/\b(9[1-5][0-9\s-]{18,26})\b/) ||
                       labelText.match(/\b(ESUS[0-9A-Za-z]{6,20})\b/i) ||
                       labelText.match(/(?:fedex(?:[\s\w-]{0,35})?|tracking\s*(?:number|#|no\.?|id|code)?|guía|rastreo)[\s:#-]+([0-9]{12,15})\b/i);
    if (labelMatch) {
      const cleanMatch = (labelMatch[1] || labelMatch[0]).replace(/[\s-]/g, '');
      if (isValidTrackingNumber(cleanMatch, excluded)) {
        trackingNumber = cleanMatch;
        break;
      }
    }
  }

  // 2. Buscar en el texto directo del nodo con patrones de couriers de alta confianza
  if (!trackingNumber) {
    const nodeText = (node.innerText || '') + '\n' + (node.textContent || '');
    const textPatterns = [
      // UPS (1Z...)
      /\b(1Z[\s-]?[0-9A-Z]{3}[\s-]?[0-9A-Z]{3}[\s-]?[0-9A-Z]{2}[\s-]?[0-9A-Z]{4}[\s-]?[0-9A-Z]{4})\b/i,
      // USPS continuo o con espacios estándar (ej: 9400 1118 9956 2537 6251 40)
      /\b(9[1-5](?:[\s-]?[0-9]){18,24})\b/,
      // USPS con código postal de ruteo 420
      /\b(?:420\s*[0-9]{5}\s*)?(9[1-5](?:[\s-]?[0-9]){18,22})\b/,
      /\b([0-9]{4}\s+[0-9]{4}\s+[0-9]{4}\s+[0-9]{4}\s+[0-9]{4}(?:\s+[0-9]{2,4})?)\b/,
      // USPS / eBay Standard Delivery
      /\b(ESUS[0-9A-Za-z]{6,20}|EEUS[0-9A-Za-z]{6,20}|UPAA[0-9A-Za-z]{6,20})\b/i,
      // USPS Internacional
      /\b([A-Z]{2}[0-9]{9}US)\b/i,
      // FedEx
      /(?:fedex(?:[\s\w-]{0,35})?|carrier\s*:\s*fedex[^\d]{0,20})[\s:#-]+([0-9]{12,15})\b/i,
      /\b(7489[\s-]?[0-9\s-]{16,22})\b/,
      // Etiqueta explícita de tracking que contenga al menos 4 dígitos
      /(?:tracking\s*(?:number|#|id|no\.?|code)?|n[uú]mero\s*de\s*(?:seguimiento|gu[ií]a)|rastreo|gu[ií]a)[\s:#-]+([A-Za-z0-9\s-]{8,38})/i
    ];

    for (const pattern of textPatterns) {
      const match = nodeText.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].replace(/[\s-]/g, '');
        if (isValidTrackingNumber(candidate, excluded)) {
          trackingNumber = candidate;
          break;
        }
      }
    }

    // 3. Si la tarjeta menciona FedEx explícitamente y tiene un número de 12 dígitos
    if (!trackingNumber && /\bfedex\b/i.test(nodeText)) {
      const fedexTextMatches = nodeText.matchAll(/(?:fedex[^\d]{0,30})([0-9]{12,15})\b/gi);
      for (const m of fedexTextMatches) {
        const cand = m[1];
        if (isValidTrackingNumber(cand, excluded)) {
          trackingNumber = cand;
          break;
        }
      }
    }
  }

  // 4. Búsqueda profunda dentro del HTML de la tarjeta
  if (!trackingNumber && node.innerHTML) {
    const rawHtml = node.innerHTML;

    // A. UPS 1Z o USPS 9400 en HTML
    const htmlUps = rawHtml.match(/\b(1Z[0-9A-Z]{16})\b/i);
    if (htmlUps && isValidTrackingNumber(htmlUps[1], excluded)) {
      trackingNumber = htmlUps[1];
    }

    if (!trackingNumber) {
      const htmlUsps = rawHtml.match(/\b(9[1-5][0-9]{18,22})\b/) || rawHtml.match(/\b(ESUS[0-9A-Za-z]{6,20})\b/i);
      if (htmlUsps && isValidTrackingNumber(htmlUsps[1], excluded)) {
        trackingNumber = htmlUsps[1];
      }
    }

    // B. Buscar en URLs o atributos dentro del HTML del card
    if (!trackingNumber) {
      const htmlUrlMatches = rawHtml.matchAll(/(?:tracking(?:_?num(?:ber)?|_?no|_?id|_?code)?|track(?:_?num(?:ber)?|_?no|_?id)|shipmentTracking(?:Number)?|trknbr|tracknumbers?|tLabels)=([A-Za-z0-9_-]{8,40})/gi);
      for (const hum of htmlUrlMatches) {
        const clean = hum[1].replace(/[\s-]/g, '');
        if (isValidTrackingNumber(clean, excluded)) {
          trackingNumber = clean;
          break;
        }
      }
    }

    // C. Buscar etiquetas JSON o atributos de tracking en el HTML
    if (!trackingNumber) {
      const htmlLabeled = rawHtml.matchAll(/(?:tracking(?:_?num(?:ber)?|_?no|_?id|_?code)?|track(?:_?num(?:ber)?|_?no|_?id)|shipmentTracking(?:Number)?|carrierTrackingNumber|deliveryTrackingNumber)["':=\s]+["']?([A-Za-z0-9_-]{8,40})["']?/gi);
      for (const hlm of htmlLabeled) {
        const clean = hlm[1].replace(/[\s-]/g, '');
        if (isValidTrackingNumber(clean, excluded)) {
          trackingNumber = clean;
          break;
        }
      }
    }

    // D. Si el HTML del card menciona FedEx y tiene 12 dígitos asociados
    if (!trackingNumber && /\bfedex\b/i.test(rawHtml)) {
      const htmlFedex = rawHtml.matchAll(/(?:fedex[^\d]{0,30})([0-9]{12,15})\b/gi);
      for (const m of htmlFedex) {
        const candidate = m[1];
        if (isValidTrackingNumber(candidate, excluded)) {
          trackingNumber = candidate;
          break;
        }
      }
    }
  }

  return {
    trackingNumber: trackingNumber && isValidTrackingNumber(trackingNumber, excluded) ? trackingNumber : '',
    courier: trackingNumber ? detectCourier(trackingNumber) : 'otro',
    trackHref
  };
}

/**
 * Extrae la mejor URL de imagen de un contenedor resolviendo lazy-loading SIN necesidad de hacer scroll manual
 */
function extractImageFromNode(node, itemId = '', orderId = '') {
  if (!node) return '';

  // 1. Si existe <noscript>, contiene la imagen original sin lazy-loading
  const noscripts = Array.from(node.querySelectorAll('noscript'));
  for (const ns of noscripts) {
    const txt = ns.textContent || '';
    const match = txt.match(/src=["'](https:\/\/[^"']*(?:ebayimg\.com|ebaystatic\.com)[^"']*)["']/i);
    if (match && !match[1].includes('s_1x2.gif')) {
      return match[1].replace(/&amp;/g, '&');
    }
  }

  // 2. Buscar en todos los elementos del contenedor algún atributo que apunte a ebayimg.com
  const allElements = Array.from(node.querySelectorAll('img, picture, source, div, a, span'));
  for (const el of allElements) {
    if (el.currentSrc && el.currentSrc.startsWith('http') && !el.currentSrc.includes('s_1x2.gif') && !el.currentSrc.includes('placeholder')) {
      return el.currentSrc;
    }

    // Atributos típicos de lazy-loading y srcset
    const lazyAttrs = ['data-src', 'data-lazy', 'data-original', 'data-defer-src', 'data-image', 'data-srcset', 'srcset', '_src'];
    for (const attrName of lazyAttrs) {
      const val = el.getAttribute(attrName);
      if (val && typeof val === 'string') {
        const urlMatch = val.match(/https:\/\/[^\s"',]+(?:ebayimg\.com|ebaystatic\.com)[^\s"',]+/i);
        if (urlMatch && !urlMatch[0].includes('s_1x2.gif')) {
          return urlMatch[0].replace(/&amp;/g, '&');
        }
      }
    }

    // Cualquier atributo que contenga ebayimg.com
    for (const attr of el.attributes) {
      const val = attr.value;
      if (val && typeof val === 'string' && val.includes('ebayimg.com') && !val.includes('s_1x2.gif')) {
        const urlMatch = val.match(/https:\/\/[^\s"',]+(?:ebayimg\.com)[^\s"',]+/i);
        if (urlMatch) {
          return urlMatch[0].replace(/&amp;/g, '&');
        }
      }
    }
  }

  // 3. Fallback a etiqueta img con src directo
  const img = node.querySelector('img');
  if (img && img.src && img.src.startsWith('http') && !img.src.includes('s_1x2.gif') && !img.src.includes('data:image')) {
    return img.src;
  }

  // 4. Fallback a scripts de la página
  if (itemId || orderId) {
    const scriptImg = findImageInScripts(itemId, orderId);
    if (scriptImg) return scriptImg;
  }

  return '';
}

/**
 * Consulta la página de tracking o detalle de orden en segundo plano
 */
async function fetchEbayTracking(orderId, trackHref, itemId = '') {
  if (!orderId) return '';
  const rawItemId = String(itemId || '').replace(/_u[0-9]+$/, '').trim();
  const excluded = [rawItemId, orderId].filter(Boolean);

  const urlsToTry = [];
  if (trackHref && trackHref.startsWith('http') && !trackHref.includes('javascript:') && !trackHref.includes('/ord/show')) {
    urlsToTry.push(trackHref);
  }
  if (/^[0-9]{2}-[0-9]{5}-[0-9]{5}$/.test(orderId)) {
    // NUNCA consultar order.ebay.com/ord/show (desencadena el límite diario 'limitexceeded' de eBay)
    urlsToTry.push(`https://www.ebay.com/cnt/TrackPackage?orderId=${encodeURIComponent(orderId)}`);
    urlsToTry.push(`https://www.ebay.com/mye/myebay/v2/purchase/tracking?orderId=${encodeURIComponent(orderId)}`);
  }

  const patterns = [
    /(?:trackingNumber|tracking_number|trackNumber|shipmentTrackingNumber|trackingId)["':\s]+["']?([A-Za-z0-9_-]{8,36})["']?/gi,
    /\b(1Z[0-9A-Z]{16})\b/gi,
    /\b(9[1-5][0-9\s-]{18,28})\b/g,
    /\b([0-9]{4}\s+[0-9]{4}\s+[0-9]{4}\s+[0-9]{4}\s+[0-9]{4}\s+[0-9]{2,4})\b/g,
    /\b(ESUS[0-9A-Za-z]{6,16}|EEUS[0-9A-Za-z]{6,16}|UPAA[0-9A-Za-z]{6,16})\b/gi,
    /(?:fedex|fedextrack|guía|rastreo|carrier|tracking)[^0-9a-zA-Z]{1,20}([0-9]{12})\b/gi,
    /\b(7489[\s-]?[0-9\s-]{16,22})\b/g
  ];

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (res.status === 429 || (res.url && res.url.includes('limitexceeded'))) return '';
      if (!res.ok) continue;
      const html = await res.text();
      if (html.includes('limitexceeded') || html.includes('exceeded the number of requests')) return '';

      for (const p of patterns) {
        let match;
        while ((match = p.exec(html)) !== null) {
          const clean = (match[1] || match[0]).replace(/[\s-]/g, '');
          if (isValidTrackingNumber(clean, excluded)) {
            trackingCache.set(orderId, clean);
            return clean;
          }
        }
      }
    } catch (e) {
      console.warn(`[Smartbits] No se pudo obtener tracking remoto para orden ${orderId}:`, e);
    }
  }

  return '';
}

function parseEbayOrderDate(card, cardText) {
  const dateElements = card.querySelectorAll('[data-testid*="order-date"], [data-testid*="date"], .order-date, [class*="orderDate"], [class*="order-header"], [class*="orderHeader"], [class*="order-info"]');
  let combinedText = '';
  dateElements.forEach(el => {
    combinedText += ' ' + (el.innerText || '');
  });
  combinedText += ' ' + (cardText || '');

  const regex = /(?:Order\s*date|Ordered\s*on|Order\s*placed\s*on|Order\s*placed|Placed\s*on|Purchased\s*on|Fecha\s*(?:del\s*pedido|de\s*la\s*orden|de\s*compra)?|Comprado\s*el)\s*[:\s]\s*([A-Za-z]{3,10}\s+[0-9]{1,2},?\s+[0-9]{4}|[0-9]{1,2}\s+(?:de\s+)?[A-Za-z]{3,10},?\s+(?:de\s+)?[0-9]{4}|[0-9]{1,2}[\/\.-][0-9]{1,2}[\/\.-][0-9]{2,4})/i;

  const match = combinedText.match(regex);
  let dateStr = match ? match[1] : null;

  if (!dateStr) {
    const fallbackMatch = combinedText.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+([0-9]{1,2}),?\s+([0-9]{4})\b/i);
    if (fallbackMatch) {
      dateStr = `${fallbackMatch[1]} ${fallbackMatch[2]}, ${fallbackMatch[3]}`;
    }
  }

  if (!dateStr) return new Date().toISOString().split('T')[0];

  dateStr = dateStr.replace(/\s+de\s+/gi, ' ').trim();

  const months = {
    jan: 1, ene: 1, january: 1, enero: 1,
    feb: 2, february: 2, febrero: 2,
    mar: 3, march: 3, marzo: 3,
    apr: 4, abr: 4, april: 4, abril: 4,
    may: 5, mayo: 5,
    jun: 6, june: 6, junio: 6,
    jul: 7, july: 7, julio: 7,
    aug: 8, ago: 8, august: 8, agosto: 8,
    sep: 9, sept: 9, september: 9, septiembre: 9, set: 9,
    oct: 10, october: 10, octubre: 10,
    nov: 11, november: 11, noviembre: 11,
    dec: 12, dic: 12, december: 12, diciembre: 12
  };

  const mdyMatch = dateStr.match(/^([A-Za-z]+)\s+([0-9]{1,2}),?\s+([0-9]{4})$/);
  if (mdyMatch) {
    const mName = mdyMatch[1].toLowerCase();
    const month = months[mName] || months[mName.slice(0, 3)];
    if (month) {
      const day = String(mdyMatch[2]).padStart(2, '0');
      const year = mdyMatch[3];
      const mStr = String(month).padStart(2, '0');
      return `${year}-${mStr}-${day}`;
    }
  }

  const dmyMatch = dateStr.match(/^([0-9]{1,2})\s+([A-Za-z]+),?\s+([0-9]{4})$/);
  if (dmyMatch) {
    const mName = dmyMatch[2].toLowerCase();
    const month = months[mName] || months[mName.slice(0, 3)];
    if (month) {
      const day = String(dmyMatch[1]).padStart(2, '0');
      const year = dmyMatch[3];
      const mStr = String(month).padStart(2, '0');
      return `${year}-${mStr}-${day}`;
    }
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return new Date().toISOString().split('T')[0];
}

async function autoTriggerLazyLoad() {
  const scrollHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  const clientHeight = window.innerHeight || 800;
  const originalScrollTop = window.scrollY || window.pageYOffset || 0;

  try {
    document.querySelectorAll('img[data-src], img[data-lazy], img[data-defer-src]').forEach(img => {
      const real = img.getAttribute('data-src') || img.getAttribute('data-lazy') || img.getAttribute('data-defer-src');
      if (real && real.startsWith('http')) img.src = real;
    });

    if (scrollHeight > clientHeight) {
      const steps = Math.min(6, Math.ceil(scrollHeight / clientHeight));
      const stepSize = scrollHeight / steps;

      for (let i = 1; i <= steps; i++) {
        window.scrollTo({ top: i * stepSize, behavior: 'instant' });
        await new Promise(r => setTimeout(r, 30));
      }
      window.scrollTo({ top: originalScrollTop, behavior: 'instant' });
      await new Promise(r => setTimeout(r, 40));
    }
  } catch (_) {}
}

async function extractOrdersFromPage() {
  const processedItemKeys = new Set();

  // Diagnóstico automático para trackings conocidos de FedEx
  try {
    const testTrackings = ['383425182826', '383403154637', '876316697415', '876173494889'];
    console.group('[Smartbits Diagnostic] Búsqueda de Trackings Conocidos en eBay');
    testTrackings.forEach(trk => {
      const inHtml = document.documentElement ? document.documentElement.innerHTML.includes(trk) : false;
      console.log(`Tracking ${trk}: ¿Presente en document.documentElement.innerHTML? -> ${inHtml ? '✅ SÍ' : '❌ NO'}`);
      if (inHtml) {
        document.querySelectorAll('script').forEach((sc, i) => {
          if ((sc.textContent || '').includes(trk)) {
            console.log(`  -> Presente en <script idx="${i}"> (type: "${sc.type}", id: "${sc.id}")`);
          }
        });
        document.querySelectorAll('*').forEach(el => {
          if (el.children.length === 0 && (el.innerText || el.textContent || '').includes(trk)) {
            console.log(`  -> Presente en elemento <${el.tagName}> texto: "${(el.innerText || el.textContent || '').slice(0, 80)}"`);
          }
        });
      }
    });
    console.groupEnd();
  } catch (diagErr) {
    console.warn('[Smartbits Diagnostic] Error en diagnóstico:', diagErr);
  }

  // Forzar lazy loading programáticamente sin requerir scroll manual del usuario
  await autoTriggerLazyLoad();

  // 1. Buscar contenedores estándar de órdenes en eBay
  const cardCandidates = document.querySelectorAll(
    '[data-testid*="order-card"], .m-order-card, .purchase-card, .order-item, [class*="orderCard"], div.sh-card, [data-order-id], [class*="order-container"], [class*="order-card-container"]'
  );

  let cards = Array.from(cardCandidates);

  // 2. Si no hay contenedores estándar, buscar por elementos con formato de orden XX-XXXXX-XXXXX
  if (cards.length === 0) {
    const allDivs = document.querySelectorAll('div, section, article, li');
    const seenNodes = new Set();
    allDivs.forEach(div => {
      if (div.innerText && /\b[0-9]{2}-[0-9]{5}-[0-9]{5}\b/.test(div.innerText)) {
        const hasChildWithSameOrder = Array.from(div.children).some(c => /\b[0-9]{2}-[0-9]{5}-[0-9]{5}\b/.test(c.innerText));
        if (!hasChildWithSameOrder && div.children.length >= 1) {
          let container = div;
          for (let i = 0; i < 4; i++) {
            if (container.parentElement && container.parentElement !== document.body && container.parentElement !== document.documentElement) {
              const matchesInParent = (container.parentElement.innerText || '').match(/\b[0-9]{2}-[0-9]{5}-[0-9]{5}\b/g) || [];
              if (matchesInParent.length === 1) {
                container = container.parentElement;
              } else {
                break;
              }
            }
          }
          if (!seenNodes.has(container)) {
            seenNodes.add(container);
            cards.push(container);
          }
        }
      }
    });
  }

  // 3. Si aún no hay, buscar a través de enlaces a artículos /itm/
  if (cards.length === 0) {
    const itemLinks = document.querySelectorAll('a[href*="/itm/"]');
    const containerSet = new Set();
    itemLinks.forEach(link => {
      let parent = link.parentElement;
      for (let i = 0; i < 8; i++) {
        if (!parent || parent === document.body) break;
        if (parent.classList.contains('card') || parent.tagName === 'SECTION' || parent.tagName === 'LI' || parent.getAttribute('role') === 'region' || parent.querySelector('button, [class*="order"]')) {
          containerSet.add(parent);
          break;
        }
        parent = parent.parentElement;
      }
    });
    cards = Array.from(containerSet);
  }

  // 4. Fallback para detalle de orden específica
  if (cards.length === 0 && /\b[0-9]{2}-[0-9]{5}-[0-9]{5}\b/.test(document.body.innerText)) {
    const mainContainer = document.querySelector('main, #mainContent, #main, [role="main"]') || document.body;
    cards.push(mainContainer);
  }

  const cardResults = await Promise.all(cards.map(async (card, cardIndex) => {
    const cardOrders = [];
    try {
      // 0. Contenedor completo de la orden para abarcar encabezado, estado y cuerpo
      let orderWrapper = card;
      let pCur = card;
      for (let s = 0; s < 5; s++) {
        if (!pCur || pCur === document.body || pCur === document.documentElement) break;
        if (pCur.matches && pCur.matches('[data-testid*="order-card"], .m-order-card, .purchase-card, [class*="orderCard"], [class*="order-card"], [class*="order-container"], [role="region"], li, section, article')) {
          orderWrapper = pCur;
        }
        pCur = pCur.parentElement;
      }

      const cardText = card.innerText || '';
      const wrapperText = orderWrapper ? (orderWrapper.innerText || orderWrapper.textContent || '') : '';
      const fullText = `${cardText}\n${wrapperText}`;
      const fullHtml = orderWrapper ? orderWrapper.innerHTML : (card.innerHTML || '');

      // 1. Número de Orden de eBay
      let orderId = '';
      const orderMatch = fullText.match(/(?:Order|Orden|Pedido)\s*(?:number|número|#|:)?\s*([0-9]{2}-[0-9]{5}-[0-9]{5})/i) ||
                         fullText.match(/\b([0-9]{2}-[0-9]{5}-[0-9]{5})\b/) ||
                         window.location.href.match(/orderId=([0-9]{2}-[0-9]{5}-[0-9]{5})/i);
      if (orderMatch) {
        orderId = orderMatch[1];
      } else {
        const attrId = (orderWrapper || card).getAttribute('data-order-id') || (orderWrapper || card).getAttribute('data-orderid');
        if (attrId) orderId = attrId;
        else orderId = `order_${cardIndex + 1}`;
      }

      if (/3570|5410|precision|latitude|inspiron/i.test(fullText)) {
        console.group(`[Smartbits Diagnostic] Tarjeta #${cardIndex + 1} (${orderId})`);
        console.log('Texto resumen:', fullText.replace(/\s+/g, ' ').slice(0, 200));
        (orderWrapper || card).querySelectorAll('a, button, [role="button"]').forEach(btn => {
          console.log(`  -> "${(btn.innerText || btn.textContent || '').trim()}" | href="${btn.getAttribute('href') || ''}" | data-testid="${btn.getAttribute('data-testid') || ''}"`);
        });
        console.groupEnd();
      }

      // 2. Fecha de compra
      const purchaseDate = parseEbayOrderDate(orderWrapper || card, fullText);

      // 3. Vendedor
      let seller = '';
      const sellerLink = (orderWrapper || card).querySelector('a[href*="/usr/"], a[href*="/str/"]');
      if (sellerLink) {
        seller = cleanText(sellerLink.innerText) || cleanText(sellerLink.href.split('/').pop());
      } else {
        const sellerMatch = fullText.match(/(?:Sold by|Vendido por|Seller:)\s*([A-Za-z0-9_-]+)/i);
        if (sellerMatch) seller = sellerMatch[1];
      }

      // Detección de estado del envío en eBay (ej. "Awaiting shipment")
      const awaitingShipmentRegex = /(?:awaiting[\s_-]*(?:shipment|dispatch)|pending[\s_-]*shipment|shipping[\s_-]*pending|not[\s_-]*yet[\s_-]*shipped|will[\s_-]*ship|order[\s_-]*placed|order[\s_-]*confirmed|esperando[\s_-]*(?:el[\s_-]*)?env[ií]o|pendiente[\s_-]*de[\s_-]*env[ií]o)/i;
      const deliveredRegex = /\b(?:delivered|entregado)\b/i;
      const shippedRegex = /\b(?:shipped|in[\s_-]*transit|enviado|en[\s_-]*tr[aá]nsito)\b/i;

      let cardAwaiting = awaitingShipmentRegex.test(fullText) || awaitingShipmentRegex.test(fullHtml);
      const isDelivered = deliveredRegex.test(fullText);
      const isShipped = shippedRegex.test(fullText);

      if (!cardAwaiting && orderWrapper) {
        const statusEls = orderWrapper.querySelectorAll('[class*="status"], [class*="badge"], [data-testid*="status"], [aria-label], [title]');
        for (const el of statusEls) {
          const txt = `${el.innerText || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`;
          if (awaitingShipmentRegex.test(txt)) {
            cardAwaiting = true;
            break;
          }
        }
      }

      // Si no tiene indicación de entregado ni de enviado, ni botón directo de TrackPackage:
      if (!cardAwaiting && !isDelivered && !isShipped && !fullHtml.includes('TrackPackage')) {
        cardAwaiting = true;
      }

      // 4. Tracking general de la orden (extraído EXCLUSIVAMENTE dentro del nodo de esta tarjeta)
      const orderTrackingInfo = extractTrackingFromNode(card, '', orderId);

      // Si la orden aún no tiene tracking directo en la tarjeta, buscar en scripts solo si NO está esperando envío
      if (!orderTrackingInfo.trackingNumber && orderId && !cardAwaiting) {
        const scriptTrk = findTrackingInScripts(orderId, '');
        if (scriptTrk) {
          orderTrackingInfo.trackingNumber = scriptTrk;
          orderTrackingInfo.courier = detectCourier(scriptTrk);
        }
      }

      // 5. EXTRACCIÓN MULTI-ARTÍCULO INDEPENDIENTE
      const allItemLinks = Array.from(card.querySelectorAll('a[href*="/itm/"]'));
      const itemsMap = new Map();

      allItemLinks.forEach(link => {
        const url = link.href;
        const itmMatch = url.match(/\/itm\/(?:[^\/]+\/)?([0-9]+)/);
        const itemId = itmMatch ? itmMatch[1] : url;

        if (!itemsMap.has(itemId)) {
          itemsMap.set(itemId, {
            itemId,
            url,
            links: [link]
          });
        } else {
          itemsMap.get(itemId).links.push(link);
        }
      });

      if (itemsMap.size > 0) {
        let itemIdx = 0;
        for (const [itemId, itemGroup] of itemsMap.entries()) {
          itemIdx++;
          const firstLink = itemGroup.links[0] || card;

          // Localizar el contenedor específico del artículo
          let itemRow = firstLink.closest ? firstLink.closest('[data-testid*="item"], [class*="item-card"], [class*="order-item"], [class*="orderItem"], tr, [role="row"], li') : null;
          if (!itemRow) {
            let cur = firstLink.parentElement;
            while (cur && cur !== card) {
              const hasPrice = cur.querySelector('.price, [class*="price"], [data-testid*="price"]');
              const isOrderHeader = cur.querySelector('[class*="order-header"], [class*="orderHeader"], [data-testid*="order-total"]');
              if (hasPrice && !isOrderHeader) {
                itemRow = cur;
                break;
              }
              cur = cur.parentElement;
            }
          }
          if (!itemRow) itemRow = firstLink.parentElement || card;

          // 5.1 TÍTULO LIMPIO (con sanitización total)
          let title = '';
          for (const l of itemGroup.links) {
            const txt = cleanTitle(l.innerText) || cleanTitle(l.getAttribute('title')) || cleanTitle(l.getAttribute('aria-label'));
            if (txt.length > title.length) title = txt;
          }

          if (title.length < 5 && itemRow) {
            const heading = itemRow.querySelector('h3, h4, .item-title, .title, a');
            if (heading) title = cleanTitle(heading.innerText);
          }

          if (!title || title.length < 2) {
            title = cleanTitle(card.querySelector('h3, h4, [class*="title"], a')?.innerText) || `Artículo de eBay #${itemId}`;
          }

          // 5.2 IMAGEN DEL ARTÍCULO (sin requerir scroll manual)
          let imageUrl = extractImageFromNode(itemRow, itemId, orderId);
          if (!imageUrl) {
            for (const l of itemGroup.links) {
              imageUrl = extractImageFromNode(l, itemId, orderId);
              if (imageUrl) break;
            }
          }
          if (!imageUrl) {
            imageUrl = extractImageFromNode(card, itemId, orderId);
          }
          if (!imageUrl) {
            imageUrl = findImageInScripts(itemId, orderId);
          }

          // 5.3 TRACKING INDIVIDUAL DEL ARTÍCULO (soporta Delivered y en tránsito)
          const itemText = (itemRow ? `${itemRow.innerText || ''}\n${itemRow.textContent || ''}` : '') || cardText;
          const itemFullText = `${itemText}\n${fullText}`;

          const itemDelivered = isDelivered || deliveredRegex.test(itemFullText);
          const itemShipped = isShipped || shippedRegex.test(itemFullText);
          let itemAwaiting = cardAwaiting || awaitingShipmentRegex.test(itemFullText);

          let itemTrackingInfo = extractTrackingFromNode(itemRow, itemId, orderId);
          let itemTrackingNumber = itemTrackingInfo.trackingNumber;
          let itemCourier = itemTrackingInfo.courier;

          // Si itemRow no tiene tracking directo, buscar en toda la tarjeta de la orden
          if (!itemTrackingNumber && card) {
            const cardTrackingInfo = extractTrackingFromNode(card, itemId, orderId);
            if (cardTrackingInfo.trackingNumber) {
              itemTrackingNumber = cardTrackingInfo.trackingNumber;
              itemCourier = cardTrackingInfo.courier;
              if (cardTrackingInfo.trackHref && !itemTrackingInfo.trackHref) {
                itemTrackingInfo.trackHref = cardTrackingInfo.trackHref;
              }
            }
          }

          // Búsqueda en scripts usando orderId e itemId solo si no está en espera de envío
          if (!itemTrackingNumber && orderId && !itemAwaiting) {
            const scriptTrk = findTrackingInScripts(orderId, itemId);
            if (scriptTrk) {
              itemTrackingNumber = scriptTrk;
              itemCourier = detectCourier(scriptTrk);
            }
          }

          if (!itemTrackingNumber && orderTrackingInfo.trackingNumber && !itemAwaiting) {
            itemTrackingNumber = orderTrackingInfo.trackingNumber;
            itemCourier = orderTrackingInfo.courier;
          }

          // Si el pedido está en espera de envío ("Awaiting shipment") y no hay botón explícito de TrackPackage en el DOM,
          // garantizamos que quede limpio sin guías falsas o heredadas
          if (itemAwaiting && !card.querySelector('a[href*="TrackPackage"], a[href*="track_number"], a[href*="tracking"]')) {
            itemTrackingNumber = '';
            itemCourier = 'otro';
          }

          // Si no tiene tracking y no ha sido entregado ni marcado como enviado, está en espera de envío
          if (!itemTrackingNumber && !itemDelivered && !itemShipped) {
            itemAwaiting = true;
          }

          // 5.4 PRECIO INDIVIDUAL DEL ARTÍCULO
          let price = 0;
          let qty = 1;

          const qtyMatch = itemText.match(/(?:Quantity|Qty|Cantidad|Cant\.)\s*[:#]?\s*([0-9]+)/i) ||
                           itemText.match(/\b([0-9]+)\s*(?:items|artículos|unidades)\b/i);
          if (qtyMatch) {
            qty = parseInt(qtyMatch[1], 10) || 1;
          }

          const unitMatch = itemText.match(/(?:\$|US\s*\$)\s*([0-9,]+(?:\.[0-9]{2})?)\s*(?:each|ea\.?|c\/u|cada uno)/i);
          if (unitMatch) {
            price = parsePrice(unitMatch[1]);
          }

          if (!price && itemRow) {
            const itemPriceEl = itemRow.querySelector('[data-testid*="price"], [class*="price"], .price, [class*="cost"]');
            if (itemPriceEl) price = parsePrice(itemPriceEl.innerText);
          }

          if (!price && itemRow) {
            price = parsePrice(itemRow.innerText);
          }

          if (!price && itemsMap.size === 1) {
            const cardPriceEl = card.querySelector('.price, [class*="price"], [data-testid*="price"]');
            if (cardPriceEl) price = parsePrice(cardPriceEl.innerText);
            if (!price) price = parsePrice(cardText);
          }

          if (price > 0 && qty > 1 && !unitMatch) {
            price = Math.round((price / qty) * 100) / 100;
          }

          const effectiveTrackHref = itemTrackingInfo.trackHref || orderTrackingInfo.trackHref || '';

          if (qty > 1) {
            for (let q = 1; q <= qty; q++) {
              const multiKey = `${orderId}_${itemId}_u${q}`;
              if (processedItemKeys.has(multiKey)) continue;
              processedItemKeys.add(multiKey);

              cardOrders.push({
                cardIndex,
                itemIndex: itemIdx,
                orderId,
                itemId: `${itemId}_u${q}`,
                uniqueKey: multiKey,
                titulo: `${title} (Unidad ${q}/${qty})`,
                precio: price,
                fecha_compra: purchaseDate,
                vendedor: seller,
                foto_url: imageUrl,
                item_url: itemGroup.url,
                tracking_usa: itemTrackingNumber,
                courier_usa: itemCourier,
                trackHref: effectiveTrackHref,
                isAwaitingShipment: itemAwaiting && !itemTrackingNumber,
                isDelivered: itemDelivered,
                shipping_status: (itemAwaiting && !itemTrackingNumber) ? 'awaiting_shipment' : (itemDelivered ? 'delivered' : 'pendiente'),
                estado: 'pendiente'
              });
            }
          } else {
            const uniqueKey = `${orderId}_${itemId}`;
            if (processedItemKeys.has(uniqueKey)) continue;
            processedItemKeys.add(uniqueKey);

            cardOrders.push({
              cardIndex,
              itemIndex: itemIdx,
              orderId,
              itemId,
              uniqueKey,
              titulo: title,
              precio: price,
              fecha_compra: purchaseDate,
              vendedor: seller,
              foto_url: imageUrl,
              item_url: itemGroup.url,
              tracking_usa: itemTrackingNumber,
              courier_usa: itemCourier,
              trackHref: effectiveTrackHref,
              isAwaitingShipment: itemAwaiting && !itemTrackingNumber,
              isDelivered: itemDelivered,
              shipping_status: (itemAwaiting && !itemTrackingNumber) ? 'awaiting_shipment' : (itemDelivered ? 'delivered' : 'pendiente'),
              estado: 'pendiente'
            });
          }
        }
      } else {
        // Fallback para compras donde no se encontró enlace /itm/
        const uniqueKey = `${orderId}_item_1`;
        if (!processedItemKeys.has(uniqueKey)) {
          processedItemKeys.add(uniqueKey);

          const title = cleanTitle(card.querySelector('h3, h4, .item-title, .title, a')?.innerText) || `Artículo de orden #${orderId}`;
          const imageUrl = extractImageFromNode(card, '', orderId) || findImageInScripts('', orderId);

          let price = 0;
          const priceElem = card.querySelector('.price, [class*="price"], [data-testid*="price"]');
          if (priceElem) price = parsePrice(priceElem.innerText);
          if (!price) price = parsePrice(cardText);

          const trkInfo = extractTrackingFromNode(card, '', orderId);
          let trackingNum = trkInfo.trackingNumber;
          let courier = trkInfo.courier;

          if (!trackingNum && orderId && !cardAwaiting) {
            const scriptTrk = findTrackingInScripts(orderId, '', title);
            if (scriptTrk) {
              trackingNum = scriptTrk;
              courier = detectCourier(scriptTrk);
            }
          }

          if (cardAwaiting && !card.querySelector('a[href*="TrackPackage"], a[href*="track_number"], a[href*="tracking"]')) {
            trackingNum = '';
            courier = 'otro';
          }

          cardOrders.push({
            cardIndex,
            itemIndex: 0,
            orderId,
            itemId: orderId,
            uniqueKey,
            titulo: title,
            precio: price,
            fecha_compra: purchaseDate,
            vendedor: seller,
            foto_url: imageUrl,
            item_url: '',
            tracking_usa: trackingNum,
            courier_usa: courier,
            trackHref: trkInfo.trackHref || '',
            isAwaitingShipment: (cardAwaiting || (!trackingNum && !isDelivered && !isShipped)) && !trackingNum,
            isDelivered: isDelivered,
            shipping_status: (cardAwaiting && !trackingNum) ? 'awaiting_shipment' : (isDelivered ? 'delivered' : 'pendiente'),
            estado: 'pendiente'
          });
        }
      }
    } catch (err) {
      console.warn('Smartbits: Error procesando tarjeta:', err);
    }
    return cardOrders;
  }));

  const orders = cardResults.flat();

  // Validación de seguridad contra contaminación cruzada de trackings:
  // En eBay cada orden distinta tiene su propio tracking. Si un mismo tracking aparece en órdenes con orderId diferente, se descarta.
  const trackingOwners = new Map();
  for (const o of orders) {
    if (o.tracking_usa && o.orderId) {
      const owner = trackingOwners.get(o.tracking_usa);
      if (owner && owner !== o.orderId) {
        trackingOwners.set(o.tracking_usa, 'COLLISION');
      } else if (!owner) {
        trackingOwners.set(o.tracking_usa, o.orderId);
      }
    }
  }
  for (const o of orders) {
    if (o.tracking_usa && trackingOwners.get(o.tracking_usa) === 'COLLISION') {
      console.warn(`[Smartbits] Descartando tracking contaminado ${o.tracking_usa} presente en múltiples órdenes.`);
      o.tracking_usa = '';
      o.courier_usa = 'otro';
    }
  }

  // Ordenar estrictamente por fecha de orden descendente (más reciente primero),
  // y por orden visual de aparición en la página de eBay (cardIndex y itemIndex)
  orders.sort((a, b) => {
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

  return orders;
}

// Escuchar peticiones desde popup evitando listeners duplicados al re-ejecutar el script
function handleEbayMessage(request, sender, sendResponse) {
  if (request.action === 'EXTRACT_EBAY_ORDERS') {
    extractOrdersFromPage().then(orders => {
      sendResponse({ success: true, count: orders.length, orders });
    }).catch(err => {
      console.error('[Smartbits] Error extrayendo compras:', err);
      sendResponse({ success: false, error: err.message, orders: [] });
    });
    return true;
  }
}

if (window.__SMARTBITS_LISTENER_ACTIVE__) {
  chrome.runtime.onMessage.removeListener(window.__SMARTBITS_LISTENER_ACTIVE__);
}
window.__SMARTBITS_LISTENER_ACTIVE__ = handleEbayMessage;
chrome.runtime.onMessage.addListener(handleEbayMessage);

// --- CAPTURA PASIVA EN NAVEGACIÓN (100% segura contra rate-limits de eBay) ---
// Cuando el usuario visita con normalidad una página de rastreo o detalle de orden,
// capturamos la guía en segundo plano y la guardamos en la caché local sin hacer peticiones extra.
function autoCaptureTrackingOnTrackingPage() {
  try {
    const href = window.location.href || '';
    const isTrackingPage = href.includes('TrackPackage') || 
                           href.includes('/ord/show') || 
                           href.includes('/vod/') || 
                           href.includes('/purchase/tracking') ||
                           href.includes('/ship/tra');
    if (!isTrackingPage) return;

    // 1. Extraer orderId de la URL o del DOM
    let orderId = '';
    const mUrl = href.match(/orderId=([0-9]{2}-[0-9]{5}-[0-9]{5})/i);
    if (mUrl) {
      orderId = mUrl[1];
    } else {
      const mText = (document.body ? document.body.innerText : '').match(/\b([0-9]{2}-[0-9]{5}-[0-9]{5})\b/);
      if (mText) orderId = mText[1];
    }

    if (!orderId) return;

    // 2. Extraer tracking number y courier del DOM
    const trkInfo = extractTrackingFromNode(document.body, '', orderId);
    if (trkInfo && trkInfo.trackingNumber && isValidTrackingNumber(trkInfo.trackingNumber)) {
      console.log(`[Smartbits] 📦 Guía capturada pasivamente en navegación (${orderId}): ${trkInfo.courier.toUpperCase()} ${trkInfo.trackingNumber}`);
      
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['sb_ebay_trackings_cache'], (data) => {
          const cache = data.sb_ebay_trackings_cache || {};
          cache[orderId] = {
            trackingNumber: trkInfo.trackingNumber,
            courier: trkInfo.courier
          };
          chrome.storage.local.set({ sb_ebay_trackings_cache: cache });
        });
      }
    }
  } catch (err) {
    console.debug('[Smartbits] autoCaptureTracking error:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoCaptureTrackingOnTrackingPage);
} else {
  autoCaptureTrackingOnTrackingPage();
}


