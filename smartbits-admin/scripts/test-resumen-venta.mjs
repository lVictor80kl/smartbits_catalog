import { calcularResumenVenta } from '../src/utils/resumenVenta.js';

const esBs = (p) => p.moneda === 'BS';

const casos = [
  {
    nombre: 'Solo USD - pago parcial sin descuento',
    args: { precioTotalUsd: 1000, tasaNum: 100, pagos: [{ metodo: 'Efectivo $', moneda: 'USD', monto: 500 }], esPagoBs: esBs },
  },
  {
    nombre: 'Solo USD - pago parcial con descuento',
    args: { precioTotalUsd: 1000, tasaNum: 100, pagos: [{ metodo: 'Efectivo $', moneda: 'USD', monto: 500 }], esPagoBs: esBs, aplicaDescuento: true },
  },
  {
    nombre: 'Solo Bs - pago parcial sin descuento',
    args: { precioTotalUsd: 1000, tasaNum: 100, pagos: [{ metodo: 'Pago Móvil', moneda: 'BS', monto: 40000 }], esPagoBs: esBs },
  },
  {
    nombre: 'Solo Bs - pago parcial con descuento',
    args: { precioTotalUsd: 1000, tasaNum: 100, pagos: [{ metodo: 'Pago Móvil', moneda: 'BS', monto: 40000 }], esPagoBs: esBs, aplicaDescuento: true },
  },
  {
    nombre: 'Mixto - sin descuento',
    args: { precioTotalUsd: 1000, tasaNum: 100, pagos: [{ metodo: 'Pago Móvil', moneda: 'BS', monto: 40000 }, { metodo: 'Binance (USDT)', moneda: 'USD', monto: 500 }], esPagoBs: esBs },
  },
  {
    nombre: 'Mixto - con descuento',
    args: { precioTotalUsd: 1000, tasaNum: 100, pagos: [{ metodo: 'Pago Móvil', moneda: 'BS', monto: 40000 }, { metodo: 'Binance (USDT)', moneda: 'USD', monto: 500 }], esPagoBs: esBs, aplicaDescuento: true },
  },
  {
    nombre: 'Pagado completo',
    args: { precioTotalUsd: 1000, tasaNum: 100, pagos: [{ metodo: 'Zelle', moneda: 'USD', monto: 1000 }], esPagoBs: esBs },
  },
  {
    nombre: 'Sobrepago (vuelto)',
    args: { precioTotalUsd: 1000, tasaNum: 100, pagos: [{ metodo: 'Zelle', moneda: 'USD', monto: 1050 }], esPagoBs: esBs },
  },
  {
    nombre: 'Sin pagos',
    args: { precioTotalUsd: 1000, tasaNum: 100, pagos: [], esPagoBs: esBs },
  },
  {
    nombre: 'Metodo Bs elegido sin monto (la nota ya va en Bs)',
    args: { precioTotalUsd: 1000, tasaNum: 100, pagos: [{ metodo: 'Pago Móvil', moneda: 'BS', monto: '' }], esPagoBs: esBs },
  },
  {
    nombre: 'Metodo Bs sin monto + pago en USD',
    args: { precioTotalUsd: 1000, tasaNum: 100, pagos: [{ metodo: 'Pago Móvil', moneda: 'BS', monto: '' }, { metodo: 'Zelle', moneda: 'USD', monto: 300 }], esPagoBs: esBs },
  },
];

for (const c of casos) {
  const r = calcularResumenVenta(c.args);
  console.log(`\n=== ${c.nombre} ===`);
  console.log(` total: $${r.totalUsd} / Bs ${r.totalBs} | principalBs=${r.principalBs} | tieneMetodoBs=${r.tieneMetodoBs}`);
  console.log(` pagado: Bs ${r.pagadoBs} ($${r.pagadoBsUsd}) + $${r.pagadoUsd} = $${r.pagadoTotalUsd}`);
  console.log(` saldo: $${r.saldoUsd} | pendiente: $${r.saldoPendienteUsd} | vuelto: $${r.vueltoUsd}`);
  console.log(` descuento activo=${r.descuentoActivo} | $${r.descuentoUsd} (${r.descuentoPct}%) | total final $${r.totalFinalUsd} / Bs ${r.totalFinalBs}`);
}
