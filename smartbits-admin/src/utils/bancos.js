export const COMISIONES_POR_CUENTA = {
  'bancamiga': 5,
  'venezuela': 2.5,
  'bolivares_bs': 0,
  'efectivo': 0,
  'zelle': 0,
  'binance': 0,
  'zinli': 0,
  'paypal': 0,
  'bnc': 1.5,
  'bnc papa': 1.5,
  'banco bnc': 1.5,
  'banco venezuela': 2.5,
  'banco de venezuela': 2.5,
};

export const normalizarLabel = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

export function resolverComisionCuenta(cuentaKey, cuentaLabel, comisionesCustom = {}, dinamicaData = {}) {
  const key = String(cuentaKey || '').toLowerCase();

  // 1. Configuración explícita en _comisiones_cuentas de Firestore
  if (comisionesCustom && comisionesCustom[key] !== undefined) {
    const cfg = comisionesCustom[key];
    if (typeof cfg === 'object' && cfg !== null) {
      const tiene = Boolean(cfg.tiene_comision ?? cfg.activa);
      const pct = tiene ? (Number(cfg.porcentaje ?? cfg.pct) || 0) : 0;
      return { comision_activa: tiene, comision_pct: pct };
    }
    if (typeof cfg === 'number') {
      return { comision_activa: cfg > 0, comision_pct: cfg };
    }
  }

  // 2. Si la cuenta dinámica ya almacena comision_activa o comision_pct
  if (dinamicaData && (dinamicaData.comision_activa !== undefined || dinamicaData.comision_pct !== undefined)) {
    const tiene = Boolean(dinamicaData.comision_activa);
    const pct = tiene ? (Number(dinamicaData.comision_pct) || 0) : 0;
    return { comision_activa: tiene, comision_pct: pct };
  }

  // 3. Fallback al diccionario COMISIONES_POR_CUENTA
  let defaultPct = 0;
  if (COMISIONES_POR_CUENTA[key] !== undefined) {
    defaultPct = COMISIONES_POR_CUENTA[key];
  } else {
    const norm = normalizarLabel(cuentaLabel);
    if (COMISIONES_POR_CUENTA[norm] !== undefined) {
      defaultPct = COMISIONES_POR_CUENTA[norm];
    } else {
      const matchKey = Object.keys(COMISIONES_POR_CUENTA).find(k => k && norm.includes(k));
      if (matchKey) defaultPct = COMISIONES_POR_CUENTA[matchKey];
    }
  }

  return {
    comision_activa: defaultPct > 0,
    comision_pct: defaultPct
  };
}

export function obtenerComisionDeCuenta(cuentaObj, cuentaKey, cuentaLabel) {
  if (cuentaObj) {
    if (cuentaObj.comision_activa === false) return 0;
    if (cuentaObj.comision_activa === true && cuentaObj.comision_pct !== undefined) {
      return Number(cuentaObj.comision_pct) || 0;
    }
    if (cuentaObj.comision_pct !== undefined && cuentaObj.comision_pct !== null && cuentaObj.comision_pct > 0) {
      return Number(cuentaObj.comision_pct) || 0;
    }
  }
  const res = resolverComisionCuenta(cuentaKey || cuentaObj?.key, cuentaLabel || cuentaObj?.label);
  return res.comision_activa ? res.comision_pct : 0;
}
