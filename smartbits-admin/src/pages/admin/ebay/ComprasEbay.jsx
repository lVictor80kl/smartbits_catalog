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
  CheckCircle, Unlink, Layers, Edit2, Plus
} from 'lucide-react';
import { getTrackingUrlUsa, getCourierUsaConfig, COURIERS_USA } from '../../../utils/couriers';
import TrackingModal from '../trackings/TrackingModal';
import { syncTrackingFromEbay } from '../../../utils/syncTrackingFromEbay';

export default function ComprasEbay() {
  const navigate = useNavigate();
  const [compras, setCompras] = useState([]);
  const [laptops, setLaptops] = useState([]);
  const [componentes, setComponentes] = useState([]);
  const [trackings, setTrackings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('pendientes'); // 'todos' | 'pendientes' | 'en_tracking' | 'en_inventario' | 'descartados'

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

  // Edición rápida de precio
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceVal, setEditingPriceVal] = useState('');

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

  // Algoritmo de Coincidencia Inteligente con exclusión de equipos ya asignados
  const findInventoryMatch = (ebayItem, excludedLaptopIds = new Set()) => {
    if (!ebayItem || ebayItem.estado === 'en_inventario') return null;

    const ebayTitle = (ebayItem.titulo || '').toLowerCase();
    const ebayOrderId = (ebayItem.orderId || '').toLowerCase().trim();
    const ebayItemId = (ebayItem.itemId || '').toLowerCase().trim();
    const ebayTracking = (ebayItem.tracking_usa || '').replace(/[\s-]/g, '').toLowerCase();

    // 1. Coincidencia exacta por N° de orden o ID de item en observaciones_compra o ebay_compra_id
    for (const lap of laptops) {
      if (excludedLaptopIds.has(lap.id)) continue;
      if (lap.ebay_compra_id && lap.ebay_compra_id === ebayItem.id) {
        return { type: 'laptop', item: lap, confidence: 'exact', reason: `Ficha ya enlazada a esta compra` };
      }
      const obs = (lap.observaciones_compra || '').toLowerCase();
      if (ebayOrderId && obs.includes(ebayOrderId)) {
        return { type: 'laptop', item: lap, confidence: 'exact', reason: `Orden #${ebayItem.orderId}` };
      }
      if (ebayItemId && obs.includes(ebayItemId)) {
        return { type: 'laptop', item: lap, confidence: 'exact', reason: `Artículo eBay #${ebayItem.itemId}` };
      }
    }

    // 2. Coincidencia por Tracking USA registrado en el módulo de Envíos
    if (ebayTracking && trackings.length > 0) {
      for (const trk of trackings) {
        const trkUsa = (trk.tracking_usa || '').replace(/[\s-]/g, '').toLowerCase();
        if (trkUsa && trkUsa === ebayTracking) {
          if (Array.isArray(trk.items)) {
            for (const ti of trk.items) {
              const lap = laptops.find(l => l.id === ti.id);
              if (lap && !excludedLaptopIds.has(lap.id)) {
                return { type: 'laptop', item: lap, confidence: 'exact', reason: `Mismo Tracking ${ebayItem.tracking_usa}` };
              }
            }
          }
        }
      }
    }

    // 3. Coincidencia semántica por Marca y Modelo de Laptop
    const stopWords = new Set(['laptop', 'notebook', 'intel', 'core', 'with', 'para', 'computadora', 'nuevo', 'used', 'refurbished', 'original', 'excelente', 'screen', 'pantalla', 'disco', 'year', 'good', 'condition', 'the', 'and', 'for']);
    const cleanKeywords = ebayTitle
      .replace(/[^\w\s]/gi, ' ')
      .split(/\s+/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length >= 3 && !stopWords.has(w));

    let bestLaptop = null;
    let maxScore = 0;

    for (const lap of laptops) {
      if (excludedLaptopIds.has(lap.id)) continue;

      const lapModel = (lap.modelo || '').toLowerCase();
      const lapBrand = (lap.marca || '').toLowerCase();
      let score = 0;

      // Coincidencia de marca (ej. Asus, Dell, Lenovo)
      if (lapBrand && ebayTitle.includes(lapBrand)) {
        score += 2;
      }

      // Coincidencia de palabras clave del modelo
      cleanKeywords.forEach(kw => {
        if (lapModel.includes(kw)) score += 2;
      });

      // Si el modelo exacto de la laptop está contenido en el título de eBay (ej. "vivobook 14", "latitude 5500")
      if (lapModel.length >= 4 && ebayTitle.includes(lapModel)) {
        score += 5;
      }

      // Proximidad de precio de compra
      if (lap.precio_ebay && ebayItem.precio) {
        const diff = Math.abs(Number(lap.precio_ebay) - Number(ebayItem.precio));
        if (diff < 2) score += 3;
        else if (diff < 15) score += 1;
      }

      // Fecha idéntica
      if (lap.fecha_compra && ebayItem.fecha_compra && lap.fecha_compra === ebayItem.fecha_compra) {
        score += 2;
      }

      if (score > maxScore) {
        maxScore = score;
        bestLaptop = lap;
      }
    }

    if (bestLaptop && maxScore >= 5) {
      return {
        type: 'laptop',
        item: bestLaptop,
        confidence: maxScore >= 7 ? 'high' : 'medium',
        reason: `Modelo: ${bestLaptop.marca || ''} ${bestLaptop.modelo || ''}`
      };
    }

    // 4. Coincidencia con Componentes
    for (const comp of componentes) {
      const compName = (comp.nombre || '').toLowerCase().trim();
      if (compName.length >= 4 && ebayTitle.includes(compName)) {
        return {
          type: 'componente',
          item: comp,
          confidence: 'high',
          reason: `Componente: ${comp.nombre}`
        };
      }
    }

    return null;
  };

  // Mapa de sugerencias calculadas en memoria con asignación 1 a 1
  const sugerenciasMap = useMemo(() => {
    // 1. Identificar laptops que ya están vinculadas en la base de datos
    const globallyLinkedLaptops = new Set();
    compras.forEach(c => {
      if (c.estado === 'en_inventario' && c.tipo_inventario === 'laptop' && c.inventario_id) {
        globallyLinkedLaptops.add(c.inventario_id);
      }
    });
    laptops.forEach(l => {
      if (l.ebay_compra_id) globallyLinkedLaptops.add(l.id);
    });

    const allocatedLaptopIds = new Set(globallyLinkedLaptops);
    const map = {};

    // 2. Emparejar compras pendientes secuencialmente de forma excluyente
    compras.forEach(item => {
      if (item.estado === 'pendiente') {
        const match = findInventoryMatch(item, allocatedLaptopIds);
        if (match) {
          map[item.id] = match;
          if (match.type === 'laptop') {
            allocatedLaptopIds.add(match.item.id);
          }
        }
      }
    });
    return map;
  }, [compras, laptops, componentes, trackings]);

  const totalSugerencias = Object.keys(sugerenciasMap).length;

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

  // Conteos para métricas y filtros
  const totalCount = compras.length;
  const pendientesCount = compras.filter(c => c.estado === 'pendiente').length;
  const enTrackingCount = compras.filter(c => c.estado === 'en_tracking').length;
  const enInventarioCount = compras.filter(c => c.estado === 'en_inventario').length;
  const descartadosCount = compras.filter(c => c.estado === 'descartado').length;

  // Filtrado y ordenación de compras (siguiendo el orden cronológico de fecha_compra)
  const comprasFiltradas = compras
    .filter(item => {
      if (filterEstado === 'pendientes' && item.estado !== 'pendiente') return false;
      if (filterEstado === 'en_tracking' && item.estado !== 'en_tracking') return false;
      if (filterEstado === 'en_inventario' && item.estado !== 'en_inventario') return false;
      if (filterEstado === 'descartados' && item.estado !== 'descartado') return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTitulo = item.titulo && item.titulo.toLowerCase().includes(term);
        const matchOrder = item.orderId && item.orderId.toLowerCase().includes(term);
        const matchTracking = item.tracking_usa && item.tracking_usa.toLowerCase().includes(term);
        const matchVendedor = item.vendedor && item.vendedor.toLowerCase().includes(term);
        if (!matchTitulo && !matchOrder && !matchTracking && !matchVendedor) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // 1. Fecha de compra descendente (más reciente primero)
      const dateA = a.fecha_compra ? new Date(a.fecha_compra).getTime() : 0;
      const dateB = b.fecha_compra ? new Date(b.fecha_compra).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;

      // 2. Si tienen la misma fecha, por fecha de sincronización descendente
      const syncA = a.fecha_sincronizacion?.toMillis?.() || (a.fecha_sincronizacion ? new Date(a.fecha_sincronizacion).getTime() : 0);
      const syncB = b.fecha_sincronizacion?.toMillis?.() || (b.fecha_sincronizacion ? new Date(b.fecha_sincronizacion).getTime() : 0);
      return syncB - syncA;
    });

  // Acciones de Auto-vinculación con sincronización a Trackings
  const handleAutoLinkAll = async () => {
    const keys = Object.keys(sugerenciasMap);
    if (keys.length === 0) {
      alert('No se detectaron coincidencias automáticas de alta certeza en este momento.');
      return;
    }

    if (!confirm(`Se detectaron ${keys.length} compras de eBay con coincidencia en tu inventario. ¿Deseas vincularlas automáticamente ahora y registrar sus trackings de USA en Envíos?`)) {
      return;
    }

    setLinkingProcessing(true);
    let linked = 0;
    let trackingsSynced = 0;

    try {
      for (const ebayId of keys) {
        const match = sugerenciasMap[ebayId];
        const ebayItem = compras.find(c => c.id === ebayId);
        let trkId = null;

        if (ebayItem?.tracking_usa) {
          try {
            const trkRes = await syncTrackingFromEbay(db, {
              ebayItem,
              inventoryItem: match.item,
              tipo: match.type
            });
            if (trkRes?.id) {
              trkId = trkRes.id;
              trackingsSynced++;
            }
          } catch (trkErr) {
            console.warn('Error sincronizando tracking para ' + ebayId, trkErr);
          }
        }

        // 1. Actualizar registro en compras_ebay
        const ebayRef = doc(db, 'compras_ebay', ebayId);
        await updateDoc(ebayRef, {
          estado: 'en_inventario',
          tipo_inventario: match.type,
          inventario_id: match.item.id,
          tracking_id: trkId || ebayItem?.tracking_id || null,
          vinculado_automatico: true,
          fecha_actualizacion: serverTimestamp()
        });

        // 2. Actualizar ficha en inventario (laptops) para cerrar vinculación bidireccional
        if (match.type === 'laptop') {
          try {
            await updateDoc(doc(db, 'laptops', match.item.id), {
              ebay_compra_id: ebayId,
              tracking_usa: ebayItem?.tracking_usa ? ebayItem.tracking_usa.trim().toUpperCase() : (match.item.tracking_usa || ''),
              precio_ebay: ebayItem?.precio || match.item.precio_ebay || 0,
              ...(trkId ? { tracking_id: trkId } : {})
            });
          } catch (lErr) {
            console.warn('No se pudo actualizar ficha de laptop con ebay_compra_id:', lErr);
          }
        }

        linked++;
      }

      setAutoLinkNotification(`¡Éxito! Se vincularon ${linked} compras con tu inventario${trackingsSynced > 0 ? ` y se sincronizaron ${trackingsSynced} encomiendas en Envíos` : ''}.`);
      setTimeout(() => setAutoLinkNotification(''), 7000);
    } catch (e) {
      alert('Error en auto-vinculación: ' + e.message);
    } finally {
      setLinkingProcessing(false);
    }
  };

  const handleConfirmSingleAutoLink = async (ebayItem, match) => {
    try {
      let trkId = null;
      if (ebayItem?.tracking_usa) {
        const trkRes = await syncTrackingFromEbay(db, {
          ebayItem,
          inventoryItem: match.item,
          tipo: match.type
        });
        trkId = trkRes?.id || null;
      }

      await updateDoc(doc(db, 'compras_ebay', ebayItem.id), {
        estado: 'en_inventario',
        tipo_inventario: match.type,
        inventario_id: match.item.id,
        tracking_id: trkId || ebayItem.tracking_id || null,
        vinculado_automatico: true,
        fecha_actualizacion: serverTimestamp()
      });

      if (match.type === 'laptop') {
        await updateDoc(doc(db, 'laptops', match.item.id), {
          ebay_compra_id: ebayItem.id,
          tracking_usa: ebayItem?.tracking_usa ? ebayItem.tracking_usa.trim().toUpperCase() : (match.item.tracking_usa || ''),
          precio_ebay: ebayItem?.precio || match.item.precio_ebay || 0,
          ...(trkId ? { tracking_id: trkId } : {})
        });
      }
    } catch (e) {
      alert('Error vinculando compra: ' + e.message);
    }
  };

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
          {/* Botón Auto-vincular Inteligente */}
          {totalSugerencias > 0 && (
            <button
              onClick={handleAutoLinkAll}
              disabled={linkingProcessing}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg transition shadow-md hover:shadow-lg animate-pulse"
              title="Vincular automáticamente todas las compras que coinciden con tu inventario"
            >
              <Sparkles className="w-4 h-4" />
              <span>Auto-vincular ({totalSugerencias})</span>
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
            <span>{syncingTrackings ? 'Sincronizando...' : 'Sincronizar Trackings USA'}</span>
          </button>

          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 rounded-lg hover:bg-blue-100 transition shadow-sm"
          >
            <Info className="w-4 h-4" />
            <span>Extensión Chrome</span>
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

      {/* Tarjetas de Métricas Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* TARJETA PENDIENTES - ALERTA ROJA DESTACADA */}
        <div 
          onClick={() => setFilterEstado('pendientes')}
          className={`cursor-pointer p-4 rounded-xl border transition-all duration-200 ${
            pendientesCount > 0 
              ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 ring-2 ring-red-500/20 shadow-md' 
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${
              pendientesCount > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-500'
            }`}>
              Pendientes de Inventario
            </span>
            {pendientesCount > 0 && (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold ${
              pendientesCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
            }`}>
              {pendientesCount}
            </span>
            <span className="text-xs text-red-600 dark:text-red-400 font-medium">
              {pendientesCount > 0 ? '¡Requieren ingresar!' : 'Al día'}
            </span>
          </div>
        </div>

        {/* En Tracking */}
        <div 
          onClick={() => setFilterEstado('en_tracking')}
          className="cursor-pointer p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              En Tránsito / Tracking
            </span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
              {enTrackingCount}
            </span>
            <span className="text-xs text-gray-400">paquetes</span>
          </div>
        </div>

        {/* En Inventario */}
        <div 
          onClick={() => setFilterEstado('en_inventario')}
          className="cursor-pointer p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-emerald-300 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              En Inventario
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {enInventarioCount}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">listos</span>
          </div>
        </div>

        {/* Total Sincronizadas */}
        <div 
          onClick={() => setFilterEstado('todos')}
          className="cursor-pointer p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total Sincronizadas
            </span>
            <ShoppingBag className="w-4 h-4 text-gray-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {totalCount}
            </span>
            <span className="text-xs text-gray-400">artículos</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterEstado('pendientes')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              filterEstado === 'pendientes'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 hover:bg-red-100'
            }`}
          >
            <span>🔴 Pendientes</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[11px] ${
              filterEstado === 'pendientes' ? 'bg-red-700 text-white' : 'bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200'
            }`}>
              {pendientesCount}
            </span>
          </button>

          <button
            onClick={() => setFilterEstado('todos')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              filterEstado === 'todos'
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Todos ({totalCount})
          </button>

          <button
            onClick={() => setFilterEstado('en_tracking')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              filterEstado === 'en_tracking'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            En Tracking ({enTrackingCount})
          </button>

          <button
            onClick={() => setFilterEstado('en_inventario')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              filterEstado === 'en_inventario'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            En Inventario ({enInventarioCount})
          </button>

          <button
            onClick={() => setFilterEstado('descartados')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              filterEstado === 'descartados'
                ? 'bg-gray-600 text-white font-semibold'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
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
              ? 'Usa la Extensión de Chrome en tu cuenta de eBay para sincronizar tus pedidos aquí.' 
              : 'Prueba cambiando los filtros para ver otras compras sincronizadas.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {comprasFiltradas.map((item) => {
            const isPendiente = item.estado === 'pendiente';
            const isEnInventario = item.estado === 'en_inventario';
            const isEnTracking = item.estado === 'en_tracking';
            const isDescartado = item.estado === 'descartado';

            const courierConfig = item.courier_usa ? getCourierUsaConfig(item.courier_usa) : null;
            const trackingUrl = item.tracking_usa ? getTrackingUrlUsa(item.courier_usa, item.tracking_usa) : null;
            const matchSuggestion = isPendiente ? sugerenciasMap[item.id] : null;

            return (
              <div 
                key={item.id}
                className={`p-4 rounded-xl border transition-all duration-150 flex flex-col gap-3 ${
                  isPendiente 
                    ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/60 hover:border-red-400 shadow-sm' 
                    : isEnInventario 
                    ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-gray-200 dark:border-gray-800'
                    : isDescartado
                    ? 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 opacity-60'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Info Principal del Producto */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {item.foto_url ? (
                        <img 
                          src={item.foto_url} 
                          alt={item.titulo} 
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.style.display = 'none'; }} 
                        />
                      ) : (
                        <ShoppingBag className="w-6 h-6 text-gray-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isPendiente && (
                          <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/60 dark:text-red-200 dark:border-red-800 flex items-center gap-1.5 shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                            PENDIENTE DE INVENTARIO
                          </span>
                        )}
                        {isEnInventario && (
                          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            En Inventario ({item.tipo_inventario === 'laptop' ? 'Laptop' : item.tipo_inventario === 'componente' ? 'Componente' : 'Registrado'})
                          </span>
                        )}
                        {isEnTracking && (
                          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            En Tracking
                          </span>
                        )}
                        {isDescartado && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                            Descartado
                          </span>
                        )}

                        {item.orderId && (
                          <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                            Orden: #{item.orderId}
                          </span>
                        )}
                        {item.itemId && (
                          <span className="text-[10px] font-mono text-gray-400">
                            Item: {item.itemId}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 group">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1 leading-snug">
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
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {editingPriceId === item.id ? (
                          <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 p-1 rounded-lg border border-emerald-300 dark:border-emerald-700 shadow-xs">
                            <span className="text-emerald-700 dark:text-emerald-300 font-bold text-xs">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={editingPriceVal}
                              onChange={(e) => setEditingPriceVal(e.target.value)}
                              className="w-24 px-1.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-200 bg-white dark:bg-gray-900 border border-emerald-300 rounded focus:outline-hidden"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSavePrice(item.id);
                                if (e.key === 'Escape') setEditingPriceId(null);
                              }}
                            />
                            <button
                              onClick={() => handleSavePrice(item.id)}
                              className="p-1 text-emerald-700 hover:bg-emerald-200 rounded"
                              title="Guardar precio"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingPriceId(null)}
                              className="p-1 text-gray-400 hover:bg-gray-200 rounded"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group/price">
                            <span 
                              onClick={() => handleStartEditPrice(item)}
                              className="font-bold text-emerald-600 dark:text-emerald-400 text-sm cursor-pointer hover:underline"
                              title="Clic para editar precio"
                            >
                              ${Number(item.precio || 0).toFixed(2)} USD
                            </span>
                            <button
                              onClick={() => handleStartEditPrice(item)}
                              className="opacity-0 group-hover/price:opacity-100 p-0.5 text-gray-400 hover:text-emerald-600 transition"
                              title="Editar precio"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {item.fecha_compra && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {item.fecha_compra}
                          </span>
                        )}
                        {item.vendedor && (
                          <span>Vendedor: <strong className="text-gray-700 dark:text-gray-300">{item.vendedor}</strong></span>
                        )}
                      </div>

                      {(() => {
                        const rawItem = String(item.itemId || '').replace(/_u[0-9]+$/, '').trim();
                        const isItemIdBogus = item.tracking_usa && rawItem && item.tracking_usa.trim() === rawItem;
                        const isWordBogus = item.tracking_usa && (item.tracking_usa.toLowerCase() === 'experience' || item.tracking_usa.replace(/\D/g, '').length < 4);
                        if (isItemIdBogus || isWordBogus) {
                          return (
                            <div className="pt-1 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-800">
                              <span>⚠️ Tracking inválido ({item.tracking_usa}{isItemIdBogus ? ' es el Item ID' : ''}).</span>
                              <button
                                onClick={() => handleOpenQuickTracking(item)}
                                className="underline font-semibold hover:text-amber-800"
                              >
                                Corregir
                              </button>
                            </div>
                          );
                        }

                        const rawItemId = String(item.itemId || '').replace(/_u[0-9]+$/, '').trim();
                        const rawOrderId = String(item.orderId || '').replace(/[\s-]/g, '').trim();
                        const isBogusTracking = item.tracking_usa && (
                          item.tracking_usa === rawItemId ||
                          item.tracking_usa === rawOrderId ||
                          /^[0-9]{2}-[0-9]{5}-[0-9]{5}$/.test(item.tracking_usa) ||
                          item.tracking_usa.startsWith('{') ||
                          item.tracking_usa.includes('EVENTFAMILY')
                        );

                        if (item.tracking_usa && !isBogusTracking) {
                          const trk = trackings.find(t => (t.tracking_usa || '').trim().toUpperCase() === item.tracking_usa.trim().toUpperCase() || t.id === item.tracking_id);
                          return (
                            <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                              <span className="text-gray-400">Tracking USA:</span>
                              {trackingUrl ? (
                                <a 
                                  href={trackingUrl} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="font-mono text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
                                >
                                  <span>{courierConfig?.label || (item.courier_usa?.toUpperCase() || 'USA')}:</span>
                                  <span>{item.tracking_usa}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                                  {item.tracking_usa}
                                </span>
                              )}

                              <button
                                onClick={() => handleOpenQuickTracking(item)}
                                className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition"
                                title="Editar Tracking USA"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>

                              {trk && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                  trk.tracking_vzla 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                }`}>
                                  <Package className="w-3 h-3" />
                                  <span>{trk.tracking_vzla ? `VZLA: ${trk.tracking_vzla}` : 'En Envíos (Falta Tracking VZLA)'}</span>
                                </span>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                            {isBogusTracking && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800" title="Se detectó el ID del artículo como tracking">
                                ⚠️ ID de compra detectado (Pendiente de tracking)
                              </span>
                            )}
                            {item.shipping_status === 'awaiting_shipment' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800" title="El vendedor en eBay aún no ha emitido la guía de envío">
                                ⏳ Awaiting tracking
                              </span>
                            )}
                            <button
                              onClick={() => handleOpenQuickTracking(item)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-dashed border-purple-300 dark:border-purple-800 rounded-lg transition"
                              title="Asignar número de Tracking USA a esta compra"
                            >
                              <Plus className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                              <span>Tracking USA</span>
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Acciones Rápidas */}
                  <div className="flex flex-wrap md:flex-nowrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-gray-200 dark:border-gray-700 flex-shrink-0">
                    {/* Botón Vincular a Inventario Existente (Manual) */}
                    {isPendiente && (
                      <button
                        onClick={() => handleOpenLinkModal(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 rounded-lg transition"
                        title="Vincular con un producto ya registrado en el inventario"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>Vincular</span>
                      </button>
                    )}

                    {/* Ver Ficha en Inventario si ya está vinculado */}
                    {isEnInventario && item.inventario_id && (
                      <button
                        onClick={() => {
                          if (item.tipo_inventario === 'laptop') navigate(`/admin/edit/${item.inventario_id}`);
                          else if (item.tipo_inventario === 'componente') navigate(`/admin/components/edit/${item.inventario_id}`);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                        title="Abrir ficha del producto en inventario"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Ver Ficha</span>
                      </button>
                    )}

                    {/* Desvincular si ya está en inventario */}
                    {isEnInventario && (
                      <button
                        onClick={() => handleUnlink(item)}
                        className="p-1.5 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-gray-100 transition"
                        title="Desvincular y volver a estado pendiente"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    )}

                    {/* Convertir a Nueva Laptop */}
                    {isPendiente && (
                      <button
                        onClick={() => handleConvertToLaptop(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs"
                        title="Crear ficha de Laptop con estos datos precargados"
                      >
                        <Laptop className="w-3.5 h-3.5" />
                        <span>+ Laptop</span>
                      </button>
                    )}

                    {/* Convertir a Nuevo Componente */}
                    {isPendiente && (
                      <button
                        onClick={() => handleConvertToComponent(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
                        title="Crear componente con estos datos precargados"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>+ Comp.</span>
                      </button>
                    )}

                    {/* Crear Tracking */}
                    {!isEnTracking && (
                      <button
                        onClick={() => handleOpenTrackingModal(item)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 border border-purple-200 rounded-lg transition"
                        title="Crear o asociar a encomienda"
                      >
                        <Box className="w-3.5 h-3.5" />
                        <span>Tracking</span>
                      </button>
                    )}

                    {/* Descartar / Restaurar */}
                    <button
                      onClick={() => handleToggleDescartar(item)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                      title={isDescartado ? "Restaurar a pendientes" : "Descartar (compra personal o no tienda)"}
                    >
                      {isDescartado ? <RotateCcw className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    {/* Eliminar */}
                    <button
                      onClick={() => setDeleteConfirm({ open: true, id: item.id, title: item.titulo })}
                      className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                      title="Eliminar registro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Banner de Sugerencia Automática de Coincidencia */}
                {matchSuggestion && (
                  <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-indigo-900 dark:text-indigo-200 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                      <span>
                        Sugerencia en inventario: <strong>{matchSuggestion.item.marca || ''} {matchSuggestion.item.modelo || matchSuggestion.item.nombre}</strong>
                        {matchSuggestion.item.precio_ebay ? ` • $${matchSuggestion.item.precio_ebay} USD` : ''} 
                        <span className="text-indigo-500 text-[11px] ml-1">({matchSuggestion.reason})</span>
                      </span>
                    </div>
                    <button
                      onClick={() => handleConfirmSingleAutoLink(item, matchSuggestion)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md shadow-xs text-xs self-start sm:self-auto flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Vincular Ahora</span>
                    </button>
                  </div>
                )}
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
