export function getCostoTotal(item) {
  const guardado = Number(item.costo_total ?? item.costo_total_usd ?? 0);
  if (guardado > 0) return guardado;
  const base = Number(item.precio_ebay ?? item.costo_compra ?? 0);
  const comisiones = Number(item.total_comisiones ?? item.comision_banco ?? 0);
  const adicionales = Number(item.costos_adicionales ?? item.gastos_adicionales ?? 0);
  const envio = Number(item.envio_usd ?? 0);
  return base + comisiones + adicionales + envio;
}
