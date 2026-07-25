import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Save, RefreshCw, Wallet, DollarSign, Percent } from 'lucide-react';

export default function ResumenCaja() {
  const [saldos, setSaldos] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Cuentas fijas para mostrar siempre, incluso si están en 0 en DB
  const cuentas = [
    { key: 'bancamiga', label: 'Bancamiga (USD)', icon: DollarSign },
    { key: 'efectivo', label: 'Efectivo (USD)', icon: Wallet },
    { key: 'paypal', label: 'PayPal (USD)', icon: DollarSign },
    { key: 'zelle', label: 'Zelle (USD)', icon: DollarSign },
    { key: 'binance', label: 'Binance (USDT)', icon: DollarSign },
    { key: 'zinli', label: 'Zinli (USD)', icon: DollarSign },
    { key: 'venezuela', label: 'Banco Venezuela (Bs)', icon: Wallet },
    { key: 'bolivares_bs', label: 'Otros Bs', icon: Wallet },
    { key: 'caja_envios', label: 'Caja Envíos', icon: Wallet },
    { key: 'ventas_no_asignadas', label: 'Ventas por Asignar', icon: Wallet },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'caja', 'saldos');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSaldos(docSnap.data());
      }
    } catch (error) {
      console.error('Error fetching caja:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (key, value) => {
    setSaldos(prev => ({
      ...prev,
      [key]: value === '' ? '' : parseFloat(value) || 0
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Limpiar valores vacíos antes de guardar
      const cleanSaldos = {};
      for (const [key, value] of Object.entries(saldos)) {
        cleanSaldos[key] = value === '' ? 0 : value;
      }
      const docRef = doc(db, 'caja', 'saldos');
      await setDoc(docRef, {
        ...cleanSaldos,
        updated_at: new Date()
      }, { merge: true });
      alert('Saldos actualizados correctamente');
    } catch (error) {
      console.error('Error saving caja:', error);
      alert('Error al guardar: ' + error.message);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2"><RefreshCw className="animate-spin w-5 h-5"/> Cargando saldos...</div>;

  const totalUSD = cuentas
    .filter(c => !c.key.includes('bs') && c.key !== 'venezuela')
    .reduce((acc, curr) => acc + (Number(saldos[curr.key]) || 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-lg">
            <DollarSign className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total en Caja (USD)</p>
            <h3 className="text-2xl font-bold text-gray-900">${totalUSD.toFixed(2)}</h3>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <Percent className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Tasa de Cambio</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-bold text-gray-900">Bs.</span>
              <input 
                type="number"
                value={saldos.tasa_cambio || ''}
                onChange={(e) => handleChange('tasa_cambio', e.target.value)}
                className="w-24 px-2 py-1 border border-gray-300 rounded font-semibold focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-brand-600" />
          Saldos por Cuenta
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cuentas.map(cuenta => {
            const Icon = cuenta.icon;
            return (
              <div key={cuenta.key}>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Icon className="w-4 h-4 text-gray-400" />
                  {cuenta.label}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">{cuenta.key.includes('bs') || cuenta.key === 'venezuela' ? 'Bs' : '$'}</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 transition-colors"
                    value={saldos[cuenta.key] ?? ''}
                    onChange={(e) => handleChange(cuenta.key, e.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-70"
          >
            {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
