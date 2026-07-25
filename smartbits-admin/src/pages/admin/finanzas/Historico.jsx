import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, getDoc, updateDoc, deleteDoc, increment, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Download, Search, Edit2, Trash2, X, AlertTriangle, Save, Loader2, Plus } from 'lucide-react';

const METODO_TO_CAJA_KEY = {
  'Zelle': 'zelle',
  'Efectivo': 'efectivo',
  'USDT': 'binance',
  'Binance Pay': 'binance',
  'Zinli': 'zinli',
  'PayPal': 'paypal',
  'Pago Móvil': 'venezuela',
  'Transferencia': 'venezuela',
};

export default function Historico() {
  const [ingresos, setIngresos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  // Estados para Modales
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, item: null, processing: false });
  const [editModal, setEditModal] = useState({ 
    isOpen: false, item: null, ventaData: null, metodosPago: [], 
    isGeneric: false, processing: false, loadingVenta: false 
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'historico_ingresos'), orderBy('fecha', 'desc'));
      const snap = await getDocs(q);
      setIngresos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching historico:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const exportCSV = () => {
    const headers = ['Fecha', 'Concepto', 'Ingreso', 'Ganancia', 'Tipo'];
    const rows = ingresos.map(i => [
      i.fecha ? new Date(i.fecha.toDate()).toLocaleString() : '',
      `"${(i.concepto || '').replace(/"/g, '""')}"`,
      i.monto,
      i.ganancia ?? '',
      i.tipo || 'ingreso'
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `historico_ingresos_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = ingresos.filter(i => 
    i.concepto?.toLowerCase().includes(filter.toLowerCase()) ||
    i.tipo?.toLowerCase().includes(filter.toLowerCase())
  );

  // --- LÓGICA DE BORRADO ---
  const confirmDelete = async () => {
    const { item } = deleteModal;
    if (!item) return;
    setDeleteModal(prev => ({ ...prev, processing: true }));

    try {
      let cajaUpdates = { updated_at: new Date() };
      let ventaId = null;

      if (item.laptopId) {
        const qVentas = query(collection(db, 'ventas'), where('laptopId', '==', item.laptopId));
        const snapVentas = await getDocs(qVentas);
        
        if (!snapVentas.empty) {
          const ventaDoc = snapVentas.docs[0];
          ventaId = ventaDoc.id;
          const ventaData = ventaDoc.data();
          const metodosPago = ventaData.metodos_pago || [];

          for (const pago of metodosPago) {
            const cuenta = METODO_TO_CAJA_KEY[pago.metodo];
            if (cuenta && pago.montoUSD > 0) {
              cajaUpdates[cuenta] = increment(-pago.montoUSD);
            }
          }
          if (metodosPago.length === 0 && item.monto > 0) {
            cajaUpdates.ventas_no_asignadas = increment(-item.monto);
          }
        } else {
          cajaUpdates.ventas_no_asignadas = increment(-item.monto);
        }
      } else {
        cajaUpdates.ventas_no_asignadas = increment(-item.monto);
      }

      const cajaRef = doc(db, 'caja', 'saldos');
      await updateDoc(cajaRef, cajaUpdates);

      if (ventaId) {
        await deleteDoc(doc(db, 'ventas', ventaId));
      }

      if (item.laptopId) {
        const laptopRef = doc(db, 'laptops', item.laptopId);
        await updateDoc(laptopRef, {
          disponibilidad: 'Disponible',
        });
      }

      await deleteDoc(doc(db, 'historico_ingresos', item.id));

      alert('Ingreso borrado y caja actualizada correctamente.');
      setDeleteModal({ isOpen: false, item: null, processing: false });
      fetchData();
    } catch (error) {
      console.error("Error al borrar el ingreso:", error);
      alert('Error al borrar: ' + error.message);
      setDeleteModal(prev => ({ ...prev, processing: false }));
    }
  };

  // --- LÓGICA DE EDICIÓN MULTI-PAGO ---
  const openEditModal = async (item) => {
    setEditModal({ 
      isOpen: true, item, ventaData: null, metodosPago: [], 
      isGeneric: false, processing: false, loadingVenta: true 
    });
    
    try {
      if (item.laptopId) {
        const qVentas = query(collection(db, 'ventas'), where('laptopId', '==', item.laptopId));
        const snapVentas = await getDocs(qVentas);
        
        if (!snapVentas.empty) {
          const ventaDoc = snapVentas.docs[0];
          const ventaData = { id: ventaDoc.id, ...ventaDoc.data() };
          const metodosPago = JSON.parse(JSON.stringify(ventaData.metodos_pago || []));
          if (metodosPago.length === 0) {
            metodosPago.push({ metodo: 'Zelle', montoUSD: item.monto || 0 });
          }
          setEditModal(prev => ({ ...prev, ventaData, metodosPago, isGeneric: false, loadingVenta: false }));
          return;
        }
      }
      
      // Si no hay desglose, creamos uno inicial vacio para que lo llene
      setEditModal(prev => ({ 
        ...prev, 
        isGeneric: true, 
        metodosPago: [{ metodo: 'Zelle', montoUSD: item.monto || 0 }], 
        loadingVenta: false 
      }));
    } catch (error) {
      console.error("Error al abrir edición:", error);
      setEditModal(prev => ({ ...prev, loadingVenta: false }));
    }
  };

  const addPago = () => {
    setEditModal(prev => ({
      ...prev,
      metodosPago: [...prev.metodosPago, { metodo: 'Zelle', montoUSD: 0 }]
    }));
  };

  const removePago = (index) => {
    setEditModal(prev => ({
      ...prev,
      metodosPago: prev.metodosPago.filter((_, i) => i !== index)
    }));
  };

  const updatePago = (index, field, value) => {
    setEditModal(prev => {
      const newMetodos = [...prev.metodosPago];
      if (field === 'montoUSD') {
        const val = parseFloat(value);
        newMetodos[index].montoUSD = isNaN(val) ? '' : val;
      } else {
        newMetodos[index][field] = value;
      }
      return { ...prev, metodosPago: newMetodos };
    });
  };

  const saveEdit = async () => {
    const { item, ventaData, metodosPago, isGeneric } = editModal;
    setEditModal(prev => ({ ...prev, processing: true }));

    try {
      const cajaNetos = {};
      let nuevoTotalVentaUSD = 0;
      
      // 1. REVERTIR EL INGRESO VIEJO EN CAJA
      if (isGeneric) {
        cajaNetos['ventas_no_asignadas'] = -(item.monto || 0);
      } else {
        const oldMetodos = ventaData?.metodos_pago || [];
        for (const pago of oldMetodos) {
          const cuenta = METODO_TO_CAJA_KEY[pago.metodo];
          if (cuenta && pago.montoUSD > 0) {
            cajaNetos[cuenta] = (cajaNetos[cuenta] || 0) - pago.montoUSD;
          }
        }
        // Si no habia metodos en la venta, revertir de ventas_no_asignadas
        if (oldMetodos.length === 0 && item.monto > 0) {
           cajaNetos['ventas_no_asignadas'] = -(item.monto);
        }
      }

      // 2. APLICAR EL NUEVO DESGLOSE
      metodosPago.forEach(pago => {
        const monto = parseFloat(pago.montoUSD) || 0;
        nuevoTotalVentaUSD += monto;
        const cuenta = METODO_TO_CAJA_KEY[pago.metodo];
        if (cuenta && monto > 0) {
          cajaNetos[cuenta] = (cajaNetos[cuenta] || 0) + monto;
        }
      });

      // 3. CONSTRUIR PAYLOAD CAJA
      let cajaUpdates = { updated_at: new Date() };
      for (const [cuenta, neto] of Object.entries(cajaNetos)) {
        if (neto !== 0) {
          cajaUpdates[cuenta] = increment(neto);
        }
      }

      // 4. ACTUALIZAR CAJA
      const cajaRef = doc(db, 'caja', 'saldos');
      await updateDoc(cajaRef, cajaUpdates);

      // 5. CALCULAR NUEVA GANANCIA
      // Para generar la ganancia necesitamos el costo. 
      // Si es genérico y no hay venta, asumimos costo 0 (ganancia = monto), o mantenemos el costo implicito
      let costoTotal = 0;
      if (!isGeneric && ventaData) {
        costoTotal = ventaData.costo_total || 0;
      } else {
        // En genéricos, inferimos el costo previo: costo = monto_anterior - ganancia_anterior
        costoTotal = (item.monto || 0) - (item.ganancia || 0);
      }
      const nuevaGanancia = nuevoTotalVentaUSD - costoTotal;

      // 6. ACTUALIZAR VENTA Y LAPTOP SI EXISTEN
      if (!isGeneric && ventaData) {
        await updateDoc(doc(db, 'ventas', ventaData.id), {
          metodos_pago: metodosPago,
          precio_venta_usd: nuevoTotalVentaUSD,
          ganancia: nuevaGanancia
        });
      }
      
      if (item.laptopId) {
        await updateDoc(doc(db, 'laptops', item.laptopId), {
          metodos_pago: metodosPago,
          precio_final_venta: nuevoTotalVentaUSD
        });
      }

      // 7. ACTUALIZAR HISTORICO
      await updateDoc(doc(db, 'historico_ingresos', item.id), {
        monto: nuevoTotalVentaUSD,
        ganancia: nuevaGanancia
      });

      alert('Métodos de pago actualizados y caja cuadrada exitosamente.');
      setEditModal({ isOpen: false, item: null, ventaData: null, metodosPago: [], processing: false, loadingVenta: false, isGeneric: false });
      fetchData();
    } catch (error) {
      console.error("Error al guardar edición:", error);
      alert('Error: ' + error.message);
      setEditModal(prev => ({ ...prev, processing: false }));
    }
  };


  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            placeholder="Buscar por concepto o tipo..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        
        <button 
          onClick={exportCSV}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-medium transition-colors w-full sm:w-auto justify-center"
        >
          <Download className="w-4 h-4" />
          Exportar a CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando historial...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No se encontraron registros</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Concepto</th>
                  <th className="px-6 py-4 text-right">Ingreso (USD)</th>
                  <th className="px-6 py-4 text-right">Ganancia (USD)</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {item.fecha ? new Date(item.fecha.toDate()).toLocaleString() : 'Pendiente'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-700 uppercase">
                        {item.tipo || 'Ingreso'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{item.concepto}</td>
                    <td className="px-6 py-4 text-right font-bold text-blue-600">
                      ${item.monto?.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">
                      {item.ganancia != null ? `+$${item.ganancia.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => openEditModal(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteModal({ isOpen: true, item, processing: false })}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Borrar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE BORRADO */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !deleteModal.processing && setDeleteModal({ isOpen: false, item: null, processing: false })} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all w-full max-w-md p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">¿Borrar ingreso?</h3>
              </div>
              <p className="text-sm text-slate-500 mb-6">
                Estás a punto de borrar el ingreso por <strong className="text-slate-800">${deleteModal.item?.monto}</strong> correspondiente a "{deleteModal.item?.concepto}".
                <br/><br/>
                Esta acción descontará el saldo automáticamente de la caja. Si este ingreso está asociado a una laptop, la laptop volverá a estado "Disponible".
              </p>
              
              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  disabled={deleteModal.processing}
                  onClick={() => setDeleteModal({ isOpen: false, item: null, processing: false })}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deleteModal.processing}
                  onClick={confirmDelete}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleteModal.processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Confirmar Borrado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN MULTI-PAGO */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !editModal.processing && setEditModal(prev => ({ ...prev, isOpen: false }))} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all w-full max-w-lg p-6">
              
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Editar Métodos de Pago</h3>
                    <p className="text-xs text-slate-500">Monto Original: ${editModal.item?.monto?.toFixed(2)}</p>
                  </div>
                </div>
                {!editModal.processing && (
                  <button onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {editModal.loadingVenta ? (
                <div className="py-8 text-center text-slate-500 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span>Cargando desglose de pago...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {editModal.isGeneric && (
                    <div className="p-3 bg-amber-50 text-amber-700 text-sm rounded-lg border border-amber-200 flex gap-2">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                      <p>Este ingreso no tenía un desglose guardado en ventas. Revisa cómo pagó el cliente y llena los montos.</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {editModal.metodosPago.map((pago, index) => (
                      <div key={index} className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <select
                          value={pago.metodo}
                          onChange={(e) => updatePago(index, 'metodo', e.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="Zelle">Zelle</option>
                          <option value="USDT">USDT / Binance</option>
                          <option value="Efectivo">Efectivo</option>
                          <option value="Pago Móvil">Pago Móvil</option>
                          <option value="Transferencia">Transferencia</option>
                          <option value="Zinli">Zinli</option>
                          <option value="PayPal">PayPal</option>
                        </select>
                        
                        <div className="relative w-32">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                          <input
                            type="number" min="0" step="0.01"
                            value={pago.montoUSD}
                            onChange={(e) => updatePago(index, 'montoUSD', e.target.value)}
                            className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            placeholder="0.00"
                          />
                        </div>

                        {editModal.metodosPago.length > 1 && (
                          <button 
                            onClick={() => removePago(index)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={addPago}
                      className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 py-1"
                    >
                      <Plus className="w-4 h-4" /> Agregar otro método de pago
                    </button>
                  </div>

                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Nuevo Total a Guardar:</span>
                      <span className="text-2xl font-bold text-slate-900">
                        ${editModal.metodosPago.reduce((acc, p) => acc + (parseFloat(p.montoUSD) || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end mt-6">
                    <button
                      type="button"
                      disabled={editModal.processing}
                      onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                      className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={editModal.processing}
                      onClick={saveEdit}
                      className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {editModal.processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Re-calcular y Guardar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
