import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, collection } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Users, TrendingUp, Info, Activity, Settings } from 'lucide-react';

export default function CapitalSocios() {
  const [config, setConfig] = useState({ prestamo_mama: 0, inversion_ysmael: 0 });
  const [caja, setCaja] = useState({});
  const [laptops, setLaptops] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({ prestamo_mama: 0, inversion_ysmael: 0 });
  const editingRef = useRef(false);

  // Mantener ref sincronizada para no re-suscribir listeners
  useEffect(() => {
    editingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    let loadCount = 0;
    const totalSources = 4;
    const markLoaded = () => {
      loadCount++;
      if (loadCount >= totalSources) setLoading(false);
    };

    const handleError = (source) => (err) => {
      console.error(`Error en ${source}:`, err);
      setError(`Error cargando ${source}: ${err.message}`);
      markLoaded();
    };

    // 1. Config
    const unsubConfig = onSnapshot(
      doc(db, 'finanzas', 'config'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setConfig(data);
          if (!editingRef.current) {
            setEditValues({
              prestamo_mama: data.prestamo_mama || 0,
              inversion_ysmael: data.inversion_ysmael || 0
            });
          }
        }
        markLoaded();
      },
      handleError('configuración')
    );

    // 2. Caja
    const unsubCaja = onSnapshot(
      doc(db, 'caja', 'saldos'),
      (docSnap) => {
        if (docSnap.exists()) {
          setCaja(docSnap.data());
        }
        markLoaded();
      },
      handleError('caja')
    );

    // 3. Laptops
    const unsubLaptops = onSnapshot(
      collection(db, 'laptops'),
      (snapshot) => {
        setLaptops(snapshot.docs.map(d => d.data()));
        markLoaded();
      },
      handleError('laptops')
    );

    // 4. Gastos Personales
    const unsubGastos = onSnapshot(
      collection(db, 'gastos_personales'),
      (snapshot) => {
        setGastos(snapshot.docs.map(d => d.data()));
        markLoaded();
      },
      handleError('gastos')
    );

    return () => {
      unsubConfig();
      unsubCaja();
      unsubLaptops();
      unsubGastos();
    };
  }, []); // <-- Sin dependencias. Se suscribe UNA sola vez.

  const handleSaveConfig = async () => {
    try {
      await setDoc(doc(db, 'finanzas', 'config'), {
        prestamo_mama: Number(editValues.prestamo_mama),
        inversion_ysmael: Number(editValues.inversion_ysmael)
      }, { merge: true });
      setIsEditing(false);
      alert("Configuración actualizada.");
    } catch (e) {
      console.error(e);
      alert("Error actualizando: " + e.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando capital...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  const fmt = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  // --- MATEMÁTICA EN EL FRONTEND ---
  const prestamo_mama = config?.prestamo_mama || 0;
  const inversion_ysmael = config?.inversion_ysmael || 0;

  let caja_total = 0;
  const BS_KEYS = ['venezuela', 'bolivares_bs'];
  const EXCLUDE_KEYS = ['tasa_cambio', 'updated_at', 'caja_envios'];
  for (const [key, value] of Object.entries(caja)) {
    if (typeof value === 'number' && !EXCLUDE_KEYS.includes(key) && !BS_KEYS.includes(key)) {
      caja_total += value;
    }
  }

  let inventario = 0;
  laptops.forEach(laptop => {
    if (!laptop.fecha_venta) {
      inventario += Number(laptop.costo_total || 0);
    }
  });

  const capital_total = caja_total + inventario;
  const capital_smartbits = capital_total - prestamo_mama;

  let gastos_ysmael = 0;
  let gastos_victor = 0;
  gastos.forEach(gasto => {
    if (gasto.socio === 'ysmael') gastos_ysmael += Number(gasto.monto || 0);
    if (gasto.socio === 'victor') gastos_victor += Number(gasto.monto || 0);
  });

  const capital_base = capital_smartbits - inversion_ysmael + gastos_ysmael + gastos_victor;
  const mitad_cada_uno = capital_base / 2;
  const capital_ysmael = mitad_cada_uno - gastos_ysmael;
  const capital_victor = mitad_cada_uno - gastos_victor;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* HEADER DE CAPITAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-24 h-24" />
          </div>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Capital Total (Negocio)</p>
          <h2 className="text-4xl font-black mb-4">{fmt(capital_smartbits)}</h2>
          <div className="flex gap-4 text-sm font-medium">
            <div className="bg-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-slate-300">Caja (USD):</span>
              <span className="text-white">{fmt(caja_total)}</span>
            </div>
            <div className="bg-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-slate-300">Costo Inv:</span>
              <span className="text-white">{fmt(inventario)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-center relative">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="absolute top-4 right-4 text-gray-400 hover:text-brand-600 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
          
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-brand-500" />
            Parámetros Iniciales
          </h3>
          
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Préstamo Mamá (Deuda externa)</label>
                <input type="number" value={editValues.prestamo_mama} onChange={e => setEditValues(v => ({...v, prestamo_mama: e.target.value}))} className="w-full mt-1 border border-gray-300 rounded focus:ring-brand-500 focus:border-brand-500 px-3 py-1.5" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Inversión Ysmael (Inicial)</label>
                <input type="number" value={editValues.inversion_ysmael} onChange={e => setEditValues(v => ({...v, inversion_ysmael: e.target.value}))} className="w-full mt-1 border border-gray-300 rounded focus:ring-brand-500 focus:border-brand-500 px-3 py-1.5" />
              </div>
              <button onClick={handleSaveConfig} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm w-full font-bold">Guardar</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <span className="text-slate-600 font-medium">Préstamo Externo</span>
                <span className="text-red-600 font-bold">-{fmt(prestamo_mama)}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <span className="text-slate-600 font-medium">Inversión Inicial Ysmael</span>
                <span className="text-brand-600 font-bold">{fmt(inversion_ysmael)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Capital Base Generado</span>
                <span className="text-emerald-600 font-bold">{fmt(capital_base)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DETALLE POR SOCIO */}
      <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mt-8 mb-4">
        <Users className="w-6 h-6 text-brand-600" />
        Distribución de Socios
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* YSMAEL */}
        <div className="bg-white border-2 border-transparent hover:border-brand-100 rounded-2xl p-6 shadow-sm transition-all relative">
          {capital_ysmael > capital_victor && (
            <div className="absolute -top-3 -right-3 bg-emerald-500 text-white w-8 h-8 flex items-center justify-center rounded-full shadow-lg border-2 border-white">
              ★
            </div>
          )}
          <h4 className="text-2xl font-black text-slate-800 mb-6">Ysmael</h4>
          
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">50% Capital Base</span>
              <span className="font-semibold text-slate-700">{fmt(mitad_cada_uno)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Deuda por Gastos Personales</span>
              <span className="font-semibold text-red-500">-{fmt(gastos_ysmael)}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Capital Neto Actual</p>
            <p className={`text-3xl font-black ${capital_ysmael < 0 ? 'text-red-600' : 'text-brand-600'}`}>
              {fmt(capital_ysmael)}
            </p>
          </div>
        </div>

        {/* VICTOR */}
        <div className="bg-white border-2 border-transparent hover:border-brand-100 rounded-2xl p-6 shadow-sm transition-all relative">
          {capital_victor > capital_ysmael && (
            <div className="absolute -top-3 -right-3 bg-emerald-500 text-white w-8 h-8 flex items-center justify-center rounded-full shadow-lg border-2 border-white">
              ★
            </div>
          )}
          <h4 className="text-2xl font-black text-slate-800 mb-6">Víctor</h4>
          
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">50% Capital Base</span>
              <span className="font-semibold text-slate-700">{fmt(mitad_cada_uno)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Deuda por Gastos Personales</span>
              <span className="font-semibold text-red-500">-{fmt(gastos_victor)}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Capital Neto Actual</p>
            <p className={`text-3xl font-black ${capital_victor < 0 ? 'text-red-600' : 'text-brand-600'}`}>
              {fmt(capital_victor)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 mt-8">
        <Activity className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          <strong>Fórmula de Capital:</strong> El capital base se calcula sumando la caja y el inventario, restando el préstamo inicial, y <em>sumando</em> los gastos personales de ambos. De esta forma, el dinero que cada quien saca para uso personal se convierte en una deuda hacia el negocio y <strong>no reduce la tajada de ganancia del otro socio</strong>.
        </p>
      </div>

    </div>
  );
}
