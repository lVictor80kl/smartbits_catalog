export function calcularDiferencial({ montoOrigen, montoDestino, monedaOrigen, monedaDestino, tasaReferencia }) {
  const ref = Number(tasaReferencia) > 0 ? Number(tasaReferencia) : 1;
  const valorOrigenUsd = monedaOrigen === 'BS' ? Number(montoOrigen) / ref : Number(montoOrigen);
  const valorDestinoUsd = monedaDestino === 'BS' ? Number(montoDestino) / ref : Number(montoDestino);
  return valorDestinoUsd - valorOrigenUsd;
}

export function derivarTasaReal({ montoOrigen, montoDestino, monedaOrigen, monedaDestino }) {
  if (monedaOrigen === monedaDestino) return null;
  const origen = Number(montoOrigen);
  const destino = Number(montoDestino);
  if (isNaN(origen) || isNaN(destino) || origen <= 0 || destino <= 0) return null;
  if (monedaOrigen === 'BS') return origen / destino;
  return destino / origen;
}

export function calcularDestino({ montoOrigen, tasa, monedaOrigen, monedaDestino }) {
  const origen = Number(montoOrigen);
  const t = Number(tasa);
  if (monedaOrigen === monedaDestino || isNaN(origen) || origen <= 0 || isNaN(t) || t <= 0) return origen;
  if (monedaOrigen === 'BS') return origen / t;
  return origen * t;
}