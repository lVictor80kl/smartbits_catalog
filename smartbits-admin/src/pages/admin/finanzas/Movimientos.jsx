import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useCorteContable } from '../../../utils/useCorteContable';
import { calcularDiferencial, derivarTasaReal, calcularDestino } from '../../../utils/diferencialCambiario';
import { 
  TrendingDown, Users, ArrowRightLeft, PlusCircle, Search, Trash2, Edit2, 
  Loader2, Filter, AlertCircle, CheckCircle, Calendar, RefreshCw, X, Save
} from 'lucide-react';

const CUENTAS_FIJAS = [
  { key: 'efectivo', label: 'Efectivo (USD)', moneda: 'USD' },
  { key: 'zelle', label: 'Zelle (USD)', moneda: 'USD' },
  { key: 'binance', label: 'Binance USDT (USD)', moneda: 'USD' },
  { key: 'zinli', label: 'Zinli (USD)', moneda: 'USD' },
  { key: 'bancamiga', label: 'Bancamiga (USD)', moneda: 'USD' },
  { key: 'paypal', label: 'PayPal (USD)', moneda: 'USD' },
  { key: 'venezuela', label: 'Banco Venezuela (Bs)', moneda: 'BS' },
  { key: 'bolivares_bs', label: 'Otros Bs (Bs)', moneda: 'BS' },
];

