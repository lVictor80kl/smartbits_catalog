/**
 * Servicio seguro de obtención y normalización de tasas de cambio para Venezuela.
 * Fuentes:
 * - BCV Dólar ($): DolarApi Oficial (Scraping oficial del BCV)
 * - BCV Euro (€): DolarApi Oficial (Scraping oficial del BCV)
 * - Binance P2P (USDT/VES): CriptoYa Binance P2P (con fallback a Yadio)
 *
 * Medidas de Seguridad implementadas:
 * 1. Zero Trust: Validación estricta y casteo numérico finito en todas las respuestas.
 * 2. Timeouts con AbortController (6 segundos) para evitar bloqueos de UI.
 * 3. Sanitización de rangos: Descarta cualquier dato anómalo o corrupto.
 * 4. Peticiones de solo lectura (GET) sin envío de credenciales ni tokens sensibles.
 */

export const TIPO_TASA = {
  BCV_USD: 'bcv_usd',
  BCV_EUR: 'bcv_eur',
  BINANCE: 'binance_usdt',
  CUSTOM: 'custom'
};

export const TIPO_TASA_LABELS = {
  [TIPO_TASA.BCV_USD]: 'BCV Dólar ($)',
  [TIPO_TASA.BCV_EUR]: 'BCV Euro (€)',
  [TIPO_TASA.BINANCE]: 'Binance P2P (USDT)',
  [TIPO_TASA.CUSTOM]: 'Personalizada (Custom)'
};

/**
 * Valida y sanitiza que el valor sea un número positivo dentro de un rango económico válido.
 */
export function sanitizarNumeroTasa(val) {
  if (val === null || val === undefined) return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val).trim().replace(',', '.'));
  if (isNaN(num) || !Number.isFinite(num) || num <= 0 || num > 50000000) {
    return null;
  }
  // Redondeo seguro a 2 decimales para operaciones comerciales
  return Math.round(num * 100) / 100;
}

/**
 * Realiza un fetch con timeout estricto de seguridad.
 */
async function fetchConTimeout(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Obtiene la tasa oficial de BCV Dólar (DolarApi con fallback a Yadio)
 */
async function obtenerBcvDolar() {
  try {
    const data = await fetchConTimeout('https://ve.dolarapi.com/v1/dolares/oficial');
    const tasa = sanitizarNumeroTasa(data?.promedio || data?.venta || data?.compra);
    if (tasa) return { tasa, fuente: 'DolarApi Oficial (BCV)' };
  } catch (errDolarApi) {
    console.warn('DolarApi BCV Dólar falló, intentando fallback Yadio:', errDolarApi.message);
  }

  // Fallback secundario a Yadio si DolarApi está temporalmente inaccesible
  try {
    const dataYadio = await fetchConTimeout('https://api.yadio.io/json');
    const tasaYadio = sanitizarNumeroTasa(dataYadio?.USD?.other?.official?.rate);
    if (tasaYadio) return { tasa: tasaYadio, fuente: 'Yadio BCV Oficial (Fallback)' };
  } catch (errYadio) {
    console.warn('Fallback Yadio BCV falló:', errYadio.message);
  }

  throw new Error('Dato inválido o no disponible para BCV Dólar');
}

/**
 * Obtiene la tasa oficial de BCV Euro
 */
async function obtenerBcvEuro() {
  const data = await fetchConTimeout('https://ve.dolarapi.com/v1/euros/oficial');
  const tasa = sanitizarNumeroTasa(data?.promedio || data?.venta || data?.compra);
  if (!tasa) throw new Error('Dato inválido recibido para BCV Euro');
  return { tasa, fuente: 'DolarApi Oficial (BCV)' };
}

/**
 * Obtiene la tasa de Binance P2P (USDT a VES).
 * Intenta primero CriptoYa, si falla aplica fallback automático a Yadio.
 */
async function obtenerBinanceP2P() {
  // Intento 1: CriptoYa Binance P2P
  try {
    const data = await fetchConTimeout('https://criptoya.com/api/binancep2p/usdt/ves');
    // En Binance P2P 'ask' es el precio de compra de USDT (lo que cuesta adquirir USDT en Bs)
    // 'bid' es el precio de venta. Tomamos 'ask' o el promedio seguro.
    const tasa = sanitizarNumeroTasa(data?.ask || data?.bid);
    if (tasa) {
      return { tasa, fuente: 'CriptoYa Binance P2P' };
    }
  } catch (errCriptoYa) {
    console.warn('CriptoYa no respondió, intentando fallback Yadio:', errCriptoYa.message);
  }

  // Intento 2: Fallback Yadio
  try {
    const dataYadio = await fetchConTimeout('https://api.yadio.io/json');
    const tasaP2P = dataYadio?.USD?.other?.p2p_usdt?.rate || dataYadio?.USD?.rate;
    const tasa = sanitizarNumeroTasa(tasaP2P);
    if (tasa) {
      return { tasa, fuente: 'Yadio P2P USDT (Fallback)' };
    }
  } catch (errYadio) {
    console.warn('Fallback Yadio también falló:', errYadio.message);
  }

  throw new Error('No se pudo obtener la cotización de Binance P2P');
}

/**
 * Consulta concurrentemente todas las tasas configuradas con blindaje de errores.
 * Si alguna tasa puntual falla pero otras tienen éxito, retorna las obtenidas
 * sin romper la ejecución completa.
 */
export async function fetchTasasVenezolanas() {
  const [bcvUsdResult, bcvEurResult, binanceResult] = await Promise.allSettled([
    obtenerBcvDolar(),
    obtenerBcvEuro(),
    obtenerBinanceP2P()
  ]);

  const resultado = {
    bcv_usd: bcvUsdResult.status === 'fulfilled' ? bcvUsdResult.value.tasa : null,
    bcv_eur: bcvEurResult.status === 'fulfilled' ? bcvEurResult.value.tasa : null,
    binance_usdt: binanceResult.status === 'fulfilled' ? binanceResult.value.tasa : null,
    updated_at: new Date().toISOString(),
    errores: {},
    fuentes: {}
  };

  if (bcvUsdResult.status === 'fulfilled') {
    resultado.fuentes.bcv_usd = bcvUsdResult.value.fuente;
  } else {
    resultado.errores.bcv_usd = bcvUsdResult.reason?.message || 'Error al consultar BCV USD';
  }

  if (bcvEurResult.status === 'fulfilled') {
    resultado.fuentes.bcv_eur = bcvEurResult.value.fuente;
  } else {
    resultado.errores.bcv_eur = bcvEurResult.reason?.message || 'Error al consultar BCV EUR';
  }

  if (binanceResult.status === 'fulfilled') {
    resultado.fuentes.binance_usdt = binanceResult.value.fuente;
  } else {
    resultado.errores.binance_usdt = binanceResult.reason?.message || 'Error al consultar Binance P2P';
  }

  return resultado;
}
