import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  fetchTasasVenezolanas, 
  sanitizarNumeroTasa, 
  TIPO_TASA 
} from '../services/tasasCambioService';

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

export function parseDecimalInput(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const sanitized = String(val).trim().replace(',', '.');
  const num = parseFloat(sanitized);
  return isNaN(num) ? 0 : num;
}

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
  const cuentasFijasConNombres = CUENTAS_FIJAS.map(c => ({
    ...c,
    label: nombresCustom[c.key] || c.label
  }));

  const listaCuentasRaw = [
    ...cuentasFijasConNombres,
    ...cuentasDinamicas
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
  const tasaCambio = Number(saldos.tasa_cambio) || 1;

  const tasas = {
    bcv_usd: sanitizarNumeroTasa(rawTasas.bcv_usd) || null,
    bcv_eur: sanitizarNumeroTasa(rawTasas.bcv_eur) || null,
    binance_usdt: sanitizarNumeroTasa(rawTasas.binance_usdt) || null,
    custom: sanitizarNumeroTasa(rawTasas.custom) || (tasaCambio > 1 ? tasaCambio : null),
    tasa_predeterminada: tasaPredeterminada,
    updated_at: rawTasas.updated_at || null,
    fuente: rawTasas.fuente || null
  };

  // Helper para añadir una cuenta nueva
  const agregarCuenta = async ({ nombre, moneda, saldoInicial = 0 }) => {
    if (!nombre || !nombre.trim()) throw new Error('Ingresa un nombre para la cuenta.');
    const safeKey = 'dinamica_' + nombre.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
    const nuevaCuenta = { key: safeKey, label: nombre.trim(), moneda: moneda || 'USD' };
    const nuevasDinamicas = [...cuentasDinamicas, nuevaCuenta];

    await updateDoc(doc(db, 'caja', 'saldos'), {
      [safeKey]: parseDecimalInput(saldoInicial),
      _cuentas_dinamicas: nuevasDinamicas,
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
    const cleanTasas = {
      bcv_usd: res.bcv_usd ?? tasas.bcv_usd ?? null,
      bcv_eur: res.bcv_eur ?? tasas.bcv_eur ?? null,
      binance_usdt: res.binance_usdt ?? tasas.binance_usdt ?? null,
      custom: tasas.custom ?? null,
      tasa_predeterminada: tasaPredeterminada || TIPO_TASA.BINANCE,
      updated_at: res.updated_at || new Date().toISOString(),
      fuentes: res.fuentes || {}
    };

    // Determinar la tasa activa efectiva para retrocompatibilidad
    let tasaEfectiva = cleanTasas[tasaPredeterminada];
    if (!tasaEfectiva || tasaEfectiva <= 0) {
      tasaEfectiva = cleanTasas.binance_usdt || cleanTasas.bcv_usd || tasaCambio;
    }

    const payload = {
      tasas: cleanTasas,
      updated_at: new Date()
    };

    if (tasaEfectiva > 0) {
      payload.tasa_cambio = tasaEfectiva;
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
    const payload = {
      'tasas.tasa_predeterminada': claveTasa,
      updated_at: new Date()
    };
    if (valorSeleccionado && valorSeleccionado > 0) {
      payload.tasa_cambio = valorSeleccionado;
    }
    await updateDoc(doc(db, 'caja', 'saldos'), payload);
  };

  // Actualiza el valor de la tasa Custom / Manual acordada
  const actualizarTasaCustom = async (nuevoValor) => {
    const valorSanitizado = sanitizarNumeroTasa(nuevoValor);
    if (!valorSanitizado || valorSanitizado <= 0) {
      throw new Error('Ingresa un valor de tasa válido.');
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
    const tasaNum = parseDecimalInput(nuevaTasa);
    if (isNaN(tasaNum) || tasaNum <= 0) throw new Error('Tasa de cambio inválida.');
    await updateDoc(doc(db, 'caja', 'saldos'), {
      tasa_cambio: tasaNum,
      'tasas.custom': tasaNum,
      'tasas.tasa_predeterminada': TIPO_TASA.CUSTOM,
      updated_at: new Date()
    });
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
    tasas,
    loading,
    agregarCuenta,
    renombrarCuenta,
    eliminarCuenta,
    actualizarTasaCambio,
    actualizarTasaCustom,
    fijarTasaPredeterminada,
    sincronizarTasasOnline,
    isCuentaBs
  };
}

