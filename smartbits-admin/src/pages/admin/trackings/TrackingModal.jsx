import { useState, useEffect } from 'react';
import { 
  X, Plus, Trash2, Search, Laptop, Package, Wrench, 
  Truck, ExternalLink, DollarSign, Calendar, AlertCircle, CheckCircle2, Loader2, Sparkles, Box
} from 'lucide-react';
import { 
  collection, getDocs, doc, addDoc, updateDoc, writeBatch, increment, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { 
  COURIERS_USA, COURIERS_VZLA, ESTADOS_TRACKING, 
  getTrackingUrlUsa, getTrackingUrlVzla, getCourierUsaConfig, getCourierVzlaConfig 
} from '../../../utils/couriers';
import { useCuentasCaja } from '../../../utils/useCuentasCaja';
import { getGastosExtraItems, getCostoBaseConComision } from '../../../utils/costos';

export default function TrackingModal({ isOpen, onClose, trackingToEdit, onSaved }) {
  const { todasCuentas, tasaCambio, loading: loadingCajas } = useCuentasCaja();

  // Estados de inventario para seleccionar ítems
  const [laptopsList, setLaptopsList] = useState([]);
  const [componentesList, setComponentesList] = useState([]);
  const [loadingInventario, setLoadingInventario] = useState(true);

  // Formulario principal
  const [formData, setFormData] = useState({
    tracking_usa: '',
    courier_usa: 'usps',
    prealertado: false,
    fecha_prealerta: '',
    casillero_cuenta: '',

    tracking_vzla: '',
    courier_vzla: 'liberty',
    courier_vzla_otro: '',

    estado: 'por_prealertar',
    items: [],
    notas: '',

    // Flete / Finanzas
    registrarFlete: false,
    flete_monto: '',
    flete_moneda: 'USD',
    flete_tasa: '',
    flete_peso_lb: '',
    flete_cuenta: 'binance',
  });

  const [saving, setSaving] = useState(false);
  const [activeTabItem, setActiveTabItem] = useState('laptop'); // 'laptop' | 'componente' | 'libre'
  const [searchItemTerm, setSearchItemTerm] = useState('');
  const [customItemDesc, setCustomItemDesc] = useState('');
  const [customItemDetalle, setCustomItemDetalle] = useState('');

  // Cargar Laptops y Componentes de Firestore al abrir
  useEffect(() => {
    if (!isOpen) return;

    const fetchInventario = async () => {
      setLoadingInventario(true);
      try {
        const [laptopsSnap, compsSnap] = await Promise.all([
          getDocs(collection(db, 'laptops')),
          getDocs(collection(db, 'componentes'))
        ]);

        const laps = laptopsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const comps = compsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        setLaptopsList(laps);
        setComponentesList(comps);
      } catch (err) {
        console.error('Error cargando inventario para modal tracking:', err);
      } finally {
        setLoadingInventario(false);
      }
    };

    fetchInventario();
  }, [isOpen]);

  // Si es modo edición, inicializar formulario con trackingToEdit
  useEffect(() => {
    if (trackingToEdit) {
      setFormData({
        tracking_usa: trackingToEdit.tracking_usa || '',
        courier_usa: trackingToEdit.courier_usa || 'usps',
        prealertado: Boolean(trackingToEdit.prealertado),
        fecha_prealerta: trackingToEdit.fecha_prealerta || '',
        casillero_cuenta: trackingToEdit.casillero_cuenta || '',

        tracking_vzla: trackingToEdit.tracking_vzla || '',
        courier_vzla: trackingToEdit.courier_vzla || 'liberty',
        courier_vzla_otro: trackingToEdit.courier_vzla_otro || '',

        estado: trackingToEdit.estado || 'por_prealertar',
        items: Array.isArray(trackingToEdit.items) ? trackingToEdit.items : [],
        notas: trackingToEdit.notas || '',

        registrarFlete: false,
        flete_monto: trackingToEdit.flete?.monto_original?.toString() || '',
        flete_moneda: trackingToEdit.flete?.moneda_original || 'USD',
        flete_tasa: trackingToEdit.flete?.tasa_cambio?.toString() || '',
        flete_peso_lb: trackingToEdit.flete?.peso_lb?.toString() || '',
        flete_cuenta: trackingToEdit.flete?.cuenta_caja || 'binance',
      });
    } else {
      // Nuevo
      setFormData({
        tracking_usa: '',
        courier_usa: 'usps',
        prealertado: false,
        fecha_prealerta: '',
        casillero_cuenta: '',

        tracking_vzla: '',
        courier_vzla: 'liberty',
        courier_vzla_otro: '',

        estado: 'por_prealertar',
        items: [],
        notas: '',

        registrarFlete: false,
        flete_monto: '',
        flete_moneda: 'USD',
        flete_tasa: '',
        flete_peso_lb: '',
        flete_cuenta: 'binance',
      });
    }
  }, [trackingToEdit, isOpen]);

  if (!isOpen) return null;

  // Manejador de cambios generales
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: type === 'checkbox' ? checked : value };

      // Si marca prealertado y no tiene fecha, poner hoy
      if (name === 'prealertado' && checked && !prev.fecha_prealerta) {
        updated.fecha_prealerta = new Date().toISOString().split('T')[0];
        if (prev.estado === 'por_prealertar') {
          updated.estado = 'prealertado';
        }
      } else if (name === 'prealertado' && !checked) {
        if (prev.estado === 'prealertado') {
          updated.estado = 'por_prealertar';
        }
      }

      // Si coloca tracking_vzla y está en estado inicial, sugerir que ya está en Miami
      if (name === 'tracking_vzla' && value.trim().length > 3 && (prev.estado === 'por_prealertar' || prev.estado === 'prealertado')) {
        updated.estado = 'en_miami';
      }

      return updated;
    });
  };

  // Agregar Ítem consolidado
  const handleAddItem = (item) => {
    // Evitar duplicados por id si ya está
    if (item.id && formData.items.some(i => i.id === item.id)) {
      alert('Este ítem ya está agregado en este paquete.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, item]
    }));
  };

  const handleAddCustomItem = (e) => {
    e.preventDefault();
    if (!customItemDesc.trim()) return;
    const newItem = {
      tipo: 'otro',
      id: `custom_${Date.now()}`,
      nombre: customItemDesc.trim(),
      detalles: customItemDetalle.trim() || 'Accesorio / Repuesto libre'
    };
    handleAddItem(newItem);
    setCustomItemDesc('');
    setCustomItemDetalle('');
  };

  const handleRemoveItem = (itemId) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== itemId)
    }));
  };

  // Previsualización flete
  const cuentaFleteSel = todasCuentas.find(c => c.key === formData.flete_cuenta);
  const esBsFlete = cuentaFleteSel?.moneda === 'BS' || formData.flete_moneda === 'BS';
  const fleteMontoNum = parseFloat(formData.flete_monto) || 0;
  const tasaFleteUsada = esBsFlete ? (parseFloat(formData.flete_tasa) || tasaCambio) : 1;
  const fleteCalculadoUsd = esBsFlete 
    ? (tasaFleteUsada > 0 ? Math.round((fleteMontoNum / tasaFleteUsada) * 100) / 100 : 0)
    : fleteMontoNum;

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.tracking_usa.trim() && !formData.tracking_vzla.trim()) {
      alert('Debes ingresar al menos el Tracking de USA o el Tracking de Venezuela.');
      return;
    }

    if (formData.items.length === 0) {
      if (!confirm('No has vinculado ningún ítem (laptop, componente o accesorio) a este paquete. ¿Deseas guardarlo de todas formas?')) {
        return;
      }
    }

    setSaving(true);
    try {
      const trackingData = {
        tracking_usa: formData.tracking_usa.trim().toUpperCase(),
        courier_usa: formData.courier_usa,
        prealertado: Boolean(formData.prealertado),
        fecha_prealerta: formData.prealertado ? (formData.fecha_prealerta || new Date().toISOString().split('T')[0]) : null,
        casillero_cuenta: formData.casillero_cuenta.trim(),

        tracking_vzla: formData.tracking_vzla.trim().toUpperCase(),
        courier_vzla: formData.courier_vzla,
        courier_vzla_otro: formData.courier_vzla === 'otro' ? formData.courier_vzla_otro.trim() : null,

        estado: formData.estado,
        items: formData.items,
        notas: formData.notas.trim(),

        fecha_actualizacion: serverTimestamp(),
      };

      // Si el estado es ya_recogido y no tenía fecha de recogida
      if (formData.estado === 'ya_recogido') {
        trackingData.fecha_recogido = trackingToEdit?.fecha_recogido || new Date().toISOString().split('T')[0];
      }

      // Si se registra pago de flete en finanzas
      if (formData.registrarFlete && fleteMontoNum > 0) {
        trackingData.flete = {
          monto_original: fleteMontoNum,
          moneda_original: esBsFlete ? 'BS' : 'USD',
          tasa_cambio: esBsFlete ? tasaFleteUsada : 1,
          monto_usd: fleteCalculadoUsd,
          peso_lb: parseFloat(formData.flete_peso_lb) || null,
          cuenta_caja: formData.flete_cuenta,
          pagado: true,
          fecha_pago: new Date().toISOString().split('T')[0],
        };
      } else if (trackingToEdit?.flete) {
        trackingData.flete = trackingToEdit.flete;
      }

      let savedDocId = trackingToEdit?.id;

      if (trackingToEdit) {
        await updateDoc(doc(db, 'trackings', trackingToEdit.id), trackingData);
      } else {
        trackingData.fecha_creacion = serverTimestamp();
        const newDoc = await addDoc(collection(db, 'trackings'), trackingData);
        savedDocId = newDoc.id;
      }

      // Si se marcó registrar flete en finanzas y hay monto, aplicar batch contable
      if (formData.registrarFlete && fleteMontoNum > 0) {
        const batch = writeBatch(db);
        const movRef = doc(collection(db, 'compras_inventario'));
        const gastoId = `flete_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        const nombresItems = formData.items.map(i => i.nombre).join(', ') || 'Carga consolidada';
        const courierLabel = formData.tracking_vzla 
          ? (getCourierVzlaConfig(formData.courier_vzla).nombre + ` (${formData.tracking_vzla})`)
          : (getCourierUsaConfig(formData.courier_usa).nombre + ` (${formData.tracking_usa})`);

        batch.set(movRef, {
          categoria: 'envio',
          concepto: `Flete de envío ${courierLabel} — [${nombresItems}]`,
          tracking_id: savedDocId,
          movimiento_gasto_id: gastoId,
          monto: fleteCalculadoUsd,
          monto_original: fleteMontoNum,
          moneda_original: esBsFlete ? 'BS' : 'USD',
          tasa_cambio: esBsFlete ? tasaFleteUsada : 1,
          metodo_pago: formData.flete_cuenta,
          fecha: serverTimestamp(),
        });

        // Descontar saldo de la cuenta de caja
        batch.update(doc(db, 'caja', 'saldos'), {
          [formData.flete_cuenta]: increment(-fleteMontoNum),
        });

        // Si hay laptops en los ítems, distribuir proporcionalmente el flete en sus gastos_extra
        const laptopsInPackage = formData.items.filter(i => i.tipo === 'laptop');
        if (laptopsInPackage.length > 0) {
          const costoPorLaptopUsd = Math.round((fleteCalculadoUsd / laptopsInPackage.length) * 100) / 100;
          
          for (const lapItem of laptopsInPackage) {
            const laptopRef = doc(db, 'laptops', lapItem.id);
            const laptopData = laptopsList.find(l => l.id === lapItem.id);
            if (laptopData) {
              const gastosPrevios = getGastosExtraItems(laptopData);
              const nuevoGasto = {
                id: gastoId,
                tipo: 'envio',
                descripcion: `Flete ${courierLabel}`,
                monto_original: Math.round((fleteMontoNum / laptopsInPackage.length) * 100) / 100,
                moneda_original: esBsFlete ? 'BS' : 'USD',
                tasa_cambio: esBsFlete ? tasaFleteUsada : 1,
                monto_usd: costoPorLaptopUsd,
                cuenta_key: formData.flete_cuenta,
                fecha: new Date().toISOString().split('T')[0],
              };
              const nuevosGastos = [...gastosPrevios, nuevoGasto];
              const totalExtraNuevo = nuevosGastos.reduce((acc, g) => acc + (Number(g.monto_usd) || 0), 0);
              const costoBaseConComision = getCostoBaseConComision(laptopData);
              const nuevoCostoTotal = Math.round((costoBaseConComision + totalExtraNuevo) * 100) / 100;

              batch.update(laptopRef, {
                gastos_extra: nuevosGastos,
                gastos_extra_total_usd: totalExtraNuevo,
                costo_total: nuevoCostoTotal,
                actualizadoEn: serverTimestamp(),
              });
            }
          }
        }

        await batch.commit();
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Error al guardar tracking:', err);
      alert('Error al guardar tracking: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Filtrado de laptops y componentes para el buscador
  const laptopsFiltradas = laptopsList.filter(l => {
    if (!searchItemTerm.trim()) return true;
    const term = searchItemTerm.toLowerCase();
    return (
      (l.modelo && l.modelo.toLowerCase().includes(term)) ||
      (l.marca && l.marca.toLowerCase().includes(term)) ||
      (l.cpu && l.cpu.toLowerCase().includes(term))
    );
  });

  const componentesFiltrados = componentesList.filter(c => {
    if (!searchItemTerm.trim()) return true;
    const term = searchItemTerm.toLowerCase();
    return (
      (c.nombre && c.nombre.toLowerCase().includes(term)) ||
      (c.categoria && c.categoria.toLowerCase().includes(term)) ||
      (c.marca && c.marca.toLowerCase().includes(term))
    );
  });

  // Preview de enlaces directos
  const urlUsaPreview = getTrackingUrlUsa(formData.courier_usa, formData.tracking_usa);
  const urlVzlaPreview = getTrackingUrlVzla(formData.courier_vzla, formData.tracking_vzla);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-brand-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 border border-brand-400/30 rounded-xl text-brand-400">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {trackingToEdit ? 'Editar Registro de Envío' : 'Registrar Nuevo Paquete / Tracking'}
              </h2>
              <p className="text-xs text-slate-300">
                Control de tramo USA, recepción en Miami, guía Venezuela y consolidación
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* SECCIÓN 1: TRAMO USA */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">1</span>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Tramo 1: Envío en EE. UU. (Hacia Casillero Miami)</h3>
              </div>
              {urlUsaPreview && formData.tracking_usa && (
                <a
                  href={urlUsaPreview}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors border border-blue-200"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Rastrear en {getCourierUsaConfig(formData.courier_usa).nombre}
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Courier en EE. UU.</label>
                <select
                  name="courier_usa"
                  value={formData.courier_usa}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                >
                  {COURIERS_USA.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Número de Tracking USA (USPS, FedEx, UPS...)
                </label>
                <input
                  type="text"
                  name="tracking_usa"
                  value={formData.tracking_usa}
                  onChange={handleChange}
                  placeholder="Ej: 9400111899562537182930 ó 1Z9999999999999999"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-medium text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none uppercase"
                />
              </div>
            </div>

            {/* Pre-alerta y Casillero */}
            <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-4 bg-white/70 p-3 rounded-xl border">
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="prealertado"
                    checked={formData.prealertado}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
                <div>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    {formData.prealertado ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Pre-alerta enviada al casillero
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
                        Pendiente por Prealertar
                      </span>
                    )}
                  </span>
                  <p className="text-[11px] text-slate-500">¿Ya subiste la factura y el tracking a la web del courier?</p>
                </div>
              </div>

              {formData.prealertado && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">Fecha Prealerta:</span>
                  <input
                    type="date"
                    name="fecha_prealerta"
                    value={formData.fecha_prealerta}
                    onChange={handleChange}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600">Código Casillero:</span>
                <input
                  type="text"
                  name="casillero_cuenta"
                  value={formData.casillero_cuenta}
                  onChange={handleChange}
                  placeholder="Ej: LIB-84920"
                  className="w-28 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono font-medium text-slate-800 uppercase"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: TRAMO VENEZUELA (AGENCIA MIAMI -> VZLA) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-black flex items-center justify-center">2</span>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Tramo 2: Agencia hacia Venezuela (Guía Courier VZLA)</h3>
              </div>
              {urlVzlaPreview && formData.tracking_vzla && (
                <a
                  href={urlVzlaPreview}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-lg transition-colors border border-brand-200"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Rastrear en {getCourierVzlaConfig(formData.courier_vzla).nombre}
                </a>
              )}
            </div>

            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Nota logística:</strong> El número de guía de Venezuela lo emite la agencia (Liberty, Zoom, Tealca) 
                una vez que el paquete ha sido recibido, medido y procesado en su almacén de Miami. 
                Al colocar este número, se valida que ya llegó a Miami.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Courier de Envío a VZLA</label>
                <select
                  name="courier_vzla"
                  value={formData.courier_vzla}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                >
                  {COURIERS_VZLA.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Número de Guía / Tracking VZLA (Liberty, Zoom, Tealca)
                </label>
                <input
                  type="text"
                  name="tracking_vzla"
                  value={formData.tracking_vzla}
                  onChange={handleChange}
                  placeholder="Ej: LIB-8921200 ó 1009823412 (Zoom)"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-medium text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none uppercase"
                />
              </div>
            </div>

            {formData.courier_vzla === 'otro' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Especificar nombre del courier</label>
                <input
                  type="text"
                  name="courier_vzla_otro"
                  value={formData.courier_vzla_otro}
                  onChange={handleChange}
                  placeholder="Ej: Fletes Gaviota, LearExpress, etc."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-medium text-slate-800"
                />
              </div>
            )}
          </div>

          {/* SECCIÓN 3: SEMÁFORO Y ESTADO */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-black flex items-center justify-center">3</span>
              Estado Actual del Paquete (Semáforo de Envíos)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {ESTADOS_TRACKING.map((est) => {
                const isSelected = formData.estado === est.key;
                return (
                  <button
                    key={est.key}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, estado: est.key }))}
                    className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? `${est.color} ring-2 ring-brand-500 shadow-sm`
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${est.dot} ${isSelected ? 'animate-pulse' : ''}`} />
                      <span className="text-xs font-bold">{est.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">{est.descripcion}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN 4: ARTÍCULOS CONSOLIDADOS (LAPTOPS, COMPONENTES, ACCESORIOS) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-black flex items-center justify-center">4</span>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  Contenido Consolidado del Paquete ({formData.items.length} {formData.items.length === 1 ? 'artículo' : 'artículos'})
                </h3>
              </div>
            </div>

            {/* Lista actual de ítems añadidos */}
            {formData.items.length > 0 ? (
              <div className="space-y-2">
                {formData.items.map((it, idx) => (
                  <div
                    key={it.id || idx}
                    className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        it.tipo === 'laptop' ? 'bg-indigo-50 text-indigo-700' :
                        it.tipo === 'componente' ? 'bg-purple-50 text-purple-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {it.tipo === 'laptop' && <Laptop className="w-4 h-4" />}
                        {it.tipo === 'componente' && <Package className="w-4 h-4" />}
                        {it.tipo === 'otro' && <Box className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{it.nombre}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            it.tipo === 'laptop' ? 'bg-indigo-100 text-indigo-800' :
                            it.tipo === 'componente' ? 'bg-purple-100 text-purple-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {it.tipo}
                          </span>
                        </div>
                        {it.detalles && <p className="text-xs text-slate-500">{it.detalles}</p>}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Quitar de este paquete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-5 bg-white/60 border border-dashed border-slate-300 rounded-xl">
                <p className="text-xs text-slate-500">No has añadido artículos a este paquete.</p>
                <p className="text-[11px] text-slate-400">Selecciona abajo una laptop, un componente o añade artículos libres.</p>
              </div>
            )}

            {/* Selector de nuevo ítem */}
            <div className="bg-white p-4 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Añadir artículo a la guía:</span>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setActiveTabItem('laptop')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      activeTabItem === 'laptop' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    💻 Laptop
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTabItem('componente')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      activeTabItem === 'componente' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📦 Componente
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTabItem('libre')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      activeTabItem === 'libre' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ➕ Otro / Libre
                  </button>
                </div>
              </div>

              {activeTabItem !== 'libre' ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchItemTerm}
                      onChange={(e) => setSearchItemTerm(e.target.value)}
                      placeholder={activeTabItem === 'laptop' ? 'Buscar laptop por modelo, procesador...' : 'Buscar componente por nombre...'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-slate-100 border border-slate-100 rounded-xl p-1 bg-slate-50/50">
                    {activeTabItem === 'laptop' ? (
                      laptopsFiltradas.slice(0, 15).map(lap => {
                        const yaAgregada = formData.items.some(i => i.id === lap.id);
                        return (
                          <div key={lap.id} className="flex items-center justify-between p-2 hover:bg-white rounded-lg transition-colors">
                            <div className="text-xs">
                              <span className="font-bold text-slate-800">{lap.modelo}</span>
                              <span className="text-slate-500 ml-2">({lap.marca || 'Sin marca'} - {lap.cpu || ''} - {lap.ram || ''})</span>
                              <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-slate-200 font-semibold text-slate-700">
                                {lap.disponibilidad || 'Disponible'}
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={yaAgregada}
                              onClick={() => handleAddItem({
                                tipo: 'laptop',
                                id: lap.id,
                                nombre: lap.modelo,
                                detalles: `${lap.marca || ''} ${lap.cpu || ''} ${lap.ram || ''}`.trim()
                              })}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                yaAgregada 
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              }`}
                            >
                              {yaAgregada ? 'Añadida' : '+ Añadir'}
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      componentesFiltrados.slice(0, 15).map(comp => {
                        const yaAgregado = formData.items.some(i => i.id === comp.id);
                        return (
                          <div key={comp.id} className="flex items-center justify-between p-2 hover:bg-white rounded-lg transition-colors">
                            <div className="text-xs">
                              <span className="font-bold text-slate-800">{comp.nombre}</span>
                              <span className="text-slate-500 ml-2">({comp.categoria || 'Componente'})</span>
                            </div>
                            <button
                              type="button"
                              disabled={yaAgregado}
                              onClick={() => handleAddItem({
                                tipo: 'componente',
                                id: comp.id,
                                nombre: comp.nombre,
                                detalles: comp.categoria || 'Componente'
                              })}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                yaAgregado 
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-purple-600 hover:bg-purple-700 text-white'
                              }`}
                            >
                              {yaAgregado ? 'Añadido' : '+ Añadir'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customItemDesc}
                    onChange={(e) => setCustomItemDesc(e.target.value)}
                    placeholder="Descripción (ej: 2x Cargadores Dell 65W Originales)"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-brand-500"
                  />
                  <input
                    type="text"
                    value={customItemDetalle}
                    onChange={(e) => setCustomItemDetalle(e.target.value)}
                    placeholder="Detalles / Serial (opcional)"
                    className="w-48 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomItem}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold"
                  >
                    + Agregar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 5: FLETE Y FINANZAS (OPCIONAL) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-black flex items-center justify-center">5</span>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Flete y Costos de Envío (Finanzas y Caja)</h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="registrarFlete"
                  checked={formData.registrarFlete}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>

            {formData.registrarFlete ? (
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4">
                <p className="text-xs text-slate-600">
                  Al guardar, se registrará el egreso formal en <strong>Finanzas &gt; Compras e Inventario</strong>, 
                  se descontará el monto de la caja seleccionada y se prorrateará el flete entre las laptops vinculadas.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Peso del paquete (lb)</label>
                    <input
                      type="number"
                      step="0.1"
                      name="flete_peso_lb"
                      value={formData.flete_peso_lb}
                      onChange={handleChange}
                      placeholder="Ej: 6.5"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Cuenta de Caja a descontar</label>
                    <select
                      name="flete_cuenta"
                      value={formData.flete_cuenta}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                    >
                      {todasCuentas.map(c => (
                        <option key={c.key} value={c.key}>{c.label} ({c.moneda})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Monto del Flete ({esBsFlete ? 'Bs' : 'USD'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="flete_monto"
                      value={formData.flete_monto}
                      onChange={handleChange}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                    />
                  </div>

                  {esBsFlete && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Tasa de Cambio (Bs/$)</label>
                      <input
                        type="number"
                        step="0.01"
                        name="flete_tasa"
                        value={formData.flete_tasa || tasaCambio}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                      />
                    </div>
                  )}
                </div>

                {fleteMontoNum > 0 && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-emerald-800 font-medium">Impacto estimado en costos:</span>
                    <span className="font-bold text-emerald-900">
                      Total: ${fleteCalculadoUsd.toFixed(2)} USD 
                      {formData.items.filter(i => i.tipo === 'laptop').length > 1 && (
                        <span className="ml-2 font-normal text-emerald-700">
                          (~${(fleteCalculadoUsd / formData.items.filter(i => i.tipo === 'laptop').length).toFixed(2)} por laptop)
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Activa esta opción si ya pagaste el flete en la agencia y deseas registrar el egreso contable automáticamente.
              </p>
            )}
          </div>

          {/* SECCIÓN 6: NOTAS Y OBSERVACIONES */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
              Notas u Observaciones del Envío
            </label>
            <textarea
              name="notas"
              rows={2}
              value={formData.notas}
              onChange={handleChange}
              placeholder="Ej: Paquete consolidado en casillero. Incluye caja original. Factura comercial adjuntada en el portal."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-brand-500"
            />
          </div>

        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {trackingToEdit ? 'Actualizar Registro' : 'Guardar Paquete'}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
