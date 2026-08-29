import { useState } from 'react';
import {
  writeBatch, doc, collection, increment, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useCuentasCaja } from '../utils/useCuentasCaja';
import {
  getGastosExtraItems, getGastosExtraTotal, getLegadosExtrasUsd, getCostoBaseConComision,
} from '../utils/costos';
import {
  X, Truck, PackagePlus, Trash2, Loader2, PlusCircle, CheckCircle2, Banknote,
} from 'lucide-react';

const TIPOS = [
  { key: 'envio', label: 'Envío', icon: Truck },
  { key: 'extra', label: 'Gasto Extra', icon: PackagePlus },
];

const generarId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export default function GastosAdicionalesModal({ laptop, onClose }) {
  const { todasCuentas, tasaCambio, loading: loadingCuentas } = useCuentasCaja();

  const [tipo, setTipo] = useState('envio');
  const [form, setForm] = useState({ descripcion: '', monto: '', cuenta_key: 'binance', tasa: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  if (!laptop) return null;

  const gastosExtra = getGastosExtraItems(laptop);
  const totalExtraUsd = getGastosExtraTotal(laptop);
  const costoBaseConComision = getCostoBaseConComision(laptop);
  const legadosUsd = getLegadosExtrasUsd(laptop);
  const precioVenta = Number(laptop.precio) || 0;

  const cuentaSel = todasCuentas.find(c => c.key === form.cuenta_key);
  const esBs = cuentaSel?.moneda === 'BS';
  const montoNum = parseFloat(form.monto) || 0;
  const tasaUsada = esBs ? (parseFloat(form.tasa) || tasaCambio) : null;
  const previewUsd = esBs ? (montoNum > 0 && tasaUsada > 0 ? montoNum / tasaUsada : 0) : montoNum;

  const fmtUsd = (v) => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtOriginal = (g) => g.moneda_original === 'BS'
    ? `Bs ${Number(g.monto_original).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${Number(g.monto_original).toFixed(2)}`;

  const recalcYActualizarBatch = (batch, nuevosGastos) => {
    const totalExtraNuevo = nuevosGastos.reduce((acc, g) => acc + (Number(g.monto_usd) || 0), 0);
    const nuevoCostoTotal = Math.round((costoBaseConComision + totalExtraNuevo + legadosUsd) * 100) / 100;
    batch.update(doc(db, 'laptops', laptop.id), {
      gastos_extra: nuevosGastos,
      gastos_extra_total_usd: totalExtraNuevo,
      costo_total: nuevoCostoTotal,
      ganancia_estimada: Math.round((precioVenta - nuevoCostoTotal) * 100) / 100,
      actualizadoEn: serverTimestamp(),
    });
  };

  const handleAgregar = async (e) => {
    e.preventDefault();
    if (!form.descripcion.trim()) return alert('Ingresa una descripción del gasto.');
    if (!(montoNum > 0)) return alert('Ingresa un monto válido.');
    if (!form.cuenta_key) return alert('Selecciona la cuenta de caja a descontar.');
    if (esBs && !(tasaUsada > 0)) return alert('Ingresa una tasa de cambio válida.');

    setSaving(true);
    try {
      const montoUsd = esBs
        ? Math.round((montoNum / tasaUsada) * 100) / 100
        : Math.round(montoNum * 100) / 100;

      const movRef = doc(collection(db, 'compras_inventario'));
      const gastoId = generarId();
      const nombreEquipo = `${laptop.marca || ''} ${laptop.modelo || ''}`.trim();
      const tipoLabel = tipo === 'envio' ? 'Envío' : 'Gasto extra';

      const batch = writeBatch(db);

      // 1. Movimiento formal en Finanzas (Historial de Movimientos)
      batch.set(movRef, {
        categoria: tipo === 'envio' ? 'envio' : 'gasto_extra',
        concepto: `${tipoLabel} (${form.descripcion.trim()}) — ${nombreEquipo}`,
        laptop_id: laptop.id,
        laptop_modelo: laptop.modelo || '',
        movimiento_gasto_id: gastoId,
        monto: montoUsd,
        monto_original: montoNum,
        moneda_original: esBs ? 'BS' : 'USD',
        tasa_cambio: tasaUsada,
        metodo_pago: form.cuenta_key,
        fecha: serverTimestamp(),
      });

      // 2. Descuento inmediato de la cuenta de caja seleccionada
      batch.update(doc(db, 'caja', 'saldos'), {
        [form.cuenta_key]: increment(-montoNum),
        updated_at: new Date(),
      });

      // 3. Registro en la laptop + recálculo de costo total
      const nuevoGasto = {
        id: gastoId,
        movimiento_id: movRef.id,
        tipo,
        descripcion: form.descripcion.trim(),
        cuenta_key: form.cuenta_key,
        cuenta_label: cuentaSel?.label || form.cuenta_key,
        moneda_original: esBs ? 'BS' : 'USD',
        monto_original: montoNum,
        tasa_cambio: tasaUsada,
        monto_usd: montoUsd,
        fecha: new Date().toISOString(),
      };
      recalcYActualizarBatch(batch, [...gastosExtra, nuevoGasto]);

      await batch.commit();
      setForm({ descripcion: '', monto: '', cuenta_key: form.cuenta_key, tasa: '' });
    } catch (err) {
      console.error(err);
      alert('Error al registrar el gasto: ' + err.message);
    }
    setSaving(false);
  };

  const handleEliminar = async (gasto) => {
    if (!window.confirm(`¿Eliminar "${gasto.descripcion}"?\nSe revertirán ${fmtOriginal(gasto)} a la cuenta ${gasto.cuenta_label}.`)) return;

    setDeletingId(gasto.id);
    try {
      const batch = writeBatch(db);

      // 1. Revertir dinero a la caja
      batch.update(doc(db, 'caja', 'saldos'), {
        [gasto.cuenta_key]: increment(Number(gasto.monto_original) || 0),
        updated_at: new Date(),
      });

      // 2. Borrar el movimiento vinculado en finanzas
      if (gasto.movimiento_id) {
        batch.delete(doc(db, 'compras_inventario', gasto.movimiento_id));
      }

      // 3. Quitar de la laptop y recalcular
      recalcYActualizarBatch(batch, gastosExtra.filter(g => g.id !== gasto.id));

      await batch.commit();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el gasto: ' + err.message);
    }
    setDeletingId(null);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-gray-100 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-600" />
              Gastos Adicionales / Envío
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {laptop.marca} {laptop.modelo} — se descuentan de caja y suman al costo total del equipo.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 pt-4 space-y-5">

          {/* Resumen de costos */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Compra + Comisión</p>
              <p className="font-black text-slate-800">{fmtUsd(costoBaseConComision)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Gastos Extra ({gastosExtra.length})</p>
              <p className="font-black text-emerald-700">{fmtUsd(totalExtraUsd)}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Costo Total USD</p>
              <p className="font-black text-blue-800">{fmtUsd(costoBaseConComision + totalExtraUsd + legadosUsd)}</p>
            </div>
          </div>

          {/* Lista de gastos registrados */}
          {gastosExtra.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Registrados</p>
              {gastosExtra.map(g => (
                <div key={g.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${g.tipo === 'envio' ? 'text-green-500' : 'text-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{g.descripcion}</p>
                    <p className="text-[11px] text-slate-500 capitalize">
                      {g.tipo === 'envio' ? 'Envío' : 'Pago extra'} • {g.cuenta_label} • {fmtOriginal(g)}
                      {g.moneda_original === 'BS' && ` (≈${fmtUsd(g.monto_usd)})`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleEliminar(g)}
                    disabled={deletingId !== null}
                    className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                    title="Eliminar gasto (revierte caja)"
                  >
                    {deletingId === g.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Formulario nuevo gasto */}
          <form onSubmit={handleAgregar} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Agregar nuevo pago</p>

            {/* Tipo */}
            <div className="flex gap-2">
              {TIPOS.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTipo(t.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 text-xs font-bold transition-colors ${
                      tipo === t.key
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Descripción</label>
              <input
                type="text"
                placeholder={tipo === 'envio' ? 'Ej: Envío Miami-Caracas' : 'Ej: RAM adicional 16GB'}
                value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Monto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Monto ({esBs ? 'Bs' : '$'})</label>
                <input
                  type="number" step="0.01" min="0"
                  placeholder="0.00"
                  value={form.monto}
                  onChange={e => setForm(p => ({ ...p, monto: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-brand-500"
                />
                {esBs && previewUsd > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1">≈ {fmtUsd(previewUsd)} USD</p>
                )}
              </div>

              {/* Tasa si Bs */}
              {esBs ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tasa (Bs/$)</label>
                  <div className="flex gap-2">
                    <input
                      type="number" step="0.01" min="0"
                      placeholder={tasaCambio.toFixed(2)}
                      value={form.tasa}
                      onChange={e => setForm(p => ({ ...p, tasa: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, tasa: tasaCambio.toString() }))}
                      className="px-2 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg whitespace-nowrap"
                      title="Usar tasa guardada en caja"
                    >
                      Guardada
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-end">
                  <p className="text-[11px] text-slate-400 pb-2">Se descontará de la cuenta al guardar.</p>
                </div>
              )}
            </div>

            {/* Cuenta de caja */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Descontar de cuenta de caja</label>
              <select
                value={form.cuenta_key}
                onChange={e => setForm(p => ({ ...p, cuenta_key: e.target.value, tasa: '' }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500"
              >
                {loadingCuentas && <option>Cargando cuentas...</option>}
                {todasCuentas.map(c => (
                  <option key={c.key} value={c.key}>{c.label} ({c.moneda})</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              {saving ? 'Registrando...' : 'Registrar y descontar de caja'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
