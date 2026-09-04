// Utilidades y configuración de Couriers para Rastreo de Envíos Smartbits

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
  if (!num) return null;

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
      // Si el número contiene letras o sólo dígitos
      return `https://www.libertyexpress.com/venezuela/rastreo/`;
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
