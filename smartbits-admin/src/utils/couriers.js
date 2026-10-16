// Utilidades y configuración de Couriers para Rastreo de Envíos Smartbits
import { tieneEnvioPagado } from './costos';

export const COURIERS_USA = [
  { id: 'usps', nombre: 'USPS', color: 'bg-blue-600 text-white', icon: '📬' },
  { id: 'ups', nombre: 'UPS', color: 'bg-amber-800 text-white', icon: '📦' },
  { id: 'fedex', nombre: 'FedEx', color: 'bg-purple-700 text-white', icon: '✈️' },
  { id: 'dhl', nombre: 'DHL USA', color: 'bg-yellow-400 text-red-800', icon: '🚚' },
  { id: 'amazon', nombre: 'Amazon', color: 'bg-slate-800 text-white', icon: '🛒' },
  { id: 'otro', nombre: 'Otro Courier', color: 'bg-gray-600 text-white', icon: '📦' },
];

export const COURIERS_VZLA = [
  { id: 'liberty', nombre: 'Liberty Express', color: 'bg-red-600 text-white', badge: 'bg-red-50 text-red-700 border-red-200', icon: '🗽' },
  { id: 'zoom', nombre: 'Zoom Envíos', color: 'bg-blue-700 text-white', badge: 'bg-blue-50 text-blue-700 border-blue-200', icon: '⚡' },
  { id: 'tealca', nombre: 'Tealca', color: 'bg-blue-800 text-white', badge: 'bg-sky-50 text-sky-700 border-sky-200', icon: '🟦' },
  { id: 'mrw', nombre: 'MRW', color: 'bg-orange-600 text-white', badge: 'bg-orange-50 text-orange-700 border-orange-200', icon: '📦' },
  { id: 'dhl_vzla', nombre: 'DHL Venezuela', color: 'bg-yellow-500 text-red-900', badge: 'bg-amber-50 text-amber-800 border-amber-200', icon: '🚚' },
  { id: 'otro', nombre: 'Otro Courier', color: 'bg-gray-700 text-white', badge: 'bg-gray-50 text-gray-700 border-gray-200', icon: '📦' },
];

export const ESTADOS_TRACKING = [
  {
    key: 'por_prealertar',
    label: 'Por Prealertar',
    descripcion: 'Tracking USA registrado, pendiente por subir factura/alerta al casillero',
    color: 'bg-red-100 text-red-800 border-red-200',
    dot: 'bg-red-500',
    badge: 'bg-red-500 text-white',
    step: 1
  },
  {
    key: 'prealertado',
    label: 'Prealertado (En Tránsito USA)',
    descripcion: 'Pre-alerta enviada, paquete viajando hacia el almacén de Miami',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    badge: 'bg-amber-500 text-white',
    step: 2
  },
  {
    key: 'en_miami',
    label: 'Recibido en Miami (Guía VZLA)',
    descripcion: 'El casillero recibió el paquete y emitió la guía de courier',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    dot: 'bg-blue-500',
    badge: 'bg-blue-600 text-white',
    step: 3
  },
  {
    key: 'transito_vzla',
    label: 'En Tránsito Internacional / Aduana',
    descripcion: 'En vuelo/barco o en proceso aduanal de nacionalización',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    dot: 'bg-purple-500',
    badge: 'bg-purple-600 text-white',
    step: 4
  },
  {
    key: 'disponible_agencia',
    label: 'Disponible en Agencia VZLA',
    descripcion: 'Listo para que Smartbits vaya a retirar en sucursal local',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    dot: 'bg-orange-500',
    badge: 'bg-orange-600 text-white',
    step: 5
  },
  {
    key: 'ya_recogido',
    label: 'Ya Recogido (En Taller)',
    descripcion: 'Paquete en manos de Smartbits, en chequeo técnico previo a inventario',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-600 text-white',
    step: 6
  },
];

export function getEstadoConfig(estadoKey) {
  return ESTADOS_TRACKING.find(e => e.key === estadoKey) || ESTADOS_TRACKING[0];
}

export function getCourierUsaConfig(courierId) {
  return COURIERS_USA.find(c => c.id === courierId) || COURIERS_USA[COURIERS_USA.length - 1];
}

export function getCourierVzlaConfig(courierId) {
  return COURIERS_VZLA.find(c => c.id === courierId) || COURIERS_VZLA[COURIERS_VZLA.length - 1];
}

// Genera la URL directa de rastreo oficial para abrir en 1 clic
export function getTrackingUrlUsa(courierId, trackingNum) {
  const num = (trackingNum || '').trim();
  if (!num || num.startsWith('{') || num.startsWith('[') || num.includes('EVENTFAMILY') || num.includes('"') || num.length > 40) {
    return null;
  }

  switch (courierId) {
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(num)}`;
    case 'ups':
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(num)}`;
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(num)}`;
    case 'dhl':
      return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(num)}`;
    case 'amazon':
      return `https://track.amazon.com/tracking/${encodeURIComponent(num)}`;
    default:
      return `https://t.17track.net/en#nums=${encodeURIComponent(num)}`;
  }
}

