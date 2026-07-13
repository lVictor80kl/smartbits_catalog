import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { PlusCircle, Edit, Trash2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ComponentsDashboard() {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [filterDisp, setFilterDisp] = useState('Todas');
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [priceSort, setPriceSort] = useState('asc');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState({ show: false, ids: [], names: '' });

  useEffect(() => {
    const q = query(collection(db, 'componentes'), orderBy('nombre'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setComponents(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDeleteClick = (id, nombre) => {
    setShowDeleteModal({ show: true, ids: [id], names: nombre });
  };

  const handleBulkDeleteClick = () => {
    const names = filteredComponents
      .filter(c => selectedIds.includes(c.id))
      .map(c => c.nombre)
      .join(', ');
    setShowDeleteModal({ show: true, ids: selectedIds, names });
  };

  const confirmDelete = async () => {
    const ids = showDeleteModal.ids;
    setDeletingId(ids.length === 1 ? ids[0] : 'bulk');
    try {
      for (const id of ids) {
        await deleteDoc(doc(db, 'componentes', id));
      }
      setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    } finally {
      setDeletingId(null);
      setShowDeleteModal({ show: false, ids: [], names: '' });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredComponents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredComponents.map(c => c.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const tipos = ['Todos', ...new Set(components.map(c => c.tipo).filter(Boolean))];

  const filteredComponents = components
    .filter(c => {
      const matchDisp = filterDisp === 'Todas' || c.disponibilidad === filterDisp;
      const matchTipo = filterTipo === 'Todos' || c.tipo === filterTipo;
      const matchSearch = (c.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.marca || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchDisp && matchTipo && matchSearch;
    })
    .sort((a, b) => {
      const dispOrder = { 'Disponible': 0, 'Coming soon': 1, 'No disponible': 2 };
      const dispA = dispOrder[a.disponibilidad] ?? 3;
      const dispB = dispOrder[b.disponibilidad] ?? 3;
      if (dispA !== dispB) return dispA - dispB;
      if (priceSort === 'asc') return a.precio - b.precio;
      if (priceSort === 'desc') return b.precio - a.precio;
      return 0;
    });

  const tipoBadgeColors = {
    RAM: 'bg-blue-100 text-blue-700',
    SSD: 'bg-green-100 text-green-700',
    Bateria: 'bg-amber-100 text-amber-700',
    Otros: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario de Componentes</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? 'Cargando...' : `${filteredComponents.length} componente${filteredComponents.length !== 1 ? 's' : ''} mostrado${filteredComponents.length !== 1 ? 's' : ''} (de ${components.length} en total)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/components/new"
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <PlusCircle className="w-5 h-5" />
            Añadir Componente
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        {!loading && components.length > 0 && (
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex flex-wrap items-end gap-4">
            <div className="flex flex-col flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">Buscar</label>
              <input
                type="text"
                placeholder="Ej: Kingston, DDR4..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">Tipo</label>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                {tipos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">Disponibilidad</label>
              <select
                value={filterDisp}
                onChange={(e) => setFilterDisp(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="Todas">Todas</option>
                <option value="Disponible">Disponible</option>
                <option value="Coming soon">Coming soon</option>
                <option value="No disponible">No disponible</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1">Precio</label>
              <select
                value={priceSort}
                onChange={(e) => setPriceSort(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="default">Orden original</option>
                <option value="asc">Menor a mayor</option>
                <option value="desc">Mayor a menor</option>
              </select>
            </div>

            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDeleteClick}
                className="ml-auto bg-red-50 text-red-600 hover:bg-red-100 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 border border-red-200"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar Seleccionados ({selectedIds.length})
              </button>
            )}
          </div>
        )}
        {loading ? (
          <div className="py-24 flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Cargando inventario de componentes...</p>
          </div>
        ) : components.length === 0 ? (
          <div className="py-24 text-center text-gray-400">
            <p className="font-medium text-gray-500">No hay componentes registrados aún.</p>
            <Link to="/admin/components/new" className="mt-3 inline-block text-purple-600 hover:underline text-sm font-medium">
              Añade tu primer componente →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 w-10">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={filteredComponents.length > 0 && selectedIds.length === filteredComponents.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-4 font-semibold">Componente</th>
                  <th className="px-6 py-4 font-semibold">Tipo</th>
                  <th className="px-6 py-4 font-semibold">Marca</th>
                  <th className="px-6 py-4 font-semibold">Precio</th>
                  <th className="px-6 py-4 font-semibold text-center">Stock</th>
                  <th className="px-6 py-4 font-semibold">Disponibilidad</th>
                  <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredComponents.map(comp => (
                  <tr key={comp.id} className={`hover:bg-gray-50/50 transition-colors ${selectedIds.includes(comp.id) ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={selectedIds.includes(comp.id)}
                        onChange={() => toggleSelect(comp.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center p-1 shrink-0">
                          <img
                            src={comp.imagen || '/default-laptop.png'}
                            alt={comp.nombre}
                            onError={(e) => { e.target.onerror = null; e.target.src = '/default-laptop.png'; }}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 line-clamp-1">{comp.nombre}</div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tipoBadgeColors[comp.tipo] || 'bg-gray-100 text-gray-700'}`}>
                            {comp.tipo}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${tipoBadgeColors[comp.tipo] || 'bg-gray-100 text-gray-700'}`}>
                        {comp.tipo}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs font-medium text-gray-700">
                      {comp.marca || '—'}
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">${comp.precio}</div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-bold ${
                        (comp.unidades || 0) > 5
                          ? 'bg-green-100 text-green-700'
                          : (comp.unidades || 0) > 0
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                      }`}>
                        {comp.unidades ?? 0}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        comp.disponibilidad === 'Disponible'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {comp.disponibilidad}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/components/edit/${comp.id}`}
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteClick(comp.id, comp.nombre)}
                          disabled={deletingId === comp.id || deletingId === 'bulk'}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="Eliminar"
                        >
                          {deletingId === comp.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />
                          }
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

      {showDeleteModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
              <Trash2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">
              {showDeleteModal.ids.length === 1 ? '¿Eliminar componente?' : '¿Eliminar selección?'}
            </h3>

            <p className="text-gray-500 text-center text-sm mb-6 leading-relaxed">
              Estás a punto de eliminar {showDeleteModal.ids.length === 1 ? 'un componente' : `${showDeleteModal.ids.length} componentes`}.
              Esta acción es irreversible y los datos no se podrán recuperar.
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-8 max-h-32 overflow-y-auto border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Elementos:</p>
              <p className="text-sm text-gray-700 font-medium">{showDeleteModal.names}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal({ show: false, ids: [], names: '' })}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingId !== null}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-200"
              >
                {deletingId !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {showDeleteModal.ids.length === 1 ? 'Sí, eliminar' : 'Sí, eliminar todos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
