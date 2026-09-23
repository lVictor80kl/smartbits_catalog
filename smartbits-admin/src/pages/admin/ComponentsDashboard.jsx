import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  PlusCircle, Edit, Trash2, Loader2, FileText, MoreVertical, 
  Flame, Copy, Banknote, X 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import GastosAdicionalesModal from '../../components/GastosAdicionalesModal';
import OfertaModal from '../../components/OfertaModal';

export default function ComponentsDashboard() {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [filterDisp, setFilterDisp] = useState('Todas');
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [filterBorrador, setFilterBorrador] = useState('Todos');
  const [filterOfertasOnly, setFilterOfertasOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [priceSort, setPriceSort] = useState('asc');
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Modales y menús
  const [showDeleteModal, setShowDeleteModal] = useState({ show: false, ids: [], names: '' });
  const [gastosModalComponent, setGastosModalComponent] = useState(null);
  const [modalOferta, setModalOferta] = useState({ open: false, item: null });
  const [activeMenu, setActiveMenu] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'componentes'), orderBy('nombre'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setComponents(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const toggleActionMenu = (comp, e) => {
    e.stopPropagation();
    if (activeMenu?.id === comp.id) {
      setActiveMenu(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setActiveMenu({ id: comp.id, comp, rect });
    }
  };

  const closeActionMenu = () => setActiveMenu(null);

  useEffect(() => {
    if (!activeMenu) return;

    const handleClickOutside = (e) => {
      if (e.target.closest('#actions-dropdown-menu')) return;
      setActiveMenu(null);
    };

    const handleScroll = () => {
      setActiveMenu(null);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActiveMenu(null);
    };

    window.addEventListener('click', handleClickOutside);
    window.addEventListener('resize', handleScroll);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenu]);

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

  const handleDuplicateComponents = async (targetIds) => {
    if (!targetIds || targetIds.length === 0) return;
    const isBulk = targetIds.length > 1;
    setDuplicatingId(isBulk ? 'bulk' : targetIds[0]);

    try {
      const itemsToDuplicate = components.filter(c => targetIds.includes(c.id));
      for (const comp of itemsToDuplicate) {
        const newComponentData = {
          nombre: comp.nombre || '',
          tipo: comp.tipo || 'RAM',
          marca: comp.marca || '',
          precio: comp.precio || 0,
          unidades: comp.unidades ?? 1,
          disponibilidad: comp.disponibilidad || 'Disponible',
          imagen: comp.imagen || '',
          imagenes: Array.isArray(comp.imagenes) ? [...comp.imagenes] : (comp.imagen ? [comp.imagen] : []),
          estado: comp.estado || { pantalla: comp.estadoPantalla ?? 10, carcasa: comp.estadoCarcasa ?? 9 },
          otros: comp.otros || '',
          borrador: Boolean(comp.borrador),
          en_oferta: Boolean(comp.en_oferta),
          precio_oferta: comp.precio_oferta || null,
          etiqueta_oferta: comp.etiqueta_oferta || '',
          descripcion: comp.descripcion || '',
          descripcion_personalizada: comp.descripcion_personalizada || '',
          generacion: comp.generacion || '',
          velocidad: comp.velocidad || '',
          capacidad: comp.capacidad || '',
          interfaz: comp.interfaz || '',
          tipo_ssd: comp.tipo_ssd || '',
          capacidad_bateria: comp.capacidad_bateria || '',
          ciclo: comp.ciclo || '',
          bluetooth: comp.bluetooth || '',
          fecha_compra: comp.fecha_compra || '',
          costo_compra: comp.costo_compra ?? 0,
          costo_total: comp.costo_total ?? 0,
          observaciones_compra: comp.observaciones_compra || '',
          pagos_compra: comp.pagos_compra || [],
          createdAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'componentes'), newComponentData);
      }

      setSelectedIds(prev => prev.filter(id => !targetIds.includes(id)));
    } catch (err) {
      alert('Error al duplicar: ' + err.message);
    } finally {
      setDuplicatingId(null);
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
      const matchBorrador = filterBorrador === 'Todos'
        ? true
        : filterBorrador === 'Borradores'
          ? Boolean(c.borrador)
          : !c.borrador;
      const matchOferta = !filterOfertasOnly || Boolean(c.en_oferta);
      const matchSearch = (c.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.marca || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchDisp && matchTipo && matchBorrador && matchOferta && matchSearch;
    })
    .sort((a, b) => {
      const dispOrder = { 'Disponible': 0, 'Coming soon': 1, 'No disponible': 2 };
      const dispA = dispOrder[a.disponibilidad] ?? 3;
      const dispB = dispOrder[b.disponibilidad] ?? 3;
      if (dispA !== dispB) return dispA - dispB;
      const getPrecioEfectivo = (item) => (item.en_oferta && Number(item.precio_oferta) > 0 ? Number(item.precio_oferta) : Number(item.precio) || 0);
      if (priceSort === 'asc') return getPrecioEfectivo(a) - getPrecioEfectivo(b);
      if (priceSort === 'desc') return getPrecioEfectivo(b) - getPrecioEfectivo(a);
      return 0;
    });

  const tipoBadgeColors = {
    RAM: 'bg-blue-100 text-blue-700',
    SSD: 'bg-green-100 text-green-700',
    Bateria: 'bg-amber-100 text-amber-700',
    Teclado: 'bg-purple-100 text-purple-700',
    Mouse: 'bg-pink-100 text-pink-700',
    OTROS: 'bg-slate-100 text-slate-700',
    Otros: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. Header Principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Inventario de Componentes</h1>
          <p className="text-gray-500 text-xs font-medium mt-1">
            {loading ? 'Cargando componentes...' : `${filteredComponents.length} de ${components.length} componentes mostrados`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/components/new"
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm text-sm"
          >
            <PlusCircle className="w-4 h-4" />
            Añadir Componente
          </Link>
        </div>
      </div>

      {/* 2. Filtros y Búsqueda */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200/80 overflow-hidden">
        {!loading && components.length > 0 && (
          <div className="bg-gray-50/60 border-b border-gray-200/80 px-6 py-4 flex flex-wrap items-end gap-4">
            <div className="flex flex-col flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">Buscar</label>
              <input
                type="text"
                placeholder="Ej: Kingston, DDR4, SSD..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">Tipo</label>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
              >
                {tipos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">Estado</label>
              <select
                value={filterBorrador}
                onChange={(e) => setFilterBorrador(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all font-medium"
              >
                <option value="Todos">Todos ({components.length})</option>
                <option value="Publicados">Publicados ({components.filter(c => !c.borrador).length})</option>
                <option value="Borradores">Borradores ({components.filter(c => Boolean(c.borrador)).length})</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">Disponibilidad</label>
              <select
                value={filterDisp}
                onChange={(e) => setFilterDisp(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              >
                <option value="Todas">Todas</option>
                <option value="Disponible">Disponible</option>
                <option value="Coming soon">Coming soon</option>
                <option value="No disponible">No disponible</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">Precio</label>
              <select
                value={priceSort}
                onChange={(e) => setPriceSort(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              >
                <option value="asc">Menor a mayor</option>
                <option value="desc">Mayor a menor</option>
              </select>
            </div>

            {/* Toggle Solo Ofertas */}
            <div className="flex items-center gap-2 pb-1.5">
              <button
                type="button"
                onClick={() => setFilterOfertasOnly(!filterOfertasOnly)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  filterOfertasOnly
                    ? 'bg-orange-100 text-orange-800 border-orange-300'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Flame className={`w-3.5 h-3.5 ${filterOfertasOnly ? 'text-orange-600 fill-orange-500' : 'text-gray-400'}`} />
                <span>Solo Ofertas</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Tabla de Componentes */}
        {loading ? (
          <div className="py-24 flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
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
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 w-10">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
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
                  <tr 
                    key={comp.id} 
                    className={`hover:bg-gray-50/60 transition-colors ${selectedIds.includes(comp.id) ? 'bg-purple-50/30' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        checked={selectedIds.includes(comp.id)}
                        onChange={() => toggleSelect(comp.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center p-1 shrink-0 border border-gray-200/60">
                          <img
                            src={comp.imagen || (comp.imagenes && comp.imagenes[0]) || '/default-laptop.png'}
                            alt={comp.nombre}
                            onError={(e) => { e.target.onerror = null; e.target.src = '/default-laptop.png'; }}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 line-clamp-1 flex items-center gap-2">
                            <span>{comp.nombre}</span>
                            {comp.borrador && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wider">
                                Borrador
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tipoBadgeColors[comp.tipo] || 'bg-gray-100 text-gray-700'}`}>
                              {comp.tipo}
                            </span>
                            {comp.en_oferta && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-orange-100 text-orange-800 border border-orange-300 uppercase tracking-wider">
                                <Flame className="w-2.5 h-2.5 text-orange-600 fill-orange-500" />
                                {comp.etiqueta_oferta?.trim() || 'Oferta'}
                              </span>
                            )}
                          </div>
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
                      {comp.en_oferta && Number(comp.precio_oferta) > 0 ? (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-orange-600 text-sm sm:text-base">${comp.precio_oferta}</span>
                            <span className="text-xs text-gray-400 line-through">${comp.precio}</span>
                          </div>
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-orange-800 bg-orange-100 rounded border border-orange-200 w-fit">
                            {comp.etiqueta_oferta?.trim() || `-${Math.round(((Number(comp.precio) - Number(comp.precio_oferta)) / Number(comp.precio)) * 100)}% OFF`}
                          </span>
                        </div>
                      ) : (
                        <div className="font-bold text-gray-900">${comp.precio}</div>
                      )}
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
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        comp.disponibilidad === 'Disponible'
                          ? 'bg-green-100 text-green-700'
                          : comp.disponibilidad === 'Coming soon'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          comp.disponibilidad === 'Disponible' 
                            ? 'bg-emerald-500' 
                            : comp.disponibilidad === 'Coming soon' 
                              ? 'bg-amber-500' 
                              : 'bg-rose-500'
                        }`} />
                        {comp.disponibilidad}
                      </span>
                    </td>

                    {/* Botones de Acción */}
                    <td className="px-6 py-4 text-right">
                      {duplicatingId === comp.id ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                          <span className="hidden sm:inline">Duplicando...</span>
                        </div>
                      ) : deletingId === comp.id ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-lg">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                          <span className="hidden sm:inline">Eliminando...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/admin/components/edit/${comp.id}`}
                            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors rounded-lg hidden sm:inline-flex"
                            title="Editar componente"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => toggleActionMenu(comp, e)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                              activeMenu?.id === comp.id
                                ? 'bg-purple-50 text-purple-700 border-purple-300 shadow-2xs ring-2 ring-purple-500/20'
                                : 'text-gray-700 bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 shadow-2xs'
                            }`}
                            title="Menú de opciones"
                          >
                            <span className="hidden md:inline font-bold">Opciones</span>
                            <MoreVertical className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Dock Flotante de Acciones Masivas */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-950/95 backdrop-blur-md text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl shadow-2xl border border-gray-800 flex items-center justify-between gap-2.5 sm:gap-4 max-w-[95%] sm:max-w-md w-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-1.5 pr-2 border-r border-gray-800 shrink-0">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-xs font-bold">
              {selectedIds.length} <span className="hidden sm:inline">seleccionado{selectedIds.length !== 1 ? 's' : ''}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => handleDuplicateComponents(selectedIds)}
              disabled={duplicatingId !== null}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              {duplicatingId === 'bulk' || (selectedIds.length === 1 && duplicatingId === selectedIds[0]) ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Duplicar</span>
            </button>

            <button
              onClick={handleBulkDeleteClick}
              disabled={deletingId !== null}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors ml-0.5"
              title="Deseleccionar todos"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 5. Modal de Gastos Adicionales / Envío Reutilizado */}
      {gastosModalComponent && (
        <GastosAdicionalesModal
          item={components.find(c => c.id === gastosModalComponent.id) || gastosModalComponent}
          collectionName="componentes"
          onClose={() => setGastosModalComponent(null)}
        />
      )}

      {/* 6. Modal Reutilizable de Ofertas */}
      <OfertaModal
        open={modalOferta.open}
        item={modalOferta.item}
        collectionName="componentes"
        onClose={() => setModalOferta({ open: false, item: null })}
      />

      {/* 7. Modal de Confirmación de Eliminación */}
      {showDeleteModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-5 text-rose-600">
              <Trash2 className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">
              {showDeleteModal.ids.length === 1 ? '¿Eliminar componente?' : '¿Eliminar selección?'}
            </h3>

            <p className="text-gray-500 text-center text-xs sm:text-sm mb-6 leading-relaxed">
              Estás a punto de eliminar {showDeleteModal.ids.length === 1 ? 'un componente' : `${showDeleteModal.ids.length} componentes`}.
              Esta acción es permanente y no se podrá recuperar.
            </p>

            <div className="bg-gray-50 rounded-xl p-3.5 mb-6 max-h-32 overflow-y-auto border border-gray-200/70 text-xs">
              <p className="font-bold text-gray-400 uppercase tracking-widest mb-1">Elementos:</p>
              <p className="text-gray-700 font-medium leading-normal">{showDeleteModal.names}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal({ show: false, ids: [], names: '' })}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingId !== null}
                className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-200 text-sm"
              >
                {deletingId !== null && <Loader2 className="w-4 h-4 animate-spin" />}
                {showDeleteModal.ids.length === 1 ? 'Sí, eliminar' : 'Sí, eliminar todos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Dropdown Flotante de Acciones (Portal en document.body) */}
      {activeMenu && createPortal(
        <div
          id="actions-dropdown-menu"
          style={{
            position: 'fixed',
            zIndex: 9999,
            width: '230px',
            maxWidth: 'calc(100vw - 24px)',
            right: `${Math.max(12, window.innerWidth - activeMenu.rect.right)}px`,
            ...(window.innerHeight - activeMenu.rect.bottom < 280 && activeMenu.rect.top > 280
              ? { bottom: `${window.innerHeight - activeMenu.rect.top + 6}px` }
              : { top: `${activeMenu.rect.bottom + 6}px` })
          }}
          className="bg-white rounded-2xl shadow-2xl border border-gray-200/90 py-1.5 text-xs text-gray-700 animate-in fade-in zoom-in-95 duration-100 overflow-hidden select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3.5 py-2 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between gap-2">
            <span className="font-bold text-gray-400 uppercase text-[10px] tracking-wider shrink-0">
              Opciones
            </span>
            <span className="text-[11px] font-bold text-gray-800 truncate" title={activeMenu.comp.nombre}>
              {activeMenu.comp.nombre}
            </span>
          </div>

          <div className="p-1 space-y-0.5">
            <Link
              to={`/admin/components/edit/${activeMenu.comp.id}`}
              onClick={closeActionMenu}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-purple-50 text-gray-700 hover:text-purple-700 font-semibold transition-colors"
            >
              <Edit className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Editar componente</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                const comp = activeMenu.comp;
                closeActionMenu();
                setModalOferta({ open: true, item: comp });
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-colors text-left ${
                activeMenu.comp.en_oferta
                  ? 'bg-orange-50 text-orange-800 hover:bg-orange-100'
                  : 'hover:bg-orange-50 text-gray-700 hover:text-orange-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Flame className={`w-4 h-4 shrink-0 ${activeMenu.comp.en_oferta ? 'text-orange-600 fill-orange-500' : 'text-orange-500'}`} />
                <span>{activeMenu.comp.en_oferta ? 'Editar oferta' : 'Poner en oferta'}</span>
              </div>
              {activeMenu.comp.en_oferta && (
                <span className="text-[9px] font-black bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded-full">
                  Activa
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                const id = activeMenu.comp.id;
                closeActionMenu();
                handleDuplicateComponents([id]);
              }}
              disabled={duplicatingId === activeMenu.comp.id || duplicatingId === 'bulk'}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-purple-50 text-gray-700 hover:text-purple-700 font-semibold transition-colors text-left disabled:opacity-50"
            >
              <Copy className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Duplicar componente</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const comp = activeMenu.comp;
                closeActionMenu();
                setGastosModalComponent(comp);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 font-semibold transition-colors text-left"
            >
              <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Gastos / Envío</span>
            </button>

            <Link
              to={`/admin/components/delivery/${activeMenu.comp.id}`}
              onClick={closeActionMenu}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-teal-50 text-gray-700 hover:text-teal-700 font-semibold transition-colors"
            >
              <FileText className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Nota de entrega</span>
            </Link>
          </div>

          <div className="h-px bg-gray-100 my-1" />

          <div className="p-1">
            <button
              type="button"
              onClick={() => {
                const comp = activeMenu.comp;
                closeActionMenu();
                handleDeleteClick(comp.id, comp.nombre);
              }}
              disabled={deletingId === activeMenu.comp.id || deletingId === 'bulk'}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-semibold transition-colors text-left disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Eliminar componente</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
