/**
 * numeros.js
 *
 * Utilidades para interpretar y formatear números en el contexto venezolano,
 * donde el punto es separador de miles y la coma es separador decimal.
 *
 * Ejemplos que deben funcionar:
 *   "1006,03"   -> 1006.03
 *   "1006.03"   -> 1006.03
 *   "1.006,03"  -> 1006.03
 *   "1,006.03"  -> 1006.03
 *   "1.006.000" -> 1006000
 */

/** Quita los separadores de miles y deja el decimal con punto. */
function normalizarSeparadores(texto) {
  const hayComa = texto.includes(',');
  const hayPunto = texto.includes('.');

  if (hayComa && hayPunto) {
    // El último separador es el decimal; el otro es de miles.
    return texto.lastIndexOf(',') > texto.lastIndexOf('.')
      ? texto.replace(/\./g, '').replace(',', '.')
      : texto.replace(/,/g, '');
  }

  if (hayComa) {
    // "1,006,000" -> miles | "1006,03" -> decimal | "1,006" -> ambiguo (decimal)
    return /^-?\d{1,3}(,\d{3}){2,}$/.test(texto) ? texto.replace(/,/g, '') : texto.replace(',', '.');
  }

  if (hayPunto) {
    // "1.006.000" -> miles | "1006.03" -> decimal | "1.006" -> ambiguo (decimal)
    return /^-?\d{1,3}(\.\d{3}){2,}$/.test(texto) ? texto.replace(/\./g, '') : texto;
  }

  return texto;
}

/**
 * Convierte cualquier valor (texto o número) en número.
 * Acepta coma o punto como separador decimal y descarta los separadores de miles.
 */
export function parseDecimalInput(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const texto = String(val).trim();
  if (!texto) return 0;
  const num = parseFloat(normalizarSeparadores(texto));
  return isNaN(num) ? 0 : num;
}

/**
 * Igual que parseDecimalInput, pero resolviendo el caso "1.006" para tasas:
 * una tasa de cambio nunca es menor a 10 Bs, así que "1.006" se interpreta
 * como 1.006 (miles) y no como 1.006 (decimal).
 */
export function parseTasaInput(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  const texto = String(val).trim();
  const num = parseDecimalInput(texto);

  // "1.006" o "1,006": un único grupo de 3 decimales
  if (/^-?\d{1,3}([.,]\d{3})?$/.test(texto)) {
    const miles = Number(texto.replace(/[.,]/g, ''));
    if (miles >= 100 && num < 10) return miles;
  }

  return num;
}

/**
 * Formatea un número con el formato venezolano: "1.006,03".
 * Ideal para valores que se escriben en un input de texto.
 */
export function formatearDecimalInput(val, decimales = 2) {
  const num = Number(val);
  if (!Number.isFinite(num)) return '';
  return num.toLocaleString('es-VE', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  });
}

/**
 * Formatea un número sin decimales: "1.006".
 */
export function formatearNumeroES(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return '';
  return num.toLocaleString('es-VE', { maximumFractionDigits: 0 });
}
