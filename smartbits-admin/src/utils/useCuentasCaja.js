import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const CUENTAS_FIJAS = [
  { key: 'efectivo', label: 'Efectivo', moneda: 'USD' },
  { key: 'zelle', label: 'Zelle', moneda: 'USD' },
  { key: 'binance', label: 'Binance (USDT)', moneda: 'USD' },
  { key: 'zinli', label: 'Zinli', moneda: 'USD' },
  { key: 'bancamiga', label: 'Bancamiga', moneda: 'USD' },
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

  const todasCuentas = [
    ...CUENTAS_FIJAS,
    ...cuentasDinamicas
  ];

  const tasaCambio = Number(saldos.tasa_cambio) || 1;

  // Helper para añadir una cuenta nueva
  const agregarCuenta = async ({ nombre, moneda, saldoInicial = 0 }) => {
    if (!nombre || !nombre.trim()) throw new Error('Ingresa un nombre para la cuenta.');
    const safeKey = 'dinamica_' + nombre.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
    const nuevaCuenta = { key: safeKey, label: nombre.trim(), moneda: moneda || 'USD' };
    const nuevasDinamicas = [...cuentasDinamicas, nuevaCuenta];

    await updateDoc(doc(db, 'caja', 'saldos'), {
      [safeKey]: Number(saldoInicial) || 0,
      _cuentas_dinamicas: nuevasDinamicas,
      updated_at: new Date()
    });

    return nuevaCuenta;
  };

  // Helper para actualizar la tasa de cambio global
  const actualizarTasaCambio = async (nuevaTasa) => {
    const tasaNum = Number(nuevaTasa);
    if (isNaN(tasaNum) || tasaNum <= 0) throw new Error('Tasa de cambio inválida.');
    await updateDoc(doc(db, 'caja', 'saldos'), {
      tasa_cambio: tasaNum,
      updated_at: new Date()
    });
  };

  return { 
    saldos, 
    cuentasDinamicas, 
    todasCuentas, 
    tasaCambio, 
    loading,
    agregarCuenta,
    actualizarTasaCambio
  };
}
