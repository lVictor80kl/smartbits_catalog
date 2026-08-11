import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, collection, addDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Users, TrendingUp, Info, Activity, Settings, PlusCircle, Loader2 } from 'lucide-react';

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

  // Estado para retiro personal
  const [retiroForm, setRetiroForm] = useState({ socio: 'ysmael', concepto: '', monto: '', cuenta_salida: 'efectivo' });
  const [savingRetiro, setSavingRetiro] = useState(false);
  const [showRetiroForm, setShowRetiroForm] = useState(false);

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
      alert("Configuracion actualizada.");
    } catch (e) {
      console.error(e);
      alert("Error actualizando: " + e.message);
    }
  };

  // Cuentas disponibles para retiro (fijas + dinamicas)
  const cuentasRetiro = [
    { key: 'efectivo', label: 'Efectivo (USD)' },
    { key: 'zelle', label: 'Zelle (USD)' },
    { key: 'bancamiga', label: 'Bancamiga (USD)' },
    { key: 'binance', label: 'Binance (USD)' },
    { key: 'zinli', label: 'Zinli (USD)' },
    { key: 'paypal', label: 'PayPal (USD)' },
    { key: 'venezuela', label: 'Banco Venezuela (Bs)' },
    { key: 'bolivares_bs', label: 'Otros Bs' },
    ...(caja._cuentas_dinamicas || []).map(c => ({ key: c.key, label: c.label + (c.moneda === 'BS' ? ' (Bs)' : ' (USD)') })),
  ];

  const handleRetiro = async (e) => {
    e.preventDefault();
    if (!retiroForm.monto || !retiroForm.concepto) return alert('Completa todos los campos');
    const montoNum = Number(retiroForm.monto);
    if (isNaN(montoNum) || montoNum <= 0) return alert('Ingresa un monto valido');

    const confirmar = window.confirm(
      `¿Confirmar retiro de $${montoNum.toFixed(2)} para ${retiroForm.socio === 'ysmael' ? 'Ysmael' : 'Victor'} desde ${retiroForm.cuenta_salida}?\n\nEsto descontara el saldo de la caja y se registrara como gasto personal del socio.`
    );
    if (!confirmar) return;

    setSavingRetiro(true);
    try {
      // 1. Registrar en gastos_personales
      await addDoc(collection(db, 'gastos_personales'), {
        socio: retiroForm.socio,
        concepto: retiroForm.concepto,
        monto: montoNum,
        metodo_pago: retiroForm.cuenta_salida,
        cuenta_salida: retiroForm.cuenta_salida,
        es_deuda: true,
        fecha: serverTimestamp()
      });
      // 2. Descontar de la caja real
      await updateDoc(doc(db, 'caja', 'saldos'), {
        [retiroForm.cuenta_salida]: increment(-montoNum),
        updated_at: new Date()
      });
      setRetiroForm({ socio: 'ysmael', concepto: '', monto: '', cuenta_salida: 'efectivo' });
      setShowRetiroForm(false);
      alert('Retiro registrado y descontado de la caja exitosamente.');
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    }
    setSavingRetiro(false);
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
          <strong>Formula de Capital:</strong> El capital base se calcula sumando la caja y el inventario, restando el prestamo inicial, y <em>sumando</em> los gastos personales de ambos. De esta forma, el dinero que cada quien saca para uso personal se convierte en una deuda hacia el negocio y <strong>no reduce la tajada de ganancia del otro socio</strong>.
        </p>
      </div>

      {/* SECCION: Registrar Retiro Personal */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-brand-600" />
            Registrar Retiro Personal
          </h3>
          <button
            onClick={() => setShowRetiroForm(p => !p)}
            className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${showRetiroForm ? 'bg-gray-100 text-gray-600' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
          >
            {showRetiroForm ? 'Cancelar' : '+ Nuevo Retiro'}
          </button>
        </div>

        {showRetiroForm && (
          <form onSubmit={handleRetiro} className="space-y-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Socio que retira</label>
                <div className="flex gap-3">
                  {[{v:'ysmael',l:'Ysmael'},{v:'victor',l:'Victor'}].map(s => (
                    <label key={s.v} className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border-2 cursor-pointer transition-colors font-semibold ${retiroForm.socio === s.v ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      <input type="radio" value={s.v} checked={retiroForm.socio === s.v} onChange={() => setRetiroForm(p => ({...p, socio: s.v}))} className="hidden" />
                      {s.l}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta de donde sale</label>
                <select
                  value={retiroForm.cuenta_salida}
                  onChange={e => setRetiroForm(p => ({...p, cuenta_salida: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                >
                  {cuentasRetiro.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Concepto</label>
                <input
                  type="text"
                  value={retiroForm.concepto}
                  onChange={e => setRetiroForm(p => ({...p, concepto: e.target.value}))}
                  placeholder="Ej: Adelanto quincena, pago personal..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (USD o Bs segun cuenta)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-sm">$</span>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={retiroForm.monto}
                    onChange={e => setRetiroForm(p => ({...p, monto: e.target.value}))}
                    className="w-full pl-8 border border-gray-300 rounded-lg px-3 py-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                    required
                  />
                </div>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
              <Activity className="w-4 h-4 flex-shrink-0 mt-0.5" />
              El retiro descontara el monto de la cuenta seleccionada y se registrara como deuda personal de <strong>{retiroForm.socio === 'ysmael' ? 'Ysmael' : 'Victor'}</strong>, sin afectar el capital del otro socio.
            </div>
            <button
              type="submit"
              disabled={savingRetiro}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {savingRetiro ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              {savingRetiro ? 'Registrando...' : 'Confirmar Retiro'}
            </button>
          </form>
        )}
      </div>

    </div>
  );
}
