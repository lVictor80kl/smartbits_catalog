import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Package, Edit2, Save, X, RefreshCw, Layers, Check, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getCostoTotal, getGastosExtraItems, getGastosExtraTotal } from '../../../utils/costos';

const ESTADOS_ACTIVOS = ['Disponible', 'Coming soon'];

export default function InventarioFinanciero() {
  const [laptops, setLaptops] = useState([]);
  const [componentes, setComponentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('laptops');
  const [estadoSortOrder, setEstadoSortOrder] = useState('disponible'); // 'disponible' | 'coming_soon'

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
    const comisiones = costoBase > 0 ? Number(item.total_comisiones ?? item.comision_banco ?? 0) : 0;

    // Costo + Comisión acumulado (0 si no hay costo base asignado)
    const costoMasComision = costoBase > 0 ? Number(item.costo_mas_comision ?? (costoBase + comisiones)) : 0;

    const adicionales = Number(item.costos_adicionales ?? item.gastos_adicionales ?? 0);
    const envio = Number(item.envio_usd ?? 0);
    const gastosExtra = getGastosExtraTotal(item);
    const gastosFlete = adicionales + envio + gastosExtra;

    // Costo Total USD final (misma fuente en toda la app)
    const costoTotalUSD = getCostoTotal(item);

    return {
      costoBase,
      comisiones,
      costoMasComision,
      adicionales,
      envio,
      gastosExtra,
      gastosExtraItems: getGastosExtraItems(item),
      gastosFlete,
      costoTotalUSD
    };
  };

  const laptopsActivas = laptops.filter(l => ESTADOS_ACTIVOS.includes(l.disponibilidad));
  const componentesActivos = componentes.filter(c => ESTADOS_ACTIVOS.includes(c.disponibilidad));

  const costoInvLaptops = laptopsActivas.reduce((acc, l) => acc + getItemCostos(l).costoTotalUSD, 0);
  const costoInvComponentes = componentesActivos.reduce((acc, c) => acc + getItemCostos(c).costoTotalUSD, 0);
  const costoInvTotal = costoInvLaptops + costoInvComponentes;

  const rawItems = activeTab === 'laptops' ? laptopsActivas : componentesActivos;
  const items = [...rawItems].sort((a, b) => {
    const prio = (val) => val === 'Disponible' ? (estadoSortOrder === 'disponible' ? 1 : 2) : (estadoSortOrder === 'disponible' ? 2 : 1);
    return prio(a.disponibilidad) - prio(b.disponibilidad);
  });

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
                onClick={() => setActiveTab(t.key)}
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
                  <th
                    onClick={() => setEstadoSortOrder(prev => prev === 'disponible' ? 'coming_soon' : 'disponible')}
                    className="px-5 py-4 cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    title="Haz clic para cambiar el orden por Estado (Disponible / Coming soon)"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Estado</span>
                      {estadoSortOrder === 'disponible' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-brand-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-brand-600" />
                      )}
                    </div>
                  </th>
                  <th className="px-5 py-4 text-right">Costo + Comisión</th>
                  <th className="px-5 py-4 text-right">Gastos/Flete</th>
                  <th className="px-5 py-4 text-right font-semibold text-slate-700">Costo Total (USD)</th>
                  <th className="px-5 py-4 text-right">Precio Venta</th>
                  <th className="px-5 py-4 text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const c = getItemCostos(item);
                  const costoMasComision = c.costoMasComision;
                  const gastosFlete = c.gastosFlete;
                  const costoTotal = c.costoTotalUSD;
                  const precioVenta = Number(item.precio) || Number(item.precio_venta) || 0;
                  const margen = precioVenta > 0 ? precioVenta - costoTotal : null;

                  return (
                    <tr key={item.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50/50">
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
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-gray-900">{fmt(costoMasComision)}</span>
                        </div>
                      </td>

                      {/* Gastos / Flete (RAM + Cargador + Envío) */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-gray-800 font-semibold">{fmt(gastosFlete)}</span>
                          {c.gastosExtraItems.length > 0 && (
                            <span
                              className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-1.5 rounded-full"
                              title={c.gastosExtraItems.map(g => `${g.descripcion}: $${Number(g.monto_usd).toFixed(2)}`).join(' • ')}
                            >
                              {c.gastosExtraItems.length} pago{c.gastosExtraItems.length !== 1 ? 's' : ''} extra/envío
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Costo Total */}
                      <td className="px-5 py-4 text-right">
                        <span className="font-bold text-slate-800">{fmt(costoTotal)}</span>
                      </td>

                      {/* Precio Venta */}
                      <td className="px-5 py-4 text-right">
                        <span className="font-medium text-brand-700">{precioVenta > 0 ? fmt(precioVenta) : '—'}</span>
                      </td>

                      {/* Margen */}
                      <td className="px-5 py-4 text-right">
                        {margen !== null ? (
                          <span className={`font-bold ${margen >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {margen >= 0 ? '+' : ''}{fmt(margen)}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
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
                  <td colSpan={2} />
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
