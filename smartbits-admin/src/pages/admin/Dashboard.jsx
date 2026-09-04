import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { PlusCircle, Edit, Trash2, Loader2, FileText, Download, CloudLightning, Package, Wrench, Banknote, Filter, SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp, X, Copy, Flame, MoreVertical } from 'lucide-react';
import { Link } from 'react-router-dom';
import GastosAdicionalesModal from '../../components/GastosAdicionalesModal';
import { tieneEnvioPagado, tienePagoExtra, getCostoTotal } from '../../utils/costos';


export default function Dashboard() {
  const [laptops, setLaptops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [filterDisp, setFilterDisp] = useState([]);
  const [filterMarca, setFilterMarca] = useState([]);
  const [filterRam, setFilterRam] = useState([]);
  const [filterStorage, setFilterStorage] = useState([]);
  const [filterCpu, setFilterCpu] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [priceSort, setPriceSort] = useState('asc');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState({ show: false, ids: [], names: '' });
  const [gastosModalLaptop, setGastosModalLaptop] = useState(null);
  const [modalOferta, setModalOferta] = useState({ open: false, laptop: null, en_oferta: false, precio_oferta: '', etiqueta_oferta: '', saving: false });
  const [activeMenu, setActiveMenu] = useState(null);

  const toggleActionMenu = (laptop, e) => {
    e.stopPropagation();
    if (activeMenu?.id === laptop.id) {
      setActiveMenu(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setActiveMenu({ id: laptop.id, laptop, rect });
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

  // Model count: how many units per model name
  const modelCounts = laptops.reduce((acc, l) => {
    const key = l.modelo?.trim().toLowerCase();
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  // Normalize brand names after fetching
  useEffect(() => {
    const q = query(collection(db, 'laptops'), orderBy('modelo'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const normalized = rawData.map(l => {
        if (l.marca && l.marca.toLowerCase() === 'hp') {
          return { ...l, marca: 'HP' };
        }
        return l;
      });
      setLaptops(normalized);
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

  const handleDuplicateLaptops = async (targetIds) => {
    if (!targetIds || targetIds.length === 0) return;
    const isBulk = targetIds.length > 1;
    setDuplicatingId(isBulk ? 'bulk' : targetIds[0]);

    try {
      const itemsToDuplicate = laptops.filter(l => targetIds.includes(l.id));
      for (const laptop of itemsToDuplicate) {
        // Extraer especificaciones técnicas y multimedia omitiendo costos/gastos contables
        const newLaptopData = {
          modelo: laptop.modelo || '',
          marca: laptop.marca || '',
          cpu: laptop.cpu || '',
          ram: laptop.ram || '',
          almacenamiento: laptop.almacenamiento || '',
          gpu: laptop.gpu || '',
          pantalla: laptop.pantalla || '',
          touch: laptop.touch || 'No',
          windows: laptop.windows || '',
          bateria: laptop.bateria || 'Excelente',
          precio: laptop.precio || 0,
          disponibilidad: laptop.disponibilidad || 'Disponible',
          imagen: laptop.imagen || '',
          imagenes: Array.isArray(laptop.imagenes) ? [...laptop.imagenes] : (laptop.imagen ? [laptop.imagen] : []),
          estadoPantalla: laptop.estadoPantalla ?? 10,
          estadoCarcasa: laptop.estadoCarcasa ?? 9,
          otros: laptop.otros || '',
          borrador: Boolean(laptop.borrador),
          en_oferta: Boolean(laptop.en_oferta),
          precio_oferta: laptop.precio_oferta || null,
          etiqueta_oferta: laptop.etiqueta_oferta || '',
          createdAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'laptops'), newLaptopData);
      }

      setSelectedIds(prev => prev.filter(id => !targetIds.includes(id)));
    } catch (err) {
      alert('Error al duplicar: ' + err.message);
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleGuardarOferta = async (e) => {
    e.preventDefault();
    if (!modalOferta.laptop) return;
    const isOfertaActive = Boolean(modalOferta.en_oferta);
    const precioOfertaNum = Number(modalOferta.precio_oferta);
    if (isOfertaActive && (isNaN(precioOfertaNum) || precioOfertaNum <= 0)) {
      return alert("Ingresa un precio de oferta válido.");
    }
    setModalOferta(p => ({ ...p, saving: true }));
    try {
      const laptopRef = doc(db, 'laptops', modalOferta.laptop.id);
      await updateDoc(laptopRef, {
        en_oferta: isOfertaActive,
        precio_oferta: isOfertaActive ? precioOfertaNum : null,
        etiqueta_oferta: isOfertaActive ? (modalOferta.etiqueta_oferta || '') : '',
        updatedAt: new Date().toISOString()
      });
      setModalOferta({ open: false, laptop: null, en_oferta: false, precio_oferta: '', etiqueta_oferta: '', saving: false });
    } catch (err) {
      console.error(err);
      alert("Error al actualizar oferta: " + err.message);
      setModalOferta(p => ({ ...p, saving: false }));
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
    if (filterMarca.length > 0) filterParts.push(`Marcas: ${filterMarca.join(', ')}`);
    if (filterDisp.length > 0) filterParts.push(`Disponibilidad: ${filterDisp.join(', ')}`);
    if (filterRam.length > 0) filterParts.push(`RAM: ${filterRam.join(', ')}`);
    if (filterStorage.length > 0) filterParts.push(`Almacenamiento: ${filterStorage.join(', ')}`);
    if (filterCpu.trim()) filterParts.push(`CPU: "${filterCpu}"`);
    if (searchTerm.trim()) filterParts.push(`Búsqueda: "${searchTerm}"`);
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
          <span style="padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 10px; ${laptop.disponibilidad === 'Disponible'
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

  const toggleArrayFilter = (setter, currentArray, value) => {
    if (currentArray.includes(value)) {
      setter(currentArray.filter(item => item !== value));
    } else {
      setter([...currentArray, value]);
    }
  };

  const marcasDisponibles = Array.from(new Set(laptops.map(l => {
    const m = l.marca;
    if (m && m.toLowerCase() === 'hp') return 'HP';
    return m;
  }).filter(Boolean))).sort();

  const disponibilidadesDisponibles = ['Disponible', 'Coming soon', 'No disponible'];

  const ramsDisponibles = Array.from(new Set(laptops.map(l => l.ram?.trim()).filter(Boolean))).sort((a, b) => {
    const numA = parseInt(a) || 0;
    const numB = parseInt(b) || 0;
    return numA - numB;
  });

  const storagesDisponibles = Array.from(new Set(laptops.map(l => l.almacenamiento?.trim()).filter(Boolean))).sort();

  const activeFiltersCount =
    (filterDisp.length > 0 ? 1 : 0) +
    (filterMarca.length > 0 ? 1 : 0) +
    (filterRam.length > 0 ? 1 : 0) +
    (filterStorage.length > 0 ? 1 : 0) +
    (filterCpu.trim() !== '' ? 1 : 0) +
    (searchTerm.trim() !== '' ? 1 : 0);

  const clearAllFilters = () => {
    setFilterDisp([]);
    setFilterMarca([]);
    setFilterRam([]);
    setFilterStorage([]);
    setFilterCpu('');
    setSearchTerm('');
    setPriceSort('asc');
  };

  const filteredLaptops = laptops
    .filter(laptop => {
      const matchDisp = filterDisp.length === 0 || filterDisp.includes(laptop.disponibilidad);
      const matchMarca = filterMarca.length === 0 || filterMarca.includes(laptop.marca);
      const matchRam = filterRam.length === 0 || filterRam.includes(laptop.ram?.trim());
      const matchStorage = filterStorage.length === 0 || filterStorage.includes(laptop.almacenamiento?.trim());
      const matchCpu = !filterCpu.trim() || (laptop.cpu || '').toLowerCase().includes(filterCpu.toLowerCase().trim());
      const matchSearch = !searchTerm.trim() ||
        laptop.modelo.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (laptop.marca || '').toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (laptop.cpu || '').toLowerCase().includes(searchTerm.toLowerCase().trim());

      return matchDisp && matchMarca && matchRam && matchStorage && matchCpu && matchSearch;
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
            to="/admin/components/new"
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <Package className="w-5 h-5" />
            Añadir Componente
          </Link>
          <Link
            to="/admin/service"
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <Wrench className="w-5 h-5" />
            Servicio Técnico
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
          <div className="bg-gray-50 border-b border-gray-200">
            {/* Main Bar */}
            <div className="px-6 py-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <input
                  type="text"
                  placeholder="Buscar modelo, marca o CPU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                {/* Price Sort */}
                <select
                  value={priceSort}
                  onChange={(e) => setPriceSort(e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm font-medium text-gray-700 cursor-pointer"
                >
                  <option value="asc">Precio: Menor a mayor</option>
                  <option value="desc">Precio: Mayor a menor</option>
                </select>

                {/* Filter Toggle Button */}
                <button
                  onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 border shadow-sm ${showFiltersPanel || activeFiltersCount > 0
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-bold ml-0.5">
                      {activeFiltersCount}
                    </span>
                  )}
                  {showFiltersPanel ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>

                {/* Clear Filters Button */}
                {activeFiltersCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                    title="Limpiar todos los filtros"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Limpiar
                  </button>
                )}
              </div>

              {selectedIds.length > 0 && (
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => handleDuplicateLaptops(selectedIds)}
                    disabled={duplicatingId !== null}
                    className="bg-purple-50 text-purple-700 hover:bg-purple-100 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 border border-purple-200 disabled:opacity-50"
                    title="Duplicar equipos seleccionados sin datos contables"
                  >
                    {duplicatingId === 'bulk' || (selectedIds.length === 1 && duplicatingId === selectedIds[0]) ? (
                      <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Duplicar ({selectedIds.length})
                  </button>
                  <button
                    onClick={handleBulkDeleteClick}
                    disabled={deletingId !== null}
                    className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 border border-red-200 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar Seleccionados ({selectedIds.length})
                  </button>
                </div>
              )}
            </div>

            {/* Collapsible Panel */}
            {showFiltersPanel && (
              <div className="px-6 pb-5 pt-2 border-t border-gray-200 bg-white/70 space-y-4 text-xs">
                {/* Row 1: Disponibilidad */}
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Disponibilidad
                  </label>
                  <div className="flex flex-wrap gap-2 items-center">
                    <button
                      onClick={() => setFilterDisp([])}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${filterDisp.length === 0
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                        }`}
                    >
                      Todas
                    </button>
                    {disponibilidadesDisponibles.map(disp => {
                      const isSelected = filterDisp.includes(disp);
                      return (
                        <button
                          key={disp}
                          onClick={() => toggleArrayFilter(setFilterDisp, filterDisp, disp)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border flex items-center gap-1 ${isSelected
                              ? 'bg-blue-100 text-blue-800 border-blue-300 font-bold shadow-xs'
                              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                            }`}
                        >
                          {disp}
                          {isSelected && <X className="w-3 h-3 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row 2: Marca */}
                {marcasDisponibles.length > 0 && (
                  <div>
                    <label className="block font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Marca
                    </label>
                    <div className="flex flex-wrap gap-2 items-center">
                      <button
                        onClick={() => setFilterMarca([])}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${filterMarca.length === 0
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                          }`}
                      >
                        Todas
                      </button>
                      {marcasDisponibles.map(marca => {
                        const isSelected = filterMarca.includes(marca);
                        return (
                          <button
                            key={marca}
                            onClick={() => toggleArrayFilter(setFilterMarca, filterMarca, marca)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border flex items-center gap-1 ${isSelected
                                ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold shadow-xs'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                              }`}
                          >
                            {marca}
                            {isSelected && <X className="w-3 h-3 text-indigo-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Row 3: Specifications Grid (RAM, Storage, CPU) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                  {/* RAM */}
                  <div>
                    <label className="block font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Memoria RAM
                    </label>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <button
                        onClick={() => setFilterRam([])}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border ${filterRam.length === 0
                            ? 'bg-gray-800 text-white border-gray-800'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                      >
                        Todas
                      </button>
                      {ramsDisponibles.map(ram => {
                        const isSelected = filterRam.includes(ram);
                        return (
                          <button
                            key={ram}
                            onClick={() => toggleArrayFilter(setFilterRam, filterRam, ram)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${isSelected
                                ? 'bg-purple-100 text-purple-800 border-purple-300 font-bold'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                              }`}
                          >
                            {ram}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Storage */}
                  <div>
                    <label className="block font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Disco / Almacenamiento
                    </label>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <button
                        onClick={() => setFilterStorage([])}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border ${filterStorage.length === 0
                            ? 'bg-gray-800 text-white border-gray-800'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                      >
                        Todos
                      </button>
                      {storagesDisponibles.map(st => {
                        const isSelected = filterStorage.includes(st);
                        return (
                          <button
                            key={st}
                            onClick={() => toggleArrayFilter(setFilterStorage, filterStorage, st)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${isSelected
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                              }`}
                          >
                            {st}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CPU */}
                  <div>
                    <label className="block font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Procesador (CPU)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Core i5, Ryzen 7..."
                      value={filterCpu}
                      onChange={(e) => setFilterCpu(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-xs"
                    />
                  </div>
                </div>
              </div>
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
                  <th className="px-6 py-4 font-semibold text-center">Precio</th>
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
                          <div className="font-medium text-gray-900 line-clamp-1 flex items-center gap-2">
                            {laptop.modelo}
                            {laptop.borrador && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                                Borrador
                              </span>
                            )}
                            {laptop.en_oferta && (
                              <span className="text-[10px] font-black text-white bg-gradient-to-r from-red-600 to-orange-500 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 shadow-xs">
                                <Flame className="w-3 h-3 fill-white text-white shrink-0" />
                                <span>OFERTA ${laptop.precio_oferta} ({laptop.etiqueta_oferta || `-${Math.round(((Number(laptop.precio) - Number(laptop.precio_oferta)) / Number(laptop.precio)) * 100)}%`})</span>
                              </span>
                            )}

                            <div className="flex flex-col items-start gap-1 my-1">
                              {tieneEnvioPagado(laptop) && (

                                <span
                                  className="text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1"
                                  title="Envío pagado y registrado"
                                >
                                  <Banknote className="w-3 h-3" />
                                  Envío
                                </span>
                              )}
                              {tienePagoExtra(laptop) && (
                                <span
                                  className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1"
                                  title="Pago extra"
                                >
                                  <Banknote className="w-3 h-3" />
                                  Extra
                                </span>

                              )}
                            </div>

                          </div>

                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs">
                      <div className="text-gray-900 font-medium line-clamp-1 truncate max-w-[150px]" title={laptop.cpu}>{laptop.cpu}</div>
                      <div className="text-gray-500">{laptop.ram} • {laptop.almacenamiento}</div>
                    </td>

                    <td className="px-6 py-4">
                      {laptop.en_oferta ? (
                        <div>
                          <div className="font-black text-orange-600 text-sm flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500 shrink-0" />
                            <span>${laptop.precio_oferta}</span>
                          </div>
                          <div className="text-xs text-gray-400 line-through font-medium">
                            ${laptop.precio}
                          </div>
                        </div>
                      ) : (
                        <div className="font-bold text-gray-900">${laptop.precio}</div>
                      )}
                      <div className="text-xs text-gray-400 font-medium mt-0.5" title="Costo total actual">
                        Costo: ${Number(getCostoTotal(laptop) || 0).toFixed(2)}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${laptop.disponibilidad === 'Disponible'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                        }`}>
                        {laptop.disponibilidad}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      {duplicatingId === laptop.id ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                          <span className="hidden sm:inline">Duplicando...</span>
                        </div>
                      ) : deletingId === laptop.id ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-lg">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                          <span className="hidden sm:inline">Eliminando...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/admin/edit/${laptop.id}`}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors rounded-lg hidden sm:inline-flex"
                            title="Editar equipo"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => toggleActionMenu(laptop, e)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                              activeMenu?.id === laptop.id
                                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-xs ring-2 ring-blue-500/20'
                                : 'text-gray-700 bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 shadow-2xs'
                            }`}
                            title="Menú de acciones"
                          >
                            <span className="hidden md:inline font-semibold">Acciones</span>
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

      {/* Modal de Gastos Adicionales / Envío */}
      {gastosModalLaptop && (
        <GastosAdicionalesModal
          laptop={laptops.find(l => l.id === gastosModalLaptop.id) || gastosModalLaptop}
          onClose={() => setGastosModalLaptop(null)}
        />
      )}

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
      {/* MODAL RÁPIDO: REGISTRAR/EDITAR OFERTA */}
      {modalOferta.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg">
                  <Flame className="w-5 h-5 fill-orange-500/20" />
                </div>
                <span>Oferta Promocional</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOferta({ open: false, laptop: null, en_oferta: false, precio_oferta: '', etiqueta_oferta: '', saving: false })}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Equipo: <span className="font-bold text-gray-800">{modalOferta.laptop?.modelo}</span> (Precio regular: ${modalOferta.laptop?.precio} USD)
            </p>

            <form onSubmit={handleGuardarOferta} className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-200">
                <span className="text-xs font-bold text-orange-950">Activar Oferta en Catálogo</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modalOferta.en_oferta}
                    onChange={(e) => setModalOferta(p => ({ ...p, en_oferta: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>

              {modalOferta.en_oferta && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Precio Promocional ($USD)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-orange-600 font-bold">$</span>
                      <input
                        type="number" step="0.01" min="0"
                        placeholder="0.00"
                        value={modalOferta.precio_oferta}
                        onChange={e => setModalOferta(p => ({ ...p, precio_oferta: e.target.value }))}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-900 focus:ring-2 focus:ring-orange-500"
                        required={modalOferta.en_oferta}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Texto del Badge (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej: OFERTA IMPERDIBLE, 15% OFF, PRECIO ESPECIAL..."
                      value={modalOferta.etiqueta_oferta}
                      onChange={e => setModalOferta(p => ({ ...p, etiqueta_oferta: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">Si lo dejas en blanco se mostrará el porcentaje calculado (ej. -15% OFF).</p>
                  </div>

                  {Number(modalOferta.laptop?.precio) > 0 && Number(modalOferta.precio_oferta) > 0 && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">Badge a mostrar:</span>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-red-600 to-orange-500 text-white">
                        {modalOferta.etiqueta_oferta.trim() || `-${Math.round(((Number(modalOferta.laptop?.precio) - Number(modalOferta.precio_oferta)) / Number(modalOferta.laptop?.precio)) * 100)}% OFF`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOferta({ open: false, laptop: null, en_oferta: false, precio_oferta: '', etiqueta_oferta: '', saving: false })}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalOferta.saving}
                  className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {modalOferta.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {modalOferta.saving ? 'Guardando...' : 'Guardar Oferta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DROPDOWN FLOTANTE DE ACCIONES POR PORTAL */}
      {activeMenu && createPortal(
        <div
          id="actions-dropdown-menu"
          style={{
            position: 'fixed',
            zIndex: 9999,
            width: '220px',
            right: `${Math.max(12, window.innerWidth - activeMenu.rect.right)}px`,
            ...(window.innerHeight - activeMenu.rect.bottom < 280 && activeMenu.rect.top > 280
              ? { bottom: `${window.innerHeight - activeMenu.rect.top + 6}px` }
              : { top: `${activeMenu.rect.bottom + 6}px` })
          }}
          className="bg-white rounded-xl shadow-2xl border border-gray-200/80 py-1 text-xs text-gray-700 animate-in fade-in zoom-in-95 duration-100 overflow-hidden select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between gap-2">
            <span className="font-semibold text-gray-500 uppercase text-[10px] tracking-wider shrink-0">
              Acciones
            </span>
            <span className="text-[11px] font-medium text-gray-700 truncate" title={activeMenu.laptop.modelo}>
              {activeMenu.laptop.modelo}
            </span>
          </div>

          <div className="p-1 space-y-0.5">
            <Link
              to={`/admin/edit/${activeMenu.laptop.id}`}
              onClick={closeActionMenu}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium transition-colors"
            >
              <Edit className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Editar equipo</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                const lp = activeMenu.laptop;
                closeActionMenu();
                setModalOferta({
                  open: true,
                  laptop: lp,
                  en_oferta: Boolean(lp.en_oferta),
                  precio_oferta: lp.precio_oferta ? lp.precio_oferta.toString() : (lp.precio ? Math.round(Number(lp.precio) * 0.85).toString() : ''),
                  etiqueta_oferta: lp.etiqueta_oferta || '',
                  saving: false
                });
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-colors text-left ${
                activeMenu.laptop.en_oferta
                  ? 'bg-orange-50/70 text-orange-800 hover:bg-orange-100/80'
                  : 'hover:bg-orange-50/60 text-gray-700 hover:text-orange-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Flame className={`w-4 h-4 shrink-0 ${activeMenu.laptop.en_oferta ? 'text-orange-600 fill-orange-500/20' : 'text-orange-500'}`} />
                <span>{activeMenu.laptop.en_oferta ? 'Editar oferta' : 'Poner en oferta'}</span>
              </div>
              {activeMenu.laptop.en_oferta && (
                <span className="text-[10px] font-bold bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-full">
                  Activa
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                const id = activeMenu.laptop.id;
                closeActionMenu();
                handleDuplicateLaptops([id]);
              }}
              disabled={duplicatingId === activeMenu.laptop.id || duplicatingId === 'bulk'}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-purple-50 text-gray-700 hover:text-purple-700 font-medium transition-colors text-left disabled:opacity-50"
            >
              <Copy className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Duplicar equipo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const lp = activeMenu.laptop;
                closeActionMenu();
                setGastosModalLaptop(lp);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 font-medium transition-colors text-left"
            >
              <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Gastos / Envío</span>
            </button>

            <Link
              to={`/admin/delivery/${activeMenu.laptop.id}`}
              onClick={closeActionMenu}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-teal-50 text-gray-700 hover:text-teal-700 font-medium transition-colors"
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
                const lp = activeMenu.laptop;
                closeActionMenu();
                handleDeleteClick(lp.id, lp.modelo);
              }}
              disabled={deletingId === activeMenu.laptop.id || deletingId === 'bulk'}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 hover:text-red-700 font-medium transition-colors text-left disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 text-red-600 shrink-0" />
              <span>Eliminar equipo</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
