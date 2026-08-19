import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, addDoc, collection, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Wallet, DollarSign, Plus, AlertTriangle, RefreshCw, Settings, X, Save, History, Landmark } from 'lucide-react';

// Cuentas fijas del sistema (compatibilidad con esquema existente)
const CUENTAS_FIJAS_USD = [
  { key: 'bancamiga', label: 'Bancamiga', moneda: 'USD' },
  { key: 'efectivo', label: 'Efectivo', moneda: 'USD' },
  { key: 'paypal', label: 'PayPal', moneda: 'USD' },
  { key: 'zelle', label: 'Zelle', moneda: 'USD' },
  { key: 'binance', label: 'Binance (USDT)', moneda: 'USD' },
  { key: 'zinli', label: 'Zinli', moneda: 'USD' },
];
const CUENTAS_FIJAS_BS = [
  { key: 'venezuela', label: 'Banco Venezuela', moneda: 'BS' },
  { key: 'bolivares_bs', label: 'Otros Bs', moneda: 'BS' },
];
const EXCLUIR_KEYS = ['tasa_cambio', 'updated_at', 'caja_envios', 'ventas_no_asignadas', '_cuentas_dinamicas'];

export default function ResumenCaja() {
  const [saldos, setSaldos] = useState({});
  const [loading, setLoading] = useState(true);

  // Modal: Nueva Cuenta
  const [modalNueva, setModalNueva] = useState({ open: false, nombre: '', moneda: 'USD' });
  // Modal: Ajuste Manual
  const [modalAjuste, setModalAjuste] = useState({ open: false, cuentaKey: '', cuentaLabel: '', saldoActual: 0, nuevoSaldo: '', ajustador: '', motivo: '', saving: false });

  // Cuentas dinamicas creadas por el usuario (guardadas como metadata en saldos._cuentas_dinamicas)
  const [cuentasDinamicas, setCuentasDinamicas] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'caja', 'saldos'), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setSaldos(data);
        // Leer metadata de cuentas dinamicas
        const dinamicas = data._cuentas_dinamicas || [];
        setCuentasDinamicas(dinamicas);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // -------- Calculos --------
  const tasaCambio = Number(saldos.tasa_cambio) || 1;

  const todasUSD = [...CUENTAS_FIJAS_USD, ...cuentasDinamicas.filter(c => c.moneda === 'USD')];
  const todasBS = [...CUENTAS_FIJAS_BS, ...cuentasDinamicas.filter(c => c.moneda === 'BS')];

  const totalUSD = todasUSD.reduce((acc, c) => acc + (Number(saldos[c.key]) || 0), 0);
  const totalBSenUSD = tasaCambio > 0
    ? todasBS.reduce((acc, c) => acc + (Number(saldos[c.key]) || 0) / tasaCambio, 0)
    : 0;
  const totalGeneral = totalUSD + totalBSenUSD;

  // -------- Handlers --------
  const handleTasa = async (valor) => {
    try {
      await updateDoc(doc(db, 'caja', 'saldos'), { tasa_cambio: Number(valor) || 0, updated_at: new Date() });
    } catch (e) { console.error(e); }
  };

  const crearCuenta = async () => {
    const { nombre, moneda } = modalNueva;
    if (!nombre.trim()) return alert('Ingresa un nombre para la cuenta.');
    const key = 'dinamica_' + nombre.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    const nuevas = [...cuentasDinamicas, { key, label: nombre.trim(), moneda }];
    try {
      await updateDoc(doc(db, 'caja', 'saldos'), {
        [key]: 0,
        _cuentas_dinamicas: nuevas,
        updated_at: new Date()
      });
      setModalNueva({ open: false, nombre: '', moneda: 'USD' });
    } catch (e) { alert('Error: ' + e.message); }
  };

  const abrirAjuste = (cuentaKey, cuentaLabel) => {
    const saldoActual = Number(saldos[cuentaKey]) || 0;
    setModalAjuste({ open: true, cuentaKey, cuentaLabel, saldoActual, nuevoSaldo: saldoActual.toString(), ajustador: '', motivo: '', saving: false });
  };

  const confirmarAjuste = async () => {
    const { cuentaKey, cuentaLabel, saldoActual, nuevoSaldo, ajustador, motivo } = modalAjuste;
    if (!ajustador) return alert('Selecciona quien realiza el ajuste.');
    if (!motivo.trim()) return alert('El motivo del ajuste es obligatorio.');
    const nuevoNum = Number(nuevoSaldo);
    if (isNaN(nuevoNum)) return alert('Ingresa un monto valido.');

    setModalAjuste(p => ({ ...p, saving: true }));
    const diferencia = nuevoNum - saldoActual;

    try {
      // 1. Actualizar saldo en caja
      await updateDoc(doc(db, 'caja', 'saldos'), {
        [cuentaKey]: nuevoNum,
        updated_at: new Date()
      });
      // 2. Guardar en historial de auditoria
      await addDoc(collection(db, 'auditoria_caja'), {
        cuenta_key: cuentaKey,
        cuenta_label: cuentaLabel,
        saldo_anterior: saldoActual,
        saldo_nuevo: nuevoNum,
        diferencia,
        ajustador,
        motivo,
        fecha: serverTimestamp()
      });
      setModalAjuste({ open: false, cuentaKey: '', cuentaLabel: '', saldoActual: 0, nuevoSaldo: '', ajustador: '', motivo: '', saving: false });
      alert('Ajuste registrado en el historial de auditoria.');
    } catch (e) {
      console.error(e);
      alert('Error: ' + e.message);
      setModalAjuste(p => ({ ...p, saving: false }));
    }
  };

  const fmt = (v, moneda = 'USD') => moneda === 'USD'
    ? `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `Bs ${Number(v || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) return (
    <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
      <RefreshCw className="animate-spin w-5 h-5" /> Cargando caja...
    </div>
  );

  // -------- Render de una fila de cuenta --------
  const CuentaRow = ({ cuenta, moneda }) => {
    const saldo = Number(saldos[cuenta.key]) || 0;
    const saldoUSD = moneda === 'BS' && tasaCambio > 0 ? saldo / tasaCambio : saldo;
    return (
      <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 bg-white transition-colors group">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${moneda === 'USD' ? 'bg-green-100' : 'bg-amber-100'}`}>
            {moneda === 'USD' ? <DollarSign className="w-4 h-4 text-green-600" /> : <Landmark className="w-4 h-4 text-amber-600" />}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{cuenta.label}</p>
            {moneda === 'BS' && tasaCambio > 0 && (
              <p className="text-xs text-gray-400">≈ {fmt(saldoUSD, 'USD')}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-lg font-bold ${saldo < 0 ? 'text-red-600' : 'text-slate-800'}`}>
            {fmt(saldo, moneda)}
          </span>
          <button
            onClick={() => abrirAjuste(cuenta.key, cuenta.label)}
            title="Ajuste manual auditado"
            className="p-1.5 text-gray-300 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* KPIs Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg col-span-1 md:col-span-1">
          <div className="flex justify-between items-start">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total General Caja</p>
          </div>
          <h2 className="text-3xl font-black mt-2">${totalGeneral.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
          <p className="text-slate-500 text-xs mt-1">USD + Bs convertido</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
          <p className="text-emerald-700 text-xs font-bold uppercase tracking-wider mb-1">Total Cuentas USD</p>
          <h2 className="text-2xl font-black text-emerald-800">${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6">
          <p className="text-amber-700 text-xs font-bold uppercase tracking-wider mb-1">Total Cuentas Bs (en USD)</p>
          <h2 className="text-2xl font-black text-amber-800">${totalBSenUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-amber-600">Tasa:</span>
            <input
              type="number"
              defaultValue={saldos.tasa_cambio || ''}
              onBlur={e => handleTasa(e.target.value)}
              placeholder="Bs/USD"
              className="w-24 px-2 py-1 border border-amber-200 rounded-lg text-sm font-bold text-amber-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <span className="text-xs text-amber-500">Bs/$</span>
          </div>
        </div>
      </div>

      {/* Bloque Cuentas USD */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Cuentas en USD ($)
          </h3>
          <button
            onClick={() => setModalNueva({ open: true, nombre: '', moneda: 'USD' })}
            className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva cuenta USD
          </button>
        </div>
        <div className="space-y-2">
          {todasUSD.map(c => <CuentaRow key={c.key} cuenta={c} moneda="USD" />)}
        </div>
      </div>

      {/* Bloque Cuentas Bs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-amber-600" />
            Cuentas en Bolivares (Bs)
          </h3>
          <button
            onClick={() => setModalNueva({ open: true, nombre: '', moneda: 'BS' })}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva cuenta Bs
          </button>
        </div>
        <div className="space-y-2">
          {todasBS.map(c => <CuentaRow key={c.key} cuenta={c} moneda="BS" />)}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
        <History className="w-3.5 h-3.5" />
        Los saldos se actualizan automaticamente con ventas, gastos operativos y retiros. Para ajustar manualmente, pasa el cursor sobre la cuenta y usa el icono de ajuste.
      </p>

      {/* MODAL: Nueva Cuenta */}
      {modalNueva.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setModalNueva({ open: false, nombre: '', moneda: 'USD' })} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-brand-600" /> Nueva Cuenta
                </h3>
                <button onClick={() => setModalNueva({ open: false, nombre: '', moneda: 'USD' })} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la cuenta</label>
                  <input
                    type="text"
                    placeholder="Ej: Binance Pay, Payoneer..."
                    value={modalNueva.nombre}
                    onChange={e => setModalNueva(p => ({ ...p, nombre: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                  <div className="flex gap-3">
                    {['USD', 'BS'].map(m => (
                      <label key={m} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border-2 cursor-pointer transition-colors ${
                        modalNueva.moneda === m ? 'border-brand-600 bg-brand-50 text-brand-700 font-bold' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                        <input type="radio" value={m} checked={modalNueva.moneda === m} onChange={() => setModalNueva(p => ({ ...p, moneda: m }))} className="hidden" />
                        {m === 'USD' ? '$ Dolares' : 'Bs Bolivares'}
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  onClick={crearCuenta}
                  className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 rounded-lg transition-colors mt-2"
                >
                  Crear Cuenta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Ajuste Manual Auditado */}
      {modalAjuste.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !modalAjuste.saving && setModalAjuste(p => ({ ...p, open: false }))} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Ajuste Manual de Caja</h3>
                  <p className="text-xs text-slate-500">Cuenta: {modalAjuste.cuentaLabel}</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-sm text-amber-800 flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                Este ajuste quedara registrado en el historial de auditoria con tu nombre, la diferencia y el motivo. Solo usar para corregir descuadres reales.
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Saldo Actual</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-700">
                      {modalAjuste.saldoActual.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nuevo Saldo</label>
                    <input
                      type="number" step="0.01"
                      value={modalAjuste.nuevoSaldo}
                      onChange={e => setModalAjuste(p => ({ ...p, nuevoSaldo: e.target.value }))}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">¿Quien realiza el ajuste?</label>
                  <div className="flex gap-3">
                    {['Ysmael', 'Victor'].map(nombre => (
                      <label key={nombre} className={`flex-1 flex items-center justify-center py-2 rounded-lg border-2 cursor-pointer transition-colors ${
                        modalAjuste.ajustador === nombre ? 'border-brand-600 bg-brand-50 text-brand-700 font-bold' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                        <input type="radio" value={nombre} checked={modalAjuste.ajustador === nombre} onChange={() => setModalAjuste(p => ({ ...p, ajustador: nombre }))} className="hidden" />
                        {nombre}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Motivo del ajuste <span className="text-red-500">*</span></label>
                  <textarea
                    rows={2}
                    placeholder="Ej: Corrección de descuadre por venta en efectivo no registrada..."
                    value={modalAjuste.motivo}
                    onChange={e => setModalAjuste(p => ({ ...p, motivo: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>

                {modalAjuste.nuevoSaldo !== '' && !isNaN(Number(modalAjuste.nuevoSaldo)) && (
                  <div className={`p-3 rounded-lg text-sm font-medium ${Number(modalAjuste.nuevoSaldo) - modalAjuste.saldoActual >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    Diferencia: {Number(modalAjuste.nuevoSaldo) - modalAjuste.saldoActual >= 0 ? '+' : ''}{(Number(modalAjuste.nuevoSaldo) - modalAjuste.saldoActual).toFixed(2)}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setModalAjuste(p => ({ ...p, open: false }))}
                    disabled={modalAjuste.saving}
                    className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarAjuste}
                    disabled={modalAjuste.saving}
                    className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {modalAjuste.saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Confirmar Ajuste
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
