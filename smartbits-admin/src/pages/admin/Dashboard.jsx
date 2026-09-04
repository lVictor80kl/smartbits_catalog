import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  PlusCircle, Edit, Trash2, Loader2, FileText, Download, 
  Package, Wrench, Banknote, SlidersHorizontal, RotateCcw, 
  ChevronDown, ChevronUp, X, Copy, Flame, MoreVertical,
  LayoutGrid, List, Search, Laptop, DollarSign, CheckCircle2,
  Clock, AlertCircle, ArrowUpDown, Cpu, HardDrive, MemoryStick, Eye,
  TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import GastosAdicionalesModal from '../../components/GastosAdicionalesModal';
import { tieneEnvioPagado, tienePagoExtra, getCostoTotal } from '../../utils/costos';

export default function Dashboard() {
  const [laptops, setLaptops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  
  // Vista: tabla o cuadrícula
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('smartbits_admin_view_mode') || 'table';
  });

  // Filtros
  const [filterDisp, setFilterDisp] = useState([]);
  const [filterMarca, setFilterMarca] = useState([]);
  const [filterRam, setFilterRam] = useState([]);
  const [filterStorage, setFilterStorage] = useState([]);
  const [filterCpu, setFilterCpu] = useState('');
  const [filterOfertasOnly, setFilterOfertasOnly] = useState(false);
  const [filterBorradoresOnly, setFilterBorradoresOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [priceSort, setPriceSort] = useState('asc');
  
  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Modales
  const [showDeleteModal, setShowDeleteModal] = useState({ show: false, ids: [], names: '' });
  const [gastosModalLaptop, setGastosModalLaptop] = useState(null);
  const [modalOferta, setModalOferta] = useState({ 
    open: false, laptop: null, en_oferta: false, precio_oferta: '', etiqueta_oferta: '', saving: false 
  });
  const [activeMenu, setActiveMenu] = useState(null);

  // Guardar preferencia de vista
  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('smartbits_admin_view_mode', mode);
  };

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

  // Cargar datos en tiempo real de Firestore
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

  // Estado para alternar entre ver el valor total del inventario o solo de las disponibles
  const [valorDisplayMode, setValorDisplayMode] = useState('total'); // 'total' | 'disponibles'

  // Métricas para Bento KPIs (cuadradas exactamente con Finanzas -> Inventario)
  const stats = useMemo(() => {
    const total = laptops.length;
    const disponibles = laptops.filter(l => l.disponibilidad === 'Disponible');
    const comingSoon = laptops.filter(l => l.disponibilidad === 'Coming soon');
    const activas = laptops.filter(l => l.disponibilidad === 'Disponible' || l.disponibilidad === 'Coming soon');
    const enOferta = laptops.filter(l => Boolean(l.en_oferta));
    const borradores = laptops.filter(l => Boolean(l.borrador));

    // Costo de adquisición real (Finanzas)
    const costoInvTotal = activas.reduce((acc, l) => acc + (getCostoTotal(l) || 0), 0);
    const costoInvDisponibles = disponibles.reduce((acc, l) => acc + (getCostoTotal(l) || 0), 0);
    const costoInvComingSoon = comingSoon.reduce((acc, l) => acc + (getCostoTotal(l) || 0), 0);

    // Helper para obtener el precio de venta real/efectivo (considera oferta si está activa)
    const getPrecioVenta = (l) => {
      if (l.en_oferta && Number(l.precio_oferta) > 0) return Number(l.precio_oferta);
      return Number(l.precio) || 0;
    };

    // Precios de venta al público (PVP)
    const pvpTotal = activas.reduce((acc, l) => acc + getPrecioVenta(l), 0);
    const pvpDisponibles = disponibles.reduce((acc, l) => acc + getPrecioVenta(l), 0);

    // Ganancia total estimada (Precio de venta - Costo real)
    const gananciaTotal = activas.reduce((acc, l) => {
      const precio = getPrecioVenta(l);
      const costo = getCostoTotal(l) || 0;
      return acc + (precio - costo);
    }, 0);

    const gananciaDisponibles = disponibles.reduce((acc, l) => {
      const precio = getPrecioVenta(l);
      const costo = getCostoTotal(l) || 0;
      return acc + (precio - costo);
    }, 0);

    const promedioPrecio = disponibles.length > 0 
      ? Math.round(pvpDisponibles / disponibles.length) 
      : 0;

    return {
      total,
      disponiblesCount: disponibles.length,
      comingSoonCount: comingSoon.length,
      activasCount: activas.length,
      enOfertaCount: enOferta.length,
      borradoresCount: borradores.length,
      // Costos idénticos a Finanzas
      costoInvTotal,
      costoInvDisponibles,
      costoInvComingSoon,
      // PVP venta y Ganancias
      pvpTotal,
      pvpDisponibles,
      gananciaTotal,
      gananciaDisponibles,
      promedioPrecio
    };
  }, [laptops]);

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

    const filterParts = [];
    if (filterMarca.length > 0) filterParts.push(`Marcas: ${filterMarca.join(', ')}`);
    if (filterDisp.length > 0) filterParts.push(`Disponibilidad: ${filterDisp.join(', ')}`);
    if (filterRam.length > 0) filterParts.push(`RAM: ${filterRam.join(', ')}`);
    if (filterStorage.length > 0) filterParts.push(`Almacenamiento: ${filterStorage.join(', ')}`);
    if (filterCpu.trim()) filterParts.push(`CPU: "${filterCpu}"`);
    if (filterOfertasOnly) filterParts.push(`Solo Ofertas`);
    if (filterBorradoresOnly) filterParts.push(`Solo Borradores`);
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
        <h1 style="text-align: center; font-size: 18px; font-weight: 700; color: #1a1a1a; border-bottom: 3px solid #0d9488; padding-bottom: 8px; margin-bottom: 6px; letter-spacing: 2px;">
          LISTADO DE INVENTARIO
        </h1>
        <p style="text-align: center; font-size: 11px; color: #888; margin-bottom: 20px;">
          ${filterText} — ${filteredLaptops.length} equipo${filteredLaptops.length !== 1 ? 's' : ''} — Generado: ${now.toLocaleDateString('es-VE')}
        </p>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f0fdfa; border-bottom: 2px solid #0d9488;">
              <th style="padding: 8px 10px; text-align: center; color: #0d9488; font-weight: 700; font-size: 10px; text-transform: uppercase; width: 40px;">#</th>
              <th style="padding: 8px 10px; text-align: left; color: #0d9488; font-weight: 700; font-size: 10px; text-transform: uppercase;">Equipo</th>
              <th style="padding: 8px 10px; text-align: left; color: #0d9488; font-weight: 700; font-size: 10px; text-transform: uppercase;">Especificaciones</th>
              <th style="padding: 8px 10px; text-align: center; color: #0d9488; font-weight: 700; font-size: 10px; text-transform: uppercase;">Estado</th>
              <th style="padding: 8px 10px; text-align: right; color: #0d9488; font-weight: 700; font-size: 10px; text-transform: uppercase;">Precio</th>
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
    (filterOfertasOnly ? 1 : 0) +
    (filterBorradoresOnly ? 1 : 0) +
    (searchTerm.trim() !== '' ? 1 : 0);

  const clearAllFilters = () => {
    setFilterDisp([]);
    setFilterMarca([]);
    setFilterRam([]);
    setFilterStorage([]);
    setFilterCpu('');
    setFilterOfertasOnly(false);
    setFilterBorradoresOnly(false);
    setSearchTerm('');
    setPriceSort('asc');
  };

  // Filtrado y ordenamiento
  const filteredLaptops = laptops
    .filter(laptop => {
      const matchDisp = filterDisp.length === 0 || filterDisp.includes(laptop.disponibilidad);
      const matchMarca = filterMarca.length === 0 || filterMarca.includes(laptop.marca);
      const matchRam = filterRam.length === 0 || filterRam.includes(laptop.ram?.trim());
      const matchStorage = filterStorage.length === 0 || filterStorage.includes(laptop.almacenamiento?.trim());
      const matchCpu = !filterCpu.trim() || (laptop.cpu || '').toLowerCase().includes(filterCpu.toLowerCase().trim());
      const matchOferta = !filterOfertasOnly || Boolean(laptop.en_oferta);
      const matchBorrador = !filterBorradoresOnly || Boolean(laptop.borrador);
      const matchSearch = !searchTerm.trim() ||
        laptop.modelo.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (laptop.marca || '').toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (laptop.cpu || '').toLowerCase().includes(searchTerm.toLowerCase().trim());

      return matchDisp && matchMarca && matchRam && matchStorage && matchCpu && matchOferta && matchBorrador && matchSearch;
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
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* 1. Header Principal con Acciones Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-white p-4 sm:p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-50 text-brand-700 rounded-xl shrink-0">
              <Laptop className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Inventario de Equipos</h1>
              <p className="text-gray-500 text-xs font-medium mt-0.5">
                {loading ? 'Sincronizando inventario...' : `${filteredLaptops.length} de ${laptops.length} equipos mostrados`}
              </p>
            </div>
          </div>
        </div>

        {/* Botones de acción en móvil: scroll horizontal suave / flex wrap */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap w-full sm:w-auto">
          <button
            onClick={handleExportPDF}
            disabled={loading || filteredLaptops.length === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl transition-all shadow-2xs active:scale-[0.98] disabled:opacity-50 shrink-0"
            title="Exportar listado actual a PDF imprimible"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden xs:inline sm:inline">Exportar PDF</span>
            <span className="xs:hidden sm:hidden">PDF</span>
          </button>

          <Link
            to="/admin/components/new"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all shadow-2xs active:scale-[0.98] shrink-0"
          >
            <Package className="w-3.5 h-3.5" />
            <span>Componente</span>
          </Link>

          <Link
            to="/admin/service"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all shadow-2xs active:scale-[0.98] shrink-0"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Servicio Técnico</span>
            <span className="sm:hidden">Servicio</span>
          </Link>

          <Link
            to="/admin/new"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all shadow-sm shadow-brand-600/20 active:scale-[0.98] shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Añadir</span>
          </Link>
        </div>
      </div>

      {/* 2. Bento Grid: KPIs Ejecutivos e Interactivos Adaptados a Móvil */}
      {!loading && laptops.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Tarjeta 1: Total Equipos */}
          <div 
            onClick={() => clearAllFilters()}
            className="p-3.5 sm:p-4 bg-white rounded-2xl border border-gray-200/80 shadow-2xs hover:shadow-xs hover:border-brand-300 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-400 group-hover:text-brand-600 transition-colors">
                Total Equipos
              </span>
              <div className="p-1.5 bg-gray-50 rounded-lg text-gray-600 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                <Laptop className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-xl sm:text-2xl font-black text-gray-900">{stats.total}</span>
              {stats.borradoresCount > 0 && (
                <span className="text-[9px] sm:text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                  {stats.borradoresCount} borrador{stats.borradoresCount > 1 ? 'es' : ''}
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1 truncate">En base de datos</p>
          </div>

          {/* Tarjeta 2: Disponibles */}
          <div 
            onClick={() => {
              setFilterDisp(prev => prev.length === 1 && prev[0] === 'Disponible' ? [] : ['Disponible']);
            }}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer group ${
              filterDisp.includes('Disponible') && filterDisp.length === 1
                ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-white border-gray-200/80 shadow-2xs hover:shadow-xs hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Disponibles
              </span>
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-xl sm:text-2xl font-black text-emerald-700">{stats.disponiblesCount}</span>
              <span className="text-[10px] sm:text-[11px] font-medium text-emerald-600/80">
                ({Math.round((stats.disponiblesCount / (stats.total || 1)) * 100)}%)
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1 truncate">
              En stock para venta
            </p>
          </div>

          {/* Tarjeta 3: En Oferta */}
          <div 
            onClick={() => setFilterOfertasOnly(!filterOfertasOnly)}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer group ${
              filterOfertasOnly
                ? 'bg-orange-50/70 border-orange-300 ring-2 ring-orange-500/20 shadow-xs'
                : 'bg-white border-gray-200/80 shadow-2xs hover:shadow-xs hover:border-orange-300'
            }`}
          >
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-orange-700 flex items-center gap-1">
                <span>En Oferta</span>
                <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-500 fill-orange-500" />
              </span>
              <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg">
                <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-orange-500/20" />
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-xl sm:text-2xl font-black text-orange-600">{stats.enOfertaCount}</span>
              <span className="text-[10px] sm:text-[11px] font-bold text-orange-600/90 truncate">
                {stats.enOfertaCount > 0 ? 'Activas' : 'Sin ofertas'}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1 truncate">
              {filterOfertasOnly ? 'Filtro activo' : 'Clic para filtrar'}
            </p>
          </div>

          {/* Tarjeta 4: Valoración Total (Sincronizada con Finanzas - Ancho completo en móvil) */}
          <div className="col-span-2 lg:col-span-1 p-3.5 sm:p-4 bg-white rounded-2xl border border-gray-200/80 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Valor Inv. (Finanzas)
                  </span>
                  <span className="text-[9px] font-extrabold bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-100">
                    Costo
                  </span>
                </div>

                {/* Selector rápido: Total vs Solo Disponibles */}
                <div className="flex items-center p-0.5 bg-gray-100 rounded-lg text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setValorDisplayMode('total')}
                    className={`px-2 py-0.5 rounded-md transition-all ${
                      valorDisplayMode === 'total'
                        ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    title="Ver valor total de laptops activas (Disponibles + Coming soon)"
                  >
                    Total
                  </button>
                  <button
                    type="button"
                    onClick={() => setValorDisplayMode('disponibles')}
                    className={`px-2 py-0.5 rounded-md transition-all ${
                      valorDisplayMode === 'disponibles'
                        ? 'bg-white text-emerald-700 shadow-2xs font-extrabold'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    title="Ver valor de laptops disponibles"
                  >
                    Disp.
                  </button>
                </div>
              </div>

              {/* Monto Principal Seleccionado */}
              <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  ${(valorDisplayMode === 'total' ? stats.costoInvTotal : stats.costoInvDisponibles).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-gray-400 font-bold uppercase">USD</span>
              </div>

              <p className="text-[10px] sm:text-[11px] font-medium text-gray-500 mt-0.5">
                {valorDisplayMode === 'total' 
                  ? `Total activo (${stats.activasCount} laptops: Disp + CS)` 
                  : `Solo disponibles (${stats.disponiblesCount} laptops en stock)`
                }
              </p>
            </div>

            {/* Desglose comparativo Total vs Disponibles y Ganancia Total */}
            <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 text-gray-500">
                <span className="text-gray-400 font-medium">
                  {valorDisplayMode === 'total' ? 'Disp:' : 'Total:'}
                </span>
                <span className="font-bold text-gray-800">
                  ${(valorDisplayMode === 'total' ? stats.costoInvDisponibles : stats.costoInvTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div 
                className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-2xs" 
                title="Ganancia total proyectada de los equipos seleccionados (Precio de venta - Costo de adquisición)"
              >
                <TrendingUp className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>Ganancia total: +${(valorDisplayMode === 'total' ? stats.gananciaTotal : stats.gananciaDisponibles).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Toolbar Principal de Búsqueda, Filtros y Selector de Vista */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden transition-all">
        
        {/* Barra superior de herramientas */}
        <div className="p-3.5 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Input de Búsqueda Omnibox */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar modelo, marca, CPU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-gray-50/70 hover:bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Controles de Vista, Filtros y Orden */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 flex-wrap">
            
            {/* Orden por Precio */}
            <div className="relative flex-1 sm:flex-initial min-w-[125px]">
              <select
                value={priceSort}
                onChange={(e) => setPriceSort(e.target.value)}
                className="w-full appearance-none pl-7 pr-7 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none shadow-2xs cursor-pointer transition-all"
              >
                <option value="asc">Precio: Menor</option>
                <option value="desc">Precio: Mayor</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Toggle Filtros Avanzados */}
            <button
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shadow-2xs ${
                showFiltersPanel || activeFiltersCount > 0
                  ? 'bg-brand-50 border-brand-300 text-brand-700 ring-2 ring-brand-500/10'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="bg-brand-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Selector de Modo de Vista (Tabla vs Cuadrícula) */}
            <div className="flex items-center p-1 bg-gray-100 rounded-xl border border-gray-200/80">
              <button
                type="button"
                onClick={() => handleSetViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-brand-700 shadow-2xs font-bold'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
                title="Vista de Tabla / Lista"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-brand-700 shadow-2xs font-bold'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
                title="Vista de Cuadrícula (Cards)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Botón de limpiar filtros activos */}
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-bold transition-colors"
                title="Limpiar todos los filtros"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {/* Chips de estado rápido (Quick Pills con scroll táctil horizontal en móvil) */}
        <div className="px-3.5 sm:px-5 py-2.5 flex items-center gap-1.5 border-t border-gray-100 bg-gray-50/40 text-xs overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-0.5">Rápido:</span>
          
          <button
            onClick={() => {
              setFilterDisp([]);
              setFilterOfertasOnly(false);
              setFilterBorradoresOnly(false);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
              filterDisp.length === 0 && !filterOfertasOnly && !filterBorradoresOnly
                ? 'bg-gray-900 text-white shadow-2xs'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            Todos ({laptops.length})
          </button>

          <button
            onClick={() => {
              setFilterDisp(prev => prev.includes('Disponible') && prev.length === 1 ? [] : ['Disponible']);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              filterDisp.includes('Disponible') && filterDisp.length === 1
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Disponibles ({stats.disponiblesCount})
          </button>

          <button
            onClick={() => setFilterOfertasOnly(!filterOfertasOnly)}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              filterOfertasOnly
                ? 'bg-orange-600 text-white shadow-2xs'
                : 'bg-white text-orange-700 border border-orange-200 hover:bg-orange-50'
            }`}
          >
            <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
            Ofertas ({stats.enOfertaCount})
          </button>

          <button
            onClick={() => {
              setFilterDisp(prev => prev.includes('Coming soon') && prev.length === 1 ? [] : ['Coming soon']);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              filterDisp.includes('Coming soon') && filterDisp.length === 1
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
            }`}
          >
            <Clock className="w-3 h-3" />
            Coming Soon ({stats.comingSoonCount})
          </button>

          <button
            onClick={() => setFilterBorradoresOnly(!filterBorradoresOnly)}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              filterBorradoresOnly
                ? 'bg-slate-700 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            Borradores ({stats.borradoresCount})
          </button>
        </div>

        {/* Panel Colapsable de Filtros Avanzados (Marca, RAM, Disco, CPU) */}
        {showFiltersPanel && (
          <div className="p-5 border-t border-gray-200 bg-gray-50/80 space-y-4 text-xs animate-in slide-in-from-top-2 duration-150">
            
            {/* Fila: Marcas */}
            {marcasDisponibles.length > 0 && (
              <div>
                <label className="block font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Marcas
                </label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <button
                    onClick={() => setFilterMarca([])}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all border ${
                      filterMarca.length === 0
                        ? 'bg-brand-600 text-white border-brand-600 shadow-2xs'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
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
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all border flex items-center gap-1 ${
                          isSelected
                            ? 'bg-brand-50 text-brand-800 border-brand-300 shadow-2xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {marca}
                        {isSelected && <X className="w-3 h-3 text-brand-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cuadrícula de Especificaciones (RAM, Almacenamiento, CPU) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-gray-200/60">
              {/* RAM */}
              <div>
                <label className="block font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Memoria RAM
                </label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <button
                    onClick={() => setFilterRam([])}
                    className={`px-2.5 py-1 rounded-lg font-medium border ${
                      filterRam.length === 0
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
                        className={`px-2.5 py-1 rounded-lg font-medium border transition-all ${
                          isSelected
                            ? 'bg-purple-100 text-purple-900 border-purple-300 font-bold'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {ram}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Almacenamiento */}
              <div>
                <label className="block font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Almacenamiento (Disco)
                </label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <button
                    onClick={() => setFilterStorage([])}
                    className={`px-2.5 py-1 rounded-lg font-medium border ${
                      filterStorage.length === 0
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
                        className={`px-2.5 py-1 rounded-lg font-medium border transition-all ${
                          isSelected
                            ? 'bg-cyan-100 text-cyan-900 border-cyan-300 font-bold'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filtro CPU */}
              <div>
                <label className="block font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Procesador (CPU)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ej: Core i5, Ryzen 7..."
                    value={filterCpu}
                    onChange={(e) => setFilterCpu(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  />
                  {filterCpu && (
                    <button
                      onClick={() => setFilterCpu('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Contenido Principal: Estados de Carga, Vacío, Tabla o Cuadrícula */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            <p className="text-sm font-medium text-gray-500">Cargando inventario de Smartbits...</p>
          </div>
        ) : laptops.length === 0 ? (
          <div className="py-20 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4">
              <Laptop className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-gray-900">No hay equipos registrados</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Empieza agregando tu primera laptop al catálogo para gestionarla aquí.
            </p>
            <Link 
              to="/admin/new" 
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Añadir Laptop
            </Link>
          </div>
        ) : filteredLaptops.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">No se encontraron coincidencias</h3>
            <p className="text-xs text-gray-500 mt-1">
              Prueba cambiando o limpiando los filtros de búsqueda aplicados.
            </p>
            <button
              onClick={clearAllFilters}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restablecer Filtros
            </button>
          </div>
        ) : viewMode === 'table' ? (
          
          <div>
            {/* ===== VISTA DE LISTA COMPACTA ADAPTADA A CELULAR (md:hidden) ===== */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredLaptops.map(laptop => (
                <div
                  key={laptop.id}
                  className={`p-3.5 flex flex-col gap-2.5 transition-colors ${
                    selectedIds.includes(laptop.id) ? 'bg-brand-50/40' : 'hover:bg-gray-50/60'
                  }`}
                >
                  {/* Fila superior: Checkbox, Miniatura, Título, Estado */}
                  <div className="flex items-start gap-2.5">
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        checked={selectedIds.includes(laptop.id)}
                        onChange={() => toggleSelect(laptop.id)}
                      />
                    </div>

                    <div className="h-12 w-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                      <img
                        src={laptop.imagen || '/default-laptop.png'}
                        alt={laptop.modelo}
                        onError={(e) => { e.target.onerror = null; e.target.src = '/default-laptop.png'; }}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-gray-900 text-xs line-clamp-1">
                          {laptop.modelo}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          laptop.disponibilidad === 'Disponible'
                            ? 'bg-emerald-100 text-emerald-800'
                            : laptop.disponibilidad === 'Coming soon'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                        }`}>
                          {laptop.disponibilidad}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {laptop.marca && (
                          <span className="text-[9px] font-black uppercase text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {laptop.marca}
                          </span>
                        )}
                        {laptop.borrador && (
                          <span className="text-[9px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                            Borrador
                          </span>
                        )}
                        {laptop.en_oferta && (
                          <span className="text-[9px] font-black text-white bg-gradient-to-r from-red-600 to-orange-500 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Flame className="w-2.5 h-2.5 fill-white" />
                            <span>OFERTA ${laptop.precio_oferta}</span>
                          </span>
                        )}
                        {tieneEnvioPagado(laptop) && (
                          <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Envío
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Fila intermedia: Especificaciones técnicas */}
                  <div className="ml-6 flex items-center gap-1.5 text-[11px] text-gray-600 flex-wrap">
                    <span className="font-medium text-gray-800 truncate max-w-[150px]">{laptop.cpu || 'Sin CPU'}</span>
                    <span>•</span>
                    <span className="bg-gray-100 px-1.5 py-0.2 rounded font-medium">{laptop.ram || '—'}</span>
                    <span>•</span>
                    <span className="bg-gray-100 px-1.5 py-0.2 rounded font-medium">{laptop.almacenamiento || '—'}</span>
                    {laptop.pantalla && (
                      <>
                        <span>•</span>
                        <span className="text-gray-500">{laptop.pantalla}</span>
                      </>
                    )}
                  </div>

                  {/* Fila inferior: Precio, Costo y Acciones */}
                  <div className="ml-6 pt-1.5 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      {laptop.en_oferta ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-black text-orange-600 text-sm">${laptop.precio_oferta}</span>
                          <span className="text-[10px] text-gray-400 line-through">${laptop.precio}</span>
                        </div>
                      ) : (
                        <div className="font-extrabold text-gray-900 text-sm">${laptop.precio}</div>
                      )}
                      <div className="text-[10px] text-gray-400 font-medium">
                        Costo: ${Number(getCostoTotal(laptop) || 0).toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Link
                        to={`/admin/edit/${laptop.id}`}
                        className="p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        title="Editar equipo"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => toggleActionMenu(laptop, e)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl border border-gray-200 bg-white text-gray-700 shadow-2xs hover:bg-gray-50 active:scale-[0.98]"
                      >
                        <span>Opciones</span>
                        <MoreVertical className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ===== VISTA DE TABLA COMPLETA PARA ESCRITORIO (hidden md:block) ===== */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 text-[11px] uppercase tracking-wider font-bold">
                  <th className="px-5 py-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      checked={filteredLaptops.length > 0 && selectedIds.length === filteredLaptops.length}
                      onChange={toggleSelectAll}
                      title="Seleccionar todos los mostrados"
                    />
                  </th>
                  <th className="px-5 py-3.5">Equipo / Modelo</th>
                  <th className="px-5 py-3.5">Especificaciones</th>
                  <th className="px-5 py-3.5 text-center">Precio ($USD)</th>
                  <th className="px-5 py-3.5 text-center">Disponibilidad</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredLaptops.map(laptop => (
                  <tr 
                    key={laptop.id} 
                    className={`hover:bg-gray-50/80 transition-colors group ${
                      selectedIds.includes(laptop.id) ? 'bg-brand-50/30' : ''
                    }`}
                  >
                    {/* Checkbox de selección */}
                    <td className="px-5 py-3.5 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        checked={selectedIds.includes(laptop.id)}
                        onChange={() => toggleSelect(laptop.id)}
                      />
                    </td>

                    {/* Equipo / Modelo e Imagen */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3.5">
                        <div className="h-12 w-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center p-1 shrink-0 overflow-hidden group-hover:border-gray-200 transition-colors">
                          <img
                            src={laptop.imagen || '/default-laptop.png'}
                            alt={laptop.modelo}
                            onError={(e) => { e.target.onerror = null; e.target.src = '/default-laptop.png'; }}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 line-clamp-1 flex items-center gap-2">
                            <span>{laptop.modelo}</span>

                            {laptop.borrador && (
                              <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md shrink-0">
                                Borrador
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            {laptop.marca && (
                              <span className="text-[10px] font-black uppercase text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                {laptop.marca}
                              </span>
                            )}

                            {laptop.en_oferta && (
                              <span className="text-[10px] font-black text-white bg-gradient-to-r from-red-600 to-orange-500 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 shadow-2xs">
                                <Flame className="w-3 h-3 fill-white text-white shrink-0" />
                                <span>${laptop.precio_oferta} ({laptop.etiqueta_oferta || `-${Math.round(((Number(laptop.precio) - Number(laptop.precio_oferta)) / Number(laptop.precio)) * 100)}%`})</span>
                              </span>
                            )}

                            {tieneEnvioPagado(laptop) && (
                              <span
                                className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1"
                                title="Envío pagado y registrado"
                              >
                                <Banknote className="w-3 h-3" />
                                Envío
                              </span>
                            )}

                            {tienePagoExtra(laptop) && (
                              <span
                                className="text-[10px] font-bold text-blue-800 bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1"
                                title="Pago extra"
                              >
                                <Banknote className="w-3 h-3" />
                                Extra
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Specs Rápidas */}
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-800 line-clamp-1 truncate max-w-[200px]" title={laptop.cpu}>
                        {laptop.cpu || '—'}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-gray-500 text-[11px]">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded font-medium">{laptop.ram || '—'}</span>
                        <span>•</span>
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded font-medium">{laptop.almacenamiento || '—'}</span>
                        {laptop.pantalla && (
                          <>
                            <span>•</span>
                            <span>{laptop.pantalla}{laptop.touch?.toLowerCase() === 'sí' ? ' (Touch)' : ''}</span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Precio & Costo */}
                    <td className="px-5 py-3.5 text-center">
                      {laptop.en_oferta ? (
                        <div>
                          <div className="font-black text-orange-600 text-sm flex items-center justify-center gap-1">
                            <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500 shrink-0" />
                            <span>${laptop.precio_oferta}</span>
                          </div>
                          <div className="text-[11px] text-gray-400 line-through font-medium">
                            ${laptop.precio}
                          </div>
                        </div>
                      ) : (
                        <div className="font-extrabold text-gray-900 text-sm">${laptop.precio}</div>
                      )}
                      <div className="text-[10px] text-gray-400 font-medium mt-0.5" title="Costo total de adquisición">
                        Costo: ${Number(getCostoTotal(laptop) || 0).toFixed(2)}
                      </div>
                    </td>

                    {/* Disponibilidad */}
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        laptop.disponibilidad === 'Disponible'
                          ? 'bg-emerald-100 text-emerald-800'
                          : laptop.disponibilidad === 'Coming soon'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          laptop.disponibilidad === 'Disponible' 
                            ? 'bg-emerald-500' 
                            : laptop.disponibilidad === 'Coming soon' 
                              ? 'bg-amber-500' 
                              : 'bg-rose-500'
                        }`} />
                        {laptop.disponibilidad}
                      </span>
                    </td>

                    {/* Botón de Acciones */}
                    <td className="px-5 py-3.5 text-right">
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
                            className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors rounded-lg hidden sm:inline-flex"
                            title="Editar equipo"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => toggleActionMenu(laptop, e)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                              activeMenu?.id === laptop.id
                                ? 'bg-brand-50 text-brand-700 border-brand-300 shadow-2xs ring-2 ring-brand-500/20'
                                : 'text-gray-700 bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 shadow-2xs'
                            }`}
                            title="Menú de acciones"
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
          </div>
        ) : (

          /* ===== VISTA DE CUADRÍCULA (GRID CARDS) ===== */
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredLaptops.map(laptop => (
              <div
                key={laptop.id}
                className={`bg-white rounded-2xl border transition-all flex flex-col justify-between overflow-hidden group hover:shadow-md ${
                  selectedIds.includes(laptop.id) 
                    ? 'border-brand-400 ring-2 ring-brand-500/20 shadow-xs' 
                    : 'border-gray-200/90 hover:border-gray-300'
                }`}
              >
                {/* Cabecera de la Tarjeta con Imagen y Checkbox */}
                <div className="relative bg-gray-50 p-4 pb-2 flex items-center justify-center h-44 border-b border-gray-100 overflow-hidden">
                  <div className="absolute top-3 left-3 z-10">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      checked={selectedIds.includes(laptop.id)}
                      onChange={() => toggleSelect(laptop.id)}
                    />
                  </div>

                  <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      laptop.disponibilidad === 'Disponible'
                        ? 'bg-emerald-100 text-emerald-800'
                        : laptop.disponibilidad === 'Coming soon'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                    }`}>
                      {laptop.disponibilidad}
                    </span>

                    {laptop.borrador && (
                      <span className="text-[9px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                        Borrador
                      </span>
                    )}
                  </div>

                  <img
                    src={laptop.imagen || '/default-laptop.png'}
                    alt={laptop.modelo}
                    onError={(e) => { e.target.onerror = null; e.target.src = '/default-laptop.png'; }}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
                  />

                  {laptop.en_oferta && (
                    <div className="absolute bottom-2 left-2 z-10">
                      <span className="text-[10px] font-black text-white bg-gradient-to-r from-red-600 to-orange-500 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                        <Flame className="w-3 h-3 fill-white" />
                        <span>OFERTA ${laptop.precio_oferta}</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Contenido / Specs de la Laptop */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                      <span>{laptop.marca || 'Genérica'}</span>
                      {tieneEnvioPagado(laptop) && (
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[9px] font-bold">
                          Envío Pagado
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-gray-900 text-sm line-clamp-1 group-hover:text-brand-700 transition-colors" title={laptop.modelo}>
                      {laptop.modelo}
                    </h4>

                    {/* Chips de Especificaciones */}
                    <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                      <div className="flex items-center gap-1.5 font-medium truncate" title={laptop.cpu}>
                        <Cpu className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{laptop.cpu || 'Sin CPU'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500 font-medium">
                        <div className="flex items-center gap-1">
                          <MemoryStick className="w-3.5 h-3.5 text-gray-400" />
                          <span>{laptop.ram || '—'}</span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <HardDrive className="w-3.5 h-3.5 text-gray-400" />
                          <span>{laptop.almacenamiento || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Precios y Botón de Opciones */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      {laptop.en_oferta ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-black text-orange-600">${laptop.precio_oferta}</span>
                          <span className="text-xs text-gray-400 line-through">${laptop.precio}</span>
                        </div>
                      ) : (
                        <span className="text-base font-black text-gray-900">${laptop.precio}</span>
                      )}
                      <div className="text-[10px] text-gray-400 font-medium">
                        Costo: ${Number(getCostoTotal(laptop) || 0).toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Link
                        to={`/admin/edit/${laptop.id}`}
                        className="p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => toggleActionMenu(laptop, e)}
                        className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Opciones"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Dock Flotante de Acciones Masivas (Posicionado sobre el menú móvil inferior) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-950/95 backdrop-blur-md text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl shadow-2xl border border-gray-800 flex items-center justify-between gap-2.5 sm:gap-4 max-w-[95%] sm:max-w-md w-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-1.5 pr-2 border-r border-gray-800 shrink-0">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
            <span className="text-xs font-bold">
              {selectedIds.length} <span className="hidden sm:inline">seleccionado{selectedIds.length !== 1 ? 's' : ''}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => handleDuplicateLaptops(selectedIds)}
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

      {/* 6. Modal de Gastos Adicionales / Envíos */}
      {gastosModalLaptop && (
        <GastosAdicionalesModal
          laptop={laptops.find(l => l.id === gastosModalLaptop.id) || gastosModalLaptop}
          onClose={() => setGastosModalLaptop(null)}
        />
      )}

      {/* 7. Modal de Confirmación de Eliminación */}
      {showDeleteModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-5 text-rose-600">
              <Trash2 className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">
              {showDeleteModal.ids.length === 1 ? '¿Eliminar equipo?' : '¿Eliminar selección?'}
            </h3>

            <p className="text-gray-500 text-center text-xs sm:text-sm mb-6 leading-relaxed">
              Estás a punto de eliminar {showDeleteModal.ids.length === 1 ? 'un equipo' : `${showDeleteModal.ids.length} equipos`}.
              Esta acción es permanente y no se podrá revertir.
            </p>

            <div className="bg-gray-50 rounded-xl p-3.5 mb-6 max-h-32 overflow-y-auto border border-gray-200/70 text-xs">
              <p className="font-bold text-gray-400 uppercase tracking-widest mb-1">Elementos:</p>
              <p className="text-gray-700 font-medium leading-normal">{showDeleteModal.names}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal({ show: false, ids: [], names: '' })}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs sm:text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingId !== null}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-sm shadow-rose-600/20"
              >
                {deletingId !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {showDeleteModal.ids.length === 1 ? 'Sí, eliminar' : 'Sí, eliminar todos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal de Oferta Rápida */}
      {modalOferta.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-150 border border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
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
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none"
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

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOferta({ open: false, laptop: null, en_oferta: false, precio_oferta: '', etiqueta_oferta: '', saving: false })}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalOferta.saving}
                  className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs sm:text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-orange-600/20"
                >
                  {modalOferta.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {modalOferta.saving ? 'Guardando...' : 'Guardar Oferta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Dropdown Flotante de Acciones (Portal en document.body) */}
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
            <span className="text-[11px] font-bold text-gray-800 truncate" title={activeMenu.laptop.modelo}>
              {activeMenu.laptop.modelo}
            </span>
          </div>

          <div className="p-1 space-y-0.5">
            <Link
              to={`/admin/edit/${activeMenu.laptop.id}`}
              onClick={closeActionMenu}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-brand-50 text-gray-700 hover:text-brand-700 font-semibold transition-colors"
            >
              <Edit className="w-4 h-4 text-brand-600 shrink-0" />
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
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-colors text-left ${
                activeMenu.laptop.en_oferta
                  ? 'bg-orange-50 text-orange-800 hover:bg-orange-100'
                  : 'hover:bg-orange-50 text-gray-700 hover:text-orange-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Flame className={`w-4 h-4 shrink-0 ${activeMenu.laptop.en_oferta ? 'text-orange-600 fill-orange-500' : 'text-orange-500'}`} />
                <span>{activeMenu.laptop.en_oferta ? 'Editar oferta' : 'Poner en oferta'}</span>
              </div>
              {activeMenu.laptop.en_oferta && (
                <span className="text-[9px] font-black bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded-full">
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
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-purple-50 text-gray-700 hover:text-purple-700 font-semibold transition-colors text-left disabled:opacity-50"
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
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 font-semibold transition-colors text-left"
            >
              <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Gastos / Envío</span>
            </button>

            <Link
              to={`/admin/delivery/${activeMenu.laptop.id}`}
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
                const lp = activeMenu.laptop;
                closeActionMenu();
                handleDeleteClick(lp.id, lp.modelo);
              }}
              disabled={deletingId === activeMenu.laptop.id || deletingId === 'bulk'}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-semibold transition-colors text-left disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Eliminar equipo</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
