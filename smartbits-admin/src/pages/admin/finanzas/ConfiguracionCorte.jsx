import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { ShieldCheck, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, RefreshCw, Layers, DollarSign, Users, Landmark, Sparkles } from 'lucide-react';
import { useCorteContable } from '../../../utils/useCorteContable';
import { getCostoTotal } from '../../../utils/costos';

const CUENTAS_BASE = [
  { key: 'efectivo', label: 'Efectivo', moneda: 'USD' },
  { key: 'zelle', label: 'Zelle', moneda: 'USD' },
  { key: 'binance', label: 'Binance (USDT)', moneda: 'USD' },
  { key: 'zinli', label: 'Zinli', moneda: 'USD' },
  { key: 'bancamiga', label: 'Bancamiga', moneda: 'USD' },
  { key: 'paypal', label: 'PayPal', moneda: 'USD' },
  { key: 'venezuela', label: 'Banco Venezuela', moneda: 'BS' },
  { key: 'bolivares_bs', label: 'Otros Bs', moneda: 'BS' },
];

export default function ConfiguracionCorte({ onCorteRealizado }) {
  const { corte, loading: loadingCorte } = useCorteContable();
  const [step, setStep] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cuentas dinámicas
  const [cuentasDinamicas, setCuentasDinamicas] = useState([]);

  // Form State
  const [saldosCaja, setSaldosCaja] = useState({
    efectivo: 0,
    zelle: 0,
    binance: 0,
    zinli: 0,
    bancamiga: 0,
    paypal: 0,
    venezuela: 0,
    bolivares_bs: 0,
  });
  const [tasaCambio, setTasaCambio] = useState(1);
  const [capitalYsmael, setCapitalYsmael] = useState(0);
  const [capitalVictor, setCapitalVictor] = useState(0);
  const [inventarioSugerido, setInventarioSugerido] = useState(0);
  const [inventarioManual, setInventarioManual] = useState(0);
  const [usarInvSugerido, setUsarInvSugerido] = useState(true);

  const todasCuentas = [...CUENTAS_BASE, ...cuentasDinamicas];

  // Cargar saldos actuales como valores de partida inicial al configurar
  useEffect(() => {
    async function loadCurrentState() {
      try {
        const cajaSnap = await getDoc(doc(db, 'caja', 'saldos'));
        if (cajaSnap.exists()) {
          const d = cajaSnap.data();
          const dinamicas = d._cuentas_dinamicas || [];
          setCuentasDinamicas(dinamicas);

          const initialSaldos = {
            efectivo: d.efectivo || 0,
            zelle: d.zelle || 0,
            binance: d.binance || 0,
            zinli: d.zinli || 0,
            bancamiga: d.bancamiga || 0,
            paypal: d.paypal || 0,
            venezuela: d.venezuela || 0,
            bolivares_bs: d.bolivares_bs || 0,
          };
          dinamicas.forEach(dc => {
            initialSaldos[dc.key] = d[dc.key] || 0;
          });

          setSaldosCaja(initialSaldos);
          if (d.tasa_cambio) setTasaCambio(d.tasa_cambio);
        }

        // Calcular costo del inventario activo actual
        const [laptopsSnap, compSnap] = await Promise.all([
          getDocs(collection(db, 'laptops')),
          getDocs(collection(db, 'componentes'))
        ]);
        let totalInv = 0;
        const estadosActivos = ['Disponible', 'Coming soon'];
        laptopsSnap.docs.forEach(docSnap => {
          const l = docSnap.data();
          if (estadosActivos.includes(l.disponibilidad)) {
            totalInv += getCostoTotal(l);
          }
        });
        compSnap.docs.forEach(docSnap => {
          const c = docSnap.data();
          if (estadosActivos.includes(c.disponibilidad)) {
            totalInv += getCostoTotal(c);
          }
        });
        setInventarioSugerido(totalInv);
        setInventarioManual(totalInv);
      } catch (err) {
        console.error("Error al precargar estado para corte:", err);
      }
    }

    if (!corte) {
      loadCurrentState();
    } else {
      // Si ya hay corte cargado, precargar sus valores para edición si se requiere
      setSaldosCaja({ ...corte.saldos_iniciales });
      setTasaCambio(corte.tasa_cambio_corte || 1);
      setCapitalYsmael(corte.capital_inicial_ysmael || 0);
      setCapitalVictor(corte.capital_inicial_victor || 0);
      setInventarioManual(corte.inventario_inicial || 0);
      // Cargar cuentas dinámicas del corte o de caja
      getDoc(doc(db, 'caja', 'saldos')).then(s => {
        if (s.exists() && s.data()._cuentas_dinamicas) {
          setCuentasDinamicas(s.data()._cuentas_dinamicas);
        }
      });
    }
  }, [corte]);

  const handleEjecutarCorte = async () => {
    if (isNaN(Number(capitalYsmael)) || isNaN(Number(capitalVictor))) {
      return alert("Ingresa valores numéricos válidos para el capital de ambos socios.");
    }

    const confirmar = window.confirm(
      "⚠️ ¿Confirmas ejecutar el Corte Contable con estos valores de Punto Cero?\n\n" +
      "1. Se fijarán los saldos iniciales de cada caja.\n" +
      "2. El capital de partida será de $" + Number(capitalYsmael).toFixed(2) + " (Ysmael) y $" + Number(capitalVictor).toFixed(2) + " (Víctor).\n" +
      "3. Todos los movimientos posteriores sumarán o restarán directamente sobre este punto cero."
    );
    if (!confirmar) return;

    setSaving(true);
    try {
      const invFinal = usarInvSugerido ? Number(inventarioSugerido) : Number(inventarioManual);
      const saldosFinales = {};
      Object.keys(saldosCaja).forEach(k => {
        saldosFinales[k] = Number(saldosCaja[k]) || 0;
      });

      // 1. Guardar documento del corte contable
      await setDoc(doc(db, 'finanzas', 'corte_contable'), {
        activo: true,
        fecha_corte: serverTimestamp(),
        saldos_iniciales: saldosFinales,
        tasa_cambio_corte: Number(tasaCambio) || 1,
        inventario_inicial: invFinal,
        capital_inicial_ysmael: Number(capitalYsmael),
        capital_inicial_victor: Number(capitalVictor),
        updated_at: serverTimestamp()
      });

      // 2. Sincronizar saldos de caja en vivo con los saldos iniciales definidos
      await setDoc(doc(db, 'caja', 'saldos'), {
        ...saldosFinales,
        tasa_cambio: Number(tasaCambio) || 1,
        updated_at: new Date()
      }, { merge: true });

      alert("✅ ¡Corte contable ejecutado con éxito! El sistema ahora opera en punto cero corregido.");
      setIsEditing(false);
      if (onCorteRealizado) onCorteRealizado();
    } catch (err) {
      console.error(err);
      alert("Error al ejecutar el corte: " + err.message);
    }
    setSaving(false);
  };

  if (loadingCorte) {
    return (
      <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin" /> Cargando estado de corte contable...
      </div>
    );
  }

  // Si ya existe un corte y el usuario no está en modo edición
  if (corte && !isEditing) {
    const fechaCorteStr = corte.fecha_corte_js
      ? corte.fecha_corte_js.toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Registrada';

    const fmt = (v, moneda = 'USD') => moneda === 'USD'
      ? `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `Bs ${Number(v || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800">Corte Contable Activo</h3>
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">Punto Cero Fijado</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Fecha de aplicación: <span className="font-semibold text-slate-700">{fechaCorteStr}</span></p>
            </div>
          </div>
          <button
            onClick={() => { setIsEditing(true); setStep(1); }}
            className="text-xs font-bold text-slate-600 hover:text-brand-600 bg-slate-100 hover:bg-brand-50 px-3 py-2 rounded-lg transition-colors border border-slate-200"
          >
            Re-configurar Punto Cero
          </button>
        </div>

        {/* Resumen del punto de partida */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Capital Inicial Ysmael</p>
            <h4 className="text-2xl font-black text-slate-800">{fmt(corte.capital_inicial_ysmael)}</h4>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Capital Inicial Víctor</p>
            <h4 className="text-2xl font-black text-slate-800">{fmt(corte.capital_inicial_victor)}</h4>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Inventario al Corte</p>
            <h4 className="text-2xl font-black text-slate-800">{fmt(corte.inventario_inicial)}</h4>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Saldos de Caja Definidos en el Corte</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {todasCuentas.map(c => {
              const val = corte.saldos_iniciales?.[c.key] || 0;
              return (
                <div key={c.key} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                  <span className="text-slate-500 font-medium block">{c.label}</span>
                  <span className="text-sm font-bold text-slate-800">{fmt(val, c.moneda)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // WIZARD DE CONFIGURACIÓN (Paso 1, 2 o 3)
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-600" />
            Configuración de Punto Cero (Corte Contable)
          </h3>
          <p className="text-xs text-slate-500">Ingresa los saldos y capitales corregidos para iniciar la contabilidad limpia.</p>
        </div>
        <div className="flex items-center gap-1 text-xs font-bold bg-brand-50 text-brand-700 px-3 py-1.5 rounded-full">
          Paso {step} de 3
        </div>
      </div>

      {/* PASO 1: SALDOS DE CAJA */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
            <strong>Paso 1:</strong> Ingresa el saldo real disponible en cada cuenta o billetera al momento de este corte.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {todasCuentas.map(c => (
              <div key={c.key}>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex justify-between">
                  <span>{c.label}</span>
                  <span className="text-slate-400">({c.moneda})</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">
                    {c.moneda === 'USD' ? '$' : 'Bs'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={saldosCaja[c.key] ?? 0}
                    onChange={e => {
                      const v = e.target.value;
                      setSaldosCaja(p => ({ ...p, [c.key]: v === '' ? '' : Number(v) }));
                    }}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tasa de Cambio Referencial (Bs/USD)</label>
            <input
              type="number"
              step="0.01"
              value={tasaCambio}
              onChange={e => setTasaCambio(e.target.value)}
              className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              Siguiente: Inventario <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: INVENTARIO */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
            <strong>Paso 2:</strong> Verifica el valor del inventario activo actual en almacén (a costo de adquisición).
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm text-slate-800">
              <input
                type="radio"
                checked={usarInvSugerido}
                onChange={() => setUsarInvSugerido(true)}
                className="text-brand-600 focus:ring-brand-500"
              />
              <span>Usar valor calculado automáticamente desde catálogo:</span>
              <span className="font-bold text-emerald-600 ml-auto">${Number(inventarioSugerido).toFixed(2)}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm text-slate-800 pt-2 border-t border-slate-200">
              <input
                type="radio"
                checked={!usarInvSugerido}
                onChange={() => setUsarInvSugerido(false)}
                className="text-brand-600 focus:ring-brand-500"
              />
              <span>Ingresar valor de inventario corregido manualmente:</span>
            </label>

            {!usarInvSugerido && (
              <div className="pl-6 pt-1">
                <div className="relative w-56">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={inventarioManual}
                    onChange={e => setInventarioManual(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Atrás
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              Siguiente: Capital Socios <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: CAPITAL DE SOCIOS */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 flex gap-2">
            <Users className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Paso 3:</strong> Suministra el capital inicial corregido que le corresponde a cada socio a partir de hoy.
              <p className="mt-0.5 text-blue-600">
                Todo movimiento a partir de este corte sumará o restará sobre este punto cero (utilidades compartidas 50/50 y retiros directos a cada socio).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Capital Inicial — Ysmael ($ USD)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-sm font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={capitalYsmael}
                  onChange={e => setCapitalYsmael(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2.5 border border-brand-300 rounded-lg text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  required
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Capital Inicial — Víctor ($ USD)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-sm font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={capitalVictor}
                  onChange={e => setCapitalVictor(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2.5 border border-brand-300 rounded-lg text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  required
                />
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              Al ejecutar el corte, se establecerá el punto cero con fecha de hoy. Los registros anteriores quedarán como referencia histórica y no alterarán los balances nuevos.
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(2)}
              disabled={saving}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Atrás
            </button>
            <div className="flex gap-2">
              {corte && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={handleEjecutarCorte}
                disabled={saving}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {saving ? 'Guardando Corte...' : 'Ejecutar Corte Contable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