export default function Movimientos() {
  const { corte, loading: loadingCorte } = useCorteContable();

  // Tipo de operación en formulario: 'gasto_op' | 'retiro' | 'transferencia'
  const [tipoOperacion, setTipoOperacion] = useState('gasto_op');
  const [saving, setSaving] = useState(false);

  // Cuentas dinámicas desde Firestore
  const [cuentasDinamicas, setCuentasDinamicas] = useState([]);
  const [tasaCaja, setTasaCaja] = useState(1);

  // Formulario Gasto Operativo
  const [formGasto, setFormGasto] = useState({
    categoria: 'publicidad',
    concepto: '',
    monto: '',
    metodo_pago: 'efectivo',
    tasa: ''
  });

  // Formulario Reembolso
  const [formReembolso, setFormReembolso] = useState({
    categoria: 'reembolso',
    concepto: '',
    monto: '',
    cuenta_destino: 'paypal'
  });

  // Formulario Retiro Socio
  const [formRetiro, setFormRetiro] = useState({
    socio: 'ysmael',
    concepto: '',
    monto: '',
    cuenta_salida: 'efectivo'
  });

  // Formulario Transferencia Interna
  const [formTransfer, setFormTransfer] = useState({
    cuenta_origen: 'binance',
    cuenta_destino: 'efectivo',
    monto_origen: '',
    monto_destino: '',
    tasa_cambio: '',
    concepto: ''
  });

  // Listas de datos
  const [gastosOp, setGastosOp] = useState([]);
  const [gastosPers, setGastosPers] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [reembolsos, setReembolsos] = useState([]);
  const [comprasInventario, setComprasInventario] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filtros de tabla
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'gasto_op' | 'retiro_ysmael' | 'retiro_victor' | 'transferencia'
  const [busqueda, setBusqueda] = useState('');

  // Modales de eliminación y edición
  const [deleteModal, setDeleteModal] = useState({ open: false, item: null, processing: false });
  const [editModal, setEditModal] = useState({ open: false, item: null, processing: false, data: {} });

  // Escuchar cuentas dinámicas de caja
  useEffect(() => {
    const unsubCaja = onSnapshot(doc(db, 'caja', 'saldos'), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setCuentasDinamicas(data._cuentas_dinamicas || []);
        setTasaCaja(Number(data.tasa_cambio) || 1);
      }
    });
    return () => unsubCaja();
  }, []);

  const todasCuentas = [
    ...CUENTAS_FIJAS,
    ...cuentasDinamicas.map(c => ({
      key: c.key,
      label: `${c.label} (${c.moneda})`,
      moneda: c.moneda
    }))
  ];

  const tasaCambio = Number(tasaCaja) || Number(corte?.tasa_cambio_corte) || 1;

  // Cuenta/moneda seleccionada para el gasto operativo
  const cuentaFormGasto = todasCuentas.find(c => c.key === formGasto.metodo_pago);
  const esFormGastoBs = cuentaFormGasto?.moneda === 'BS';

  // Cuentas/monedas seleccionadas para la transferencia
  const cuentaTransOrigen = todasCuentas.find(c => c.key === formTransfer.cuenta_origen);
  const cuentaTransDestino = todasCuentas.find(c => c.key === formTransfer.cuenta_destino);
  const monedaTransOrigen = cuentaTransOrigen?.moneda || 'USD';
  const monedaTransDestino = cuentaTransDestino?.moneda || 'USD';
  const esCambioDivisa = monedaTransOrigen !== monedaTransDestino;

  // Sincronización bidireccional en el formulario de transferencia
  const syncDestinoDesdeTasa = (p, montoOrigen, tasa) => {
    const destino = calcularDestino({
      montoOrigen, tasa,
      monedaOrigen: monedaTransOrigen,
      monedaDestino: monedaTransDestino
    });
    return Number.isFinite(destino) ? destino.toFixed(2) : p.monto_destino;
  };
  const handleTransOrigenChange = (e) => {
    const val = e.target.value;
    setFormTransfer(p => {
      const up = { ...p, monto_origen: val };
      if (esCambioDivisa && val && p.tasa_cambio) {
        up.monto_destino = syncDestinoDesdeTasa(p, val, p.tasa_cambio);
      }
      return up;
    });
  };
  const handleTransTasaChange = (e) => {
    const val = e.target.value;
    setFormTransfer(p => {
      const up = { ...p, tasa_cambio: val };
      if (esCambioDivisa && p.monto_origen && val) {
        up.monto_destino = syncDestinoDesdeTasa(p, p.monto_origen, val);
      }
      return up;
    });
  };
  const handleTransDestinoChange = (e) => {
    const val = e.target.value;
    setFormTransfer(p => {
      const up = { ...p, monto_destino: val };
      if (esCambioDivisa && p.monto_origen && val) {
        const tasa = derivarTasaReal({
          montoOrigen: p.monto_origen, montoDestino: val,
          monedaOrigen: monedaTransOrigen,
          monedaDestino: monedaTransDestino
        });
        if (tasa !== null && Number.isFinite(tasa)) up.tasa_cambio = tasa.toFixed(2);
      }
      return up;
    });
  };

  // Formato de monto con moneda
  const fmtMontoMoneda = (moneda, monto) => moneda === 'BS'
    ? `Bs ${Number(monto).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${Number(monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const monedaDeCuenta = (key) => todasCuentas.find(c => c.key === key)?.moneda || 'USD';

  const getCuentaLabel = (key) => {
    const found = todasCuentas.find(c => c.key === key);
    return found ? found.label : key;
  };

  useEffect(() => {
    if (!corte?.fecha_corte) {
      setLoadingData(false);
      return;
    }

    const fechaCorte = corte.fecha_corte_js || (corte.fecha_corte ? corte.fecha_corte.toDate() : new Date(0));

    // 1. Gastos Operativos post-corte
    const qOp = query(collection(db, 'gastos_operativos'), where('fecha', '>=', fechaCorte), orderBy('fecha', 'desc'));
    const unsubOp = onSnapshot(qOp, snap => {
      setGastosOp(snap.docs.map(d => ({ id: d.id, coleccion: 'gastos_operativos', tipo_mov: 'gasto_op', ...d.data() })));
    });

    // 2. Gastos Personales (Retiros) post-corte
    const qPers = query(collection(db, 'gastos_personales'), where('fecha', '>=', fechaCorte), orderBy('fecha', 'desc'));
    const unsubPers = onSnapshot(qPers, snap => {
      setGastosPers(snap.docs.map(d => ({ id: d.id, coleccion: 'gastos_personales', tipo_mov: 'retiro', ...d.data() })));
    });

    // 3. Transferencias Internas post-corte
    const qTrans = query(collection(db, 'transferencias_internas'), where('fecha', '>=', fechaCorte), orderBy('fecha', 'desc'));
    const unsubTrans = onSnapshot(qTrans, snap => {
      setTransferencias(snap.docs.map(d => ({ id: d.id, coleccion: 'transferencias_internas', tipo_mov: 'transferencia', ...d.data() })));
    });

    // 4. Reembolsos / Ingresos
    const qReemb = query(collection(db, 'reembolsos'), where('fecha', '>=', fechaCorte), orderBy('fecha', 'desc'));
    const unsubReemb = onSnapshot(qReemb, snap => {
      setReembolsos(snap.docs.map(d => ({ id: d.id, coleccion: 'reembolsos', tipo_mov: 'reembolso', ...d.data() })));
    });

    // 5. Compras de Inventario
    const qComp = query(collection(db, 'compras_inventario'), where('fecha', '>=', fechaCorte), orderBy('fecha', 'desc'));
    const unsubComp = onSnapshot(qComp, snap => {
      setComprasInventario(snap.docs.map(d => ({ id: d.id, coleccion: 'compras_inventario', tipo_mov: 'compra_inventario', ...d.data() })));
      setLoadingData(false);
    });

    return () => {
      unsubOp();
      unsubPers();
      unsubTrans();
      unsubReemb();
      unsubComp();
    };
  }, [corte]);

  // --- SUBMIT REGISTRO NUEVO ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (tipoOperacion === 'gasto_op') {
        if (!formGasto.monto || !formGasto.concepto) throw new Error("Completa todos los campos requeridos.");
        const montoNum = Number(formGasto.monto);
        if (isNaN(montoNum) || montoNum <= 0) throw new Error("Monto inválido");

        const cuentaSeleccionada = todasCuentas.find(c => c.key === formGasto.metodo_pago);
        const esBs = cuentaSeleccionada?.moneda === 'BS';
        const tasaUsada = esBs ? (Number(formGasto.tasa) || tasaCambio) : 1;
        const montoUsd = esBs ? montoNum / tasaUsada : montoNum;

        await addDoc(collection(db, 'gastos_operativos'), {
          categoria: formGasto.categoria,
          concepto: formGasto.concepto,
          monto: montoUsd,
          monto_original: montoNum,
          moneda_original: esBs ? 'BS' : 'USD',
          tasa_cambio: tasaUsada,
          metodo_pago: formGasto.metodo_pago,
          fecha: serverTimestamp()
        });

        if (formGasto.metodo_pago) {
          await updateDoc(doc(db, 'caja', 'saldos'), {
            [formGasto.metodo_pago]: increment(-montoNum),
            updated_at: new Date()
          });
        }
        setFormGasto({ categoria: 'publicidad', concepto: '', monto: '', metodo_pago: 'efectivo', tasa: '' });
        alert("✅ Gasto operativo registrado.");
      } 
      else if (tipoOperacion === 'retiro') {
        if (!formRetiro.monto || !formRetiro.concepto) throw new Error("Completa todos los campos requeridos.");
        const montoNum = Number(formRetiro.monto);
        if (isNaN(montoNum) || montoNum <= 0) throw new Error("Monto inválido");

        await addDoc(collection(db, 'gastos_personales'), {
          socio: formRetiro.socio,
          concepto: formRetiro.concepto,
          monto: montoNum,
          metodo_pago: formRetiro.cuenta_salida,
          cuenta_salida: formRetiro.cuenta_salida,
          es_deuda: true,
          fecha: serverTimestamp()
        });

        if (formRetiro.cuenta_salida) {
          await updateDoc(doc(db, 'caja', 'saldos'), {
            [formRetiro.cuenta_salida]: increment(-montoNum),
            updated_at: new Date()
          });
        }
        setFormRetiro({ socio: 'ysmael', concepto: '', monto: '', cuenta_salida: 'efectivo' });
        alert("✅ Retiro de socio registrado.");
      }
      else if (tipoOperacion === 'transferencia') {
        if (!formTransfer.monto_origen) throw new Error("Ingresa el monto a transferir.");
        if (formTransfer.cuenta_origen === formTransfer.cuenta_destino) throw new Error("Las cuentas origen y destino deben ser distintas.");
        const montoSale = Number(formTransfer.monto_origen);
        const monedaOrigen = monedaTransOrigen;
        const monedaDestino = monedaTransDestino;
        const cambioDivisa = monedaOrigen !== monedaDestino;
        const montoLlega = (() => {
          const destinoManual = Number(formTransfer.monto_destino);
          if (destinoManual && destinoManual > 0) return destinoManual;
          if (cambioDivisa) {
            return calcularDestino({
              montoOrigen: montoSale,
              tasa: Number(formTransfer.tasa_cambio) || tasaCambio,
              monedaOrigen,
              monedaDestino
            });
          }
          return montoSale;
        })();
        if (isNaN(montoSale) || montoSale <= 0 || isNaN(montoLlega) || montoLlega <= 0) throw new Error("Montos inválidos");

        const tasaReal = cambioDivisa ? (Number(formTransfer.tasa_cambio) || tasaCambio) : null;
        const tasaReferencia = tasaCambio;
        const diferencialUsd = calcularDiferencial({
          montoOrigen: montoSale,
          montoDestino: montoLlega,
          monedaOrigen,
          monedaDestino,
          tasaReferencia
        });

        await addDoc(collection(db, 'transferencias_internas'), {
          cuenta_origen: formTransfer.cuenta_origen,
          cuenta_destino: formTransfer.cuenta_destino,
          monto_origen: montoSale,
          monto_destino: montoLlega,
          tasa_cambio: tasaReal,
          tasa_referencia: tasaReferencia,
          moneda_origen: monedaOrigen,
          moneda_destino: monedaDestino,
          diferencial_usd: diferencialUsd,
          concepto: formTransfer.concepto || 'Transferencia entre cuentas propias',
          fecha: serverTimestamp()
        });

        await updateDoc(doc(db, 'caja', 'saldos'), {
          [formTransfer.cuenta_origen]: increment(-montoSale),
          [formTransfer.cuenta_destino]: increment(montoLlega),
          updated_at: new Date()
        });

        setFormTransfer({ cuenta_origen: 'binance', cuenta_destino: 'efectivo', monto_origen: '', monto_destino: '', tasa_cambio: '', concepto: '' });
        alert("✅ Transferencia interna realizada.");
      }
      else if (tipoOperacion === 'reembolso') {
        if (!formReembolso.monto || !formReembolso.concepto) throw new Error("Completa todos los campos requeridos.");
        const montoNum = Number(formReembolso.monto);
        if (isNaN(montoNum) || montoNum <= 0) throw new Error("Monto inválido");

        await addDoc(collection(db, 'reembolsos'), {
          categoria: formReembolso.categoria,
          concepto: formReembolso.concepto,
          monto: montoNum,
          cuenta_destino: formReembolso.cuenta_destino,
          fecha: serverTimestamp()
        });

        if (formReembolso.cuenta_destino) {
          await updateDoc(doc(db, 'caja', 'saldos'), {
            [formReembolso.cuenta_destino]: increment(montoNum),
            updated_at: new Date()
          });
        }
        setFormReembolso({ categoria: 'reembolso', concepto: '', monto: '', cuenta_destino: 'paypal' });
        alert("✅ Reembolso registrado.");
      }
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }
    setSaving(false);
  };

  // --- BORRADO CON ROLLBACK EN CAJA ---
  const handleConfirmDelete = async () => {
    const { item } = deleteModal;
    if (!item) return;
    setDeleteModal(p => ({ ...p, processing: true }));

    try {
      if (item.tipo_mov === 'gasto_op') {
        if (item.metodo_pago && item.monto) {
          const montoReintegrar = Number(item.monto_original) || Number(item.monto);
          await updateDoc(doc(db, 'caja', 'saldos'), {
            [item.metodo_pago]: increment(montoReintegrar),
            updated_at: new Date()
          });
        }
        await deleteDoc(doc(db, 'gastos_operativos', item.id));
      } else if (item.tipo_mov === 'retiro') {
        const cuenta = item.cuenta_salida || item.metodo_pago;
        if (cuenta && item.monto) {
          await updateDoc(doc(db, 'caja', 'saldos'), {
            [cuenta]: increment(Number(item.monto)),
            updated_at: new Date()
          });
        }
        await deleteDoc(doc(db, 'gastos_personales', item.id));
      } else if (item.tipo_mov === 'transferencia') {
        if (item.cuenta_origen && item.cuenta_destino) {
          await updateDoc(doc(db, 'caja', 'saldos'), {
            [item.cuenta_origen]: increment(Number(item.monto_origen || 0)),
            [item.cuenta_destino]: increment(-Number(item.monto_destino || item.monto_origen || 0)),
            updated_at: new Date()
          });
        }
        await deleteDoc(doc(db, 'transferencias_internas', item.id));
      } else if (item.tipo_mov === 'reembolso') {
        if (item.cuenta_destino && item.monto) {
          await updateDoc(doc(db, 'caja', 'saldos'), {
            [item.cuenta_destino]: increment(-Number(item.monto)),
            updated_at: new Date()
          });
        }
        await deleteDoc(doc(db, 'reembolsos', item.id));
      } else if (item.tipo_mov === 'compra_inventario') {
        if (item.metodo_pago && (item.monto || item.monto_original)) {
          const montoReintegro = item.moneda_original === 'BS'
            ? Number(item.monto_original || item.monto || 0)
            : Number(item.monto || item.monto_original || 0);
          await updateDoc(doc(db, 'caja', 'saldos'), {
            [item.metodo_pago]: increment(montoReintegro),
            updated_at: new Date()
          });
        }
        await deleteDoc(doc(db, 'compras_inventario', item.id));
      }

      setDeleteModal({ open: false, item: null, processing: false });
      alert("Movimiento eliminado y caja re-balanceada.");
    } catch (err) {
      console.error(err);
      alert("Error al eliminar: " + err.message);
      setDeleteModal(p => ({ ...p, processing: false }));
    }
  };

  // --- LISTADO COMBINADO Y FILTRADO ---
  const todosMovimientos = [
    ...gastosOp,
    ...gastosPers,
    ...transferencias,
    ...reembolsos,
    ...comprasInventario
  ].filter(m => {
    if (filtroTipo === 'gasto_op' && m.tipo_mov !== 'gasto_op') return false;
    if (filtroTipo === 'compra_inventario' && m.tipo_mov !== 'compra_inventario') return false;
    if (filtroTipo === 'retiro_ysmael' && (m.tipo_mov !== 'retiro' || m.socio !== 'ysmael')) return false;
    if (filtroTipo === 'retiro_victor' && (m.tipo_mov !== 'retiro' || m.socio !== 'victor')) return false;
    if (filtroTipo === 'transferencia' && m.tipo_mov !== 'transferencia') return false;
    if (filtroTipo === 'reembolso' && m.tipo_mov !== 'reembolso') return false;

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const txtConcepto = (m.concepto || '').toLowerCase();
      const txtCat = (m.categoria || '').toLowerCase();
      const txtSocio = (m.socio || '').toLowerCase();
      const txtCuentas = `${m.cuenta_origen || ''} ${m.cuenta_destino || ''} ${m.metodo_pago || ''}`.toLowerCase();
      return txtConcepto.includes(q) || txtCat.includes(q) || txtSocio.includes(q) || txtCuentas.includes(q);
    }
    return true;
  }).sort((a, b) => {
    const fA = a.fecha?.toDate ? a.fecha.toDate().getTime() : 0;
    const fB = b.fecha?.toDate ? b.fecha.toDate().getTime() : 0;
    return fB - fA;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* FORMULARIO UNIFICADO DE MOVIMIENTOS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-brand-600" />
              Nuevo Movimiento
            </h3>
            <p className="text-xs text-slate-500">Registra gastos operativos, retiros o transferencias entre tus cuentas</p>
          </div>

          {/* SELECTOR DE TIPO (PILLS) */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setTipoOperacion('gasto_op')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                tipoOperacion === 'gasto_op' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" /> Gasto Operativo
            </button>
            <button
              type="button"
              onClick={() => setTipoOperacion('retiro')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                tipoOperacion === 'retiro' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Retiro Socio
            </button>
            <button
              type="button"
              onClick={() => setTipoOperacion('transferencia')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                tipoOperacion === 'transferencia' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> Transferencia
            </button>
            <button
              type="button"
              onClick={() => setTipoOperacion('reembolso')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                tipoOperacion === 'reembolso' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reembolso
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* CAMPOS: GASTO OPERATIVO */}
          {tipoOperacion === 'gasto_op' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Categoría</label>
                <select
                  value={formGasto.categoria}
                  onChange={e => setFormGasto(p => ({ ...p, categoria: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="publicidad">Publicidad (Ads)</option>
                  <option value="gasolina">Gasolina / Transporte</option>
                  <option value="envio">Envíos y Deliverys</option>
                  <option value="software">Software / Hosting</option>
                  <option value="otros">Otros</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Concepto</label>
                <input
                  type="text"
                  placeholder="Ej: Meta Ads quincena..."
                  value={formGasto.concepto}
                  onChange={e => setFormGasto(p => ({ ...p, concepto: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Monto ({esFormGastoBs ? 'Bs' : 'USD'})</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">{esFormGastoBs ? 'Bs' : '$'}</span>
                  <input
                    type="number" step="0.01" min="0.01"
                    placeholder="0.00"
                    value={formGasto.monto}
                    onChange={e => setFormGasto(p => ({ ...p, monto: e.target.value }))}
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
              </div>

              {esFormGastoBs && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tasa de cambio (Bs/$)</label>
                  <div className="flex gap-2">
                    <input
                      type="number" step="0.01" min="0.01"
                      placeholder={tasaCambio.toFixed(2)}
                      value={formGasto.tasa}
                      onChange={e => setFormGasto(p => ({ ...p, tasa: e.target.value }))}
                      className="w-full pl-3 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-brand-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setFormGasto(p => ({ ...p, tasa: tasaCambio.toString() }))}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg whitespace-nowrap"
                    >
                      Usar guardada (Bs {tasaCambio.toFixed(2)})
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descontar de cuenta</label>
                <select
                  value={formGasto.metodo_pago}
                  onChange={e => setFormGasto(p => ({ ...p, metodo_pago: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  {todasCuentas.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                  <option value="">No descontar (Manual)</option>
                </select>
              </div>
            </div>
          )}

          {/* CAMPOS: RETIRO SOCIO */}
          {tipoOperacion === 'retiro' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Socio que retira</label>
                <div className="flex gap-2">
                  {['ysmael', 'victor'].map(s => (
                    <label key={s} className={`flex-1 py-1.5 text-center rounded-lg border-2 cursor-pointer font-bold capitalize text-xs transition-colors ${
                      formRetiro.socio === s ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'
                    }`}>
                      <input
                        type="radio" value={s}
                        checked={formRetiro.socio === s}
                        onChange={() => setFormRetiro(p => ({ ...p, socio: s }))}
                        className="hidden"
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Concepto</label>
                <input
                  type="text"
                  placeholder="Ej: Adelanto quincena, tarjeta..."
                  value={formRetiro.concepto}
                  onChange={e => setFormRetiro(p => ({ ...p, concepto: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Monto (USD)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">$</span>
                  <input
                    type="number" step="0.01" min="0.01"
                    placeholder="0.00"
                    value={formRetiro.monto}
                    onChange={e => setFormRetiro(p => ({ ...p, monto: e.target.value }))}
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cuenta de salida</label>
                <select
                  value={formRetiro.cuenta_salida}
                  onChange={e => setFormRetiro(p => ({ ...p, cuenta_salida: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  {todasCuentas.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* CAMPOS: TRANSFERENCIA */}
          {tipoOperacion === 'transferencia' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cuenta Origen (Sale)</label>
                <select
                  value={formTransfer.cuenta_origen}
                  onChange={e => setFormTransfer(p => ({ ...p, cuenta_origen: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  {todasCuentas.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cuenta Destino (Entra)</label>
                <select
                  value={formTransfer.cuenta_destino}
                  onChange={e => setFormTransfer(p => ({ ...p, cuenta_destino: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  {todasCuentas.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Monto que sale ({monedaTransOrigen})</label>
                <input
                  type="number" step="0.01" min="0.01"
                  placeholder="0.00"
                  value={formTransfer.monto_origen}
                  onChange={handleTransOrigenChange}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Monto que llega ({monedaTransDestino})</label>
                <input
                  type="number" step="0.01" min="0.01"
                  placeholder={formTransfer.monto_origen || '0.00'}
                  value={formTransfer.monto_destino}
                  onChange={handleTransDestinoChange}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              {esCambioDivisa && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tasa real de la operación (Bs/$)</label>
                  <div className="flex gap-2">
                    <input
                      type="number" step="0.01" min="0.01"
                      placeholder={tasaCambio.toFixed(2)}
                      value={formTransfer.tasa_cambio}
                      onChange={handleTransTasaChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-brand-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setFormTransfer(p => ({ ...p, tasa_cambio: tasaCambio.toString() }))}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg whitespace-nowrap"
                    >
                      Usar guardada (Bs {tasaCambio.toFixed(2)})
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CAMPOS: REEMBOLSO */}
          {tipoOperacion === 'reembolso' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Concepto</label>
                <input
                  type="text"
                  placeholder="Ej: Devolución de envío, reembolso parcial..."
                  value={formReembolso.concepto}
                  onChange={e => setFormReembolso(p => ({ ...p, concepto: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Monto devuelto (USD)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">$</span>
                  <input
                    type="number" step="0.01" min="0.01"
                    placeholder="0.00"
                    value={formReembolso.monto}
                    onChange={e => setFormReembolso(p => ({ ...p, monto: e.target.value }))}
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cuenta de entrada (Destino)</label>
                <select
                  value={formReembolso.cuenta_destino}
                  onChange={e => setFormReembolso(p => ({ ...p, cuenta_destino: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  {todasCuentas.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              {saving ? 'Guardando...' : 'Registrar Movimiento'}
            </button>
          </div>
        </form>
      </div>

      {/* TABLA HISTORIAL DE MOVIMIENTOS POST-CORTE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <h3 className="font-bold text-slate-800 text-base">Historial de Movimientos</h3>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              {todosMovimientos.length}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Buscador */}
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por concepto o socio..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Selector filtro tipo */}
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              className="w-full sm:w-auto border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="todos">Todos los tipos</option>
              <option value="gasto_op">Gastos Operativos</option>
              <option value="compra_inventario">Compras Inventario</option>
              <option value="reembolso">Reembolsos / Ingresos</option>
              <option value="retiro_ysmael">Retiros Ysmael</option>
              <option value="retiro_victor">Retiros Víctor</option>
              <option value="transferencia">Transferencias Internas</option>
            </select>
          </div>
        </div>

        {loadingData ? (
          <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" /> Cargando movimientos...
          </div>
        ) : todosMovimientos.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No se encontraron movimientos registrados post-corte con los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Concepto</th>
                  <th className="px-4 py-3">Cuenta(s)</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todosMovimientos.map(item => {
                  const fechaStr = item.fecha?.toDate
                    ? item.fecha.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : 'Pendiente';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-xs whitespace-nowrap font-medium text-slate-500">
                        {fechaStr}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.tipo_mov === 'gasto_op' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                            Gasto Op ({item.categoria})
                          </span>
                        )}
                        {item.tipo_mov === 'compra_inventario' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                            Compra Inv
                          </span>
                        )}
                        {item.tipo_mov === 'retiro' && (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            item.socio === 'ysmael' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            Retiro: {item.socio?.toUpperCase()}
                          </span>
                        )}
                        {item.tipo_mov === 'transferencia' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                            Transferencia
                          </span>
                        )}
                        {item.tipo_mov === 'reembolso' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                            Reembolso
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {item.concepto || 'Sin descripción'}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-600">
                        {item.tipo_mov === 'transferencia'
                          ? `${getCuentaLabel(item.cuenta_origen)} → ${getCuentaLabel(item.cuenta_destino)}`
                          : getCuentaLabel(item.metodo_pago || item.cuenta_salida || item.cuenta_destino || 'N/A')
                        }
                      </td>

                      <td className="px-4 py-3 text-right font-black">
                        {item.tipo_mov === 'gasto_op' && (
                          <span className="text-orange-600">
                          {item.moneda_original === 'BS'
                            ? `-Bs ${Number(item.monto_original).toFixed(2)}${item.monto ? ` (≈$${Number(item.monto).toFixed(2)})` : ''}`
                            : `-$${Number(item.monto).toFixed(2)}`}
                        </span>
                        )}
                        {item.tipo_mov === 'retiro' && (
                          <span className="text-red-600">-${Number(item.monto).toFixed(2)}</span>
                        )}
                        {item.tipo_mov === 'transferencia' && (
                          <div className="text-right">
                            <span className="text-blue-600">
                              {fmtMontoMoneda(item.moneda_origen || monedaDeCuenta(item.cuenta_origen), item.monto_origen)}
                              {item.monto_destino && item.monto_destino !== item.monto_origen && ` → ${fmtMontoMoneda(item.moneda_destino || monedaDeCuenta(item.cuenta_destino), item.monto_destino)}`}
                            </span>
                            {Number(item.diferencial_usd) !== 0 && (
                              <div className={`text-[10px] font-black ${Number(item.diferencial_usd) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {Number(item.diferencial_usd) > 0 ? 'Ganancia' : 'Pérdida'} camb.: {fmtMontoMoneda('USD', Math.abs(Number(item.diferencial_usd)))}
                              </div>
                            )}
                          </div>
                        )}
                        {item.tipo_mov === 'reembolso' && (
                          <span className="text-emerald-600">+${Number(item.monto).toFixed(2)}</span>
                        )}
                        {item.tipo_mov === 'compra_inventario' && !item.es_ingreso && (
                          <span className="text-indigo-600">-${Number(item.monto).toFixed(2)}</span>
                        )}
                        {item.tipo_mov === 'compra_inventario' && item.es_ingreso && (
                          <span className="text-emerald-600">+${Number(item.monto).toFixed(2)}</span>
                        )}
                        {item.tipo_mov === 'gasto_op' && item.es_ingreso && (
                          <span className="text-emerald-600">+${Number(item.monto).toFixed(2)}</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setDeleteModal({ open: true, item, processing: false })}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar movimiento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMACIÓN DE BORRADO */}
      {deleteModal.open && deleteModal.item && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-center text-slate-900">¿Eliminar este movimiento?</h3>
            <p className="text-xs text-center text-slate-500">
              Esta acción revertirá automáticamente el saldo en la caja afectada.
            </p>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <p><span className="font-bold text-slate-700">Concepto:</span> {deleteModal.item.concepto}</p>
              <p><span className="font-bold text-slate-700">Monto:</span> ${Number(deleteModal.item.monto || deleteModal.item.monto_origen).toFixed(2)}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={deleteModal.processing}
                onClick={() => setDeleteModal({ open: false, item: null, processing: false })}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteModal.processing}
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
              >
                {deleteModal.processing ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
