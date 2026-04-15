import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { PlusCircle, Edit, Trash2, Loader2, FileText, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [laptops, setLaptops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [filterDisp, setFilterDisp] = useState('Todas');
  const [filterMarca, setFilterMarca] = useState('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [priceSort, setPriceSort] = useState('default');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState({ show: false, ids: [], names: '' });

  useEffect(() => {
    const q = query(collection(db, 'laptops'), orderBy('modelo'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLaptops(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDeleteClick = (id, modelo) => {
    setShowDeleteModal({ show: true, ids: [id], names: modelo });
  };

  const handleBulkDeleteClick = () => {
    const names = filteredLaptops
      .filter(l => selectedIds.includes(l.id))
      .map(l => l.modelo)
      .join(', ');
    setShowDeleteModal({ show: true, ids: selectedIds, names });
  };

  const confirmDelete = async () => {
    const ids = showDeleteModal.ids;
    setDeletingId(ids.length === 1 ? ids[0] : 'bulk');
    try {
      for (const id of ids) {
        await deleteDoc(doc(db, 'laptops', id));
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
    if (selectedIds.length === filteredLaptops.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLaptops.map(l => l.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleExportPDF = () => {
    if (filteredLaptops.length === 0) {
      alert('No hay equipos para exportar con los filtros actuales.');
      return;
    }

    const formatDateFile = (date) => {
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = date.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };

    const now = new Date();
    const fileName = `Inventario_SmartBits_${formatDateFile(now)}`;

    // Build active filter description
    const filterParts = [];
    if (filterMarca !== 'Todas') filterParts.push(`Marca: ${filterMarca}`);
    if (filterDisp !== 'Todas') filterParts.push(`Disponibilidad: ${filterDisp}`);
    if (searchTerm) filterParts.push(`Búsqueda: "${searchTerm}"`);
    if (priceSort === 'asc') filterParts.push('Precio: Menor a mayor');
    if (priceSort === 'desc') filterParts.push('Precio: Mayor a menor');
    const filterText = filterParts.length > 0 ? filterParts.join(' | ') : 'Sin filtros aplicados';

    const rows = filteredLaptops.map((laptop, i) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 10px; text-align: center; color: #888; font-size: 12px;">${i + 1}</td>
        <td style="padding: 8px 10px;">
          <div style="font-weight: 600; font-size: 13px; color: #111;">${laptop.modelo}</div>
          <div style="font-size: 11px; color: #888;">${laptop.marca || ''}</div>
        </td>
        <td style="padding: 8px 10px; font-size: 12px; color: #444;">
          <div>${laptop.cpu || '—'}</div>
          <div style="color: #888;">${laptop.ram || '—'} • ${laptop.almacenamiento || '—'}</div>
          <div style="color: #888;">${laptop.pantalla || ''}${laptop.touch?.toLowerCase() === 'sí' ? ' (Táctil)' : ''}</div>
        </td>
        <td style="padding: 8px 10px; text-align: center; font-size: 11px;">
          <span style="padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 10px; ${
            laptop.disponibilidad === 'Disponible'
              ? 'background: #dcfce7; color: #15803d;'
              : laptop.disponibilidad === 'Coming soon'
                ? 'background: #fef3c7; color: #b45309;'
                : 'background: #fee2e2; color: #b91c1c;'
          }">${laptop.disponibilidad || '—'}</span>
        </td>
        <td style="padding: 8px 10px; text-align: right; font-weight: 700; font-size: 14px; color: #111;">$${laptop.precio}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes para generar el PDF.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${fileName}</title>
        <style>
          @page {
            size: letter;
            margin: 12mm;
          }
          body {
            margin: 0;
            padding: 30px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #222;
            background: #fff;
          }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="/logo-black.png" alt="Smartbits" style="height: 50px;" />
        </div>
        <h1 style="text-align: center; font-size: 18px; font-weight: 700; color: #1a1a1a; border-bottom: 3px solid #5ce1e6; padding-bottom: 8px; margin-bottom: 6px; letter-spacing: 2px;">
          LISTADO DE INVENTARIO
        </h1>
        <p style="text-align: center; font-size: 11px; color: #888; margin-bottom: 20px;">
          ${filterText} — ${filteredLaptops.length} equipo${filteredLaptops.length !== 1 ? 's' : ''} — Generado: ${now.toLocaleDateString('es-VE')}
        </p>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f0f9ff; border-bottom: 2px solid #5ce1e6;">
              <th style="padding: 8px 10px; text-align: center; color: #0ea5e9; font-weight: 700; font-size: 10px; text-transform: uppercase; width: 40px;">#</th>
              <th style="padding: 8px 10px; text-align: left; color: #0ea5e9; font-weight: 700; font-size: 10px; text-transform: uppercase;">Equipo</th>
              <th style="padding: 8px 10px; text-align: left; color: #0ea5e9; font-weight: 700; font-size: 10px; text-transform: uppercase;">Especificaciones</th>
              <th style="padding: 8px 10px; text-align: center; color: #0ea5e9; font-weight: 700; font-size: 10px; text-transform: uppercase;">Estado</th>
              <th style="padding: 8px 10px; text-align: right; color: #0ea5e9; font-weight: 700; font-size: 10px; text-transform: uppercase;">Precio</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 10px; text-align: center; color: #aaa; font-size: 10px;">
          Compra inteligente, compra en Smartbits.
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 300);
    };
  };

  const marcas = ['Todas', ...new Set(laptops.map(l => l.marca).filter(Boolean))];

  const filteredLaptops = laptops
    .filter(laptop => {
      const matchDisp = filterDisp === 'Todas' || laptop.disponibilidad === filterDisp;
      const matchMarca = filterMarca === 'Todas' || laptop.marca === filterMarca;
      const matchSearch = laptop.modelo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (laptop.marca || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchDisp && matchMarca && matchSearch;
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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario de Equipos</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? 'Cargando...' : `${filteredLaptops.length} equipo${filteredLaptops.length !== 1 ? 's' : ''} mostrado${filteredLaptops.length !== 1 ? 's' : ''} (de ${laptops.length} en total)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={loading || filteredLaptops.length === 0}
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Exportar listado de equipos filtrados a PDF"
          >
            <Download className="w-4 h-4" />
            Exportar PDF
          </button>
          <Link 
            to="/admin/sync" 
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            Sincronizar Sheets
          </Link>
          <Link 
            to="/admin/new" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <PlusCircle className="w-5 h-5" />
            Añadir Laptop
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Filtros */}
        {!loading && laptops.length > 0 && (
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex flex-wrap items-end gap-4">
            <div className="flex flex-col flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">Buscar por nombre</label>
              <input 
                type="text"
                placeholder="Ej: Latitude, Thinkpad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">Marca</label>
              <select 
                value={filterMarca} 
                onChange={(e) => setFilterMarca(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                {marcas.map(m => <option key={m} value={m}>{m}</option>)}
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
            <p className="text-sm">Cargando inventario...</p>
          </div>
        ) : laptops.length === 0 ? (
          <div className="py-24 text-center text-gray-400">
            <p className="font-medium text-gray-500">No hay equipos registrados aún.</p>
            <Link to="/admin/new" className="mt-3 inline-block text-blue-600 hover:underline text-sm font-medium">
              Añade tu primer equipo →
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
                      checked={filteredLaptops.length > 0 && selectedIds.length === filteredLaptops.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-4 font-semibold">Equipo</th>
                  <th className="px-6 py-4 font-semibold">Specs Rápidas</th>
                  <th className="px-6 py-4 font-semibold text-center">Precio / Est. Visual</th>
                  <th className="px-6 py-4 font-semibold">Disponibilidad</th>
                  <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLaptops.map(laptop => (
                  <tr key={laptop.id} className={`hover:bg-gray-50/50 transition-colors ${selectedIds.includes(laptop.id) ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={selectedIds.includes(laptop.id)}
                        onChange={() => toggleSelect(laptop.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center p-1 shrink-0">
                          <img 
                            src={laptop.imagen || '/default-laptop.png'} 
                            alt={laptop.modelo} 
                            onError={(e) => { e.target.onerror = null; e.target.src = '/default-laptop.png'; }}
                            className="max-h-full max-w-full object-contain" 
                          />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 line-clamp-1">{laptop.modelo}</div>
                          <div className="text-xs text-gray-500">{laptop.marca}</div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-xs">
                      <div className="text-gray-900 font-medium line-clamp-1 truncate max-w-[150px]" title={laptop.cpu}>{laptop.cpu}</div>
                      <div className="text-gray-500">{laptop.ram} • {laptop.almacenamiento}</div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">${laptop.precio}</div>
                      <div className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded inline-block mt-1">
                        P: {laptop.estado?.pantalla ?? laptop.estadoPantalla}/10 | C: {laptop.estado?.carcasa ?? laptop.estadoCarcasa}/10
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        laptop.disponibilidad === 'Disponible' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {laptop.disponibilidad}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/delivery/${laptop.id}`}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 transition-colors"
                          title="Nota de Entrega"
                        >
                          <FileText className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/admin/edit/${laptop.id}`}
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleDeleteClick(laptop.id, laptop.modelo)}
                          disabled={deletingId === laptop.id || deletingId === 'bulk'}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="Eliminar"
                        >
                          {deletingId === laptop.id 
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

      {/* Modal de Confirmación Personalizado */}
      {showDeleteModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
              <Trash2 className="w-8 h-8" />
            </div>
            
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">
              {showDeleteModal.ids.length === 1 ? '¿Eliminar equipo?' : '¿Eliminar selección?'}
            </h3>
            
            <p className="text-gray-500 text-center text-sm mb-6 leading-relaxed">
              Estás a punto de eliminar {showDeleteModal.ids.length === 1 ? 'un equipo' : `${showDeleteModal.ids.length} equipos`}. 
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
