import { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { User, DollarSign, Calendar, PlusCircle, Activity, Trash2, Edit, Loader2, X, Save } from 'lucide-react';

export default function GastosPersonales() {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState({ show: false, id: null, concepto: '' });
  const [editingGasto, setEditingGasto] = useState(null);
  const [editFormData, setEditFormData] = useState({
    socio: 'ysmael',
    concepto: '',
    monto: '',
    metodo_pago: 'efectivo'
  });
  const [formData, setFormData] = useState({
    socio: 'ysmael',
    concepto: '',
    monto: '',
    metodo_pago: 'efectivo'
  });

  useEffect(() => {
    const q = query(collection(db, 'gastos_personales'), orderBy('fecha', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGastos(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.monto || !formData.concepto) return alert("Completa todos los campos");
    
    setSaving(true);
    try {
      await addDoc(collection(db, 'gastos_personales'), {
        ...formData,
        monto: Number(formData.monto),
        es_deuda: true, // Siempre true para gastos personales según requerimientos
        fecha: serverTimestamp()
      });
      setFormData({ socio: 'ysmael', concepto: '', monto: '', metodo_pago: 'efectivo' });
      alert("Gasto personal registrado. El capital se recalculará automáticamente.");
    } catch (e) {
      console.error(e);
      alert("Error al guardar");
    }
    setSaving(false);
  };

  const handleDeleteClick = (id, concepto) => {
    setShowDeleteModal({ show: true, id, concepto });
  };

  const confirmDelete = async () => {
    setDeletingId(showDeleteModal.id);
    try {
      await deleteDoc(doc(db, 'gastos_personales', showDeleteModal.id));
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    } finally {
      setDeletingId(null);
      setShowDeleteModal({ show: false, id: null, concepto: '' });
    }
  };

  const handleEditClick = (gasto) => {
    setEditingGasto(gasto);
    setEditFormData({
      socio: gasto.socio,
      concepto: gasto.concepto,
      monto: gasto.monto?.toString() || '',
      metodo_pago: gasto.metodo_pago
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.monto || !editFormData.concepto) return alert("Completa todos los campos");

    setSaving(true);
    try {
      await updateDoc(doc(db, 'gastos_personales', editingGasto.id), {
        socio: editFormData.socio,
        concepto: editFormData.concepto,
        monto: Number(editFormData.monto),
        metodo_pago: editFormData.metodo_pago
      });
      setEditingGasto(null);
    } catch (e) {
      console.error(e);
      alert("Error al actualizar");
    }
    setSaving(false);
  };

  const ysmaelTotal = gastos.filter(g => g.socio === 'ysmael').reduce((a,b) => a + (b.monto||0), 0);
  const victorTotal = gastos.filter(g => g.socio === 'victor').reduce((a,b) => a + (b.monto||0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Resumen de Deudas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex items-center justify-between">
          <div>
            <p className="text-red-600 text-sm font-bold uppercase tracking-wider">Deuda Acumulada Ysmael</p>
            <h3 className="text-3xl font-black text-red-700 mt-1">${ysmaelTotal.toFixed(2)}</h3>
          </div>
          <User className="w-10 h-10 text-red-200" />
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex items-center justify-between">
          <div>
            <p className="text-red-600 text-sm font-bold uppercase tracking-wider">Deuda Acumulada Víctor</p>
            <h3 className="text-3xl font-black text-red-700 mt-1">${victorTotal.toFixed(2)}</h3>
          </div>
          <User className="w-10 h-10 text-red-200" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sticky top-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
              <PlusCircle className="w-5 h-5 text-brand-600" />
              Registrar Retiro
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Socio</label>
                <select 
                  value={formData.socio}
                  onChange={e => setFormData({...formData, socio: e.target.value})}
                  className="w-full border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="ysmael">Ysmael</option>
                  <option value="victor">Víctor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Concepto</label>
                <input 
                  type="text" 
                  value={formData.concepto}
                  onChange={e => setFormData({...formData, concepto: e.target.value})}
                  placeholder="Ej: Pago tarjeta personal"
                  className="w-full border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (USD)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.monto}
                    onChange={e => setFormData({...formData, monto: e.target.value})}
                    className="w-full pl-8 border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método / Cuenta de salida</label>
                <select 
                  value={formData.metodo_pago}
                  onChange={e => setFormData({...formData, metodo_pago: e.target.value})}
                  className="w-full border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="bancamiga">Bancamiga</option>
                  <option value="zelle">Zelle</option>
                  <option value="binance">Binance</option>
                  <option value="zinli">Zinli</option>
                  <option value="bolivares">Bolívares</option>
                </select>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 mt-2">
                <p className="text-xs text-amber-800 flex gap-2 items-start">
                  <Activity className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                  IMPORTANTE: Este registro NO resta dinero de la caja automáticamente. Solo aumenta tu deuda con el negocio. Si sacaste de la caja, recuerda actualizar "Caja".
                </p>
              </div>

              <button 
                type="submit" 
                disabled={saving}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 rounded-lg transition-colors mt-2"
              >
                {saving ? 'Guardando...' : 'Registrar Gasto'}
              </button>
            </div>
          </form>
        </div>

        {/* Lista */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-slate-800">Historial de Gastos Personales</h3>
            </div>
            
            {loading ? (
              <div className="p-8 text-center text-gray-500">Cargando historial...</div>
            ) : gastos.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No hay gastos registrados</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Socio</th>
                      <th className="px-4 py-3">Concepto</th>
                      <th className="px-4 py-3">Método</th>
                      <th className="px-4 py-3 text-right">Monto</th>
                      <th className="px-4 py-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastos.map(gasto => (
                      <tr key={gasto.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {gasto.fecha ? new Date(gasto.fecha.toDate()).toLocaleDateString() : 'Pendiente'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            gasto.socio === 'ysmael' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {gasto.socio.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">{gasto.concepto}</td>
                        <td className="px-4 py-3 capitalize">{gasto.metodo_pago}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">
                          ${gasto.monto?.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleEditClick(gasto)}
                              className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(gasto.id, gasto.concepto)}
                              disabled={deletingId === gasto.id}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Eliminar"
                            >
                              {deletingId === gasto.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
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
        </div>
      </div>

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
              <Trash2 className="w-8 h-8" />
            </div>
            
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">
              ¿Eliminar gasto?
            </h3>
            
            <p className="text-gray-500 text-center text-sm mb-6 leading-relaxed">
              Estás a punto de eliminar este gasto personal. Esta acción es irreversible y los datos no se podrán recuperar.
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-8 border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Concepto:</p>
              <p className="text-sm text-gray-700 font-medium">{showDeleteModal.concepto}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal({ show: false, id: null, concepto: '' })}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingId !== null}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-200"
              >
                {deletingId !== null && <Loader2 className="w-4 h-4 animate-spin" />}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición */}
      {editingGasto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Editar Gasto</h3>
              <button
                onClick={() => setEditingGasto(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Socio</label>
                <select
                  value={editFormData.socio}
                  onChange={e => setEditFormData({ ...editFormData, socio: e.target.value })}
                  className="w-full border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="ysmael">Ysmael</option>
                  <option value="victor">Víctor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Concepto</label>
                <input
                  type="text"
                  value={editFormData.concepto}
                  onChange={e => setEditFormData({ ...editFormData, concepto: e.target.value })}
                  placeholder="Ej: Pago tarjeta personal"
                  className="w-full border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (USD)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.monto}
                    onChange={e => setEditFormData({ ...editFormData, monto: e.target.value })}
                    className="w-full pl-8 border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método / Cuenta de salida</label>
                <select
                  value={editFormData.metodo_pago}
                  onChange={e => setEditFormData({ ...editFormData, metodo_pago: e.target.value })}
                  className="w-full border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="bancamiga">Bancamiga</option>
                  <option value="zelle">Zelle</option>
                  <option value="binance">Binance</option>
                  <option value="zinli">Zinli</option>
                  <option value="bolivares">Bolívares</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGasto(null)}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-200"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
