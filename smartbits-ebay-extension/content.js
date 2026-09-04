/**
 * Smartbits - eBay Purchase History Extractor (Soporte multi-artículo / compras combinadas)
 */

function cleanText(str) {
  return str ? str.replace(/\s+/g, ' ').trim() : '';
}

function parsePrice(text) {
  if (!text) return 0;
  const match = text.match(/\$\s*([0-9,]+(?:\.[0-9]{2})?)/);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  return 0;
}

function detectCourier(tracking) {
  if (!tracking) return 'otro';
  const clean = tracking.replace(/[\s-]/g, '').toUpperCase();
  if (/^1Z[0-9A-Z]{16}$/i.test(clean)) return 'ups';
  if (/^(94|93|92|95|91)[0-9]{18,22}$/.test(clean) || /^[0-9]{20,22}$/.test(clean)) return 'usps';
  if (/^[0-9]{12}$/.test(clean) || /^[0-9]{15}$/.test(clean)) return 'fedex';
  if (/^[0-9]{10}$/.test(clean)) return 'dhl';
  return 'otro';
}

function parseEbayOrderDate(card, cardText) {
  // 1. Buscar en elementos de encabezado o fecha de la orden
  const dateElements = card.querySelectorAll('[data-testid*="order-date"], [data-testid*="date"], .order-date, [class*="orderDate"], [class*="order-header"], [class*="orderHeader"], [class*="order-info"]');
  let combinedText = '';
  dateElements.forEach(el => {
    combinedText += ' ' + (el.innerText || '');
  });
  combinedText += ' ' + (cardText || '');

  // Patrones: "Order date:Aug 29, 2026", "Order date: Aug 29, 2026", "Ordered on...", etc.
  const regex = /(?:Order\s*date|Ordered\s*on|Order\s*placed\s*on|Order\s*placed|Placed\s*on|Purchased\s*on|Fecha\s*(?:del\s*pedido|de\s*la\s*orden|de\s*compra)?|Comprado\s*el)\s*[:\s]\s*([A-Za-z]{3,10}\s+[0-9]{1,2},?\s+[0-9]{4}|[0-9]{1,2}\s+(?:de\s+)?[A-Za-z]{3,10},?\s+(?:de\s+)?[0-9]{4}|[0-9]{1,2}[\/\.-][0-9]{1,2}[\/\.-][0-9]{2,4})/i;

  const match = combinedText.match(regex);
  let dateStr = match ? match[1] : null;

  // Fallback: buscar patrón "Aug 29, 2026" directamente en el texto
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

  // Formato: "Aug 29, 2026"
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

  // Formato: "29 Aug 2026"
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

function extractOrdersFromPage() {
  const orders = [];
  const processedItemKeys = new Set();

  // Buscar contenedores de órdenes en eBay
  const cardCandidates = document.querySelectorAll(
    '[data-testid*="order-card"], .m-order-card, .purchase-card, .order-item, [class*="orderCard"], div.sh-card, [data-order-id]'
  );

  let cards = Array.from(cardCandidates);

  if (cards.length === 0) {
    const itemLinks = document.querySelectorAll('a[href*="/itm/"]');
    const containerSet = new Set();
    itemLinks.forEach(link => {
      let parent = link.parentElement;
      for (let i = 0; i < 7; i++) {
        if (parent && (parent.classList.contains('card') || parent.tagName === 'SECTION' || parent.tagName === 'LI' || parent.getAttribute('role') === 'region')) {
          containerSet.add(parent);
          break;
        }
        parent = parent?.parentElement;
      }
    });
    cards = Array.from(containerSet);
  }

  if (cards.length === 0) {
    const allDivs = document.querySelectorAll('div, section, article');
    allDivs.forEach(div => {
      if (div.innerText && /(?:Order|Orden)\s*(?:number|número|#|:)?\s*[0-9]{2}-[0-9]{5}-[0-9]{5}/i.test(div.innerText) && div.children.length > 2 && div.children.length < 30) {
        cards.push(div);
      }
    });
  }

  cards.forEach((card, cardIndex) => {
    try {
      const cardText = card.innerText || '';

      // 1. Número de Orden de eBay
      let orderId = '';
      const orderMatch = cardText.match(/(?:Order|Orden|Pedido)\s*(?:number|número|#|:)?\s*([0-9]{2}-[0-9]{5}-[0-9]{5})/i);
      if (orderMatch) {
        orderId = orderMatch[1];
      } else {
        const attrId = card.getAttribute('data-order-id') || card.getAttribute('data-orderid');
        if (attrId) orderId = attrId;
        else orderId = `order_${cardIndex + 1}`;
      }

      // 2. Fecha de compra (ej. "Order date:Aug 29, 2026" -> "2026-08-29")
      const purchaseDate = parseEbayOrderDate(card, cardText);

      // 3. Vendedor
      let seller = '';
      const sellerLink = card.querySelector('a[href*="/usr/"], a[href*="/str/"]');
      if (sellerLink) {
        seller = cleanText(sellerLink.innerText) || cleanText(sellerLink.href.split('/').pop());
      } else {
        const sellerMatch = cardText.match(/(?:Sold by|Vendido por|Seller:)\s*([A-Za-z0-9_-]+)/i);
        if (sellerMatch) seller = sellerMatch[1];
      }

      // 4. Tracking y Courier de USA
      let trackingNumber = '';
      let courier = 'otro';

      const trackingLink = card.querySelector('a[href*="tracking"], a[data-testid*="tracking"], button[data-testid*="tracking"]');
      if (trackingLink) {
        const textTrack = cleanText(trackingLink.innerText);
        const codeMatch = textTrack.match(/(1Z[0-9A-Z]{16}|9[0-9]{21}|[0-9]{12,22})/i);
        if (codeMatch) trackingNumber = codeMatch[1];
      }

      if (!trackingNumber) {
        const trackingTextMatch = cardText.match(/(?:Tracking number|Número de seguimiento|Tracking #|Tracking:)\s*([0-9A-Za-z]{10,34})/i);
        if (trackingTextMatch) trackingNumber = trackingTextMatch[1];
      }

      if (!trackingNumber) {
        const upsMatch = cardText.match(/\b(1Z[0-9A-Z]{16})\b/i);
        if (upsMatch) {
          trackingNumber = upsMatch[1];
          courier = 'ups';
        } else {
          const uspsMatch = cardText.match(/\b(94[0-9]{20}|92[0-9]{20}|93[0-9]{20})\b/);
          if (uspsMatch) {
            trackingNumber = uspsMatch[1];
            courier = 'usps';
          }
        }
      }

      if (trackingNumber && courier === 'otro') {
        courier = detectCourier(trackingNumber);
      }

      // 5. EXTRACCIÓN MULTI-ARTÍCULO
      // Buscar todos los enlaces a artículos /itm/ dentro de la orden
      const allItemLinks = Array.from(card.querySelectorAll('a[href*="/itm/"]'));
      
      // Agrupar enlaces por ID de artículo de eBay (para no duplicar si la foto y el título son enlaces separados)
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

      // Si se encontraron enlaces de artículos agrupados
      if (itemsMap.size > 0) {
        itemsMap.forEach((itemGroup, itemId) => {
          const uniqueKey = `${orderId}_${itemId}`;
          if (processedItemKeys.has(uniqueKey)) return;
          processedItemKeys.add(uniqueKey);

          // Buscar título: el enlace que tenga texto descriptivo más largo
          let title = '';
          for (const l of itemGroup.links) {
            const txt = cleanText(l.innerText) || cleanText(l.getAttribute('title')) || cleanText(l.getAttribute('aria-label'));
            if (txt.length > title.length) title = txt;
          }

          // Si el título es muy corto, buscar en contenedores cercanos
          if (title.length < 5) {
            const firstLink = itemGroup.links[0];
            const parentRow = firstLink.closest('[class*="item"], tr, [role="row"], .card, div') || firstLink.parentElement;
            const heading = parentRow?.querySelector('h3, h4, .item-title, .title, a');
            if (heading) title = cleanText(heading.innerText);
          }

          if (!title) return; // Si no hay título, ignorar

          // Buscar imagen correspondiente a este ítem
          let imageUrl = '';
          for (const l of itemGroup.links) {
            const img = l.querySelector('img') || l.parentElement?.querySelector('img');
            if (img && (img.src || img.getAttribute('data-src'))) {
              imageUrl = img.src || img.getAttribute('data-src') || '';
              break;
            }
          }
          if (!imageUrl) {
            const firstLink = itemGroup.links[0];
            const parentRow = firstLink.closest('[class*="item"], tr, [role="row"], div') || card;
            const img = parentRow.querySelector('img[src*="ebayimg.com"], img');
            if (img) imageUrl = img.src || img.getAttribute('data-src') || '';
          }

          // Buscar precio específico del ítem
          let price = 0;
          const firstLink = itemGroup.links[0];
          const itemRow = firstLink.closest('[class*="item"], tr, [role="row"], div') || firstLink.parentElement;
          if (itemRow) {
            const priceEl = itemRow.querySelector('.price, [class*="price"], [data-testid*="price"]');
            if (priceEl) price = parsePrice(priceEl.innerText);
            if (!price) price = parsePrice(itemRow.innerText);
          }
          // Si no hay precio por ítem, usar el total de la orden
          if (!price) {
            const cardPriceEl = card.querySelector('.price, [class*="price"], [data-testid*="price"]');
            if (cardPriceEl) price = parsePrice(cardPriceEl.innerText);
            if (!price) price = parsePrice(cardText);
          }

          orders.push({
            orderId,
            itemId,
            uniqueKey,
            titulo: title,
            precio: price,
            fecha_compra: purchaseDate,
            vendedor: seller,
            foto_url: imageUrl,
            item_url: itemGroup.url,
            tracking_usa: trackingNumber,
            courier_usa: courier,
            estado: 'pendiente'
          });
        });
      } else {
        // Fallback para tarjetas donde no se encontró /itm/ explícito
        const uniqueKey = `${orderId}_item_1`;
        if (processedItemKeys.has(uniqueKey)) return;
        processedItemKeys.add(uniqueKey);

        let title = '';
        const h3OrH4 = card.querySelector('h3, h4, .item-title, .title, a');
        if (h3OrH4) title = cleanText(h3OrH4.innerText);

        if (!title) return;

        let imageUrl = '';
        const imgElem = card.querySelector('img[src*="ebayimg.com"], img');
        if (imgElem) imageUrl = imgElem.src || imgElem.getAttribute('data-src') || '';

        let price = 0;
        const priceElem = card.querySelector('.price, [class*="price"]');
        if (priceElem) price = parsePrice(priceElem.innerText);
        if (!price) price = parsePrice(cardText);

        orders.push({
          orderId,
          itemId: orderId,
          uniqueKey,
          titulo: title,
          precio: price,
          fecha_compra: purchaseDate,
          vendedor: seller,
          foto_url: imageUrl,
          item_url: '',
          tracking_usa: trackingNumber,
          courier_usa: courier,
          estado: 'pendiente'
        });
      }
    } catch (err) {
      console.warn('Smartbits: Error procesando tarjeta:', err);
    }
  });

  return orders;
}

// Escuchar peticiones desde popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_EBAY_ORDERS') {
    const orders = extractOrdersFromPage();
    sendResponse({ success: true, count: orders.length, orders });
  }
  return true;
});
