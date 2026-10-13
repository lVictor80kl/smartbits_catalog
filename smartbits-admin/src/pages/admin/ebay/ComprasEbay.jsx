import { useState, useEffect, useMemo } from 'react';
import { 
  collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, setDoc, serverTimestamp, writeBatch 
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, Search, ExternalLink, Trash2, 
  AlertTriangle, CheckCircle2, Clock, Package, Laptop, 
  Box, ArrowRight, DollarSign, Calendar, RefreshCw, X, ShieldAlert,
  Info, Sparkles, Filter, Check, EyeOff, RotateCcw, Link as LinkIcon,
  CheckCircle, Unlink, Layers, Edit2, Plus, Printer, Truck, MapPin
} from 'lucide-react';
import { 
  getTrackingUrlUsa, getCourierUsaConfig, COURIERS_USA,
  getTrackingUrlVzla, getCourierVzlaConfig, COURIERS_VZLA,
  ESTADOS_TRACKING, getEstadoConfig
} from '../../../utils/couriers';
import TrackingModal from '../trackings/TrackingModal';
import { syncTrackingFromEbay } from '../../../utils/syncTrackingFromEbay';
import { tieneEnvioPagado } from '../../../utils/costos';

export default function ComprasEbay() {
  const navigate = useNavigate();
  const [compras, setCompras] = useState([]);
  const [laptops, setLaptops] = useState([]);
  const [componentes, setComponentes] = useState([]);
  const [trackings, setTrackings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('prioridad'); // 'prioridad' | 'todos' | 'pendientes' | 'sin_prealerta' | 'en_usa' | 'en_vzla' | 'en_taller' | 'disponibles' | 'coming_soon' | 'descartados'

  // Modales
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingInitialData, setTrackingInitialData] = useState(null);
  const [activeEbayItemForTracking, setActiveEbayItemForTracking] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, title: '' });

  // Modal para vincular manualmente a inventario existente
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [activeEbayItemForLink, setActiveEbayItemForLink] = useState(null);
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  const [linkActiveTab, setLinkActiveTab] = useState('laptops'); // 'laptops' | 'componentes' | 'directo'
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);
  const [linkingProcessing, setLinkingProcessing] = useState(false);
  const [syncingTrackings, setSyncingTrackings] = useState(false);
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);
  const [autoLinkNotification, setAutoLinkNotification] = useState('');

  // Modal rápido para asignar / editar Tracking USA
  const [quickTrackingModal, setQuickTrackingModal] = useState({
    open: false,
    item: null,
    tracking_usa: '',
    courier_usa: 'usps',
    syncToEnvios: true
  });

  // Modal rápido para asignar / editar Tracking VZLA
  const [quickVzlaModal, setQuickVzlaModal] = useState({
    open: false,
    item: null,
    tracking_id: null,
    courier_vzla: 'liberty',
    tracking_vzla: '',
    saving: false
  });

  // Edición rápida de precio
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceVal, setEditingPriceVal] = useState('');

  // Edición rápida de Order ID de eBay
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editingOrderVal, setEditingOrderVal] = useState('');

  // 1. Escuchar compras de eBay en tiempo real
  useEffect(() => {
    const q = query(collection(db, 'compras_ebay'), orderBy('fecha_sincronizacion', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setCompras(items);
      setLoading(false);
    }, (error) => {
      console.warn('Error con orderBy fecha_sincronizacion, cargando sin orden:', error);
      const qFallback = query(collection(db, 'compras_ebay'));
      onSnapshot(qFallback, (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCompras(items);
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, []);

  // 2. Escuchar Laptops, Componentes y Trackings en tiempo real para detección inteligente
  useEffect(() => {
    const unsubLaptops = onSnapshot(collection(db, 'laptops'), snap => {
      setLaptops(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn('Error cargando laptops:', err));

    const unsubComp = onSnapshot(collection(db, 'componentes'), snap => {
      setComponentes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn('Error cargando componentes:', err));

    const unsubTrack = onSnapshot(collection(db, 'trackings'), snap => {
      setTrackings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn('Error cargando trackings:', err));

    return () => {
      unsubLaptops();
      unsubComp();
      unsubTrack();
    };
  }, []);

  // Contador de compras marcadas con auto-vinculación previa
  const autoLinkedCount = useMemo(() => {
    return compras.filter(c => c.vinculado_automatico).length;
  }, [compras]);

  // Revertir en lote cualquier auto-vinculación errónea generada por el algoritmo anterior
  const handleRevertAllAutoLinks = async () => {
    const toRevert = compras.filter(c => c.vinculado_automatico);
    if (toRevert.length === 0) {
      alert('No hay compras con auto-vinculación activa.');
      return;
    }
    if (!confirm(`Se detectaron ${toRevert.length} compras vinculadas automáticamente.\n\n¿Deseas revertirlas a estado "Sin Inventario" para agregarlas formalmente y evitar que se mezclen con equipos anteriores?`)) {
      return;
    }
    try {
      const batch = writeBatch(db);
      for (const c of toRevert) {
        if (c.tipo_inventario === 'laptop' && c.inventario_id) {
          try {
            batch.update(doc(db, 'laptops', c.inventario_id), { ebay_compra_id: null });
          } catch (e) {}
        }
        batch.update(doc(db, 'compras_ebay', c.id), {
          estado: 'pendiente',
          tipo_inventario: '',
          inventario_id: '',
          vinculado_automatico: false,
          fecha_actualizacion: serverTimestamp()
        });
      }
      await batch.commit();
      setAutoLinkNotification(`¡Se revirtieron ${toRevert.length} compras a estado "Sin Inventario"! Ahora podrás agregarlas formalmente.`);
      setTimeout(() => setAutoLinkNotification(''), 7000);
    } catch (err) {
      alert('Error revirtiendo vinculaciones: ' + err.message);
    }
  };

  // Detección inteligente de compras duplicadas reales (mismo itemId exacto, NO por título)
  const detectedDuplicates = useMemo(() => {
    const byOrder = {};
    compras.forEach(item => {
      const ordKey = (item.orderId || 'sin_orden').trim().toLowerCase();
      if (!byOrder[ordKey]) byOrder[ordKey] = [];
      byOrder[ordKey].push(item);
    });

    const duplicatesList = [];

    Object.entries(byOrder).forEach(([ordKey, items]) => {
      if (items.length <= 1) return;

      const subGroups = [];
      items.forEach(item => {
        let placed = false;
        for (const grp of subGroups) {
          const first = grp[0];
          // Solo se considera duplicado si coincide el itemId exacto con ID de documento diferente o conflicto con id legado
          const isExactSameItem = item.itemId && first.itemId && item.itemId === first.itemId && item.id !== first.id;
          const isLegacyConflict = items.length === 2 && (item.id === `ebay_${item.orderId}` || first.id === `ebay_${first.orderId}`);

          if (isExactSameItem || isLegacyConflict) {
            grp.push(item);
            placed = true;
            break;
          }
        }
        if (!placed) {
          subGroups.push([item]);
        }
      });

      subGroups.forEach(grp => {
        if (grp.length > 1) {
          duplicatesList.push(...grp.slice(1));
        }
      });
    });

    return duplicatesList;
  }, [compras]);

  const detectedDuplicatesCount = detectedDuplicates.length;

  // Helper estricto para encontrar la ficha de inventario asociada a una compra de eBay
  const getLinkedInventoryItem = (item) => {
    if (!item) return null;

    const cleanOrderId = (item.orderId || '').trim();

    // A. Si está explícitamente asignado por tipo e ID
    if (item.tipo_inventario === 'laptop' && item.inventario_id) {
      const found = laptops.find(l => l.id === item.inventario_id);
      if (found) {
        // Si fue auto-vinculado anteriormente y el order_id no coincide, ignorar la asociación espuria
        if (item.vinculado_automatico && cleanOrderId && found.order_id && found.order_id.trim() !== cleanOrderId) {
          return null;
        }
        return { type: 'laptop', item: found };
      }
    }
    if (item.tipo_inventario === 'componente' && item.inventario_id) {
      const found = componentes.find(c => c.id === item.inventario_id);
      if (found) {
        if (item.vinculado_automatico && cleanOrderId && found.order_id && found.order_id.trim() !== cleanOrderId) {
          return null;
        }
        return { type: 'componente', item: found };
      }
    }

    // B. Por ebay_compra_id en la ficha de inventario
    const lapByEbay = laptops.find(l => l.ebay_compra_id === item.id);
    if (lapByEbay) {
      if (item.vinculado_automatico && cleanOrderId && lapByEbay.order_id && lapByEbay.order_id.trim() !== cleanOrderId) {
        return null;
      }
      return { type: 'laptop', item: lapByEbay };
    }

    const compByEbay = componentes.find(c => c.ebay_compra_id === item.id);
    if (compByEbay) {
      if (item.vinculado_automatico && cleanOrderId && compByEbay.order_id && compByEbay.order_id.trim() !== cleanOrderId) {
        return null;
      }
      return { type: 'componente', item: compByEbay };
    }

    // C. Por orderId exacto único (SOLO si es un ID real y no un identificador temporal como order_1, order_2)
    const isValidRealOrderId = (ord) => {
      if (!ord || typeof ord !== 'string') return false;
      const c = ord.replace(/^#/, '').trim().toLowerCase();
      if (!c || c.startsWith('order_') || c.startsWith('order-') || c.startsWith('item_') || c.startsWith('ebay_') || c.startsWith('temp_')) return false;
      return c.length >= 8;
    };

    if (isValidRealOrderId(cleanOrderId)) {
      const normClean = cleanOrderId.replace(/^#/, '').trim().toLowerCase();
      const lapByOrd = laptops.find(l => {
        const lo = (l.order_id || '').replace(/^#/, '').trim().toLowerCase();
        return isValidRealOrderId(lo) && lo === normClean;
      });
      if (lapByOrd) return { type: 'laptop', item: lapByOrd };

      const compByOrd = componentes.find(c => {
        const co = (c.order_id || '').replace(/^#/, '').trim().toLowerCase();
        return isValidRealOrderId(co) && co === normClean;
      });
      if (compByOrd) return { type: 'componente', item: compByOrd };
    }

    return null;
  };

  // Helper para encontrar el paquete de tracking asociado en trackings
  const getLinkedTrackingDoc = (item, invItemObj) => {
    if (!item) return null;
    if (item.tracking_id) {
      const trk = trackings.find(t => t.id === item.tracking_id);
      if (trk) return trk;
    }
    if (invItemObj?.item?.tracking_id) {
      const trk = trackings.find(t => t.id === invItemObj.item.tracking_id);
      if (trk) return trk;
    }
    const cleanUsa = (item.tracking_usa || invItemObj?.item?.tracking_usa || '').trim().replace(/[\s-]/g, '').toUpperCase();
    if (cleanUsa) {
      const trk = trackings.find(t => {
        const trkClean = (t.tracking_usa || '').trim().replace(/[\s-]/g, '').toUpperCase();
        return trkClean && trkClean === cleanUsa;
      });
      if (trk) return trk;
    }
    const targetId = invItemObj?.item?.id || item.id;
    const trkByItem = trackings.find(t => Array.isArray(t.items) && t.items.some(ti => ti.id === targetId || ti.id === item.id));
    if (trkByItem) return trkByItem;

    return null;
  };

  // Prioridad operativa para clasificación:
  // 1: Sin agregar a inventario
  // 2: Sin prealertar (tiene tracking USA pero no prealertado)
  // 3: En tracking USA (prealertado)
  // 4: En Tracking Vzla (viajando o en agencia)
  // 5: Ya en el taller
  const getItemPriority = (item, invObj, trk) => {
    const hasInv = Boolean(invObj?.item);
    const isDisponible = invObj?.item?.disponibilidad === 'Disponible';
    const isVendido = invObj?.item?.disponibilidad === 'No disponible';
    const tieneLlegada = Boolean((invObj?.item && tieneEnvioPagado(invObj.item)) || trk?.estado === 'ya_recogido' || Boolean(item.en_taller) || Boolean(invObj?.item?.en_taller));
    const isEnTaller = !isDisponible && !isVendido && tieneLlegada;

    const hasTrackingUsa = Boolean(item.tracking_usa || trk?.tracking_usa);
    const isPrealerted = Boolean(trk?.prealertado || item.prealertado);
    const hasTrackingVzla = Boolean(trk?.tracking_vzla || item.tracking_vzla);

    if (isVendido) return 7; // 7° Ya Vendido
    if (isDisponible) return 6; // 6° Ya Disponible (salió de taller)
    if (!hasInv) return 1; // 1° Sin Inventario
    if (hasTrackingUsa && !isPrealerted) return 2; // 2° Sin Prealertar
    if (isEnTaller) return 5; // 5° En taller (en preparación)
    if (hasTrackingVzla || trk?.estado === 'en_miami' || trk?.estado === 'transito_vzla' || trk?.estado === 'disponible_agencia') return 4; // 4° En tracking VZLA
    if (hasTrackingUsa) return 3; // 3° En tracking USA
    return 2.5; // En inventario esperando tracking
  };

  // Conteos y métricas unificadas para cabecera (KPIs) sincronizadas con Inventario
  const metrics = useMemo(() => {
    // 1. Cifras oficiales cuadradas con Inventario Laptops
    const disponiblesCount = laptops.filter(l => l.disponibilidad === 'Disponible').length;
    const comingSoonCount = laptops.filter(l => l.disponibilidad === 'Coming soon').length;

    let enUsaCount = 0;
    let enVzlaCount = 0;
    let yaEnTallerCount = 0;
    let sinInventarioCount = 0;
    let sinPrealertaCount = 0;

    compras.forEach(item => {
      if (item.estado === 'descartado') return;
      const invObj = getLinkedInventoryItem(item);
      const trk = getLinkedTrackingDoc(item, invObj);

      const hasInv = Boolean(invObj?.item);
      const isDisponible = invObj?.item?.disponibilidad === 'Disponible';
      const isVendido = invObj?.item?.disponibilidad === 'No disponible';
      const tieneLlegada = Boolean((invObj?.item && tieneEnvioPagado(invObj.item)) || trk?.estado === 'ya_recogido' || Boolean(item.en_taller) || Boolean(invObj?.item?.en_taller));
      const isEnTaller = !isDisponible && !isVendido && tieneLlegada;

      const hasTrackingUsa = Boolean(item.tracking_usa || trk?.tracking_usa);
      const isPrealerted = Boolean(trk?.prealertado || item.prealertado);
      const hasTrackingVzla = Boolean(trk?.tracking_vzla || item.tracking_vzla);

      if (!hasInv) sinInventarioCount++;
      if (hasTrackingUsa && !isPrealerted) sinPrealertaCount++;

      // En taller solo cuenta equipos en preparación (si ya están disponibles o vendidos, ya salieron del taller)
      if (isEnTaller) {
        yaEnTallerCount++;
      } else if (!isDisponible && !isVendido) {
        if (hasTrackingVzla || trk?.estado === 'en_miami' || trk?.estado === 'transito_vzla' || trk?.estado === 'disponible_agencia') {
          enVzlaCount++;
        } else if (hasTrackingUsa) {
          enUsaCount++;
        }
      }
    });

    return {
      total: compras.filter(c => c.estado !== 'descartado').length,
      enUsa: enUsaCount,
      enVzla: enVzlaCount,
      yaEnTaller: yaEnTallerCount,
      disponibles: disponiblesCount,
      comingSoon: comingSoonCount,
      sinInventario: sinInventarioCount,
      sinPrealerta: sinPrealertaCount,
    };
  }, [compras, laptops, componentes, trackings]);

  // Conteos para filtros
  const totalCount = compras.length;
  const pendientesCount = metrics.sinInventario;
  const enTrackingCount = metrics.enUsa + metrics.enVzla;
  const enInventarioCount = compras.length - metrics.sinInventario;
  const descartadosCount = compras.filter(c => c.estado === 'descartado').length;

  // Filtrado y ordenación inteligente de compras
  const comprasFiltradas = useMemo(() => {
    return compras
      .filter(item => {
        const invObj = getLinkedInventoryItem(item);
        const trk = getLinkedTrackingDoc(item, invObj);
        const hasInv = Boolean(invObj?.item);
        const isDisponible = invObj?.item?.disponibilidad === 'Disponible';
        const isVendido = invObj?.item?.disponibilidad === 'No disponible';
        const tieneLlegada = Boolean((invObj?.item && tieneEnvioPagado(invObj.item)) || trk?.estado === 'ya_recogido' || Boolean(item.en_taller) || Boolean(invObj?.item?.en_taller));
        const isEnTaller = !isDisponible && !isVendido && tieneLlegada;

        const hasTrackingUsa = Boolean(item.tracking_usa || trk?.tracking_usa);
        const isPrealerted = Boolean(trk?.prealertado || item.prealertado);
        const hasTrackingVzla = Boolean(trk?.tracking_vzla || item.tracking_vzla);

        if (filterEstado === 'descartados') {
          return item.estado === 'descartado';
        }
        if (item.estado === 'descartado' && filterEstado !== 'descartados') {
          return false;
        }

        if (filterEstado === 'pendientes' || filterEstado === 'sin_inventario') {
          if (hasInv) return false;
        } else if (filterEstado === 'sin_prealerta') {
          if (!hasTrackingUsa || isPrealerted || isVendido || isDisponible) return false;
        } else if (filterEstado === 'en_usa') {
          if (!hasTrackingUsa || hasTrackingVzla || isEnTaller || isVendido || isDisponible) return false;
        } else if (filterEstado === 'en_vzla') {
          if (!hasTrackingVzla || isEnTaller || isVendido || isDisponible) return false;
        } else if (filterEstado === 'en_taller') {
          if (!isEnTaller) return false;
        } else if (filterEstado === 'disponibles') {
          if (invObj?.item?.disponibilidad !== 'Disponible') return false;
        } else if (filterEstado === 'coming_soon') {
          if (invObj?.item?.disponibilidad !== 'Coming soon') return false;
        }

        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchTitulo = item.titulo && item.titulo.toLowerCase().includes(term);
          const matchOrder = item.orderId && item.orderId.toLowerCase().includes(term);
          const matchTracking = (item.tracking_usa && item.tracking_usa.toLowerCase().includes(term)) || (trk?.tracking_usa && trk.tracking_usa.toLowerCase().includes(term)) || (trk?.tracking_vzla && trk.tracking_vzla.toLowerCase().includes(term));
          const matchVendedor = item.vendedor && item.vendedor.toLowerCase().includes(term);
          const matchInv = invObj?.item && (
            (invObj.item.marca && invObj.item.marca.toLowerCase().includes(term)) ||
            (invObj.item.modelo && invObj.item.modelo.toLowerCase().includes(term)) ||
            (invObj.item.nombre && invObj.item.nombre.toLowerCase().includes(term))
          );
          if (!matchTitulo && !matchOrder && !matchTracking && !matchVendedor && !matchInv) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const invA = getLinkedInventoryItem(a);
        const trkA = getLinkedTrackingDoc(a, invA);
        const invB = getLinkedInventoryItem(b);
        const trkB = getLinkedTrackingDoc(b, invB);

        // Si el filtro es 'prioridad', ordenar primero por prioridad operativa
        if (filterEstado === 'prioridad') {
          const prioA = getItemPriority(a, invA, trkA);
          const prioB = getItemPriority(b, invB, trkB);
          if (prioA !== prioB) return prioA - prioB;
        }

        // Orden cronológico por fecha de compra descendente
        const dateA = a.fecha_compra ? new Date(a.fecha_compra).getTime() : 0;
        const dateB = b.fecha_compra ? new Date(b.fecha_compra).getTime() : 0;
        if (dateB !== dateA) return dateB - dateA;

        const syncA = a.fecha_sincronizacion?.toMillis?.() || (a.fecha_sincronizacion ? new Date(a.fecha_sincronizacion).getTime() : 0);
        const syncB = b.fecha_sincronizacion?.toMillis?.() || (b.fecha_sincronizacion ? new Date(b.fecha_sincronizacion).getTime() : 0);
        return syncB - syncA;
      });
  }, [compras, laptops, componentes, trackings, filterEstado, searchTerm]);

  // Abrir Modal de Vinculación Manual
  const handleOpenLinkModal = (item) => {
    setActiveEbayItemForLink(item);
    setLinkSearchTerm(item.titulo.split(' ').slice(0, 3).join(' ')); // término de búsqueda sugerido
    setSelectedInventoryItem(null);
    setLinkActiveTab('laptops');
    setIsLinkModalOpen(true);
  };

  // Guardar vinculación manual
  const handleConfirmManualLink = async () => {
    if (!activeEbayItemForLink) return;

    try {
      setLinkingProcessing(true);

      if (linkActiveTab === 'directo') {
        // Marcar como ya en inventario sin asociar ficha específica
        let trkId = null;
        if (activeEbayItemForLink.tracking_usa) {
          const trkRes = await syncTrackingFromEbay(db, {
            ebayItem: activeEbayItemForLink,
            inventoryItem: {
              id: `manual_${activeEbayItemForLink.id}`,
              nombre: activeEbayItemForLink.titulo,
              modelo: '',
              costo: activeEbayItemForLink.precio
            },
            tipo: 'laptop'
          });
          trkId = trkRes?.id || null;
        }

        await updateDoc(doc(db, 'compras_ebay', activeEbayItemForLink.id), {
          estado: 'en_inventario',
          tipo_inventario: 'manual',
          inventario_id: '',
          tracking_id: trkId || activeEbayItemForLink.tracking_id || null,
          notas_vinculacion: 'Marcado manualmente en inventario',
          fecha_actualizacion: serverTimestamp()
        });
      } else {
        if (!selectedInventoryItem) {
          alert('Por favor selecciona un producto de la lista.');
          setLinkingProcessing(false);
          return;
        }

        const tipo = linkActiveTab === 'laptops' ? 'laptop' : 'componente';
        let trkId = null;
        if (activeEbayItemForLink.tracking_usa) {
          const trkRes = await syncTrackingFromEbay(db, {
            ebayItem: activeEbayItemForLink,
            inventoryItem: selectedInventoryItem,
            tipo
          });
          trkId = trkRes?.id || null;
        }

        // 1. Actualizar compra
        await updateDoc(doc(db, 'compras_ebay', activeEbayItemForLink.id), {
          estado: 'en_inventario',
          tipo_inventario: tipo,
          inventario_id: selectedInventoryItem.id,
          tracking_id: trkId || activeEbayItemForLink.tracking_id || null,
          fecha_actualizacion: serverTimestamp()
        });

        // 2. Actualizar inventario si es laptop
        if (tipo === 'laptop') {
          await updateDoc(doc(db, 'laptops', selectedInventoryItem.id), {
            ebay_compra_id: activeEbayItemForLink.id,
            tracking_usa: activeEbayItemForLink.tracking_usa ? activeEbayItemForLink.tracking_usa.trim().toUpperCase() : (selectedInventoryItem.tracking_usa || ''),
            precio_ebay: activeEbayItemForLink.precio || selectedInventoryItem.precio_ebay || 0,
            ...(trkId ? { tracking_id: trkId } : {})
          });
        }
      }

      setIsLinkModalOpen(false);
      setActiveEbayItemForLink(null);
    } catch (e) {
      alert('Error vinculando: ' + e.message);
    } finally {
      setLinkingProcessing(false);
    }
  };

  // Sincronización masiva de trackings hacia el módulo de Envíos
  const handleSyncAllTrackingsToEnvios = async () => {
    // 1. Limpiar compras_ebay que aún tengan Item IDs o Order IDs como tracking
    for (const c of compras) {
      const trk = (c.tracking_usa || '').trim();
      const rawItemId = String(c.itemId || '').replace(/_u[0-9]+$/, '').trim();
      const rawOrderId = String(c.orderId || '').replace(/[\s-]/g, '').trim();
      const isBogus = (rawItemId && trk === rawItemId) || (rawOrderId && trk === rawOrderId) || /^[0-9]{2}-[0-9]{5}-[0-9]{5}$/.test(trk) || trk.startsWith('{');
      if (isBogus && c.id) {
        try {
          await updateDoc(doc(db, 'compras_ebay', c.id), {
            tracking_usa: '',
            fecha_actualizacion: serverTimestamp()
          });
        } catch (_) {}
      }
    }

    const itemsWithTracking = compras.filter(c => {
      const trk = (c.tracking_usa || '').trim();
      const rawItemId = String(c.itemId || '').replace(/_u[0-9]+$/, '').trim();
      const rawOrderId = String(c.orderId || '').replace(/[\s-]/g, '').trim();
      const isBogus = (rawItemId && trk === rawItemId) || (rawOrderId && trk === rawOrderId) || /^[0-9]{2}-[0-9]{5}-[0-9]{5}$/.test(trk);
      return trk.length > 0 && !trk.startsWith('{') && !trk.includes('EVENTFAMILY') && !isBogus && c.estado !== 'descartado';
    });

    if (itemsWithTracking.length === 0) {
      alert('ℹ️ No se encontraron compras de eBay con número de Tracking USA válido registrado en esta lista.\n\n👉 Cómo ingresar trackings:\n1. Si la orden tiene tracking en eBay: Abre la extensión en tu historial de eBay y pulsa "Sincronizar Compras".\n2. O en la lista de abajo, haz clic en el botón "+ Tracking USA" en cualquier compra para ingresarlo directamente.');
      return;
    }

    if (!confirm(`Se encontraron ${itemsWithTracking.length} compras de eBay con Tracking USA válido.\n\n¿Deseas sincronizarlas con el módulo de Envíos/Trackings? Los paquetes se registrarán automáticamente con su tracking de USA para que luego solo ingreses el tracking de Venezuela.`)) {
      return;
    }

    setSyncingTrackings(true);
    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    let lastError = '';

    try {
      for (const item of itemsWithTracking) {
        let invItem = null;
        if (item.tipo_inventario === 'laptop' && item.inventario_id) {
          invItem = laptops.find(l => l.id === item.inventario_id);
        } else if (item.tipo_inventario === 'componente' && item.inventario_id) {
          invItem = componentes.find(co => co.id === item.inventario_id);
        }

        const itemPayload = invItem ? {
          id: invItem.id,
          nombre: invItem.nombre || `${invItem.marca || ''} ${invItem.modelo || ''}`.trim(),
          modelo: invItem.modelo || '',
          costo: Number(invItem.precio_ebay || invItem.costo || item.precio) || 0
        } : {
          id: `ebay_${item.id}`,
          nombre: item.titulo,
          modelo: '',
          costo: Number(item.precio) || 0
        };

        const result = await syncTrackingFromEbay(db, {
          ebayItem: item,
          inventoryItem: itemPayload,
          tipo: item.tipo_inventario === 'componente' ? 'componente' : 'laptop'
        });

        if (result?.success && result.id) {
          if (result.status === 'created') createdCount++;
          else updatedCount++;

          if (result.id !== item.tracking_id) {
            await updateDoc(doc(db, 'compras_ebay', item.id), {
              tracking_id: result.id,
              fecha_actualizacion: serverTimestamp()
            });
          }
        } else {
          failedCount++;
          if (result?.error) lastError = result.error;
        }
      }

      if (failedCount === 0) {
        setAutoLinkNotification(`¡Sincronización con Envíos exitosa! ${createdCount} nuevos paquetes creados y ${updatedCount} actualizados.`);
      } else {
        setAutoLinkNotification(`Sincronización finalizada: ${createdCount} creados, ${updatedCount} actualizados, ${failedCount} no procesados. ${lastError ? `(Error: ${lastError})` : ''}`);
      }
      setTimeout(() => setAutoLinkNotification(''), 7000);
    } catch (err) {
      alert('Error sincronizando trackings con Envíos: ' + err.message);
    } finally {
      setSyncingTrackings(false);
    }
  };

  // Limpieza inteligente de compras duplicadas
  const handleCleanDuplicates = async () => {
    if (compras.length === 0) return;

    const byOrder = {};
    compras.forEach(item => {
      const ordKey = (item.orderId || 'sin_orden').trim().toLowerCase();
      if (!byOrder[ordKey]) byOrder[ordKey] = [];
      byOrder[ordKey].push(item);
    });

    const toDeleteIds = [];
    const updates = [];

    Object.entries(byOrder).forEach(([ordKey, items]) => {
      if (items.length <= 1) return;

      const subGroups = [];
      items.forEach(item => {
        let placed = false;
        for (const grp of subGroups) {
          const first = grp[0];
          if (item.itemId && first.itemId && item.itemId === first.itemId) {
            grp.push(item);
            placed = true;
            break;
          }
          if (item.titulo && first.titulo && item.titulo.trim().toLowerCase() === first.titulo.trim().toLowerCase()) {
            grp.push(item);
            placed = true;
            break;
          }
          if (items.length === 2 && (item.id === `ebay_${item.orderId}` || first.id === `ebay_${first.orderId}`)) {
            grp.push(item);
            placed = true;
            break;
          }
        }
        if (!placed) {
          subGroups.push([item]);
        }
      });

      subGroups.forEach(grp => {
        if (grp.length > 1) {
          // Ordenar: preferir el que está en_inventario, con tracking_usa o vinculado
          grp.sort((a, b) => {
            const scoreA = (a.estado === 'en_inventario' ? 10 : 0) + (a.tracking_usa ? 5 : 0) + (a.inventario_id ? 5 : 0) + (a.tracking_id ? 3 : 0);
            const scoreB = (b.estado === 'en_inventario' ? 10 : 0) + (b.tracking_usa ? 5 : 0) + (b.inventario_id ? 5 : 0) + (b.tracking_id ? 3 : 0);
            return scoreB - scoreA;
          });

          const keep = grp[0];
          const duplicates = grp.slice(1);

          // Si el que eliminamos tenía tracking_usa y el conservado no, transferirlo
          const missingTracking = !keep.tracking_usa && duplicates.find(d => d.tracking_usa);
          if (missingTracking) {
            updates.push({
              id: keep.id,
              tracking_usa: missingTracking.tracking_usa,
              courier_usa: missingTracking.courier_usa || 'usps',
              tracking_id: missingTracking.tracking_id || null
            });
          }

          duplicates.forEach(d => toDeleteIds.push(d.id));
        }
      });
    });

    if (toDeleteIds.length === 0) {
      alert('¡Todo limpio! No se encontraron compras duplicadas.');
      return;
    }

    if (!confirm(`Se detectaron ${toDeleteIds.length} compras duplicadas (repetidas tras la resincronización).\n\n¿Deseas limpiarlas ahora? Se conservará automáticamente la versión más completa/vinculada de cada una.`)) {
      return;
    }

    setCleaningDuplicates(true);
    try {
      for (const u of updates) {
        await updateDoc(doc(db, 'compras_ebay', u.id), {
          tracking_usa: u.tracking_usa,
          courier_usa: u.courier_usa,
          ...(u.tracking_id ? { tracking_id: u.tracking_id } : {}),
          fecha_actualizacion: serverTimestamp()
        });
      }

      const batch = writeBatch(db);
      toDeleteIds.forEach(id => {
        batch.delete(doc(db, 'compras_ebay', id));
      });
      await batch.commit();

      setAutoLinkNotification(`¡Limpieza exitosa! Se eliminaron ${toDeleteIds.length} compras duplicadas preservando su información.`);
      setTimeout(() => setAutoLinkNotification(''), 7000);
    } catch (err) {
      alert('Error eliminando duplicados: ' + err.message);
    } finally {
      setCleaningDuplicates(false);
    }
  };

  // Desvincular de inventario (volver a pendiente)
  const handleUnlink = async (item) => {
    if (!confirm('¿Deseas desvincular esta compra y regresarla a estado Pendiente de inventario?')) return;
    try {
      if (item.tipo_inventario === 'laptop' && item.inventario_id) {
        try {
          await updateDoc(doc(db, 'laptops', item.inventario_id), {
            ebay_compra_id: null
          });
        } catch (lErr) {
          console.warn('No se pudo limpiar ebay_compra_id en laptop:', lErr);
        }
      }
      await updateDoc(doc(db, 'compras_ebay', item.id), {
        estado: 'pendiente',
        tipo_inventario: '',
        inventario_id: '',
        fecha_actualizacion: serverTimestamp()
      });
    } catch (e) {
      alert('Error desvinculando: ' + e.message);
    }
  };

  // Edición rápida de precio
  const handleStartEditPrice = (item) => {
    setEditingPriceId(item.id);
    setEditingPriceVal(String(item.precio || ''));
  };

  const handleSavePrice = async (itemId) => {
    const num = parseFloat(editingPriceVal);
    if (isNaN(num) || num < 0) {
      alert('Ingresa un precio válido');
      return;
    }
    try {
      await updateDoc(doc(db, 'compras_ebay', itemId), {
        precio: num,
        fecha_actualizacion: serverTimestamp()
      });
      setEditingPriceId(null);
      setAutoLinkNotification(`¡Precio actualizado a $${num.toFixed(2)} USD!`);
      setTimeout(() => setAutoLinkNotification(''), 5000);
    } catch (e) {
      alert('Error actualizando precio: ' + e.message);
    }
  };

  // Edición rápida de Order ID de eBay
  const handleStartEditOrderId = (item) => {
    setEditingOrderId(item.id);
    setEditingOrderVal(String(item.orderId || ''));
  };

  const handleSaveOrderId = async (itemId) => {
    const clean = (editingOrderVal || '').trim().replace(/^#/, '');
    if (!clean) {
      alert('Ingresa un número de orden de eBay (ej: 06-15295-97160).');
      return;
    }

    try {
      const item = compras.find(c => c.id === itemId);
      await updateDoc(doc(db, 'compras_ebay', itemId), {
        orderId: clean,
        fecha_actualizacion: serverTimestamp()
      });

      // Si la compra ya estaba asociada a una laptop o componente, actualizar también su order_id
      if (item?.tipo_inventario === 'laptop' && item.inventario_id) {
        await updateDoc(doc(db, 'laptops', item.inventario_id), {
          order_id: clean,
          actualizadoEn: serverTimestamp()
        }).catch(() => {});
      } else if (item?.tipo_inventario === 'componente' && item.inventario_id) {
        await updateDoc(doc(db, 'componentes', item.inventario_id), {
          order_id: clean,
          actualizadoEn: serverTimestamp()
        }).catch(() => {});
      }

      setEditingOrderId(null);
      setAutoLinkNotification(`¡Order ID actualizado a #${clean}!`);
      setTimeout(() => setAutoLinkNotification(''), 5000);
    } catch (e) {
      alert('Error actualizando número de orden: ' + e.message);
    }
  };

  // Acciones de conversión
  const handleConvertToLaptop = (item) => {
    navigate('/admin/new', {
      state: {
        ebayData: {
          id: item.id,
          orderId: item.orderId,
          itemId: item.itemId,
          titulo: item.titulo,
          precio: item.precio,
          fecha_compra: item.fecha_compra,
          item_url: item.item_url,
          foto_url: item.foto_url,
          tracking_usa: item.tracking_usa,
          courier_usa: item.courier_usa
        }
      }
    });
  };

  const handleConvertToComponent = (item) => {
    navigate('/admin/components/new', {
      state: {
        ebayData: {
          id: item.id,
          orderId: item.orderId,
          itemId: item.itemId,
          titulo: item.titulo,
          precio: item.precio,
          fecha_compra: item.fecha_compra,
          item_url: item.item_url,
          foto_url: item.foto_url,
          tracking_usa: item.tracking_usa,
          courier_usa: item.courier_usa
        }
      }
    });
  };

  const handleOpenTrackingModal = (item) => {
    setActiveEbayItemForTracking(item);
    setTrackingInitialData({
      tracking_usa: item.tracking_usa || '',
      courier_usa: item.courier_usa || 'usps',
      prealertado: false,
      items: [
        {
          id: item.id,
          tipo: 'libre',
          nombre: item.titulo,
          descripcion: `Compra eBay: ${item.titulo}`,
          costo: item.precio || 0,
          precio_base: item.precio || 0,
        }
      ],
      notas: `Orden eBay: ${item.orderId || ''}\nArtículo: ${item.itemId || ''}\nVendedor: ${item.vendedor || ''}`
    });
    setIsTrackingModalOpen(true);
  };

  const handleTrackingSaved = async (savedTracking) => {
    if (activeEbayItemForTracking) {
      try {
        const updatePayload = {
          estado: 'en_tracking',
          fecha_actualizacion: serverTimestamp()
        };
        if (savedTracking?.tracking_usa) {
          updatePayload.tracking_usa = savedTracking.tracking_usa;
        }
        if (savedTracking?.courier_usa) {
          updatePayload.courier_usa = savedTracking.courier_usa;
        }
        if (savedTracking?.id) {
          updatePayload.tracking_id = savedTracking.id;
        }
        await updateDoc(doc(db, 'compras_ebay', activeEbayItemForTracking.id), updatePayload);
      } catch (e) {
        console.error('Error actualizando estado en compras_ebay:', e);
      }
    }
    setIsTrackingModalOpen(false);
    setActiveEbayItemForTracking(null);
  };

  // Handlers para el modal rápido de Tracking USA
  const handleOpenQuickTracking = (item) => {
    setQuickTrackingModal({
      open: true,
      item,
      tracking_usa: item.tracking_usa || '',
      courier_usa: item.courier_usa || 'usps',
      syncToEnvios: true
    });
  };

  const handleQuickTrackingNumberChange = (val) => {
    let detected = quickTrackingModal.courier_usa;
    const clean = val.replace(/[\s-]/g, '').toUpperCase();
    if (/^1Z[0-9A-Z]{16}$/i.test(clean)) detected = 'ups';
    else if (/^(94|93|92|95|91|420)[0-9]{18,28}$/.test(clean) || /^[0-9]{20,24}$/.test(clean) || /^(ESUS|EEUS|UPAA|LVS)/i.test(clean)) detected = 'usps';
    else if (/^[0-9]{12}$/.test(clean) || /^[0-9]{15}$/.test(clean) || /^7489[0-9]{16,22}$/.test(clean)) detected = 'fedex';
    else if (/^[0-9]{10}$/.test(clean)) detected = 'dhl';

    setQuickTrackingModal(prev => ({
      ...prev,
      tracking_usa: val,
      courier_usa: detected
    }));
  };

  const handleSaveQuickTracking = async () => {
    const { item, tracking_usa, courier_usa, syncToEnvios } = quickTrackingModal;
    if (!item) return;

    const cleanTracking = tracking_usa.trim().replace(/[\s-]/g, '').toUpperCase();
    if (!cleanTracking) {
      alert('Por favor ingresa el número de tracking de USA.');
      return;
    }

    try {
      setLinkingProcessing(true);
      let trackingId = item.tracking_id || null;

      // Si se marcó sincronizar con Envíos
      if (syncToEnvios) {
        let invItem = null;
        if (item.tipo_inventario === 'laptop' && item.inventario_id) {
          invItem = laptops.find(l => l.id === item.inventario_id);
        } else if (item.tipo_inventario === 'componente' && item.inventario_id) {
          invItem = componentes.find(c => c.id === item.inventario_id);
        }

        const itemPayload = invItem ? {
          id: invItem.id,
          nombre: invItem.nombre || `${invItem.marca || ''} ${invItem.modelo || ''}`.trim(),
          modelo: invItem.modelo || '',
          costo: invItem.precio_ebay || invItem.costo || item.precio || 0
        } : {
          id: item.id,
          nombre: item.titulo,
          modelo: '',
          costo: item.precio || 0
        };

        const resTrkId = await syncTrackingFromEbay(db, {
          ebayItem: {
            ...item,
            tracking_usa: cleanTracking,
            courier_usa: courier_usa || 'usps'
          },
          inventoryItem: itemPayload,
          tipo: item.tipo_inventario === 'componente' ? 'componente' : 'laptop'
        });

        if (resTrkId) trackingId = resTrkId;
      }

      await updateDoc(doc(db, 'compras_ebay', item.id), {
        tracking_usa: cleanTracking,
        courier_usa: courier_usa || 'usps',
        tracking_id: trackingId,
        fecha_actualizacion: serverTimestamp()
      });

      setQuickTrackingModal({ open: false, item: null, tracking_usa: '', courier_usa: 'usps', syncToEnvios: true });
      setAutoLinkNotification(`¡Tracking USA ${cleanTracking} guardado${syncToEnvios ? ' y sincronizado con Envíos' : ''}!`);
      setTimeout(() => setAutoLinkNotification(''), 6000);
    } catch (e) {
      alert('Error guardando tracking: ' + e.message);
    } finally {
      setLinkingProcessing(false);
    }
  };

  // Alternar estado de Prealerta en 1 clic
  const handleTogglePrealerta = async (item, trkDoc) => {
    try {
      const isCurrentlyPrealerted = Boolean(trkDoc?.prealertado || item.prealertado);
      const newPrealertStatus = !isCurrentlyPrealerted;

      if (trkDoc?.id) {
        await updateDoc(doc(db, 'trackings', trkDoc.id), {
          prealertado: newPrealertStatus,
          fecha_prealerta: newPrealertStatus ? serverTimestamp() : null,
          estado: newPrealertStatus ? (trkDoc.estado === 'por_prealertar' ? 'prealertado' : trkDoc.estado) : 'por_prealertar',
          fecha_actualizacion: serverTimestamp()
        });
      } else if (item.tracking_usa) {
        await syncTrackingFromEbay(db, {
          ebayItem: {
            ...item,
            prealertado: newPrealertStatus
          },
          inventoryItem: null,
          tipo: 'laptop'
        });
      }

      await updateDoc(doc(db, 'compras_ebay', item.id), {
        prealertado: newPrealertStatus,
        fecha_actualizacion: serverTimestamp()
      });

      setAutoLinkNotification(newPrealertStatus ? '¡Paquete marcado como Prealertado! ✅' : 'Prealerta marcada como pendiente.');
      setTimeout(() => setAutoLinkNotification(''), 4000);
    } catch (err) {
      console.error('Error alternando prealerta:', err);
      alert('Error actualizando prealerta: ' + err.message);
    }
  };

  // Abrir y Guardar Tracking VZLA en modal rápido
  const handleOpenQuickVzla = (item, trkDoc) => {
    setQuickVzlaModal({
      open: true,
      item,
      tracking_id: trkDoc?.id || item.tracking_id || null,
      courier_vzla: trkDoc?.courier_vzla || item.courier_vzla || 'liberty',
      tracking_vzla: trkDoc?.tracking_vzla || item.tracking_vzla || '',
      saving: false
    });
  };

  const handleSaveQuickVzla = async () => {
    const { item, tracking_id, courier_vzla, tracking_vzla } = quickVzlaModal;
    if (!item) return;
    const cleanGuia = tracking_vzla.trim().toUpperCase();

    setQuickVzlaModal(prev => ({ ...prev, saving: true }));
    try {
      let targetTrkId = tracking_id;
      if (targetTrkId) {
        await updateDoc(doc(db, 'trackings', targetTrkId), {
          tracking_vzla: cleanGuia,
          courier_vzla: courier_vzla || 'liberty',
          estado: cleanGuia ? 'en_miami' : 'prealertado',
          fecha_actualizacion: serverTimestamp()
        });
      } else {
        const res = await syncTrackingFromEbay(db, {
          ebayItem: item,
          inventoryItem: null,
          tipo: 'laptop'
        });
        if (res?.id) {
          targetTrkId = res.id;
          await updateDoc(doc(db, 'trackings', res.id), {
            tracking_vzla: cleanGuia,
            courier_vzla: courier_vzla || 'liberty',
            estado: cleanGuia ? 'en_miami' : 'prealertado',
            fecha_actualizacion: serverTimestamp()
          });
        }
      }

      await updateDoc(doc(db, 'compras_ebay', item.id), {
        tracking_vzla: cleanGuia,
        courier_vzla: courier_vzla || 'liberty',
        ...(targetTrkId ? { tracking_id: targetTrkId } : {}),
        fecha_actualizacion: serverTimestamp()
      });

      setQuickVzlaModal({ open: false, item: null, tracking_id: null, courier_vzla: 'liberty', tracking_vzla: '', saving: false });
      setAutoLinkNotification('¡Guía de Venezuela guardada exitosamente! 🇻🇪');
      setTimeout(() => setAutoLinkNotification(''), 4000);
    } catch (err) {
      console.error('Error guardando guía Vzla:', err);
      alert('Error guardando guía Vzla: ' + err.message);
      setQuickVzlaModal(prev => ({ ...prev, saving: false }));
    }
  };

  // Marcar llegada a taller físico (Smartbits) para preparación y revisión
  const handleMarcarLlegadaTaller = async (item, trkDoc, invItemObj) => {
    const itemLabel = invItemObj?.item ? `${invItemObj.item.marca || ''} ${invItemObj.item.modelo || invItemObj.item.nombre || ''}`.trim() : item.titulo;
    if (!confirm(`¿Confirmar que este equipo ya llegó físicamente al taller Smartbits?\n\n"${itemLabel}"\n\n• Se marcará como recibido en taller para su revisión y preparación.\n• NO se cambiará a Disponible (se mantiene en preparación hasta que esté listo).`)) {
      return;
    }

    try {
      if (trkDoc?.id) {
        await updateDoc(doc(db, 'trackings', trkDoc.id), {
          estado: 'ya_recogido',
          fecha_recogido: serverTimestamp(),
          fecha_actualizacion: serverTimestamp()
        });
      }

      if (invItemObj?.item?.id) {
        const col = invItemObj.type === 'componente' ? 'componentes' : 'laptops';
        await updateDoc(doc(db, col, invItemObj.item.id), {
          en_taller: true,
          actualizadoEn: serverTimestamp()
        });
      }

      await updateDoc(doc(db, 'compras_ebay', item.id), {
        en_taller: true,
        fecha_actualizacion: serverTimestamp()
      });

      setAutoLinkNotification(`🏢 ¡${itemLabel} recibido en taller! (En preparación para su venta)`);
      setTimeout(() => setAutoLinkNotification(''), 5000);
    } catch (err) {
      console.error('Error marcando llegada a taller:', err);
      alert('Error marcando llegada a taller: ' + err.message);
    }
  };

  // Generador de impresión en PDF del reporte de compras y logística
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes en tu navegador para generar la impresión.');
      return;
    }

    const now = new Date();
    const rows = comprasFiltradas.map((item, idx) => {
      const invObj = getLinkedInventoryItem(item);
      const trk = getLinkedTrackingDoc(item, invObj);
      const pvp = invObj?.item?.precio ? `$${Number(invObj.item.precio).toFixed(2)}` : '<span style="color:#d97706;font-weight:bold;">Falta PVP</span>';
      const costo = `$${Number(item.precio || 0).toFixed(2)}`;
      const trkUsa = item.tracking_usa || trk?.tracking_usa || '—';
      const trkVzla = trk?.tracking_vzla || item.tracking_vzla || '—';
      const courierU = trk?.courier_usa || item.courier_usa || 'USA';
      const courierV = trk?.courier_vzla || item.courier_vzla || 'liberty';
      const prealert = trk?.prealertado || item.prealertado ? 'Prealertado ✅' : 'Sin Prealerta ⚠️';
      const statusLabel = trk?.estado === 'ya_recogido' || item.en_taller ? 'En Taller 🏢' : (trk?.tracking_vzla || item.tracking_vzla ? 'En VZLA 🇻🇪' : (trkUsa !== '—' ? 'En USA 🇺🇸' : 'Pendiente'));

      const invTitle = invObj?.item ? `${invObj.item.marca || ''} ${invObj.item.modelo || invObj.item.nombre || ''}`.trim() : '<span style="color:#dc2626;">Sin Inventario</span>';

      return `
        <tr style="border-bottom: 1px solid #e5e7eb; font-size: 11px;">
          <td style="padding: 6px 8px; text-align: center; color: #6b7280;">${idx + 1}</td>
          <td style="padding: 6px 8px; font-weight: 600; color: #111827;">${item.orderId || 'S/N'}</td>
          <td style="padding: 6px 8px; color: #1f2937; max-width: 200px;">${item.titulo || ''}</td>
          <td style="padding: 6px 8px; font-weight: 600; color: #0284c7;">${invTitle}</td>
          <td style="padding: 6px 8px; font-family: monospace;">${courierU.toUpperCase()}: ${trkUsa}<br><small style="color:${prealert.includes('✅') ? '#059669' : '#dc2626'}">${prealert}</small></td>
          <td style="padding: 6px 8px; font-family: monospace;">${courierV.toUpperCase()}: ${trkVzla}</td>
          <td style="padding: 6px 8px; text-align: center;">${statusLabel}</td>
          <td style="padding: 6px 8px; text-align: right; font-weight: 600; color: #059669;">${costo}</td>
          <td style="padding: 6px 8px; text-align: right;">${pvp}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte de Compras y Logística - Smartbits</title>
        <style>
          @page { size: letter landscape; margin: 10mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #f3f4f6; color: #374151; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 8px; border-bottom: 2px solid #d1d5db; }
          tr:nth-child(even) { background-color: #f9fafb; }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px;">
          <div>
            <h1 style="margin: 0; font-size: 18px; color: #0f172a; font-weight: 800; letter-spacing: 0.5px;">SMARTBITS • REPORTE DE COMPRAS Y LOGÍSTICA</h1>
            <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Filtro: <strong>${filterEstado.toUpperCase()}</strong> • Total registros: <strong>${comprasFiltradas.length}</strong> • Generado: ${now.toLocaleDateString('es-VE')} ${now.toLocaleTimeString('es-VE')}</p>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 11px; font-weight: 700; color: #0284c7;">Smartbits Admin Panel</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th style="width: 90px; text-align: left;">Orden</th>
              <th style="text-align: left;">Título eBay</th>
              <th style="text-align: left;">Inventario</th>
              <th style="text-align: left;">Tracking USA</th>
              <th style="text-align: left;">Guía VZLA</th>
              <th style="text-align: center;">Estado</th>
              <th style="text-align: right; width: 80px;">Costo eBay</th>
              <th style="text-align: right; width: 80px;">PVP Venta</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div style="margin-top: 25px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
          Documento generado automáticamente por Smartbits Admin • Compra inteligente, compra en Smartbits.
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

  const handleToggleDescartar = async (item) => {
    try {
      const nuevoEstado = item.estado === 'descartado' ? 'pendiente' : 'descartado';
      await updateDoc(doc(db, 'compras_ebay', item.id), {
        estado: nuevoEstado,
        fecha_actualizacion: serverTimestamp()
      });
    } catch (e) {
      alert('Error cambiando estado: ' + e.message);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteDoc(doc(db, 'compras_ebay', deleteConfirm.id));
      setDeleteConfirm({ open: false, id: null, title: '' });
    } catch (e) {
      alert('Error eliminando compra: ' + e.message);
    }
  };

  const copyExtensionPath = () => {
    const extensionPath = 'd:\\Laptops\\Smartbits\\Programa Smartbits\\smartbits_catalog\\smartbits-ebay-extension';
    navigator.clipboard.writeText(extensionPath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2500);
  };

  // Mapa de laptops ya vinculadas a alguna compra de eBay
  const linkedLaptopsMap = useMemo(() => {
    const map = {};
    compras.forEach(c => {
      if (c.estado === 'en_inventario' && c.tipo_inventario === 'laptop' && c.inventario_id) {
        map[c.inventario_id] = c;
      }
    });
    laptops.forEach(l => {
      if (l.ebay_compra_id && !map[l.id]) {
        map[l.id] = { id: l.ebay_compra_id, orderId: 'vinculado' };
      }
    });
    return map;
  }, [compras, laptops]);

  // Filtrado para el modal de vinculación manual
  const filteredLaptopsForLink = useMemo(() => {
    return laptops.filter(l => {
      if (!linkSearchTerm.trim()) return true;
      const term = linkSearchTerm.toLowerCase();
      return (
        (l.modelo && l.modelo.toLowerCase().includes(term)) ||
        (l.marca && l.marca.toLowerCase().includes(term)) ||
        (l.id && l.id.toLowerCase().includes(term))
      );
    }).sort((a, b) => {
      const aLinked = Boolean(linkedLaptopsMap[a.id]);
      const bLinked = Boolean(linkedLaptopsMap[b.id]);
      if (aLinked && !bLinked) return 1;
      if (!aLinked && bLinked) return -1;
      return 0;
    });
  }, [laptops, linkSearchTerm, linkedLaptopsMap]);

  const filteredComponentsForLink = componentes.filter(c => {
    if (!linkSearchTerm.trim()) return true;
    const term = linkSearchTerm.toLowerCase();
    return (
      (c.nombre && c.nombre.toLowerCase().includes(term)) ||
      (c.tipo && c.tipo.toLowerCase().includes(term)) ||
      (c.marca && c.marca.toLowerCase().includes(term))
    );
  });

  const ultimaSincronizacion = useMemo(() => {
    let latest = null;
    compras.forEach(c => {
      const dt = c.fecha_sincronizacion ? (c.fecha_sincronizacion.toDate ? c.fecha_sincronizacion.toDate() : new Date(c.fecha_sincronizacion)) : null;
      if (dt && !isNaN(dt.getTime())) {
        if (!latest || dt > latest) latest = dt;
      }
    });
    return latest;
  }, [compras]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Compras de eBay
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-2">
                <span>Sincronización, detección inteligente y conversión hacia Inventario y Envíos</span>
                {ultimaSincronizacion && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    <Clock className="w-3 h-3" />
                    Última sinc.: {ultimaSincronizacion.toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botón Revertir Auto-vinculaciones si existen */}
          {autoLinkedCount > 0 && (
            <button
              onClick={handleRevertAllAutoLinks}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-rose-800 dark:text-rose-200 bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 rounded-lg hover:bg-rose-200 transition shadow-sm"
              title="Revertir compras vinculadas automáticamente por el algoritmo previo para corregir inventario"
            >
              <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>Revertir Auto-vinculaciones ({autoLinkedCount})</span>
            </button>
          )}

          {/* Botón Limpiar Duplicados */}
          {detectedDuplicatesCount > 0 && (
            <button
              onClick={handleCleanDuplicates}
              disabled={cleaningDuplicates}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-200 transition shadow-sm"
              title="Eliminar compras duplicadas conservando la versión vinculada o con tracking"
            >
              <Trash2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{cleaningDuplicates ? 'Limpiando...' : `Limpiar Duplicados (${detectedDuplicatesCount})`}</span>
            </button>
          )}

          {/* Botón Imprimir Reporte PDF */}
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-xs"
            title="Imprimir o exportar listado filtrado a PDF"
          >
            <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>Imprimir Listado</span>
          </button>

          {/* Botón Sincronizar Trackings USA a Envíos */}
          <button
            onClick={handleSyncAllTrackingsToEnvios}
            disabled={syncingTrackings}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-900 rounded-lg hover:bg-purple-100 transition shadow-sm"
            title="Registrar o actualizar en Envíos todas las compras con Tracking USA"
          >
            {syncingTrackings ? (
              <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
            ) : (
              <Package className="w-4 h-4 text-purple-600" />
            )}
            <span>{syncingTrackings ? 'Sincronizando...' : 'Sync Trackings'}</span>
          </button>

          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 rounded-lg hover:bg-blue-100 transition shadow-sm"
          >
            <Info className="w-4 h-4" />
            <span>Extensión</span>
          </button>
        </div>
      </div>

      {/* Notificación de Auto-vinculación */}
      {autoLinkNotification && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl flex items-center gap-3 text-sm font-medium animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{autoLinkNotification}</span>
        </div>
      )}

      {/* Tarjetas de Métricas Resumen - 6 KPIs Pedidos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total Equipos */}
        <div 
          onClick={() => setFilterEstado('todos')}
          className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
            filterEstado === 'todos'
              ? 'bg-blue-50/80 border-blue-400 dark:bg-blue-950/40 ring-2 ring-blue-400/20 shadow-sm'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Equipos</span>
            <ShoppingBag className="w-4 h-4 text-gray-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-gray-900 dark:text-white">{metrics.total}</span>
            <span className="text-[10px] text-gray-400 font-medium">en pipeline</span>
          </div>
        </div>

        {/* 2. En USA */}
        <div 
          onClick={() => setFilterEstado('en_usa')}
          className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
            filterEstado === 'en_usa'
              ? 'bg-amber-50/80 border-amber-400 dark:bg-amber-950/40 ring-2 ring-amber-400/20 shadow-sm'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
              <span>🇺🇸 En USA</span>
            </span>
            <Package className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-700 dark:text-amber-400">{metrics.enUsa}</span>
            <span className="text-[10px] text-amber-600 font-medium">vía casillero</span>
          </div>
        </div>

        {/* 3. Agencia Envíos Vzla */}
        <div 
          onClick={() => setFilterEstado('en_vzla')}
          className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
            filterEstado === 'en_vzla'
              ? 'bg-purple-50/80 border-purple-400 dark:bg-purple-950/40 ring-2 ring-purple-400/20 shadow-sm'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1">
              <span>🇻🇪 En VZLA</span>
            </span>
            <Truck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-700 dark:text-purple-400">{metrics.enVzla}</span>
            <span className="text-[10px] text-purple-600 font-medium">con guía local</span>
          </div>
        </div>

        {/* 4. Ya en Taller */}
        <div 
          onClick={() => setFilterEstado('en_taller')}
          className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
            filterEstado === 'en_taller'
              ? 'bg-emerald-50/80 border-emerald-400 dark:bg-emerald-950/40 ring-2 ring-emerald-400/20 shadow-sm'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
              <span>🏢 En Taller</span>
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{metrics.yaEnTaller}</span>
            <span className="text-[10px] text-emerald-600 font-medium">activos</span>
          </div>
        </div>

        {/* 5. Disponibles en Inventario */}
        <div 
          onClick={() => setFilterEstado('disponibles')}
          className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
            filterEstado === 'disponibles'
              ? 'bg-teal-50/80 border-teal-400 dark:bg-teal-950/40 ring-2 ring-teal-400/20 shadow-sm'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-teal-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">
              Disponibles
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-teal-700 dark:text-teal-400">{metrics.disponibles}</span>
            <span className="text-[10px] text-teal-600 font-medium">para venta</span>
          </div>
        </div>

        {/* 6. Coming Soon en Inventario */}
        <div 
          onClick={() => setFilterEstado('coming_soon')}
          className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
            filterEstado === 'coming_soon'
              ? 'bg-sky-50/80 border-sky-400 dark:bg-sky-950/40 ring-2 ring-sky-400/20 shadow-sm'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-sky-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider">
              Coming Soon
            </span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-sky-700 dark:text-sky-400">{metrics.comingSoon}</span>
            <span className="text-[10px] text-sky-600 font-medium">próximamente</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 1. Prioridad Operativa (Predeterminado) */}
          <button
            onClick={() => setFilterEstado('prioridad')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              filterEstado === 'prioridad'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
            }`}
          >
            <span>⚡ Prioridad Operativa</span>
            {(metrics.sinInventario > 0 || metrics.sinPrealerta > 0) && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                filterEstado === 'prioridad' ? 'bg-blue-800 text-white' : 'bg-red-500 text-white animate-pulse'
              }`}>
                {metrics.sinInventario + metrics.sinPrealerta}
              </span>
            )}
          </button>

          {/* 2. Sin Inventario */}
          <button
            onClick={() => setFilterEstado('sin_inventario')}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
              filterEstado === 'sin_inventario'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 hover:bg-red-100'
            }`}
          >
            <span>🔴 Sin Inventario</span>
            <span className="text-[11px] font-mono">({metrics.sinInventario})</span>
          </button>

          {/* 3. Sin Prealerta */}
          <button
            onClick={() => setFilterEstado('sin_prealerta')}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
              filterEstado === 'sin_prealerta'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
            }`}
          >
            <span>⚠️ Sin Prealerta</span>
            <span className="text-[11px] font-mono">({metrics.sinPrealerta})</span>
          </button>

          {/* 4. En USA */}
          <button
            onClick={() => setFilterEstado('en_usa')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              filterEstado === 'en_usa'
                ? 'bg-amber-700 text-white font-bold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            🇺🇸 En USA ({metrics.enUsa})
          </button>

          {/* 5. En VZLA */}
          <button
            onClick={() => setFilterEstado('en_vzla')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              filterEstado === 'en_vzla'
                ? 'bg-purple-700 text-white font-bold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            🇻🇪 En VZLA ({metrics.enVzla})
          </button>

          {/* 6. En Taller */}
          <button
            onClick={() => setFilterEstado('en_taller')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              filterEstado === 'en_taller'
                ? 'bg-emerald-700 text-white font-bold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            🏢 En Taller ({metrics.yaEnTaller})
          </button>

          {/* 7. Todos */}
          <button
            onClick={() => setFilterEstado('todos')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              filterEstado === 'todos'
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Todos ({metrics.total})
          </button>

          {/* 8. Descartados */}
          <button
            onClick={() => setFilterEstado('descartados')}
            className={`px-2 py-1.5 text-xs font-medium rounded-lg transition-all ${
              filterEstado === 'descartados'
                ? 'bg-gray-600 text-white font-bold'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Descartados ({descartadosCount})
          </button>
        </div>

        {/* Buscador */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar modelo, tracking, orden..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Lista de Compras */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-3 text-sm text-gray-500">Cargando compras de eBay...</p>
        </div>
      ) : comprasFiltradas.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
          <ShoppingBag className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
            {searchTerm ? 'No se encontraron compras con esa búsqueda' : 'No hay compras en esta vista'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-1 mb-4">
            {compras.length === 0 
              ? 'Usa la Extensión de Chrome en tu cuenta de eBay para importar tus compras automáticamente.'
              : 'Intenta cambiar los filtros o el término de búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {comprasFiltradas.map((item) => {
            const invObj = getLinkedInventoryItem(item);
            const trkDoc = getLinkedTrackingDoc(item, invObj);
            const hasInv = Boolean(invObj?.item);

            const isPendiente = !hasInv;
            const isEnInventario = hasInv;
            const isDescartado = item.estado === 'descartado';

            // Datos de Inventario
            const invTitle = invObj?.item ? `${invObj.item.marca || ''} ${invObj.item.modelo || invObj.item.nombre || ''}`.trim() : null;
            const invFoto = invObj?.item?.imagenes?.[0] || invObj?.item?.imagen || null;
            const invPrecioVenta = invObj?.item?.precio ? Number(invObj.item.precio) : null;
            const invDisponibilidad = invObj?.item?.disponibilidad || null;

            // Datos de Tracking USA
            const trackingUsa = (item.tracking_usa || trkDoc?.tracking_usa || '').trim().toUpperCase();
            const courierUsa = trkDoc?.courier_usa || item.courier_usa || 'usps';
            const courierUsaConfig = getCourierUsaConfig(courierUsa);
            const trackingUrlUsa = trackingUsa ? getTrackingUrlUsa(courierUsa, trackingUsa) : null;
            const isPrealerted = Boolean(trkDoc?.prealertado || item.prealertado);

            // Datos de Tracking VZLA
            const trackingVzla = (trkDoc?.tracking_vzla || item.tracking_vzla || '').trim().toUpperCase();
            const courierVzla = trkDoc?.courier_vzla || item.courier_vzla || 'liberty';
            const courierVzlaConfig = getCourierVzlaConfig(courierVzla);
            const trackingUrlVzla = trackingVzla ? getTrackingUrlVzla(courierVzla, trackingVzla) : null;

            // En taller: solo si aún NO está disponible (en preparación) y NO se ha vendido
            const isDisponible = invDisponibilidad === 'Disponible';
            const isVendido = invDisponibilidad === 'No disponible';
            const tieneEnvio = invObj?.item ? tieneEnvioPagado(invObj.item) : false;
            const isEnTaller = !isDisponible && !isVendido && (tieneEnvio || trkDoc?.estado === 'ya_recogido' || Boolean(item.en_taller) || Boolean(invObj?.item?.en_taller));

            return (
              <div 
                key={item.id}
                className={`p-4 rounded-xl border transition-all duration-150 flex flex-col gap-3 ${
                  isPendiente 
                    ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/60 hover:border-red-400 shadow-sm' 
                    : isVendido
                    ? 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75'
                    : isEnTaller
                    ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800'
                    : isDescartado
                    ? 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 opacity-60'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-xs'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Bloque Izquierdo: Doble Miniatura y Detalles */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    {/* Doble Foto (eBay + Inventario) */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Foto eBay */}
                      <div className="relative w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center shadow-xs" title="Foto original de la compra en eBay">
                        {item.foto_url ? (
                          <img 
                            src={item.foto_url} 
                            alt={item.titulo} 
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }} 
                          />
                        ) : (
                          <ShoppingBag className="w-5 h-5 text-gray-400" />
                        )}
                        <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-white text-center font-bold py-0.2">
                          eBay
                        </span>
                      </div>

                      {/* Foto Inventario */}
                      <div className="relative w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center shadow-xs" title={invFoto ? "Foto subida al inventario" : "Sin foto en inventario aún"}>
                        {invFoto ? (
                          <img 
                            src={invFoto} 
                            alt={invTitle || 'Stock'} 
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }} 
                          />
                        ) : (
                          invObj?.type === 'componente' ? <Package className="w-5 h-5 text-gray-400" /> : <Laptop className="w-5 h-5 text-gray-400" />
                        )}
                        <span className="absolute bottom-0 inset-x-0 bg-blue-600/80 text-[8px] text-white text-center font-bold py-0.2">
                          Stock
                        </span>
                      </div>
                    </div>

                    {/* Contenido Central: Doble Título, Precios y Trackings */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Meta Tags superiores */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isPendiente && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/60 dark:text-red-200 flex items-center gap-1 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                            FALTA EN INVENTARIO
                          </span>
                        )}
                        {hasInv && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            En Inventario ({invObj.type === 'laptop' ? 'Laptop' : 'Parte'})
                          </span>
                        )}
                        {invDisponibilidad && (
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                            invDisponibilidad === 'Disponible'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : invDisponibilidad === 'Coming soon'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}>
                            {invDisponibilidad === 'Disponible' ? '🟢 Disponible' : invDisponibilidad === 'Coming soon' ? '⏳ Coming Soon' : '⚪ Vendido'}
                          </span>
                        )}
                        {isEnTaller && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            En Taller 🏢
                          </span>
                        )}
                        {editingOrderId === item.id ? (
                          <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/50 p-1 rounded-lg border border-blue-300 dark:border-blue-700 shadow-xs">
                            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 font-mono">#</span>
                            <input
                              type="text"
                              placeholder="06-15295-97160"
                              value={editingOrderVal}
                              onChange={(e) => setEditingOrderVal(e.target.value)}
                              className="w-32 px-1.5 py-0.5 text-[11px] font-mono font-bold text-blue-900 dark:text-blue-100 bg-white dark:bg-gray-900 border border-blue-300 rounded focus:outline-hidden"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveOrderId(item.id);
                                if (e.key === 'Escape') setEditingOrderId(null);
                              }}
                            />
                            <button
                              onClick={() => handleSaveOrderId(item.id)}
                              className="p-1 text-emerald-700 hover:bg-emerald-200 rounded"
                              title="Guardar Order ID"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingOrderId(null)}
                              className="p-1 text-gray-400 hover:bg-gray-200 rounded"
                              title="Cancelar"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              item.orderId && item.orderId.toLowerCase().startsWith('order_')
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              Orden: #{item.orderId || 'Sin ID'}
                              {item.orderId && item.orderId.toLowerCase().startsWith('order_') && ' ⚠️'}
                            </span>
                            <button
                              onClick={() => handleStartEditOrderId(item)}
                              title="Editar o corregir Order ID único de eBay"
                              className="p-0.5 text-gray-400 hover:text-blue-600 rounded transition"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 1. Título eBay */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0">eBay:</span>
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 line-clamp-1 leading-snug">
                          {item.titulo}
                        </h4>
                        {item.item_url && (
                          <a 
                            href={item.item_url} 
                            target="_blank" 
                            rel="noreferrer"
                            title="Ver en eBay"
                            className="text-gray-400 hover:text-blue-600 transition flex-shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* 2. Título Inventario (Clic redirige a edición) */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider flex-shrink-0">Stock:</span>
                        {hasInv ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (invObj.type === 'laptop') navigate(`/admin/edit/${invObj.item.id}`);
                              else navigate(`/admin/components/edit/${invObj.item.id}`);
                            }}
                            className="text-sm font-bold text-blue-700 dark:text-blue-400 hover:underline text-left line-clamp-1 flex items-center gap-1 group/inv"
                            title="Clic para abrir la ficha en inventario"
                          >
                            <span>{invTitle}</span>
                            <Edit2 className="w-3 h-3 opacity-0 group-hover/inv:opacity-100 transition text-blue-600 flex-shrink-0" />
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-red-600 dark:text-red-400">
                            Pendiente por registrar especificaciones en inventario
                          </span>
                        )}
                      </div>

                      {/* Métricas Financieras y Fecha */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400 pt-0.5">
                        {/* Costo de Compra eBay (Editable) */}
                        {editingPriceId === item.id ? (
                          <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 p-1 rounded-lg border border-emerald-300 dark:border-emerald-700 shadow-xs">
                            <span className="text-emerald-700 dark:text-emerald-300 font-bold text-xs">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={editingPriceVal}
                              onChange={(e) => setEditingPriceVal(e.target.value)}
                              className="w-20 px-1.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-200 bg-white dark:bg-gray-900 border border-emerald-300 rounded focus:outline-hidden"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSavePrice(item.id);
                                if (e.key === 'Escape') setEditingPriceId(null);
                              }}
                            />
                            <button onClick={() => handleSavePrice(item.id)} className="p-1 text-emerald-700 hover:bg-emerald-200 rounded">
                              <Check className="w-3 h-3" />
                            </button>
                            <button onClick={() => setEditingPriceId(null)} className="p-1 text-gray-400 hover:bg-gray-200 rounded">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-gray-400">Costo:</span>
                            <span 
                              onClick={() => handleStartEditPrice(item)}
                              className="font-bold text-emerald-600 dark:text-emerald-400 text-xs cursor-pointer hover:underline"
                              title="Clic para editar costo de compra"
                            >
                              ${Number(item.precio || 0).toFixed(2)} USD
                            </span>
                            <button onClick={() => handleStartEditPrice(item)} className="p-0.5 text-gray-400 hover:text-emerald-600" title="Editar costo">
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}

                        {/* Precio de Venta PVP */}
                        {hasInv && (
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-gray-400">PVP:</span>
                            {invPrecioVenta && invPrecioVenta > 0 ? (
                              <span className="font-bold text-blue-700 dark:text-blue-300 text-xs">
                                ${invPrecioVenta.toFixed(2)} USD
                              </span>
                            ) : (
                              <span 
                                onClick={() => {
                                  if (invObj.type === 'laptop') navigate(`/admin/edit/${invObj.item.id}`);
                                  else navigate(`/admin/components/edit/${invObj.item.id}`);
                                }}
                                className="font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded text-[10px] border border-amber-300 cursor-pointer hover:bg-amber-100 animate-pulse"
                                title="Clic para ir a inventario y fijar precio de venta"
                              >
                                ⚠️ Falta fijar PVP
                              </span>
                            )}
                          </div>
                        )}

                        {/* Fecha de compra */}
                        {item.fecha_compra && (
                          <span className="flex items-center gap-1 text-[11px]">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {item.fecha_compra}
                          </span>
                        )}

                        {item.vendedor && (
                          <span className="text-[11px]">Vendedor: <strong>{item.vendedor}</strong></span>
                        )}
                      </div>

                      {/* Bloque de Trackings Claros con Banderas 🇺🇸 y 🇻🇪 */}
                      <div className="flex flex-wrap items-center gap-2 pt-1.5">
                        {/* 1. TRACKING USA 🇺🇸 */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                          <span className="text-sm" title="Estados Unidos">🇺🇸</span>
                          {trackingUsa ? (
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-slate-600 dark:text-slate-400 text-[10px]">
                                {courierUsa.toUpperCase()}:
                              </span>
                              {trackingUrlUsa ? (
                                <a 
                                  href={trackingUrlUsa} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="font-mono text-blue-600 dark:text-blue-400 hover:underline font-bold text-[11px] flex items-center gap-0.5"
                                  title="Rastrear en la web oficial del courier"
                                >
                                  {trackingUsa}
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : (
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                                  {trackingUsa}
                                </span>
                              )}
                              <button 
                                onClick={() => handleOpenQuickTracking(item)} 
                                className="p-0.5 text-slate-400 hover:text-blue-600 ml-0.5" 
                                title="Editar Tracking USA"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400 text-[10px]">Sin Tracking USA</span>
                              <button 
                                onClick={() => handleOpenQuickTracking(item)} 
                                className="text-purple-600 font-bold hover:underline text-[10px] ml-0.5"
                              >
                                + Agregar
                              </button>
                            </div>
                          )}

                          {/* Botón de Prealerta Creada ✅ */}
                          {trackingUsa && (
                            <button
                              type="button"
                              onClick={() => handleTogglePrealerta(item, trkDoc)}
                              className={`ml-1 px-2 py-0.5 text-[10px] font-bold rounded-md transition flex items-center gap-1 ${
                                isPrealerted
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 animate-pulse ring-1 ring-amber-400'
                              }`}
                              title={isPrealerted ? "Prealertado. Clic para desmarcar si fue un error" : "¡Falta prealertar en casillero! Clic para marcar Prealertado"}
                            >
                              {isPrealerted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Prealertado ✅</span>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  <span>Prealerta Pendiente ⚠️</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {/* 2. TRACKING VZLA 🇻🇪 */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                          <span className="text-sm" title="Venezuela">🇻🇪</span>
                          {trackingVzla ? (
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-slate-600 dark:text-slate-400 text-[10px]">
                                {courierVzlaConfig?.nombre || courierVzla.toUpperCase()}:
                              </span>
                              {trackingUrlVzla ? (
                                <a 
                                  href={trackingUrlVzla} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="font-mono text-emerald-700 dark:text-emerald-400 hover:underline font-bold text-[11px] flex items-center gap-0.5"
                                  title="Rastrear en la web del courier venezolano"
                                >
                                  {trackingVzla}
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : (
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                                  {trackingVzla}
                                </span>
                              )}
                              <button 
                                onClick={() => handleOpenQuickVzla(item, trkDoc)} 
                                className="p-0.5 text-slate-400 hover:text-emerald-600 ml-0.5" 
                                title="Editar Guía VZLA"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400 text-[10px]">Sin Guía VZLA</span>
                              <button 
                                onClick={() => handleOpenQuickVzla(item, trkDoc)} 
                                className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline text-[10px] ml-0.5"
                              >
                                + Guía VZLA
                              </button>
                            </div>
                          )}

                          {/* Botón Llegó al Taller */}
                          {isVendido ? (
                            <span className="ml-1 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-100 text-slate-600 border border-slate-300 flex items-center gap-1" title="Equipo vendido y entregado">
                              <span>⚪ Vendido</span>
                            </span>
                          ) : isDisponible ? (
                            <span className="ml-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1" title="Equipo listo y disponible para venta">
                              <Check className="w-3 h-3 text-teal-600" />
                              <span>Listo en Venta</span>
                            </span>
                          ) : !isEnTaller ? (
                            <button
                              type="button"
                              onClick={() => handleMarcarLlegadaTaller(item, trkDoc, invObj)}
                              className="ml-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-300 transition flex items-center gap-1 shadow-2xs"
                              title="Marcar que el equipo ya llegó físicamente al taller Smartbits para comenzar su preparación"
                            >
                              <MapPin className="w-3 h-3 text-blue-600" />
                              <span>Llegó a Taller</span>
                            </button>
                          ) : (
                            <span className="ml-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1" title="En taller en preparación para su venta">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>En Taller 🏢</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloque Derecho: Acciones de Conversión e Inventario */}
                  <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-gray-200 dark:border-gray-700 flex-shrink-0">
                    {/* Si aún NO está en inventario: Botones para Agregar */}
                    {!hasInv && (
                      <>
                        <button
                          onClick={() => handleConvertToLaptop(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs"
                          title="Crear ficha de Laptop con estos datos precargados"
                        >
                          <Laptop className="w-3.5 h-3.5" />
                          <span>+ Laptop</span>
                        </button>

                        <button
                          onClick={() => handleConvertToComponent(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
                          title="Crear componente con estos datos precargados"
                        >
                          <Package className="w-3.5 h-3.5" />
                          <span>+ Comp.</span>
                        </button>

                        <button
                          onClick={() => handleOpenLinkModal(item)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition"
                          title="Vincular con un producto ya existente en inventario"
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                          <span>Vincular</span>
                        </button>
                      </>
                    )}

                    {/* Si YA está en inventario: Botón para Editar Ficha */}
                    {hasInv && invObj?.item && (
                      <>
                        <button
                          onClick={() => {
                            if (invObj.type === 'laptop') navigate(`/admin/edit/${invObj.item.id}`);
                            else navigate(`/admin/components/edit/${invObj.item.id}`);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition shadow-xs"
                          title="Abrir y editar la ficha del equipo en inventario"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Editar Ficha</span>
                        </button>

                        <button
                          onClick={() => handleUnlink(item)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-gray-100 transition"
                          title="Desvincular ficha de inventario"
                        >
                          <Unlink className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* Descartar / Restaurar */}
                    <button
                      onClick={() => handleToggleDescartar(item)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                      title={isDescartado ? "Restaurar compra" : "Descartar compra"}
                    >
                      {isDescartado ? <RotateCcw className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    {/* Eliminar */}
                    <button
                      onClick={() => setDeleteConfirm({ open: true, id: item.id, title: item.titulo })}
                      className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                      title="Eliminar compra"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Vincular Compra con Inventario Existente */}
      {isLinkModalOpen && activeEbayItemForLink && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-700">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 rounded-lg">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Vincular con Inventario Existente
                  </h3>
                  <p className="text-xs text-gray-500">
                    Marca esta compra como ingresada y asóciala a su equipo o componente
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsLinkModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Compra de eBay seleccionada */}
            <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-3">
              {activeEbayItemForLink.foto_url && (
                <img src={activeEbayItemForLink.foto_url} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {activeEbayItemForLink.titulo}
                </p>
                <p className="text-xs text-emerald-600 font-semibold">
                  ${Number(activeEbayItemForLink.precio).toFixed(2)} USD • Orden #{activeEbayItemForLink.orderId}
                </p>
              </div>
            </div>

            {/* Selector de Pestañas de Vinculación */}
            <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
              <button
                onClick={() => { setLinkActiveTab('laptops'); setSelectedInventoryItem(null); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  linkActiveTab === 'laptops'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300'
                }`}
              >
                Laptops en Inventario ({laptops.length})
              </button>
              <button
                onClick={() => { setLinkActiveTab('componentes'); setSelectedInventoryItem(null); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  linkActiveTab === 'componentes'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300'
                }`}
              >
                Componentes ({componentes.length})
              </button>
              <button
                onClick={() => { setLinkActiveTab('directo'); setSelectedInventoryItem(null); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  linkActiveTab === 'directo'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300'
                }`}
              >
                Solo marcar en inventario (Sin asociar ficha)
              </button>
            </div>

            {/* Buscador de productos si no es directo */}
            {linkActiveTab !== 'directo' && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Buscar en ${linkActiveTab}...`}
                  value={linkSearchTerm}
                  onChange={(e) => setLinkSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
            )}

            {/* Lista de productos para seleccionar */}
            {linkActiveTab !== 'directo' ? (
              <div className="flex-1 min-h-[160px] max-h-[240px] overflow-y-auto space-y-1.5 pr-1">
                {(linkActiveTab === 'laptops' ? filteredLaptopsForLink : filteredComponentsForLink).map((inv) => {
                  const isSelected = selectedInventoryItem?.id === inv.id;
                  const title = inv.modelo ? `${inv.marca || ''} ${inv.modelo}` : inv.nombre;
                  const alreadyLinked = linkActiveTab === 'laptops' && Boolean(linkedLaptopsMap[inv.id]);
                  return (
                    <div
                      key={inv.id}
                      onClick={() => setSelectedInventoryItem(inv)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/50 font-bold' 
                          : alreadyLinked
                            ? 'border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-50/60'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-gray-900 dark:text-white font-medium">{title}</p>
                          {alreadyLinked && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold flex-shrink-0">
                              Ya Vinculada
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500">
                          {inv.precio ? `Venta: $${inv.precio}` : ''} {inv.precio_ebay ? `• Costo eBay: $${inv.precio_ebay}` : ''}
                        </p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-400'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-900 text-xs text-purple-900 dark:text-purple-200 space-y-2">
                <p className="font-bold">Marcar como ingresado en inventario:</p>
                <p>
                  Esta opción marcará la compra de eBay como <strong>"En Inventario"</strong> quitándola de las alertas rojas de pendientes, sin necesidad de crearle o asignarle una ficha individual (ideal para repuestos menores, consumibles o equipos que ya fueron vendidos).
                </p>
              </div>
            )}

            {/* Botones de acción del Modal */}
            <div className="flex justify-end gap-2 pt-3 border-t dark:border-gray-700">
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmManualLink}
                disabled={linkingProcessing || (linkActiveTab !== 'directo' && !selectedInventoryItem)}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition"
              >
                {linkingProcessing ? 'Vinculando...' : 'Confirmar Vinculación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Instrucciones de la Extensión de Chrome */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-lg">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Instalar Extensión de Chrome
                </h3>
              </div>
              <button 
                onClick={() => setShowHelpModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300 list-decimal list-inside bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <li>
                Abre Google Chrome y entra en: <code className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-800 rounded text-xs font-mono">chrome://extensions</code>
              </li>
              <li>
                Activa el <strong>Modo de desarrollador</strong> (arriba a la derecha).
              </li>
              <li>
                Haz clic en <strong>Cargar descomprimida</strong> y selecciona:
                <div className="mt-2 flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                  <span className="font-mono text-xs text-gray-800 dark:text-gray-200 truncate flex-1">
                    d:\Laptops\Smartbits\Programa Smartbits\smartbits_catalog\smartbits-ebay-extension
                  </span>
                  <button
                    onClick={copyExtensionPath}
                    className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center gap-1"
                  >
                    {copiedPath ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{copiedPath ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </li>
              <li>
                ¡Listo! Abre tu <strong>Purchase History</strong> en eBay, pulsa el icono de la extensión y sincroniza tus compras con un clic.
              </li>
            </ol>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar Eliminación */}
      {deleteConfirm.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-5 border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <h4 className="font-bold text-base text-gray-900 dark:text-white">¿Eliminar registro?</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Se eliminará el registro de eBay: <br />
              <strong className="text-gray-900 dark:text-white font-medium">{deleteConfirm.title}</strong>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm({ open: false, id: null, title: '' })}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteItem}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rápido: Asignar / Editar Tracking USA */}
      {quickTrackingModal.open && quickTrackingModal.item && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-lg">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {quickTrackingModal.item.tracking_usa ? 'Editar Tracking USA' : 'Asignar Tracking USA'}
                  </h3>
                  <p className="text-xs text-gray-500 truncate max-w-[260px]">
                    {quickTrackingModal.item.titulo}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setQuickTrackingModal({ open: false, item: null, tracking_usa: '', courier_usa: 'usps', syncToEnvios: true })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Número de Tracking USA <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickTrackingModal.tracking_usa}
                  onChange={(e) => handleQuickTrackingNumberChange(e.target.value)}
                  placeholder="Ej: 9400111899562537638491 o 1Z9999999999999999"
                  className="w-full font-mono text-sm px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden dark:text-white uppercase"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Empresa / Courier USA
                </label>
                <select
                  value={quickTrackingModal.courier_usa}
                  onChange={(e) => setQuickTrackingModal(prev => ({ ...prev, courier_usa: e.target.value }))}
                  className="w-full text-sm px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden dark:text-white"
                >
                  {COURIERS_USA.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.nombre}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Detecta automáticamente formatos de USPS, UPS, FedEx, etc.
                </p>
              </div>

              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-900">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-purple-950 dark:text-purple-200">
                  <input
                    type="checkbox"
                    checked={quickTrackingModal.syncToEnvios}
                    onChange={(e) => setQuickTrackingModal(prev => ({ ...prev, syncToEnvios: e.target.checked }))}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>
                    <strong>Registrar automáticamente en el módulo de Envíos:</strong> Crea o actualiza la encomienda en estado <em>"Por Prealertar"</em> para que luego solo ingreses el tracking de Venezuela.
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t dark:border-gray-700">
              <button
                type="button"
                onClick={() => setQuickTrackingModal({ open: false, item: null, tracking_usa: '', courier_usa: 'usps', syncToEnvios: true })}
                className="px-3.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveQuickTracking}
                disabled={linkingProcessing || !quickTrackingModal.tracking_usa.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg shadow-sm transition"
              >
                {linkingProcessing ? 'Guardando...' : 'Guardar Tracking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rápido: Asignar / Editar Tracking VZLA */}
      {quickVzlaModal.open && quickVzlaModal.item && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg text-lg">
                  🇻🇪
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {quickVzlaModal.tracking_vzla ? 'Editar Guía Venezuela' : 'Asignar Guía Venezuela'}
                  </h3>
                  <p className="text-xs text-gray-500 truncate max-w-[260px]">
                    {quickVzlaModal.item.titulo}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setQuickVzlaModal({ open: false, item: null, tracking_id: null, courier_vzla: 'liberty', tracking_vzla: '', saving: false })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Empresa / Courier en Venezuela <span className="text-red-500">*</span>
                </label>
                <select
                  value={quickVzlaModal.courier_vzla}
                  onChange={(e) => setQuickVzlaModal(prev => ({ ...prev, courier_vzla: e.target.value }))}
                  className="w-full text-sm px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden dark:text-white"
                >
                  {COURIERS_VZLA.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Número de Guía / Tracking VZLA <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickVzlaModal.tracking_vzla}
                  onChange={(e) => setQuickVzlaModal(prev => ({ ...prev, tracking_vzla: e.target.value }))}
                  placeholder="Ej: LIB-849201 o 1234567890"
                  className="w-full font-mono text-sm px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden dark:text-white uppercase"
                  autoFocus
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-200">
                <p>
                  Al guardar, se vinculará a la encomienda y el estado logístico avanzará automáticamente para que puedas monitorear su llegada a Venezuela.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t dark:border-gray-700">
              <button
                type="button"
                onClick={() => setQuickVzlaModal({ open: false, item: null, tracking_id: null, courier_vzla: 'liberty', tracking_vzla: '', saving: false })}
                className="px-3.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveQuickVzla}
                disabled={quickVzlaModal.saving || !quickVzlaModal.tracking_vzla.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition"
              >
                {quickVzlaModal.saving ? 'Guardando...' : 'Guardar Guía VZLA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Modal */}
      <TrackingModal
        isOpen={isTrackingModalOpen}
        onClose={() => {
          setIsTrackingModalOpen(false);
          setActiveEbayItemForTracking(null);
        }}
        initialData={trackingInitialData}
        onSaved={handleTrackingSaved}
      />
    </div>
  );
}
