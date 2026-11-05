/**
 * tasasCambio.js
 *
 * Utilidades puras para sanitizar, validar y corregir tasas de cambio.
 *
 * CONTEXTO (05-nov-2026):
 * La API DolarApi devolvía el Euro oficial del BCV como "1.006" en lugar de
 * "1.006,03" Bs, porque el BCV usa el punto como separador de miles y la coma
 * como separador decimal ("1.006,03"). El valor llegaba 1000 veces por debajo
 * de la realidad y, si se guardaba como tasa activa, el sistema convertía los
 * bolívares a dólares prácticamente 1:1 (inflando el Capital Total).
 *
 * La tasa oficial del Euro del BCV para ese día era 1.006,03 Bs.
 *
 * Aquí viven las reglas de validación para que ninguna tasa corrupta llegue a
 * los cálculos contables.
 */

export const UMBRAL_TASA_MINIMA = 10;        // Bs por 1 unidad de moneda
export const UMBRAL_TASA_MAXIMA = 50000000;  // Bs por 1 unidad de moneda

// Rango de coherencia entre dos tasas (EUR/VES vs USD/VES ≈ EUR/USD)
export const RANGO_COHERENCIA_MIN = 0.5;
export const RANGO_COHERENCIA_MAX = 2;

// Rango más estricto para validar una corrección x1000 (las relaciones reales
// entre dólar/euro y entre oficial/paralelo se mueven poco)
export const RANGO_CORRECCION_MIN = 0.8;
export const RANGO_CORRECCION_MAX = 1.5;

// Factor de corrección cuando la API confunde el separador de miles
export const FACTOR_MILES = 1000;

/**
 * Convierte cualquier valor a un número de tasa válido (o null).
 *
 * OJO: se redondea a 4 decimales (no a 2) porque el error de separador de
 * miles produce valores como "1.006" que, redondeados a 2 decimales, se
 * convertían en "1.01" y ya no se podían recuperar.
 */
export function sanitizarNumeroTasa(val) {
  if (val === null || val === undefined) return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val).trim().replace(',', '.'));
  if (isNaN(num) || !Number.isFinite(num) || num <= 0 || num > UMBRAL_TASA_MAXIMA) {
    return null;
  }
  // Redondeo seguro a 4 decimales para operaciones comerciales
  return Math.round(num * 10000) / 10000;
}

/**
 * Una tasa es aceptable si está dentro del rango económico de Venezuela
 * (más de 10 Bs por dólar/euro y menos de 50 millones).
 */
export function esTasaAceptable(val) {
  const num = Number(val);
  return Number.isFinite(num) && num >= UMBRAL_TASA_MINIMA && num <= UMBRAL_TASA_MAXIMA;
}

/**
 * ¿La tasa está dentro de un rango determinado respecto a una referencia?
 */
function estaEnRango(tasa, referencia, min, max) {
  const t = Number(tasa);
  const r = Number(referencia);
  if (!Number.isFinite(t) || !Number.isFinite(r) || r <= 0) return false;
  const ratio = t / r;
  return ratio >= min && ratio <= max;
}

/**
 * ¿La tasa es coherente con una tasa de referencia?
 * Ej: el Euro/VES debería estar entre 0.5 y 2 veces el USD/VES.
 */
export function esTasaCoherenteCon(tasa, referencia) {
  return estaEnRango(tasa, referencia, RANGO_COHERENCIA_MIN, RANGO_COHERENCIA_MAX);
}

/**
 * Corrige el error de separador de miles de algunas APIs.
 *
 * Si la tasa es ~1000 veces menor que la referencia, se multiplica x1000.
 * Ej: 1.006 con referencia 894.8876 -> 1006.00 (que es el valor real).
 *
 * Devuelve null si no hay forma razonable de corregirla.
 */
export function corregirTasaSeparadorMiles(tasa, referencia) {
  const t = sanitizarNumeroTasa(tasa);
  const r = Number(referencia);
  if (!t || !Number.isFinite(r) || r <= 0) return null;
  if (esTasaCoherenteCon(t, r)) return t;

  const corregida = Math.round((t * FACTOR_MILES) * 10000) / 10000;
  if (estaEnRango(corregida, r, RANGO_CORRECCION_MIN, RANGO_CORRECCION_MAX)) return corregida;

  return null;
}

