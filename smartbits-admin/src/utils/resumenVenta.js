const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Parseo tolerante de decimales ("1.234,56" -> 1234.56, "95,50" -> 95.5)
const parseMonto = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const sanitized = String(val).trim().replace(',', '.');
  const num = parseFloat(sanitized);
  return isNaN(num) ? 0 : num;
};

/**
 * Calcula el resumen de venta de una nota de entrega teniendo en cuenta
 * la moneda de cada metodo de pago (Bs / USD) y la tasa de cambio seleccionada.
 *
 * Regla de moneda principal: si existe al menos un pago en Bolívares, el total
 * se maneja en Bs; en caso contrario, en USD.
 *
 * @param {Object} params
 * @param {number} params.precioTotalUsd  Total bruto de la venta (siempre en USD)
 * @param {Array}  params.pagos            Filas de métodos de pago ({ metodo, cuentaKey, monto })
 * @param {number} params.tasaNum          Tasa seleccionada (Bs por $)
 * @param {Function} params.esPagoBs       Callback que indica si un pago es en Bs
 * @param {boolean} params.aplicaDescuento Si el saldo pendiente es un descuento
 */
export function calcularResumenVenta({
  precioTotalUsd = 0,
  pagos = [],
  tasaNum = 0,
  esPagoBs = () => false,
  aplicaDescuento = false,
} = {}) {
  const tasa = Number(tasaNum) || 0;

  let pagadoBs = 0;
  let pagadoUsd = 0;

  for (const pago of pagos) {
    const monto = parseMonto(pago?.monto);
    if (monto <= 0) continue;
    if (esPagoBs(pago)) {
      pagadoBs += monto;
    } else {
      pagadoUsd += monto;
    }
  }

  const totalUsd = Number(precioTotalUsd) || 0;
  const pagadoBsUsd = tasa > 0 ? pagadoBs / tasa : 0;
  const pagadoTotalUsd = pagadoUsd + pagadoBsUsd;

  // Saldo pendiente antes de aplicar descuento (puede ser negativo = vuelto)
  const saldoUsd = totalUsd - pagadoTotalUsd;

  // El descuento solo aplica si efectivamente hay saldo por pagar
  const descuentoActivo = Boolean(aplicaDescuento) && saldoUsd > 0;
  const descuentoUsd = descuentoActivo ? saldoUsd : 0;
  const descuentoPct = totalUsd > 0 ? (descuentoUsd / totalUsd) * 100 : 0;

  // Total final de la venta (bruto - descuento)
  const totalFinalUsd = totalUsd - descuentoUsd;

  // Pendiente real (0 si hay descuento o si el cliente pagó de más)
  const saldoPendienteUsd = (!descuentoActivo && saldoUsd > 0) ? saldoUsd : 0;
  const vueltoUsd = saldoUsd < 0 ? Math.abs(saldoUsd) : 0;

  const hayPagosBs = pagadoBs > 0;
  const hayPagosUsd = pagadoUsd > 0;

  return {
    tasa,

    // Pagos
    pagadoBs: round2(pagadoBs),
    pagadoUsd: round2(pagadoUsd),
    pagadoBsUsd: round2(pagadoBsUsd),
    pagadoTotalUsd: round2(pagadoTotalUsd),

    // Totales
    totalUsd: round2(totalUsd),
    totalBs: round2(totalUsd * tasa),
    totalFinalUsd: round2(totalFinalUsd),
    totalFinalBs: round2(totalFinalUsd * tasa),

    // Saldo / descuento
    saldoUsd: round2(saldoUsd),
    saldoBs: round2(saldoUsd * tasa),
    saldoPendienteUsd: round2(saldoPendienteUsd),
    saldoPendienteBs: round2(saldoPendienteUsd * tasa),
    vueltoUsd: round2(vueltoUsd),
    vueltoBs: round2(vueltoUsd * tasa),
    descuentoActivo,
    descuentoUsd: round2(descuentoUsd),
    descuentoPct: round2(descuentoPct),
    descuentoBs: round2(descuentoUsd * tasa),

    // Banderas de moneda
    hayPagosBs,
    hayPagosUsd,
    principalBs: hayPagosBs && tasa > 0,
  };
}

/**
 * Formatea un monto en USD con el estilo local.
 */
export const fmtUsd = (valor, formatMonto) => `$${formatMonto(valor)}`;

/**
 * Formatea un monto en Bolívares con el estilo local.
 */
export const fmtBs = (valor, formatMonto) => `Bs ${formatMonto(valor)}`;
