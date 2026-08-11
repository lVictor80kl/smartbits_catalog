import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const BANCOS_DEFAULT = [
  { id: 'bnc', nombre: 'Banco BNC', comision: 1.5 },
  { id: 'venezuela', label: 'Banco Venezuela', nombre: 'Banco Venezuela', comision: 2.5 },
  { id: 'bancamiga', nombre: 'Bancamiga', comision: 0 },
  { id: 'paypal', nombre: 'PayPal', comision: 0 },
  { id: 'zelle', nombre: 'Zelle', comision: 0 },
  { id: 'efectivo', nombre: 'Efectivo USD', comision: 0 },
  { id: 'binance', nombre: 'Binance / USDT', comision: 0 },
  { id: 'zinli', nombre: 'Zinli', comision: 0 },
];

export async function getBancosConfig() {
  try {
    const docRef = doc(db, 'finanzas', 'bancos_config');
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().bancos) {
      return snap.data().bancos;
    }
  } catch (e) {
    console.error('Error al obtener configuración de bancos:', e);
  }
  return BANCOS_DEFAULT;
}

export async function saveBancosConfig(bancosList) {
  try {
    const docRef = doc(db, 'finanzas', 'bancos_config');
    await setDoc(docRef, { bancos: bancosList, updated_at: new Date() }, { merge: true });
    return true;
  } catch (e) {
    console.error('Error al guardar configuración de bancos:', e);
    throw e;
  }
}
