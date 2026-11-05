/**
 * rastreoSaldos.js
 *
 * Utilidades para el seguimiento de saldos por cuenta (estilo estado de cuenta).
 * Permiten reconstruir el saldo de una cuenta después de cada movimiento,
 * tomando como punto de partida el saldo capturado en la apertura del rastreo.
 */

export const METODO_TO_CAJA_KEY = {
  'Zelle': 'zelle',
  'Efectivo': 'efectivo',
  'USDT': 'binance',
  'Binance Pay': 'binance',
  'Zinli': 'zinli',
  'PayPal': 'paypal',
  'Pago Móvil': 'venezuela',
  'Transferencia': 'venezuela',
};

/** Convierte cualquier valor a número seguro (0 si no es válido). */
export function toNum(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

/** Timestamp (Firestore o Date) a milisegundos. */
export function timestampToMs(fecha) {
  if (!fecha) return 0;
  if (typeof fecha.toDate === 'function') return fecha.toDate().getTime();
  const t = new Date(fecha).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Verifica si un movimiento involucra una cuenta específica.
 * (Extraído de Movimientos.jsx para reutilizarlo en el cálculo de saldos.)
 */
export function movimientoInvolucraCuenta(m, targetKey) {
  if (!targetKey || targetKey === 'todas') return true;
  if (!m) return false;

  // 1. Transferencias internas (origen o destino)
  if (m.tipo_mov === 'transferencia') {
    return m.cuenta_origen === targetKey || m.cuenta_destino === targetKey;
  }

  // 2. Retiros de socios
  if (m.tipo_mov === 'retiro') {
    const cuenta = m.cuenta_salida || m.metodo_pago;
    return cuenta === targetKey;
  }

  // 3. Aportes de capital
  if (m.tipo_mov === 'aporte_capital') {
    const cuenta = m.cuenta_destino || m.metodo_pago;
    return cuenta === targetKey;
  }

  // 4. Reembolsos
  if (m.tipo_mov === 'reembolso') {
    return m.cuenta_destino === targetKey;
  }

  // 5. Ajustes manuales de caja (auditoría)
  if (m.tipo_mov === 'ajuste') {
    return m.cuenta_key === targetKey;
  }

  // 6. Gastos operativos y compras de inventario
  if (m.tipo_mov === 'gasto_op' || m.tipo_mov === 'compra_inventario') {
    const c = m.metodo_pago || m.cuenta_origen;
    return c === targetKey;
  }

  // 7. Ventas / Ingresos
  if (m.tipo_mov === 'venta') {
    if (m.metodo_pago) {
      if (typeof m.metodo_pago === 'string') {
        const parts = m.metodo_pago.split(',').map(s => s.trim());
        if (parts.some(p => p === targetKey || METODO_TO_CAJA_KEY[p] === targetKey)) return true;
      } else if (Array.isArray(m.metodo_pago)) {
        if (m.metodo_pago.some(p => {
          const k = p.cuentaKey || METODO_TO_CAJA_KEY[p.metodo] || p.metodo;
          return k === targetKey;
        })) return true;
      }
    }
  }

  // Fallback general por cualquier campo que contenga la clave
  const candidateKeys = [
    m.metodo_pago,
    m.cuenta_salida,
    m.cuenta_destino,
    m.cuenta_origen,
    m.cuenta_key
  ].filter(Boolean);

  for (const c of candidateKeys) {
    if (typeof c === 'string') {
      if (c === targetKey || METODO_TO_CAJA_KEY[c] === targetKey) return true;
      if (c.includes(',')) {
        const parts = c.split(',').map(s => s.trim());
        if (parts.some(p => p === targetKey || METODO_TO_CAJA_KEY[p] === targetKey)) return true;
      }
    }
  }

  return false;
}

/**
 * Monto que el movimiento aplicó efectivamente sobre una cuenta,
 * expresado en la moneda de esa cuenta (positivo = entrada, negativo = salida).
 */
export function deltaCuenta(mov, cuentaKey, monedaCuenta = 'USD') {
  if (!mov || !cuentaKey || cuentaKey === 'todas') return 0;
  const esBs = monedaCuenta === 'BS';

  switch (mov.tipo_mov) {
    case 'gasto_op':
    case 'retiro':
    case 'aporte_capital':
    case 'compra_inventario': {
      const monto = toNum(mov.monto_original ?? mov.monto);
      const esEntrada = mov.tipo_mov === 'aporte_capital' || mov.es_ingreso === true;
      return esEntrada ? monto : -monto;
    }

    case 'reembolso':
      return toNum(mov.monto);

    case 'venta': {
      // Si hay detalle de la venta, se usa el monto exacto de cada cuenta.
      const pagos = mov._venta?.metodos_pago;
      if (Array.isArray(pagos) && pagos.length > 0) {
        let suma = 0;
        let encontrada = false;
        for (const p of pagos) {
          const key = p.cuentaKey || METODO_TO_CAJA_KEY[p.metodo] || p.metodo || 'efectivo';
          if (key !== cuentaKey) continue;
          encontrada = true;
          suma += esBs ? toNum(p.monto) : toNum(p.montoUSD);
        }
        if (encontrada) return suma;
      }
      // Fallback: documento sin detalle de cuentas.
      return toNum(esBs ? (mov.monto_original ?? mov.monto) : (mov.monto ?? mov.monto_original));
    }

    case 'transferencia': {
      let delta = 0;
      if (mov.cuenta_origen === cuentaKey) delta -= toNum(mov.monto_origen);
      if (mov.cuenta_destino === cuentaKey) delta += toNum(mov.monto_destino);
      return delta;
    }

    case 'ajuste':
      return toNum(mov.diferencia ?? mov.monto);

    default:
      return 0;
  }
}

/**
 * Construye la serie de saldos acumulados a partir de la apertura.
 * Los eventos deben venir ordenados de forma cronológica ascendente.
 */
export function construirSerieSaldos(eventos, saldoApertura) {
  const porMovimiento = {};
  let saldo = toNum(saldoApertura);
  let neto = 0;

  for (const ev of eventos) {
    saldo += toNum(ev.delta);
    neto += toNum(ev.delta);
    porMovimiento[ev.id] = Math.round(saldo * 100) / 100;
  }

  return {
    porMovimiento,
    saldoFinal: Math.round(saldo * 100) / 100,
    neto: Math.round(neto * 100) / 100,
  };
}