export function getTrackingUrlVzla(courierId, trackingNum) {
  const num = (trackingNum || '').trim();
  if (!num) return null;

  switch (courierId) {
    case 'liberty':
      // URL directa de IQpack - no requiere login, muestra estado inmediatamente
      return `https://iqpack.libertyexpress.com/Tracking?nGuia=${encodeURIComponent(num)}`;
    case 'zoom':
      return `https://www.zoom.red/rastreo/`;
    case 'tealca':
      return `https://www.tealca.com/rastreo/?guia=${encodeURIComponent(num)}`;
    case 'mrw':
      return `https://www.mrwve.com/rastreo`;
    default:
      return `https://t.17track.net/en#nums=${encodeURIComponent(num)}`;
  }
}

// Estados Normalizados Universales para visualización unificada en Cards y Tablas
export const ESTADOS_NORMALIZADOS = {
  label_created: {
    key: 'label_created',
    label: 'Etiqueta creada (Pendiente despacho)',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
    icon: '🏷️'
  },
  in_transit: {
    key: 'in_transit',
    label: 'En tránsito hacia Miami',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
    icon: '✈️'
  },
  out_for_delivery: {
    key: 'out_for_delivery',
    label: 'En reparto a almacén Miami',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500',
    icon: '🚚'
  },
  delivered_miami: {
    key: 'delivered_miami',
    label: 'Entregado en Almacén Miami',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    icon: '🏢'
  },
  prealertado: {
    key: 'prealertado',
    label: 'Prealertado (Esperando paquete)',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    icon: '⏳'
  },
  en_miami: {
    key: 'en_miami',
    label: 'Recibido en Casillero Miami',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    dot: 'bg-sky-500',
    icon: '🗽'
  },
  transito_vzla: {
    key: 'transito_vzla',
    label: 'En Tránsito Internacional a VZLA',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500',
    icon: '🚢'
  },
  en_aduana: {
    key: 'en_aduana',
    label: 'En Aduana / Nacionalización',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    icon: '🏛️'
  },
  disponible_agencia: {
    key: 'disponible_agencia',
    label: 'Disponible en Sucursal VZLA',
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    dot: 'bg-teal-500',
    icon: '📍'
  },
  entregado_taller: {
    key: 'entregado_taller',
    label: 'Entregado en Taller Smartbits',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    dot: 'bg-indigo-600',
    icon: '🛠️'
  },
  exception: {
    key: 'exception',
    label: 'Retenido / Problema en Entrega',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
    icon: '⚠️'
  }
};

/**
 * Traduce el estatus crudo recibido de Liberty Express o Couriers USA a un estado normalizado.
 */
