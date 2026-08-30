export function getGastosExtraItems(item) {
  return Array.isArray(item?.gastos_extra) ? item.gastos_extra : [];
}

export function getGastosExtraTotal(item) {
  return getGastosExtraItems(item).reduce((acc, g) => acc + (Number(g.monto_usd) || 0), 0);
}

// Campos legacy: sólo se retornan si NO hay gastos_extra registrados en el arreglo nuevo
export function getLegadosExtrasUsd(item) {
  const tieneGastosExtraNuevos = getGastosExtraItems(item).length > 0;
  if (tieneGastosExtraNuevos) return 0;
  const adicionales = Number(item?.costos_adicionales ?? item?.gastos_adicionales ?? 0);
  const envio = Number(item?.envio_usd ?? 0);
  return adicionales + envio;
}

export function getCostoBaseConComision(item) {
  const base = Number(item?.precio_ebay ?? item?.costo_compra ?? 0);
  if (base === 0) return 0;
  const guardado = Number(item?.costo_mas_comision ?? 0);
  if (guardado > 0) return guardado;
  const comisiones = Number(item?.total_comisiones ?? item?.comision_banco ?? 0);
  return base + comisiones;
}

export function calcularCostoTotalItem(item) {
  return getCostoBaseConComision(item) + getGastosExtraTotal(item) + getLegadosExtrasUsd(item);
}

export function getCostoTotal(item) {
  return calcularCostoTotalItem(item);
}

// Señalización: ¿ya se registró/pagó un envío de esta laptop?
export function tieneEnvioPagado(item) {
  if (getGastosExtraItems(item).some(g => g.tipo === 'envio')) return true;
  const pagadoBs = Number(item?.envio_pagado_monto_bs ?? 0);
  const pagadoUsd = Number(item?.envio_pagado_monto_usd ?? 0);
  return item?.envio_estado === 'Pagado' && (pagadoBs > 0 || pagadoUsd > 0);
}

// Señalización: ¿ya se registró al menos un pago extra?
export function tienePagoExtra(item) {
  return getGastosExtraItems(item).some(g => g.tipo === 'extra');
}
