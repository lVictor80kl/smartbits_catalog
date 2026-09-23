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

export default function GastosAdicionalesModal({ laptop, item, collectionName = 'laptops', onClose }) {
  const currentItem = item || laptop;
  const { todasCuentas, cuentasBS = [], cuentasUSD = [], tasaCambio, loading: loadingCuentas } = useCuentasCaja();

  const [tipo, setTipo] = useState('envio');
  const [form, setForm] = useState({ descripcion: '', monto: '', cuenta_key: 'binance', tasa: '' });
  const [yaRegistradoEnCaja, setYaRegistradoEnCaja] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  if (!currentItem) return null;

  const gastosExtra = getGastosExtraItems(currentItem);
  const totalExtraUsd = getGastosExtraTotal(currentItem);
  const costoBaseConComision = getCostoBaseConComision(currentItem);
  const legadosUsd = getLegadosExtrasUsd(currentItem);
  const precioVenta = Number(currentItem.precio) || 0;

  const cuentaSel = todasCuentas.find(c => c.key === form.cuenta_key);
  const esBs = !yaRegistradoEnCaja && cuentaSel?.moneda === 'BS';
  const montoNum = parseFloat(form.monto) || 0;
  const tasaUsada = esBs ? (parseFloat(form.tasa) || tasaCambio) : null;
  const previewUsd = esBs ? (montoNum > 0 && tasaUsada > 0 ? montoNum / tasaUsada : 0) : montoNum;

  const fmtUsd = (v) => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtOriginal = (g) => g.moneda_original === 'BS'
    ? `Bs ${Number(g.monto_original).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${Number(g.monto_original).toFixed(2)}`;

  const recalcYActualizarBatch = (batch, nuevosGastos) => {
    const totalExtraNuevo = nuevosGastos.reduce((acc, g) => acc + (Number(g.monto_usd) || 0), 0);
    const nuevoCostoTotal = Math.round((costoBaseConComision + totalExtraNuevo) * 100) / 100;
    batch.update(doc(db, collectionName, currentItem.id), {
      gastos_extra: nuevosGastos,
      gastos_extra_total_usd: totalExtraNuevo,
      costos_adicionales: 0,
      gastos_adicionales: 0,
      envio_usd: 0,
      costo_total: nuevoCostoTotal,
      ganancia_estimada: Math.round((precioVenta - nuevoCostoTotal) * 100) / 100,
      actualizadoEn: serverTimestamp(),
    });
  };

  const handleAgregar = async (e) => {
    e.preventDefault();
    if (!form.descripcion.trim()) return alert('Ingresa una descripción del gasto.');
    if (!(montoNum > 0)) return alert('Ingresa un monto válido.');
    if (!yaRegistradoEnCaja && !form.cuenta_key) return alert('Selecciona la cuenta de caja a descontar.');
    if (esBs && !(tasaUsada > 0)) return alert('Ingresa una tasa de cambio válida.');

    setSaving(true);
    try {
      const montoUsd = esBs
        ? Math.round((montoNum / tasaUsada) * 100) / 100
        : Math.round(montoNum * 100) / 100;

      const gastoId = generarId();
      const nombreEquipo = currentItem.nombre || `${currentItem.marca || ''} ${currentItem.modelo || ''}`.trim();
      const tipoLabel = tipo === 'envio' ? 'Envío' : 'Gasto extra';

      const batch = writeBatch(db);
      let movRefId = null;

      if (!yaRegistradoEnCaja) {
        const movRef = doc(collection(db, 'compras_inventario'));
        movRefId = movRef.id;

        const isComponent = collectionName === 'componentes';

        // 1. Movimiento formal en Finanzas (Historial de Movimientos)
        batch.set(movRef, {
          categoria: tipo === 'envio' ? 'envio' : 'gasto_extra',
          concepto: `${tipoLabel} (${form.descripcion.trim()}) — ${nombreEquipo}`,
          ...(isComponent ? {
            componente_id: currentItem.id,
            componente_nombre: currentItem.nombre || '',
          } : {
            laptop_id: currentItem.id,
            laptop_modelo: currentItem.modelo || '',
          }),
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
      }

      // 3. Registro en el item + recálculo de costo total (y reducción de ganancia estimada)
      const nuevoGasto = {
        id: gastoId,
        movimiento_id: movRefId,
        tipo,
        descripcion: form.descripcion.trim(),
        cuenta_key: yaRegistradoEnCaja ? 'stock' : form.cuenta_key,
        cuenta_label: yaRegistradoEnCaja ? 'Stock / Ya en caja' : (cuentaSel?.label || form.cuenta_key),
        moneda_original: esBs ? 'BS' : 'USD',
        monto_original: montoNum,
        tasa_cambio: tasaUsada,
        monto_usd: montoUsd,
        ya_registrado_en_caja: yaRegistradoEnCaja,
        fecha: new Date().toISOString(),
      };
      recalcYActualizarBatch(batch, [...gastosExtra, nuevoGasto]);

      await batch.commit();
      setForm({ descripcion: '', monto: '', cuenta_key: form.cuenta_key, tasa: '' });
      setYaRegistradoEnCaja(false);
    } catch (err) {
      console.error(err);
      alert('Error al registrar el gasto: ' + err.message);
    }
    setSaving(false);
  };

  const handleEliminar = async (gasto) => {
    const confirmMsg = gasto.ya_registrado_en_caja
      ? `¿Eliminar "${gasto.descripcion}"?\nEste gasto proviene de stock/caja previa, no modificará saldos de caja pero sí se restará del costo del equipo.`
      : `¿Eliminar "${gasto.descripcion}"?\nSe revertirán ${fmtOriginal(gasto)} a la cuenta ${gasto.cuenta_label}.`;

    if (!window.confirm(confirmMsg)) return;

    setDeletingId(gasto.id);
    try {
      const batch = writeBatch(db);

      // 1. Revertir dinero a la caja SOLO si no era gasto ya registrado en caja previa
      if (!gasto.ya_registrado_en_caja && gasto.cuenta_key && gasto.cuenta_key !== 'stock') {
        batch.update(doc(db, 'caja', 'saldos'), {
          [gasto.cuenta_key]: increment(Number(gasto.monto_original) || 0),
          updated_at: new Date(),
        });
      }

      // 2. Borrar el movimiento vinculado en finanzas si existía
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
              {currentItem.nombre || `${currentItem.marca || ''} ${currentItem.modelo || ''}`.trim()} — se descuentan de caja y suman al costo total del equipo.
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
              <p className="font-black text-blue-800">{fmtUsd(costoBaseConComision + totalExtraUsd)}</p>
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate">{g.descripcion}</p>
                      {g.ya_registrado_en_caja && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800 uppercase tracking-wider">
                          Stock / Ya en Caja
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 capitalize">
                      {g.tipo === 'envio' ? 'Envío' : 'Pago extra'} • {g.cuenta_label} • {fmtOriginal(g)}
                      {g.moneda_original === 'BS' && ` (≈${fmtUsd(g.monto_usd)})`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleEliminar(g)}
                    disabled={deletingId !== null}
                    className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                    title={g.ya_registrado_en_caja ? "Eliminar gasto de stock (no afecta caja)" : "Eliminar gasto (revierte caja)"}
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

            {/* Checkbox: Gasto ya registrado en caja */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={yaRegistradoEnCaja}
                  onChange={e => setYaRegistradoEnCaja(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold text-amber-900 block">
                    Gasto ya registrado en caja (ej: SSD / RAM de stock previo)
                  </span>
                  <span className="text-amber-700 text-[11px] block mt-0.5">
                    No restará dinero de la caja nuevamente para no duplicar el egreso, pero <strong>sí se sumará al costo del equipo y restará de la ganancia estimada</strong>.
                  </span>
                </div>
              </label>
            </div>

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
                placeholder={tipo === 'envio' ? 'Ej: Envío Miami-Caracas' : 'Ej: SSD NVMe 1TB de stock'}
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
                  <p className="text-[11px] text-slate-400 pb-2">
                    {yaRegistradoEnCaja ? 'El monto en USD se sumará directo al costo del equipo.' : 'Se descontará de la cuenta al guardar.'}
                  </p>
                </div>
              )}
            </div>

            {/* Cuenta de caja */}
            {!yaRegistradoEnCaja && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descontar de cuenta de caja</label>
                <select
                  value={form.cuenta_key}
                  onChange={e => setForm(p => ({ ...p, cuenta_key: e.target.value, tasa: '' }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500"
                >
                  {loadingCuentas && <option>Cargando cuentas...</option>}
                  {cuentasBS.length > 0 && (
                    <optgroup label="── Cuentas en Bolívares (BS) ──">
                      {cuentasBS.map(c => (
                        <option key={c.key} value={c.key}>{c.label} ({c.moneda})</option>
                      ))}
                    </optgroup>
                  )}
                  {cuentasUSD.length > 0 && (
                    <optgroup label="── Cuentas en Dólares (USD) ──">
                      {cuentasUSD.map(c => (
                        <option key={c.key} value={c.key}>{c.label} ({c.moneda})</option>
                      ))}
                    </optgroup>
                  )}
                  {cuentasBS.length === 0 && cuentasUSD.length === 0 && todasCuentas.map(c => (
                    <option key={c.key} value={c.key}>{c.label} ({c.moneda})</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className={`w-full flex items-center justify-center gap-2 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-60 ${
                yaRegistradoEnCaja ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              {saving ? 'Registrando...' : yaRegistradoEnCaja ? 'Registrar costo (sin restar de caja)' : 'Registrar y descontar de caja'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