export function normalizarEstadoTracking(rawStatus, courierId = '') {
  if (!rawStatus) return null;
  const str = String(rawStatus).trim().toUpperCase();

  // 1. Entregado en destino final (Taller / Facturado)
  if (
    str.includes('FACTURAD') ||
    str.includes('ENTREGAD') ||
    str.includes('ENTREGA REALIZADA') ||
    str.includes('RETIRADO POR') ||
    str.includes('RETIRADO EN AGENCIA') ||
    str.includes('PAQUETE RETIRADO')
  ) {
    return ESTADOS_NORMALIZADOS.entregado_taller;
  }

  // 2. Prealertado en espera
  if (
    str.includes('GUÍA PRE ALERTADA') ||
    str.includes('GUIA PRE ALERTADA') ||
    str.includes('PREALERTAD') ||
    str.includes('ESPERANDO PAQUETE')
  ) {
    return ESTADOS_NORMALIZADOS.prealertado;
  }

  // 2. Disponible para retiro en sucursal / agencia VZLA
  if (
    str.includes('DISPONIBLE EN AGENCIA') ||
    str.includes('DISPONIBLE EN SUCURSAL') ||
    str.includes('LISTO PARA RETIRO') ||
    str.includes('DISPONIBLE')
  ) {
    return ESTADOS_NORMALIZADOS.disponible_agencia;
  }

  // 3. Aduana / Nacionalización
  if (
    str.includes('ADUANA') ||
    str.includes('NACIONALIZACION') ||
    str.includes('AEROPUERTO MAIQUETIA') ||
    str.includes('PUERTO LA GUAIRA')
  ) {
    return ESTADOS_NORMALIZADOS.en_aduana;
  }

  // 4. Tránsito internacional hacia VZLA (Liberty, Zoom, Tealca)
  if (
    str.includes('A BORDO') ||
    str.includes('TRANSPORTADO A SU DESTINO') ||
    str.includes('LISTO PARA SER EMBARCADO') ||
    str.includes('EMBARCADO') ||
    str.includes('EMPACADO') ||
    str.includes('DESPACHADO A VENEZUELA') ||
    str.includes('DESPACHADO') ||
    str.includes('EN VUELO') ||
    str.includes('EN BARCO') ||
    str.includes('TRANSITO INTERNACIONAL') ||
    str.includes('TRANSITO A VENEZUELA')
  ) {
    return ESTADOS_NORMALIZADOS.transito_vzla;
  }

  // 5. Recibido en Almacén Casillero Miami (Liberty / Otros)
  if (
    str.includes('RECIBIDO EN CENTRO DE DISTRIBUCION') ||
    str.includes('CENTRO DE DISTRIBUCION') ||
    str.includes('RECIBIDO EN SEDE') ||
    str.includes('RECIBIDO EN ALMACEN') ||
    str.includes('RECIBIDO EN MIAMI') ||
    str.includes('ALMACEN MIAMI') ||
    str.includes('PROCESADO MIAMI') ||
    str.includes('PROCESADO EN ALMACEN')
  ) {
    return ESTADOS_NORMALIZADOS.en_miami;
  }

  // 6. Entregado por courier USA en casillero Miami (UPS, FedEx, USPS)
  if (
    str.includes('DELIVERED') ||
    str.includes('ENTREGADO EN ALMACEN') ||
    str.includes('LEFT AT') ||
    str.includes('FRONT DESK') ||
    str.includes('MAILROOM') ||
    str.includes('DOCK') ||
    str.includes('DELIVERY COMPLETED')
  ) {
    return ESTADOS_NORMALIZADOS.delivered_miami;
  }

  // 7. En reparto / Out for delivery
  if (
    str.includes('OUT FOR DELIVERY') ||
    str.includes('EN REPARTO') ||
    str.includes('ON VEHICLE')
  ) {
    return ESTADOS_NORMALIZADOS.out_for_delivery;
  }

  // 8. En tránsito USA
  if (
    str.includes('IN TRANSIT') ||
    str.includes('ON THE WAY') ||
    str.includes('EN TRANSITO') ||
    str.includes('ACCEPTED') ||
    str.includes('ARRIVED AT USPS')
  ) {
    return ESTADOS_NORMALIZADOS.in_transit;
  }

  // 9. Etiqueta creada
  if (
    str.includes('LABEL CREATED') ||
    str.includes('PRE-SHIPMENT') ||
    str.includes('SHIPPING LABEL') ||
    str.includes('ETIQUETA CREADA')
  ) {
    return ESTADOS_NORMALIZADOS.label_created;
  }

  // 10. Excepciones
  if (
    str.includes('EXCEPTION') ||
    str.includes('DELAYED') ||
    str.includes('FAILED') ||
    str.includes('RETENIDO') ||
    str.includes('PROBLEMA')
  ) {
    return ESTADOS_NORMALIZADOS.exception;
  }

  // Fallback si trae texto descriptivo
  return {
    key: 'custom',
    label: rawStatus,
    badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
    dot: 'bg-slate-500',
    icon: '📦'
  };
}

/**
 * Retorna true si el estado indica entrega física final.
 */
export function esEstadoEntregado(estadoOrText) {
  if (!estadoOrText) return false;
  const str = String(estadoOrText).trim().toUpperCase();
  return (
    str === 'YA_RECOGIDO' ||
    str === 'ENTREGADO_TALLER' ||
    str.includes('FACTURAD') ||
    str.includes('ENTREGAD') ||
    str.includes('ENTREGA REALIZADA') ||
    str.includes('RETIRADO POR') ||
    str.includes('RETIRADO EN AGENCIA') ||
    str.includes('PAQUETE RETIRADO')
  );
}

/**
 * Retorna true si el paquete ya llegó al almacén de Miami o Centro de Distribución.
 */
export function esEstadoRecibidoMiami(estadoOrText) {
  if (!estadoOrText) return false;
  const str = String(estadoOrText).trim().toUpperCase();
  return (
    str === 'EN_MIAMI' ||
    str === 'DELIVERED_MIAMI' ||
    str.includes('RECIBIDO EN CENTRO DE DISTRIBUCION') ||
    str.includes('CENTRO DE DISTRIBUCION') ||
    str.includes('RECIBIDO EN SEDE') ||
    str.includes('RECIBIDO EN ALMACEN') ||
    str.includes('RECIBIDO EN MIAMI') ||
    str.includes('ALMACEN MIAMI') ||
    str.includes('PROCESADO MIAMI') ||
    str.includes('PROCESADO EN ALMACEN') ||
    esEstadoEntregado(str)
  );
}

