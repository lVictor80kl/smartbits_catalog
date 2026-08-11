import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Package, Edit2, Save, X, RefreshCw, Layers, Check, TrendingDown } from 'lucide-react';

const ESTADOS_ACTIVOS = ['Disponible', 'Coming soon'];

export default function InventarioFinanciero() {
  const [laptops, setLaptops] = useState([]);
  const [componentes, setComponentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('laptops');

  useEffect(() => {
    let loaded = 0;
    const onLoad = () => { loaded++; if (loaded >= 2) setLoading(false); };

    const unsubLaptops = onSnapshot(collection(db, 'laptops'), snap => {
      setLaptops(snap.docs.map(d => ({ id: d.id, _col: 'laptops', ...d.data() })));
      onLoad();
    });

    const unsubComponentes = onSnapshot(collection(db, 'componentes'), snap => {
      setComponentes(snap.docs.map(d => ({ id: d.id, _col: 'componentes', ...d.data() })));
      onLoad();
    });

    return () => { unsubLaptops(); unsubComponentes(); };
  }, []);

  // Función helper para obtener los desgloses de costo real de un item
  const getItemCostos = (item) => {
    const costoBase = Number(item.precio_ebay ?? item.costo_compra ?? 0);
    const comisiones = Number(item.total_comisiones ?? item.comision_banco ?? 0);

    // Costo + Comisión acumulado
    const costoMasComision = Number(item.costo_mas_comision ?? (costoBase + comisiones));

    const adicionales = Number(item.costos_adicionales ?? item.gastos_adicionales ?? 0);
    const envio = Number(item.envio_usd ?? 0);
    const gastosFlete = adicionales + envio;

    // Costo Total USD final
    const costoTotalUSD = Number(item.costo_total_usd ?? item.costo_total ?? (costoMasComision + gastosFlete));

    return {
      costoBase,
      comisiones,
      costoMasComision,
      adicionales,
      envio,
      gastosFlete,
      costoTotalUSD
    };
  };

  const laptopsActivas = laptops.filter(l => ESTADOS_ACTIVOS.includes(l.disponibilidad));
  const componentesActivos = componentes.filter(c => ESTADOS_ACTIVOS.includes(c.disponibilidad));

  const costoInvLaptops = laptopsActivas.reduce((acc, l) => acc + getItemCostos(l).costoTotalUSD, 0);
  const costoInvComponentes = componentesActivos.reduce((acc, c) => acc + getItemCostos(c).costoTotalUSD, 0);
  const costoInvTotal = costoInvLaptops + costoInvComponentes;

  const items = activeTab === 'laptops' ? laptopsActivas : componentesActivos;

  const startEdit = (item) => {
    const c = getItemCostos(item);
    setEditingId(item.id);
    setEditData({
      costo_compra: c.costoBase,
      costos_adicionales: c.adicionales,
      envio_usd: c.envio,
      precio_venta: item.precio ?? item.precio_venta ?? 0,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleSave = async (item) => {
    setSaving(true);
    try {
      const costo_compra = Number(editData.costo_compra) || 0;
      const costos_adicionales = Number(editData.costos_adicionales) || 0;
      const envio_usd = Number(editData.envio_usd) || 0;
      const precio = Number(editData.precio_venta) || 0;

      const comisiones = Number(item.total_comisiones ?? item.comision_banco ?? 0);
      const costo_mas_comision = costo_compra + comisiones;
      const costo_total_usd = costo_mas_comision + costos_adicionales + envio_usd;

      await updateDoc(doc(db, item._col, item.id), {
        precio_ebay: costo_compra,
        costo_compra,
        costos_adicionales,
        gastos_adicionales: costos_adicionales,
        envio_usd,
        precio,
        precio_venta: precio,
        costo_mas_comision,
        costo_total: costo_total_usd,
        costo_total_usd,
      });
      setEditingId(null);
    } catch (e) {
      console.error(e);
      alert('Error al guardar: ' + e.message);
    }
    setSaving(false);
  };

  const fmt = (v) => `$${Number(v || 0).toFixed(2)}`;

  if (loading) return (
    <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
      <RefreshCw className="animate-spin w-5 h-5" /> Cargando inventario...
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Costo Inv. Total</p>
          <h2 className="text-3xl font-black">{fmt(costoInvTotal)}</h2>
          <p className="text-slate-500 text-xs mt-1">A precio de adquisición real</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-blue-100 rounded-lg"><Package className="w-4 h-4 text-blue-600" /></div>
            <p className="text-sm font-medium text-gray-500">Laptops Activas</p>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{laptopsActivas.length} <span className="text-base font-normal text-gray-400">unidades</span></h3>
          <p className="text-sm text-gray-500 mt-1">Costo: <span className="font-semibold text-slate-700">{fmt(costoInvLaptops)}</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-purple-100 rounded-lg"><Layers className="w-4 h-4 text-purple-600" /></div>
            <p className="text-sm font-medium text-gray-500">Componentes Activos</p>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{componentesActivos.length} <span className="text-base font-normal text-gray-400">unidades</span></h3>
          <p className="text-sm text-gray-500 mt-1">Costo: <span className="font-semibold text-slate-700">{fmt(costoInvComponentes)}</span></p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 p-1">
          {[
            { key: 'laptops', label: `Laptops (${laptopsActivas.length})`, icon: Package },
            { key: 'componentes', label: `Componentes (${componentesActivos.length})`, icon: Layers },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); cancelEdit(); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === t.key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          {items.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              No hay {activeTab === 'laptops' ? 'laptops' : 'componentes'} activos en inventario
            </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-4">Equipo</th>
                  <th className="px-5 py-4">Estado</th>
                  <th className="px-5 py-4 text-right">Costo + Comisión</th>
                  <th className="px-5 py-4 text-right">Gastos/Flete</th>
                  <th className="px-5 py-4 text-right font-semibold text-slate-700">Costo Total (USD)</th>
                  <th className="px-5 py-4 text-right">Precio Venta</th>
                  <th className="px-5 py-4 text-right">Margen</th>
                  <th className="px-5 py-4 text-center">Editar</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const isEditing = editingId === item.id;
                  const c = getItemCostos(item);

                  const costoBaseEdit = isEditing ? (Number(editData.costo_compra) || 0) : c.costoBase;
                  const costoMasComision = isEditing ? (costoBaseEdit + c.comisiones) : c.costoMasComision;

                  const gastosFlete = isEditing
                    ? (Number(editData.costos_adicionales) || 0) + (Number(editData.envio_usd) || 0)
                    : c.gastosFlete;

                  const costoTotal = isEditing
                    ? (costoMasComision + gastosFlete)
                    : c.costoTotalUSD;

                  const precioVenta = isEditing
                    ? (Number(editData.precio_venta) || 0)
                    : (Number(item.precio) || Number(item.precio_venta) || 0);

                  const margen = precioVenta > 0 ? precioVenta - costoTotal : null;

                  return (
                    <tr key={item.id} className={`border-b border-gray-50 transition-colors ${isEditing ? 'bg-blue-50/50' : 'hover:bg-gray-50/50'}`}>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900">{item.modelo || item.nombre}</div>

                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.disponibilidad === 'Disponible'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                          }`}>
                          {item.disponibilidad}
                        </span>
                      </td>

                      {/* Costo + Comisión */}
                      <td className="px-5 py-4 text-right">
                        {isEditing ? (
                          <div className="flex flex-col items-end">
                            <input
                              type="number" step="0.01" min="0"
                              value={editData.costo_compra}
                              onChange={e => setEditData(p => ({ ...p, costo_compra: e.target.value }))}
                              className="w-28 px-2 py-1.5 border border-blue-300 rounded-lg text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              title="Precio de compra eBay"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-gray-900">{fmt(costoMasComision)}</span>

                          </div>
                        )}
                      </td>

                      {/* Gastos / Flete (RAM + Cargador + Envío) */}
                      <td className="px-5 py-4 text-right">
                        {isEditing ? (
                          <div className="flex flex-col gap-1 items-end">
                            <input
                              type="number" step="0.01" min="0" placeholder="RAM/Carg"
                              value={editData.costos_adicionales}
                              onChange={e => setEditData(p => ({ ...p, costos_adicionales: e.target.value }))}
                              className="w-24 px-2 py-1 border border-blue-300 rounded text-right text-xs"
                              title="Adicionales (RAM/Cargador)"
                            />
                            <input
                              type="number" step="0.01" min="0" placeholder="Envío"
                              value={editData.envio_usd}
                              onChange={e => setEditData(p => ({ ...p, envio_usd: e.target.value }))}
                              className="w-24 px-2 py-1 border border-blue-300 rounded text-right text-xs"
                              title="Envío USD"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="text-gray-800 font-semibold">{fmt(gastosFlete)}</span>
                          </div>
                        )}
                      </td>

                      {/* Costo Total */}
                      <td className="px-5 py-4 text-right">
                        <span className="font-bold text-slate-800">{fmt(costoTotal)}</span>
                      </td>

                      {/* Precio Venta */}
                      <td className="px-5 py-4 text-right">
                        {isEditing ? (
                          <input
                            type="number" step="0.01" min="0"
                            value={editData.precio_venta}
                            onChange={e => setEditData(p => ({ ...p, precio_venta: e.target.value }))}
                            className="w-28 px-2 py-1.5 border border-blue-300 rounded-lg text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        ) : (
                          <span className="font-medium text-brand-700">{precioVenta > 0 ? fmt(precioVenta) : '—'}</span>
                        )}
                      </td>

                      {/* Margen */}
                      <td className="px-5 py-4 text-right">
                        {margen !== null ? (
                          <span className={`font-bold ${margen >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {margen >= 0 ? '+' : ''}{fmt(margen)}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-4 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleSave(item)}
                              disabled={saving}
                              className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                              title="Guardar"
                            >
                              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar costos"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={4} className="px-5 py-4 text-sm font-bold text-slate-600 uppercase tracking-wide">
                    Total Inventario Activo ({items.length} unidades)
                  </td>
                  <td className="px-5 py-4 text-right font-black text-slate-900 text-base">
                    {fmt(items.reduce((acc, i) => acc + getItemCostos(i).costoTotalUSD, 0))}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <TrendingDown className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          <strong>Costo + Comisión:</strong> Muestra el monto base de compra más la comisión del banco. El <strong>Costo Total USD</strong> se obtiene de sumar (Costo + Comisión) + (Gastos/Flete).
        </p>
      </div>
    </div>
  );
}
