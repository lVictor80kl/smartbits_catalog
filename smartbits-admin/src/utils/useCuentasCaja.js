import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  fetchTasasVenezolanas, 
  TIPO_TASA,
  TIPO_TASA_LABELS
} from '../services/tasasCambioService';
import {
  sanitizarNumeroTasa,
  normalizarTasas,
  resolverTasaCalculo,
  esTasaAceptable,
  UMBRAL_TASA_MINIMA,
} from './tasasCambio';
import { resolverComisionCuenta } from './bancos';
import { parseDecimalInput, parseTasaInput } from './numeros';

// Se re-exporta para mantener compatibilidad con las importaciones existentes
export { parseDecimalInput };

export const CUENTAS_FIJAS = [
  { key: 'efectivo', label: 'Efectivo ($)', moneda: 'USD' },
  { key: 'zelle', label: 'Zelle', moneda: 'USD' },
  { key: 'binance', label: 'Binance (USDT)', moneda: 'USD' },
  { key: 'zinli', label: 'Zinli', moneda: 'USD' },
  { key: 'bancamiga', label: 'Bancamiga ($)', moneda: 'USD' },
  { key: 'paypal', label: 'PayPal', moneda: 'USD' },
  { key: 'venezuela', label: 'Banco Venezuela', moneda: 'BS' },
  { key: 'bolivares_bs', label: 'Otros Bs', moneda: 'BS' },
];

