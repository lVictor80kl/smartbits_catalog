import { useState } from 'react';
import {
  writeBatch, doc, collection, increment, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useCuentasCaja, parseDecimalInput } from '../utils/useCuentasCaja';
import { parseTasaInput, formatearDecimalInput } from '../utils/numeros';
import TasasChipsSelector from './TasasChipsSelector';
import {
  getGastosExtraItems, getGastosExtraTotal, getCostoBaseConComision,
} from '../utils/costos';
import {
  X, Truck, PackagePlus, Trash2, Loader2, PlusCircle, CheckCircle2, Banknote,
  Split, Copy, Layers
} from 'lucide-react';

const TIPOS = [
  { key: 'envio', label: 'Envío', icon: Truck },
  { key: 'extra', label: 'Gasto Extra', icon: PackagePlus },
];

const generarId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export default function GastosAdicionalesModal({
  laptop,
  item,
  items,
  collectionName = 'laptops',
  onClose,
  onSuccess
}) {
  const initialItems = items && Array.isArray(items) && items.length > 0
    ? items
    : (item || laptop ? [item || laptop] : []);

  const [itemsList, setItemsList] = useState(initialItems);
  const isBulk = Boolean(items && Array.isArray(items));
  const currentItem = !isBulk ? itemsList[0] : null;

  const { todasCuentas, cuentasBS = [], cuentasUSD = [], tasaCambio, loading: loadingCuentas } = useCuentasCaja();

  const [tipo, setTipo] = useState('envio');
  const [modoDistribucion, setModoDistribucion] = useState('dividir'); // 'dividir' | 'fijo'
  const [form, setForm] = useState({ descripcion: '', monto: '', cuenta_key: 'binance', tasa: '' });
  const [yaRegistradoEnCaja, setYaRegistradoEnCaja] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  if (!isBulk && !currentItem) return null;
  if (isBulk && itemsList.length === 0) return null;

  const cuentaSel = todasCuentas.find(c => c.key === form.cuenta_key);
  const esBs = !yaRegistradoEnCaja && cuentaSel?.moneda === 'BS';
  const montoNum = parseDecimalInput(form.monto);
  const tasaUsada = esBs ? (parseTasaInput(form.tasa) || tasaCambio) : null;

  const count = itemsList.length;

  // Helper formateadores
  const fmtUsd = (v) => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtBs = (v) => `Bs ${Number(v || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtOriginal = (g) => g.moneda_original === 'BS'
    ? `Bs ${Number(g.monto_original).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${Number(g.monto_original).toFixed(2)}`;

  // Cálculos para modo Individual
  const gastosExtra = currentItem ? getGastosExtraItems(currentItem) : [];
  const totalExtraUsd = currentItem ? getGastosExtraTotal(currentItem) : 0;
  const costoBaseConComision = currentItem ? getCostoBaseConComision(currentItem) : 0;
  const precioVenta = currentItem ? (Number(currentItem.precio) || 0) : 0;
  const previewUsdIndividual = esBs ? (montoNum > 0 && tasaUsada > 0 ? montoNum / tasaUsada : 0) : montoNum;

  // Cálculos para modo Bulk (Lote)
  let montoOriginalTotal = 0;
  let montoOriginalPorItem = 0;
  let montoUsdTotal = 0;
  let montoUsdPorItem = 0;

  if (isBulk && count > 0) {
    if (modoDistribucion === 'dividir') {
      montoOriginalTotal = montoNum;
      montoOriginalPorItem = montoNum / count;
      if (esBs) {
        montoUsdTotal = tasaUsada > 0 ? montoOriginalTotal / tasaUsada : 0;
        montoUsdPorItem = tasaUsada > 0 ? montoOriginalPorItem / tasaUsada : 0;
      } else {
        montoUsdTotal = montoOriginalTotal;
        montoUsdPorItem = montoOriginalPorItem;
      }
    } else {
      montoOriginalPorItem = montoNum;
      montoOriginalTotal = montoNum * count;
      if (esBs) {
        montoUsdPorItem = tasaUsada > 0 ? montoOriginalPorItem / tasaUsada : 0;
        montoUsdTotal = tasaUsada > 0 ? montoOriginalTotal / tasaUsada : 0;
      } else {
        montoUsdPorItem = montoOriginalPorItem;
        montoUsdTotal = montoOriginalTotal;
      }
    }
    montoOriginalTotal = Math.round(montoOriginalTotal * 100) / 100;
    montoOriginalPorItem = Math.round(montoOriginalPorItem * 100) / 100;
    montoUsdTotal = Math.round(montoUsdTotal * 100) / 100;
    montoUsdPorItem = Math.round(montoUsdPorItem * 100) / 100;
  }

  // Actualizar un solo item
  const recalcYActualizarBatch = (batch, nuevosGastos) => {
    const totalExtraNuevo = nuevosGastos.reduce((acc, g) => acc + (Number(g.monto_usd) || 0), 0);
    const nuevoCostoTotal = Math.round((costoBaseConComision + totalExtraNuevo) * 100) / 100;
    const itemCol = currentItem?._collectionName || collectionName;
    batch.update(doc(db, itemCol, currentItem.id), {
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

  // Guardar un gasto individual
  const handleAgregarIndividual = async (e) => {
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

        const isComponent = (currentItem?._collectionName || collectionName) === 'componentes';

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

        batch.update(doc(db, 'caja', 'saldos'), {
          [form.cuenta_key]: increment(-montoNum),
          updated_at: new Date(),
        });
      }

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
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      alert('Error al registrar el gasto: ' + err.message);
    }
    setSaving(false);
  };

  // Guardar gastos en lote a todos los items seleccionados
  const handleAgregarLote = async (e) => {
    e.preventDefault();
    if (!form.descripcion.trim()) return alert('Ingresa una descripción del gasto.');
    if (!(montoNum > 0)) return alert('Ingresa un monto válido mayor a 0.');
    if (!yaRegistradoEnCaja && !form.cuenta_key) return alert('Selecciona la cuenta de caja a descontar.');
    if (esBs && !(tasaUsada > 0)) return alert('Ingresa una tasa de cambio válida.');
    if (itemsList.length === 0) return alert('No hay equipos seleccionados.');

    setSaving(true);
    try {
      const tipoLabel = tipo === 'envio' ? 'Envío' : 'Gasto extra';

      const CHUNK_SIZE = 100;
      for (let i = 0; i < itemsList.length; i += CHUNK_SIZE) {
        const chunk = itemsList.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        for (const it of chunk) {
          const gastoId = generarId();
          let movRefId = null;
          const itemCol = it._collectionName || collectionName;
          const isComp = itemCol === 'componentes';

          if (!yaRegistradoEnCaja) {
            const movRef = doc(collection(db, 'compras_inventario'));
            movRefId = movRef.id;
            const nombreEquipo = it.nombre || `${it.marca || ''} ${it.modelo || ''}`.trim() || 'Sin nombre';

            batch.set(movRef, {
              categoria: tipo === 'envio' ? 'envio' : 'gasto_extra',
              concepto: `${tipoLabel} (${form.descripcion.trim()}) — ${nombreEquipo}`,
              ...(isComp ? {
                componente_id: it.id,
                componente_nombre: it.nombre || '',
              } : {
                laptop_id: it.id,
                laptop_modelo: it.modelo || '',
              }),
              movimiento_gasto_id: gastoId,
              monto: montoUsdPorItem,
              monto_original: montoOriginalPorItem,
              moneda_original: esBs ? 'BS' : 'USD',
              tasa_cambio: tasaUsada,
              metodo_pago: form.cuenta_key,
              fecha: serverTimestamp(),
            });
          }

          const nuevoGasto = {
            id: gastoId,
            movimiento_id: movRefId,
            tipo,
            descripcion: form.descripcion.trim(),
            cuenta_key: yaRegistradoEnCaja ? 'stock' : form.cuenta_key,
            cuenta_label: yaRegistradoEnCaja ? 'Stock / Ya en caja' : (cuentaSel?.label || form.cuenta_key),
            moneda_original: esBs ? 'BS' : 'USD',
            monto_original: montoOriginalPorItem,
            tasa_cambio: tasaUsada,
            monto_usd: montoUsdPorItem,
            ya_registrado_en_caja: yaRegistradoEnCaja,
            fecha: new Date().toISOString(),
          };

          const costoBase = getCostoBaseConComision(it);
          const gastosPrevios = getGastosExtraItems(it);
          const nuevosGastos = [...gastosPrevios, nuevoGasto];
          const totalExtraNuevo = nuevosGastos.reduce((acc, g) => acc + (Number(g.monto_usd) || 0), 0);
          const nuevoCostoTotal = Math.round((costoBase + totalExtraNuevo) * 100) / 100;
          const precioItemVenta = Number(it.precio) || 0;

          batch.update(doc(db, itemCol, it.id), {
            gastos_extra: nuevosGastos,
            gastos_extra_total_usd: totalExtraNuevo,
            costos_adicionales: 0,
            gastos_adicionales: 0,
            envio_usd: 0,
            costo_total: nuevoCostoTotal,
            ganancia_estimada: Math.round((precioItemVenta - nuevoCostoTotal) * 100) / 100,
            actualizadoEn: serverTimestamp(),
          });
        }

        // Descontar caja una sola vez en el primer chunk si no es stock
        if (!yaRegistradoEnCaja && i === 0) {
          batch.update(doc(db, 'caja', 'saldos'), {
            [form.cuenta_key]: increment(-montoOriginalTotal),
            updated_at: new Date(),
          });
        }

        await batch.commit();
      }

      alert(`¡Listo! Se agregó el ${tipo === 'envio' ? 'envío' : 'gasto'} a los ${itemsList.length} ${collectionName === 'componentes' ? 'componentes' : 'equipos'}.`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error al registrar el gasto en lote: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (gasto) => {
    const confirmMsg = gasto.ya_registrado_en_caja
      ? `¿Eliminar "${gasto.descripcion}"?\nEste gasto proviene de stock/caja previa, no modificará saldos de caja pero sí se restará del costo del equipo.`
      : `¿Eliminar "${gasto.descripcion}"?\nSe revertirán ${fmtOriginal(gasto)} a la cuenta ${gasto.cuenta_label}.`;

    if (!window.confirm(confirmMsg)) return;

    setDeletingId(gasto.id);
    try {
      const batch = writeBatch(db);

      if (!gasto.ya_registrado_en_caja && gasto.cuenta_key && gasto.cuenta_key !== 'stock') {
        batch.update(doc(db, 'caja', 'saldos'), {
          [gasto.cuenta_key]: increment(Number(gasto.monto_original) || 0),
          updated_at: new Date(),
        });
      }

      if (gasto.movimiento_id) {
        batch.delete(doc(db, 'compras_inventario', gasto.movimiento_id));
      }

      recalcYActualizarBatch(batch, gastosExtra.filter(g => g.id !== gasto.id));

      await batch.commit();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el gasto: ' + err.message);
    }
    setDeletingId(null);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-gray-100 dark:border-gray-800 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              {isBulk ? 'Agregar Gastos / Extras en Lote' : 'Gastos Adicionales / Envío'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              {isBulk ? (
                <span>
                  Aplicando a <strong className="text-slate-800 dark:text-gray-200">{itemsList.length}</strong> {collectionName === 'componentes' ? 'componentes' : 'equipos'} seleccionados.
                </span>
              ) : (
                <span>
                  {currentItem.nombre || `${currentItem.marca || ''} ${currentItem.modelo || ''}`.trim()} — se descuentan de caja y suman al costo total del equipo.
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 pt-4 space-y-5">

          {/* VISTA EN LOTE: Chips de selección y Selector de Modo */}
          {isBulk && (
            <div className="space-y-4">
              {/* Chips de Equipos */}
              <div className="bg-slate-50 dark:bg-gray-800/60 border border-slate-200/80 dark:border-gray-700 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Elementos seleccionados ({itemsList.length})
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 hidden sm:inline">
                    Haz clic en la '✕' para excluir alguno
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {itemsList.map(it => (
                    <span
                      key={it.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-gray-200 shadow-2xs"
                    >
                      <span className="truncate max-w-[190px]">
                        {it.nombre || `${it.marca || ''} ${it.modelo || ''}`.trim() || 'Sin nombre'}
                      </span>
                      {(it.orderId || it.ebay_compra_order_id || it.serial) && (
                        <span className="text-[10px] font-mono text-slate-400 dark:text-gray-500 font-normal shrink-0">
                          {it.serial ? `SN:${it.serial}` : `#${it.orderId || it.ebay_compra_order_id}`}
                        </span>
                      )}
                      {itemsList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setItemsList(prev => prev.filter(x => x.id !== it.id))}
                          className="text-slate-400 dark:text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors"
                          title="Quitar este elemento del lote"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {/* Modo de Distribución del Monto */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-300">
                  ¿Cómo deseas aplicar el monto?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setModoDistribucion('dividir')}
                    className={`p-3 rounded-xl border text-left transition-all ${modoDistribucion === 'dividir'
                        ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-500/20 shadow-2xs'
                        : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:border-slate-300 dark:hover:border-gray-600'
                      }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                      <Split className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Dividir monto total</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400 leading-tight">
                      El monto ingresado se divide equitativamente entre los {itemsList.length} elementos (ej: encomienda o flete grupal).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoDistribucion('fijo')}
                    className={`p-3 rounded-xl border text-left transition-all ${modoDistribucion === 'fijo'
                        ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-500/20 shadow-2xs'
                        : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:border-slate-300 dark:hover:border-gray-600'
                      }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                      <Copy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Monto fijo a cada uno</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400 leading-tight">
                      El monto ingresado se asigna idéntico a cada elemento (ej: cargadores o piezas individuales).
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VISTA INDIVIDUAL: Resumen de costos del item */}
          {!isBulk && (
            <>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 dark:bg-gray-800/60 rounded-xl p-3 border border-slate-100 dark:border-gray-700">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Compra + Comisión</p>
                  <p className="font-black text-slate-800 dark:text-gray-100">{fmtUsd(costoBaseConComision)}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-xl p-3 border border-emerald-100 dark:border-emerald-800/40">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Gastos Extra ({gastosExtra.length})</p>
                  <p className="font-black text-emerald-700 dark:text-emerald-300">{fmtUsd(totalExtraUsd)}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/40 rounded-xl p-3 border border-blue-100 dark:border-blue-800/40">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Costo Total USD</p>
                  <p className="font-black text-blue-800 dark:text-blue-300">{fmtUsd(costoBaseConComision + totalExtraUsd)}</p>
                </div>
              </div>

              {/* Lista de gastos registrados individual */}
              {gastosExtra.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Registrados</p>
                  {gastosExtra.map(g => (
                    <div key={g.id} className="flex items-center gap-3 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5">
                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${g.tipo === 'envio' ? 'text-green-500' : 'text-blue-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800 dark:text-gray-200 truncate">{g.descripcion}</p>
                          {g.ya_registrado_en_caja && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                              Stock / Ya en Caja
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-gray-400 capitalize">
                          {g.tipo === 'envio' ? 'Envío' : 'Pago extra'} • {g.cuenta_label} • {fmtOriginal(g)}
                          {g.moneda_original === 'BS' && ` (≈${fmtUsd(g.monto_usd)})`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleEliminar(g)}
                        disabled={deletingId !== null}
                        className="p-1.5 text-gray-300 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors disabled:opacity-40 cursor-pointer"
                        title={g.ya_registrado_en_caja ? "Eliminar gasto de stock (no afecta caja)" : "Eliminar gasto (revierte caja)"}
                      >
                        {deletingId === g.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Formulario nuevo gasto (Común para Individual y Lote) */}
          <form
            onSubmit={isBulk ? handleAgregarLote : handleAgregarIndividual}
            className="bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-xl p-4 space-y-3"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-300">
              {isBulk ? `Detalles del gasto para ${itemsList.length} seleccionados` : 'Agregar nuevo pago'}
            </p>

            {/* Checkbox: Gasto ya registrado en caja */}
            <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg p-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={yaRegistradoEnCaja}
                  onChange={e => setYaRegistradoEnCaja(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold text-amber-900 dark:text-amber-200 block">
                    Gasto ya registrado en caja previa (ej: repuestos / stock de inventario)
                  </span>
                  <span className="text-amber-700 dark:text-amber-300 text-[11px] block mt-0.5">
                    No restará dinero de la caja nuevamente para no duplicar el egreso, pero <strong>sí se sumará al costo de cada equipo y restará de la ganancia estimada</strong>.
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
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 text-xs font-bold transition-colors cursor-pointer ${tipo === t.key
                        ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300'
                        : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:border-slate-300 dark:hover:border-gray-600'
                      }`}
                  >
                    <Icon className="w-4 h-4" /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">Descripción</label>
              <input
                type="text"
                placeholder={tipo === 'envio' ? (isBulk ? 'Ej: Envío caja courier Miami-Ccs' : 'Ej: Envío Miami-Caracas') : (isBulk ? 'Ej: Cargadores originales' : 'Ej: SSD NVMe 1TB')}
                value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Monto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">
                  {isBulk ? (
                    modoDistribucion === 'dividir'
                      ? `Monto TOTAL a repartir (${esBs ? 'Bs' : '$'})`
                      : `Monto por cada equipo (${esBs ? 'Bs' : '$'})`
                  ) : (
                    `Monto (${esBs ? 'Bs' : '$'})`
                  )}
                </label>
                <input
                  type="number" step="0.01" min="0"
                  placeholder="0.00"
                  value={form.monto}
                  onChange={e => setForm(p => ({ ...p, monto: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-700 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-500"
                />
                {!isBulk && esBs && previewUsdIndividual > 0 && (
                  <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1">≈ {fmtUsd(previewUsdIndividual)} USD</p>
                )}
              </div>

              {/* Tasa si Bs */}
              {esBs ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">Tasa (Bs/$)</label>
                  <div className="flex gap-2">
                    <input
                      type="text" inputMode="decimal"
                      placeholder={formatearDecimalInput(tasaCambio)}
                      value={form.tasa}
                      onChange={e => setForm(p => ({ ...p, tasa: e.target.value }))}
                      className="w-full min-w-0 flex-1 px-3 py-2 border border-slate-300 dark:border-gray-700 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-500"
                    />
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, tasa: formatearDecimalInput(tasaCambio) }))}
                      className="shrink-0 px-2 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-600 dark:text-gray-300 text-[10px] font-bold rounded-lg whitespace-nowrap cursor-pointer"
                      title={`Usar la tasa guardada: Bs ${formatearDecimalInput(tasaCambio)}`}
                    >
                      Guardada
                    </button>
                  </div>
                  <TasasChipsSelector
                    valorActual={form.tasa}
                    onSeleccionar={(t) => setForm(p => ({ ...p, tasa: formatearDecimalInput(t) }))}
                  />
                </div>
              ) : (
                <div className="flex items-end">
                  <p className="text-[11px] text-slate-400 dark:text-gray-500 pb-2">
                    {yaRegistradoEnCaja ? 'El monto en USD se sumará directo al costo sin afectar caja.' : 'Se descontará de la cuenta al registrar.'}
                  </p>
                </div>
              )}
            </div>

            {/* Cuenta de caja */}
            {!yaRegistradoEnCaja && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">Descontar de cuenta de caja</label>
                <select
                  value={form.cuenta_key}
                  onChange={e => setForm(p => ({ ...p, cuenta_key: e.target.value, tasa: '' }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
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

            {/* Tarjeta de Resumen en Tiempo Real para Modo Lote */}
            {isBulk && montoNum > 0 && (
              <div className="bg-slate-900 text-white rounded-xl p-3.5 text-xs space-y-2 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400 font-medium">Elementos a actualizar:</span>
                  <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                    {itemsList.length} {collectionName === 'componentes' ? 'componentes' : 'equipos'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Costo agregado a CADA elemento:</span>
                  <span className="font-extrabold text-emerald-400 text-sm">
                    +{fmtUsd(montoUsdPorItem)} USD
                    {esBs && <span className="text-[10px] text-slate-400 font-normal ml-1">({fmtBs(montoOriginalPorItem)})</span>}
                  </span>
                </div>
                {!yaRegistradoEnCaja && (
                  <div className="flex items-center justify-between border-t border-slate-800 pt-1.5">
                    <span className="text-slate-300">Total a descontar de cuenta ({cuentaSel?.label || form.cuenta_key}):</span>
                    <span className="font-black text-amber-300 text-sm">
                      {esBs ? `${fmtBs(montoOriginalTotal)} (≈ ${fmtUsd(montoUsdTotal)})` : fmtUsd(montoUsdTotal)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || (isBulk && itemsList.length === 0)}
              className={`w-full flex items-center justify-center gap-2 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-60 ${yaRegistradoEnCaja ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              {saving
                ? 'Registrando...'
                : isBulk
                  ? `Aplicar a los ${itemsList.length} seleccionados`
                  : yaRegistradoEnCaja
                    ? 'Registrar costo (sin restar de caja)'
                    : 'Registrar y descontar de caja'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