/**
 * Evalúa de forma unificada el estado logístico de un ítem de compra (eBay / Casillero / Taller)
 * siguiendo la regla operativa:
 * 1. Disponible o Vendido: Ya salió de taller.
 * 2. En Taller: Flete pagado, o entregado en agencia/taller, o marcado en_taller.
 * 3. Tránsito a VZLA: Físicamente recibido en el casillero (Miami) o en vuelo/aduana/agencia hacia Venezuela:
 *    - Courier USA marcó "Delivered" / entregado en Miami.
 *    - O Liberty Express reporta cualquier estado de procesamiento o tránsito.
 * 4. Tránsito a Casillero: El paquete está viajando dentro de USA hacia el casillero en Miami.
 */
export function evaluarEstadoLogisticoItem(item = {}, invObj = null, trkDoc = null) {
  const invItem = invObj?.item;
  const hasInv = Boolean(invItem);
  const isDisponible = invItem?.disponibilidad === 'Disponible';
  const isVendido = invItem?.disponibilidad === 'No disponible';

  const tieneEnvio = invItem ? tieneEnvioPagado(invItem) : false;
  const vzlaUltimoEstado = (trkDoc?.tracking_vzla_ultimo_estado || item?.tracking_vzla_ultimo_estado || '').trim();
  const usaUltimoEstado = (trkDoc?.tracking_usa_ultimo_estado || item?.tracking_usa_ultimo_estado || '').trim();
  const trackingUsa = (item?.tracking_usa || trkDoc?.tracking_usa || '').trim().toUpperCase();
  const trackingVzla = (trkDoc?.tracking_vzla || item?.tracking_vzla || '').trim().toUpperCase();

  const isEnTaller = !isDisponible && !isVendido && Boolean(
    tieneEnvio ||
    trkDoc?.estado === 'ya_recogido' ||
    Boolean(item?.en_taller) ||
    Boolean(invItem?.en_taller) ||
    esEstadoEntregado(vzlaUltimoEstado)
  );

  const isPrealerted = Boolean(trkDoc?.prealertado || item?.prealertado);

  // ¿Es una guía que se encuentra únicamente en fase de prealerta en espera de paquete?
  const isPrealertOnly = Boolean(
    trkDoc?.prealerta_id ||
    (trackingVzla && trackingVzla.startsWith('WRTMP-')) ||
    (vzlaUltimoEstado && /pre\s*alertad|esperando paquete/i.test(vzlaUltimoEstado))
  );

  // Físicamente recibido por Liberty en su red logística (cualquier estatus posterior a prealerta)
  const isRecibidoLiberty = Boolean(
    vzlaUltimoEstado && !isPrealertOnly
  );

  // Courier USA (UPS, FedEx, USPS, Amazon) ya entregó en el almacén de Miami
  const isUsaDelivered = Boolean(
    item?.isDelivered ||
    item?.shipping_status === 'delivered' ||
    item?.tracking_usa_entregado ||
    trkDoc?.tracking_usa_entregado ||
    (usaUltimoEstado && /delivered|entregad|left at|front desk|dock|delivery completed/i.test(usaUltimoEstado))
  );

  // ¿Ha llegado efectivamente al casillero y/o está en tránsito a Venezuela?
  const isEnVzla = !isEnTaller && !isDisponible && !isVendido && (
    isRecibidoLiberty ||
    isUsaDelivered ||
    trkDoc?.estado === 'transito_vzla' ||
    trkDoc?.estado === 'disponible_agencia' ||
    (trkDoc?.estado === 'en_miami' && !isPrealertOnly) ||
    (trackingVzla && !isPrealertOnly && !trackingVzla.startsWith('WRTMP-') && vzlaUltimoEstado && !/pre\s*alertad|esperando paquete/i.test(vzlaUltimoEstado))
  );

  // ¿Está en tránsito hacia el casillero en USA?
  const isEnUsa = !isEnTaller && !isDisponible && !isVendido && !isEnVzla && Boolean(
    trackingUsa || isPrealerted || isPrealertOnly || trackingVzla
  );

  return {
    hasInv,
    isDisponible,
    isVendido,
    isEnTaller,
    isEnVzla,
    isEnUsa,
    hasTrackingUsa: Boolean(trackingUsa),
    hasTrackingVzla: Boolean(trackingVzla),
    isPrealerted,
    isPrealertOnly,
    isUsaDelivered,
    isRecibidoLiberty,
    trackingUsa,
    trackingVzla,
    vzlaUltimoEstado,
    usaUltimoEstado
  };
}

/**
 * Formatea fechas recibidas de servicios de tracking a un formato amigable.
 */
export function formatTrackingDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  } catch (_) {}
  return String(dateStr);
}