export function useCuentasCaja() {
  const [saldos, setSaldos] = useState({});
  const [cuentasDinamicas, setCuentasDinamicas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'caja', 'saldos'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSaldos(data);
        setCuentasDinamicas(data._cuentas_dinamicas || []);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error al cargar saldos de caja:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const nombresCustom = saldos._nombres_personalizados || {};
  const comisionesCustom = saldos._comisiones_cuentas || {};

  const cuentasFijasConNombres = CUENTAS_FIJAS.map(c => {
    const label = nombresCustom[c.key] || c.label;
    const { comision_activa, comision_pct } = resolverComisionCuenta(c.key, label, comisionesCustom);
    return {
      ...c,
      label,
      comision_activa,
      comision_pct
    };
  });

  const cuentasDinamicasConComision = cuentasDinamicas.map(c => {
    const { comision_activa, comision_pct } = resolverComisionCuenta(c.key, c.label, comisionesCustom, c);
    return {
      ...c,
      comision_activa,
      comision_pct
    };
  });

  const listaCuentasRaw = [
    ...cuentasFijasConNombres,
    ...cuentasDinamicasConComision
  ];

  const cuentasBS = listaCuentasRaw.filter(c => c.moneda === 'BS');
  const cuentasUSD = listaCuentasRaw.filter(c => c.moneda !== 'BS');

  const todasCuentas = [
    ...cuentasUSD,
    ...cuentasBS
  ];

  // Configuración de tasas con retrocompatibilidad
  const rawTasas = saldos.tasas || {};
  const tasaPredeterminada = rawTasas.tasa_predeterminada || TIPO_TASA.BINANCE;

  // Las tasas guardadas se normalizan al leerlas: algunas APIs devolvieron el
  // valor con el separador de miles mal interpretado (ej: "1.006" en vez de
  // "1.006,03" Bs) y esa basura no debe llegar a los cálculos contables.
  const normalizacion = normalizarTasas(rawTasas);
  const tasasNormales = normalizacion.tasas;

  // Tasa activa: se corrige o se descarta si es inválida
  const resolucionTasa = resolverTasaCalculo(saldos.tasa_cambio, tasasNormales);
  const tasaCambio = resolucionTasa.tasa;
  const tasaCambioEsValida = resolucionTasa.esValida;
  const tasaCambioAdvertencia = resolucionTasa.nota;

  const tasas = {
    bcv_usd: tasasNormales.bcv_usd,
    bcv_eur: tasasNormales.bcv_eur,
    binance_usdt: tasasNormales.binance_usdt,
    custom: sanitizarNumeroTasa(rawTasas.custom) || (tasaCambio > UMBRAL_TASA_MINIMA ? tasaCambio : null),
    tasa_predeterminada: tasaPredeterminada,
    updated_at: rawTasas.updated_at || null,
    fuente: rawTasas.fuente || null,
    correcciones: normalizacion.correcciones
  };

  // Helper para añadir una cuenta nueva
  const agregarCuenta = async ({ nombre, moneda, saldoInicial = 0, tieneComision = false, comisionPct = 0 }) => {
    if (!nombre || !nombre.trim()) throw new Error('Ingresa un nombre para la cuenta.');
    const safeKey = 'dinamica_' + nombre.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
    const pct = tieneComision ? parseDecimalInput(comisionPct) : 0;
    const nuevaCuenta = { 
      key: safeKey, 
      label: nombre.trim(), 
      moneda: moneda || 'USD',
      comision_activa: Boolean(tieneComision),
      comision_pct: pct
    };
    const nuevasDinamicas = [...cuentasDinamicas, nuevaCuenta];

    await updateDoc(doc(db, 'caja', 'saldos'), {
      [safeKey]: parseDecimalInput(saldoInicial),
      _cuentas_dinamicas: nuevasDinamicas,
      [`_comisiones_cuentas.${safeKey}`]: {
        tiene_comision: Boolean(tieneComision),
        porcentaje: pct
      },
      updated_at: new Date()
    });

    return nuevaCuenta;
  };

  // Helper para renombrar cuenta
  const renombrarCuenta = async (cuentaKey, nuevoNombre) => {
    if (!nuevoNombre || !nuevoNombre.trim()) throw new Error('Ingresa un nombre válido.');
    const trimmed = nuevoNombre.trim();
    const esDinamica = cuentasDinamicas.some(c => c.key === cuentaKey);
    if (esDinamica) {
      const nuevasDinamicas = cuentasDinamicas.map(c => c.key === cuentaKey ? { ...c, label: trimmed } : c);
      await updateDoc(doc(db, 'caja', 'saldos'), {
        _cuentas_dinamicas: nuevasDinamicas,
        updated_at: new Date()
      });
    } else {
      const custom = saldos._nombres_personalizados || {};
      await updateDoc(doc(db, 'caja', 'saldos'), {
        _nombres_personalizados: { ...custom, [cuentaKey]: trimmed },
        updated_at: new Date()
      });
    }
  };

  // Helper para eliminar una cuenta dinámica
  const eliminarCuenta = async (cuentaKey) => {
    const esDinamica = cuentasDinamicas.some(c => c.key === cuentaKey);
    if (!esDinamica) throw new Error('Solo se pueden eliminar cuentas personalizadas creadas.');
    const nuevasDinamicas = cuentasDinamicas.filter(c => c.key !== cuentaKey);
    await updateDoc(doc(db, 'caja', 'saldos'), {
      _cuentas_dinamicas: nuevasDinamicas,
      updated_at: new Date()
    });
  };

  // Sincroniza las tasas online desde DolarApi y CriptoYa con reintentos y seguridad
  const sincronizarTasasOnline = async () => {
    const res = await fetchTasasVenezolanas();

    // Se mezclan las tasas nuevas con las guardadas y se normalizan juntas:
    // así una tasa guardada corrupta también queda corregida.
    const { tasas: cleanTasas } = normalizarTasas({
      bcv_usd: res.bcv_usd ?? tasas.bcv_usd ?? null,
      bcv_eur: res.bcv_eur ?? tasas.bcv_eur ?? null,
      binance_usdt: res.binance_usdt ?? tasas.binance_usdt ?? null
    });

    cleanTasas.custom = tasas.custom ?? null;
    cleanTasas.tasa_predeterminada = tasaPredeterminada || TIPO_TASA.BINANCE;
    cleanTasas.updated_at = res.updated_at || new Date().toISOString();
    cleanTasas.fuentes = res.fuentes || {};

    // Determinar la tasa activa efectiva para retrocompatibilidad
    let tasaEfectiva = cleanTasas[tasaPredeterminada];
    if (!esTasaAceptable(tasaEfectiva)) {
      tasaEfectiva = cleanTasas.binance_usdt || cleanTasas.bcv_usd || null;
    }

    const payload = {
      tasas: cleanTasas,
      updated_at: new Date()
    };

    // Nunca se guarda una tasa inválida: si la API trae basura, se conserva
    // la última tasa válida que ya tenía el sistema.
    if (esTasaAceptable(tasaEfectiva)) {
      payload.tasa_cambio = tasaEfectiva;
    } else {
      console.warn('[Tasas] La tasa obtenida no es válida; se conserva la tasa activa anterior.');
    }

    await updateDoc(doc(db, 'caja', 'saldos'), payload);
    return { res, updatedTasas: cleanTasas, tasaEfectiva };
  };

  // Fija qué tasa es la predeterminada en el sistema (bcv_usd, bcv_eur, binance_usdt, custom)
  const fijarTasaPredeterminada = async (claveTasa) => {
    if (!Object.values(TIPO_TASA).includes(claveTasa)) {
      throw new Error('Tipo de tasa no reconocido.');
    }
    const valorSeleccionado = tasas[claveTasa];
    if (!esTasaAceptable(valorSeleccionado)) {
      throw new Error(
        `La tasa de "${TIPO_TASA_LABELS[claveTasa] || claveTasa}" no es válida (valor recibido: ${valorSeleccionado ?? 'sin valor'}). ` +
        'Sincroniza las tasas o fija una tasa personalizada antes de usarla como referencia.'
      );
    }
    const payload = {
      'tasas.tasa_predeterminada': claveTasa,
      updated_at: new Date()
    };
    payload.tasa_cambio = valorSeleccionado;
    await updateDoc(doc(db, 'caja', 'saldos'), payload);
  };

  // Actualiza el valor de la tasa Custom / Manual acordada
  const actualizarTasaCustom = async (nuevoValor) => {
    const valorSanitizado = sanitizarNumeroTasa(parseTasaInput(nuevoValor));
    if (!valorSanitizado || valorSanitizado <= 0) {
      throw new Error('Ingresa un valor de tasa válido.');
    }
    if (!esTasaAceptable(valorSanitizado)) {
      throw new Error(
        `La tasa debe ser mayor a ${UMBRAL_TASA_MINIMA} Bs por dólar (ej: 1006.03). Valor recibido: ${valorSanitizado}.`
      );
    }
    const payload = {
      'tasas.custom': valorSanitizado,
      updated_at: new Date()
    };
    if (tasaPredeterminada === TIPO_TASA.CUSTOM) {
      payload.tasa_cambio = valorSanitizado;
    }
    await updateDoc(doc(db, 'caja', 'saldos'), payload);
  };

  // Helper para actualizar la tasa de cambio global (mantiene retrocompatibilidad asignando a custom)
  const actualizarTasaCambio = async (nuevaTasa) => {
    const tasaNum = parseTasaInput(nuevaTasa);
    if (isNaN(tasaNum) || tasaNum <= 0) throw new Error('Tasa de cambio inválida.');
    if (!esTasaAceptable(tasaNum)) {
      throw new Error(
        `La tasa debe ser mayor a ${UMBRAL_TASA_MINIMA} Bs por dólar (ej: 1006.03). Valor recibido: ${tasaNum}.`
      );
    }
    await updateDoc(doc(db, 'caja', 'saldos'), {
      tasa_cambio: tasaNum,
      'tasas.custom': tasaNum,
      'tasas.tasa_predeterminada': TIPO_TASA.CUSTOM,
      updated_at: new Date()
    });
  };

  const actualizarComisionCuenta = async (cuentaKey, { tieneComision, porcentaje }) => {
    if (!cuentaKey) throw new Error('Cuenta requerida.');
    const pct = tieneComision ? parseDecimalInput(porcentaje) : 0;
    const esDinamica = cuentasDinamicas.some(c => c.key === cuentaKey);
    const payload = {
      [`_comisiones_cuentas.${cuentaKey}`]: {
        tiene_comision: Boolean(tieneComision),
        porcentaje: pct
      },
      updated_at: new Date()
    };
    if (esDinamica) {
      payload._cuentas_dinamicas = cuentasDinamicas.map(c =>
        c.key === cuentaKey ? { ...c, comision_activa: Boolean(tieneComision), comision_pct: pct } : c
      );
    }
    await updateDoc(doc(db, 'caja', 'saldos'), payload);
  };

  const isCuentaBs = (cuentaKey) => {
    const c = todasCuentas.find(acc => acc.key === cuentaKey);
    return c ? c.moneda === 'BS' : false;
  };

  return { 
    saldos, 
    cuentasDinamicas, 
    todasCuentas,
    cuentasBS,
    cuentasUSD,
    tasaCambio, 
    tasaCambioEsValida,
    tasaCambioAdvertencia,
    tasas,
    loading,
    agregarCuenta,
    renombrarCuenta,
    actualizarComisionCuenta,
    eliminarCuenta,
    actualizarTasaCambio,
    actualizarTasaCustom,
    fijarTasaPredeterminada,
    sincronizarTasasOnline,
    isCuentaBs
  };
}