/**
 * Normaliza un conjunto de tasas (BCV USD, BCV EUR, Binance USDT):
 *  - corrige el error de separador de miles,
 *  - descarta las tasas que siguen siendo imposibles.
 *
 * @returns {{tasas: object, correcciones: string[], invalidas: string[]}}
 */
export function normalizarTasas(tasas = {}) {
  const correcciones = [];
  const invalidas = [];

  let bcv_usd = sanitizarNumeroTasa(tasas.bcv_usd);
  let bcv_eur = sanitizarNumeroTasa(tasas.bcv_eur);
  let binance_usdt = sanitizarNumeroTasa(tasas.binance_usdt);

  // 1) Dólar oficial contra Binance (referencia de mercado)
  if (bcv_usd && binance_usdt && !esTasaCoherenteCon(bcv_usd, binance_usdt)) {
    const corregida = corregirTasaSeparadorMiles(bcv_usd, binance_usdt);
    if (corregida) {
      correcciones.push(`BCV Dólar: ${bcv_usd} → ${corregida} (separador de miles)`);
      bcv_usd = corregida;
    }
  }
  if (bcv_usd && !esTasaAceptable(bcv_usd)) {
    invalidas.push('bcv_usd');
    bcv_usd = null;
  }

  // 2) Euro oficial contra el dólar oficial (ya corregido)
  if (bcv_eur && bcv_usd && !esTasaCoherenteCon(bcv_eur, bcv_usd)) {
    const corregida = corregirTasaSeparadorMiles(bcv_eur, bcv_usd);
    if (corregida) {
      correcciones.push(`BCV Euro: ${bcv_eur} → ${corregida} (separador de miles)`);
      bcv_eur = corregida;
    }
  }
  if (bcv_eur && !esTasaAceptable(bcv_eur)) {
    invalidas.push('bcv_eur');
    bcv_eur = null;
  }
  if (binance_usdt && !esTasaAceptable(binance_usdt)) {
    invalidas.push('binance_usdt');
    binance_usdt = null;
  }

  return {
    tasas: { bcv_usd, bcv_eur, binance_usdt },
    correcciones,
    invalidas,
  };
}

/**
 * Resuelve la tasa que se debe usar en los cálculos monetarios.
 *
 * Orden de preferencia:
 *  1. La tasa activa actual, si es válida y coherente.
 *  2. La tasa activa corregida (error de separador de miles).
 *  3. Una tasa de referencia disponible (BCV USD / Binance / corte).
 *  4. Sin tasa válida: se avisa para que la interfaz lo muestre.
 *
 * @returns {{tasa: number, esValida: boolean, nota: string|null}}
 */
export function resolverTasaCalculo(tasaBruta, tasas = {}, referenciasExtra = []) {
  const refs = [
    tasas.bcv_usd,
    tasas.binance_usdt,
    ...referenciasExtra,
  ].filter((r) => sanitizarNumeroTasa(r) !== null);

  const bruta = sanitizarNumeroTasa(tasaBruta);

  // 1) La tasa activa es válida
  if (bruta && esTasaAceptable(bruta)) {
    if (refs.length === 0 || refs.some((r) => esTasaCoherenteCon(bruta, r))) {
      return { tasa: bruta, esValida: true, nota: null };
    }
  }

  // 2) La tasa activa viene con el error de separador de miles
  for (const ref of refs) {
    const corregida = corregirTasaSeparadorMiles(bruta, ref);
    if (corregida) {
      return {
        tasa: corregida,
        esValida: true,
        nota: `Tasa corregida automáticamente: ${bruta} → ${corregida} (separador de miles)`,
      };
    }
  }

  // 3) Usar una tasa de referencia disponible
  for (const ref of refs) {
    if (esTasaAceptable(ref)) {
      const valor = Number(ref);
      return {
        tasa: valor,
        esValida: true,
        nota: `Tasa activa descartada (${bruta ?? 'sin valor'}); se usa la tasa de referencia ${valor}`,
      };
    }
  }

  // 4) Sin tasa utilizable
  return {
    tasa: bruta || 1,
    esValida: false,
    nota: 'No hay ninguna tasa de cambio válida disponible',
  };
}
