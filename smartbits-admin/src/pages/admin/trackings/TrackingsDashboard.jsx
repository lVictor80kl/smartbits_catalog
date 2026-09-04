import { useState, useEffect } from 'react';
import { 
  collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { 
  Truck, Plus, Search, Filter, ExternalLink, Edit, Trash2, 
  AlertCircle, CheckCircle2, Clock, MapPin, Package, Laptop, 
  Box, ArrowRight, DollarSign, Calendar, ChevronDown, RefreshCw, X, ShieldAlert
} from 'lucide-react';
import { 
  COURIERS_USA, COURIERS_VZLA, ESTADOS_TRACKING, 
  getEstadoConfig, getCourierUsaConfig, getCourierVzlaConfig, 
  getTrackingUrlUsa, getTrackingUrlVzla 
} from '../../../utils/couriers';
import TrackingModal from './TrackingModal';

export default function TrackingsDashboard() {
  const [trackings, setTrackings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterCourierVzla, setFilterCourierVzla] = useState('todos');
  const [filterPrealerta, setFilterPrealerta] = useState('todos'); // 'todos' | 'prealertado' | 'pendiente'

  // Modales y Errores
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTracking, setSelectedTracking] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, title: '' });
  const [permissionError, setPermissionError] = useState(false);

  // Carga en tiempo real de Firestore
  useEffect(() => {
    const q = query(collection(db, 'trackings'), orderBy('fecha_actualizacion', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setTrackings(docs);
      setLoading(false);
      setPermissionError(false);
    }, (error) => {
      console.warn('Advertencia en escucha de trackings con orderBy:', error);
      if (error.code === 'permission-denied') {
        setPermissionError(true);
        setLoading(false);
        return;
      }
      // Fallback sin orderBy por si falta el índice
      const qFallback = query(collection(db, 'trackings'));
      onSnapshot(qFallback, (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTrackings(docs);
        setLoading(false);
        setPermissionError(false);
      }, (errFallback) => {
        console.error('Error escuchando trackings:', errFallback);
        if (errFallback.code === 'permission-denied') {
          setPermissionError(true);
        }
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, []);

  // KPIs
  const totalSinPrealertar = trackings.filter(t => !t.prealertado && t.estado !== 'ya_recogido').length;
  const totalEnTransitoUsa = trackings.filter(t => t.estado === 'prealertado').length;
  const totalEnMiami = trackings.filter(t => t.estado === 'en_miami').length;
  const totalEnTransitoVzla = trackings.filter(t => t.estado === 'transito_vzla').length;
  const totalEnAgencia = trackings.filter(t => t.estado === 'disponible_agencia').length;
  const totalYaRecogidos = trackings.filter(t => t.estado === 'ya_recogido').length;

  // Filtrado
  const trackingsFiltrados = trackings.filter((t) => {
    // Filtro por Estado
    if (filterEstado !== 'todos' && t.estado !== filterEstado) return false;

    // Filtro por Courier VZLA
    if (filterCourierVzla !== 'todos' && t.courier_vzla !== filterCourierVzla) return false;

    // Filtro por Pre-alerta
    if (filterPrealerta === 'prealertado' && !t.prealertado) return false;
    if (filterPrealerta === 'pendiente' && t.prealertado) return false;

    // Búsqueda por texto
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchUsa = t.tracking_usa && t.tracking_usa.toLowerCase().includes(term);
      const matchVzla = t.tracking_vzla && t.tracking_vzla.toLowerCase().includes(term);
      const matchCasillero = t.casillero_cuenta && t.casillero_cuenta.toLowerCase().includes(term);
      const matchNotas = t.notas && t.notas.toLowerCase().includes(term);
      const matchItems = Array.isArray(t.items) && t.items.some(it => 
        (it.nombre && it.nombre.toLowerCase().includes(term)) ||
        (it.detalles && it.detalles.toLowerCase().includes(term))
      );

      if (!matchUsa && !matchVzla && !matchCasillero && !matchNotas && !matchItems) {
        return false;
      }
    }

    return true;
  });

  // Cambio rápido de estado desde la tabla
  const handleQuickStatusChange = async (trackingId, nuevoEstado) => {
    try {
      const updatePayload = {
        estado: nuevoEstado,
        fecha_actualizacion: serverTimestamp()
      };
      if (nuevoEstado === 'ya_recogido') {
        updatePayload.fecha_recogido = new Date().toISOString().split('T')[0];
      }
      await updateDoc(doc(db, 'trackings', trackingId), updatePayload);
    } catch (err) {
      alert('Error al actualizar estado: ' + err.message);
    }
  };

  // Cambio rápido de pre-alerta
  const handleTogglePrealerta = async (tracking) => {
    try {
      const nuevoValor = !tracking.prealertado;
      const updatePayload = {
        prealertado: nuevoValor,
        fecha_prealerta: nuevoValor ? new Date().toISOString().split('T')[0] : null,
        fecha_actualizacion: serverTimestamp()
      };
      if (nuevoValor && tracking.estado === 'por_prealertar') {
        updatePayload.estado = 'prealertado';
      }
      await updateDoc(doc(db, 'trackings', tracking.id), updatePayload);
    } catch (err) {
      alert('Error al actualizar pre-alerta: ' + err.message);
    }
  };

  // Eliminar
  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteDoc(doc(db, 'trackings', deleteConfirm.id));
      setDeleteConfirm({ open: false, id: null, title: '' });
    } catch (err) {
      alert('Error al eliminar tracking: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-100">
              <Truck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Rastreo de Envíos y Logística</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Control de paquetes en EE. UU., pre-alertas, casilleros en Miami y guías a Venezuela (Liberty, Zoom, Tealca).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedTracking(null);
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-brand-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nuevo Paquete / Tracking
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Por Prealertar */}
        <button
          onClick={() => setFilterEstado(filterEstado === 'por_prealertar' ? 'todos' : 'por_prealertar')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            filterEstado === 'por_prealertar'
              ? 'bg-red-500 text-white border-red-600 shadow-md ring-2 ring-red-400'
              : totalSinPrealertar > 0
                ? 'bg-red-50/80 border-red-200 text-red-900 hover:border-red-300'
                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider">Sin Prealertar</span>
            {totalSinPrealertar > 0 && (
              <span className={`w-2 h-2 rounded-full ${filterEstado === 'por_prealertar' ? 'bg-white' : 'bg-red-500 animate-ping'}`} />
            )}
          </div>
          <p className="text-2xl font-black mt-1">{totalSinPrealertar}</p>
          <p className={`text-[10px] mt-0.5 ${filterEstado === 'por_prealertar' ? 'text-red-100' : 'text-slate-500'}`}>
            {totalSinPrealertar === 1 ? 'Paquete urgente' : 'Pendientes casillero'}
          </p>
        </button>

        {/* 2. En Tránsito USA */}
        <button
          onClick={() => setFilterEstado(filterEstado === 'prealertado' ? 'todos' : 'prealertado')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            filterEstado === 'prealertado'
              ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400'
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider">En Tránsito USA</span>
          <p className="text-2xl font-black mt-1">{totalEnTransitoUsa}</p>
          <p className={`text-[10px] mt-0.5 ${filterEstado === 'prealertado' ? 'text-amber-100' : 'text-slate-500'}`}>
            Viajando a Miami
          </p>
        </button>

        {/* 3. En Miami */}
        <button
          onClick={() => setFilterEstado(filterEstado === 'en_miami' ? 'todos' : 'en_miami')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            filterEstado === 'en_miami'
              ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-400'
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider">En Miami</span>
          <p className="text-2xl font-black mt-1">{totalEnMiami}</p>
          <p className={`text-[10px] mt-0.5 ${filterEstado === 'en_miami' ? 'text-blue-100' : 'text-slate-500'}`}>
            Con guía VZLA
          </p>
        </button>

        {/* 4. En Tránsito / Aduana */}
        <button
          onClick={() => setFilterEstado(filterEstado === 'transito_vzla' ? 'todos' : 'transito_vzla')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            filterEstado === 'transito_vzla'
              ? 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-400'
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider">Vuelo / Aduana</span>
          <p className="text-2xl font-black mt-1">{totalEnTransitoVzla}</p>
          <p className={`text-[10px] mt-0.5 ${filterEstado === 'transito_vzla' ? 'text-purple-100' : 'text-slate-500'}`}>
            Hacia Venezuela
          </p>
        </button>

        {/* 5. En Agencia VZLA */}
        <button
          onClick={() => setFilterEstado(filterEstado === 'disponible_agencia' ? 'todos' : 'disponible_agencia')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            filterEstado === 'disponible_agencia'
              ? 'bg-orange-500 text-white border-orange-600 shadow-md ring-2 ring-orange-400'
              : totalEnAgencia > 0
                ? 'bg-orange-50 border-orange-200 text-orange-900 hover:border-orange-300'
                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider">En Agencia</span>
          <p className="text-2xl font-black mt-1">{totalEnAgencia}</p>
          <p className={`text-[10px] mt-0.5 ${filterEstado === 'disponible_agencia' ? 'text-orange-100' : 'text-slate-500'}`}>
            Listos para retirar
          </p>
        </button>

        {/* 6. Ya Recogidos */}
        <button
          onClick={() => setFilterEstado(filterEstado === 'ya_recogido' ? 'todos' : 'ya_recogido')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            filterEstado === 'ya_recogido'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400'
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider">Ya Recogidos</span>
          <p className="text-2xl font-black mt-1">{totalYaRecogidos}</p>
          <p className={`text-[10px] mt-0.5 ${filterEstado === 'ya_recogido' ? 'text-emerald-100' : 'text-slate-500'}`}>
            En taller Smartbits
          </p>
        </button>
      </div>

      {/* FILTROS Y BARRA DE BÚSQUEDA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Buscador */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por tracking USA, guía Liberty/Zoom, casillero, modelo de laptop..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-brand-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Select de Courier VZLA */}
          <div className="w-full md:w-48">
            <select
              value={filterCourierVzla}
              onChange={(e) => setFilterCourierVzla(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-brand-500"
            >
              <option value="todos">Todos los Couriers VZLA</option>
              {COURIERS_VZLA.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.nombre}</option>
              ))}
            </select>
          </div>

          {/* Select de Pre-alerta */}
          <div className="w-full md:w-44">
            <select
              value={filterPrealerta}
              onChange={(e) => setFilterPrealerta(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-brand-500"
            >
              <option value="todos">Todas las Prealertas</option>
              <option value="prealertado">✅ Prealertados</option>
              <option value="pendiente">🔴 Pendientes de Prealerta</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(filterEstado !== 'todos' || filterCourierVzla !== 'todos' || filterPrealerta !== 'todos' || searchTerm) && (
            <button
              onClick={() => {
                setFilterEstado('todos');
                setFilterCourierVzla('todos');
                setFilterPrealerta('todos');
                setSearchTerm('');
              }}
              className="px-3 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 rounded-xl transition-colors whitespace-nowrap"
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      </div>

      {/* AVISO DE REGLAS DE SEGURIDAD PENDIENTES */}
      {permissionError && (
        <div className="bg-amber-50 border border-amber-300 p-5 rounded-2xl space-y-3">
          <div className="flex items-center gap-2.5 text-amber-900 font-bold text-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span>Reglas de Seguridad de Firestore Pendientes de Publicar</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            La colección <strong>trackings</strong> aún no está autorizada en la nube de Firebase. Para habilitar el acceso a los envíos, sólo debes publicar la regla en la consola de Firebase:
          </p>
          <div className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-xs overflow-x-auto select-all">
            {`match /trackings/{document=**} {\n  allow read, write: if request.auth != null;\n}`}
          </div>
          <p className="text-[11px] text-amber-700">
            👉 En <strong>Firebase Console &gt; Firestore Database &gt; Reglas</strong>, pega este bloque antes de la regla default y haz clic en <strong>Publicar</strong>. O ejecuta <code>firebase deploy --only firestore:rules</code> en tu terminal.
          </p>
        </div>
      )}

      {/* LISTADO DE TRACKINGS */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-brand-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Cargando registros de envíos...</p>
        </div>
      ) : trackingsFiltrados.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <Truck className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No se encontraron envíos</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm || filterEstado !== 'todos' 
              ? 'No hay registros que coincidan con los filtros aplicados.'
              : 'Aún no has registrado ningún paquete. Haz clic en "Nuevo Paquete / Tracking" para comenzar.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {trackingsFiltrados.map((item) => {
            const estadoConfig = getEstadoConfig(item.estado);
            const courierUsa = getCourierUsaConfig(item.courier_usa);
            const courierVzla = getCourierVzlaConfig(item.courier_vzla);
            const urlUsa = getTrackingUrlUsa(item.courier_usa, item.tracking_usa);
            const urlVzla = getTrackingUrlVzla(item.courier_vzla, item.tracking_vzla);

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-5 shadow-xs transition-all space-y-4"
              >
                {/* Fila Superior: Estados, Pre-alerta y Acciones */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Badge de Semáforo */}
                    <div className="relative inline-block">
                      <select
                        value={item.estado}
                        onChange={(e) => handleQuickStatusChange(item.id, e.target.value)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border outline-none cursor-pointer pr-8 appearance-none transition-all ${estadoConfig.color}`}
                      >
                        {ESTADOS_TRACKING.map(est => (
                          <option key={est.key} value={est.key}>{est.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 pointer-events-none opacity-60" />
                    </div>

                    {/* Badge de Pre-alerta */}
                    <button
                      onClick={() => handleTogglePrealerta(item)}
                      title="Clic para alternar estado de pre-alerta"
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        item.prealertado
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 animate-pulse'
                      }`}
                    >
                      {item.prealertado ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Prealertado</span>
                          {item.fecha_prealerta && (
                            <span className="text-[10px] text-emerald-600 font-medium">({item.fecha_prealerta})</span>
                          )}
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                          <span>Sin Prealerta (¡Clic para marcar!)</span>
                        </>
                      )}
                    </button>

                    {/* Casillero */}
                    {item.casillero_cuenta && (
                      <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded-lg border border-slate-200 font-semibold">
                        Casillero: {item.casillero_cuenta}
                      </span>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedTracking(item);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                      title="Editar paquete / flete"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDeleteConfirm({ 
                        open: true, 
                        id: item.id, 
                        title: item.tracking_vzla || item.tracking_usa || 'este paquete' 
                      })}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar tracking"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Fila Central: Tramos de Tracking y Enlaces Directos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tramo 1: USA */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Tramo USA:</span>
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                          {courierUsa.icon} {courierUsa.nombre}
                        </span>
                      </div>
                      {urlUsa && (
                        <a
                          href={urlUsa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline bg-white px-2 py-0.5 rounded-md border border-blue-100 shadow-2xs"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Rastrear en Courier
                        </a>
                      )}
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-900 break-all select-all">
                      {item.tracking_usa || <span className="text-slate-400 font-sans font-normal italic">No asignado</span>}
                    </div>
                  </div>

                  {/* Tramo 2: VZLA */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Tramo VZLA (Agencia):</span>
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                          {courierVzla.icon} {item.courier_vzla_otro || courierVzla.nombre}
                        </span>
                      </div>
                      {urlVzla && item.tracking_vzla && (
                        <a
                          href={urlVzla}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:text-brand-800 hover:underline bg-white px-2 py-0.5 rounded-md border border-brand-100 shadow-2xs"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Rastrear en {item.courier_vzla_otro || courierVzla.nombre}
                        </a>
                      )}
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-900 break-all select-all">
                      {item.tracking_vzla ? (
                        item.tracking_vzla
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedTracking(item);
                            setIsModalOpen(true);
                          }}
                          className="text-xs font-medium text-brand-600 hover:text-brand-800 hover:underline font-sans cursor-pointer"
                        >
                          + Asignar número de guía VZLA (al llegar a Miami)
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fila Inferior: Contenido Consolidado, Flete y Notas */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs">
                  {/* Ítems Consolidados */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-500 font-medium mr-1">Contenido:</span>
                    {Array.isArray(item.items) && item.items.length > 0 ? (
                      item.items.map((it, idx) => (
                        <span
                          key={it.id || idx}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${
                            it.tipo === 'laptop'
                              ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                              : it.tipo === 'componente'
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {it.tipo === 'laptop' && <Laptop className="w-3 h-3" />}
                          {it.tipo === 'componente' && <Package className="w-3 h-3" />}
                          {it.tipo === 'otro' && <Box className="w-3 h-3" />}
                          {it.nombre}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">Sin ítems vinculados</span>
                    )}
                  </div>

                  {/* Información de Flete */}
                  <div className="flex items-center gap-3">
                    {item.flete?.pagado ? (
                      <span className="flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold">
                        <DollarSign className="w-3 h-3 text-emerald-600" />
                        Flete: ${Number(item.flete.monto_usd || 0).toFixed(2)} USD 
                        {item.flete.peso_lb && <span className="font-normal text-emerald-700">({item.flete.peso_lb} lb)</span>}
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedTracking(item);
                          setIsModalOpen(true);
                        }}
                        className="text-slate-500 hover:text-brand-600 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <DollarSign className="w-3 h-3" />
                        Registrar pago de flete
                      </button>
                    )}

                    {item.notas && (
                      <span className="text-slate-500 max-w-xs truncate" title={item.notas}>
                        💬 {item.notas}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE ALTA / EDICIÓN */}
      <TrackingModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTracking(null);
        }}
        trackingToEdit={selectedTracking}
        onSaved={() => {
          // Firebase onSnapshot actualizará automáticamente la lista
        }}
      />

      {/* MODAL CONFIRMACIÓN DE ELIMINACIÓN */}
      {deleteConfirm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-50 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">¿Eliminar registro de envío?</h3>
            </div>
            <p className="text-xs text-slate-600">
              Estás a punto de eliminar el paquete con tracking <strong>{deleteConfirm.title}</strong>. 
              Esta acción no puede deshacerse.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm({ open: false, id: null, title: '' })}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
