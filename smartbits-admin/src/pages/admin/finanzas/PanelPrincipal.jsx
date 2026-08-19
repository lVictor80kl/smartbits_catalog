import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, orderBy, limit, addDoc, updateDoc, increment, serverTimestamp, getDocs, arrayUnion } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useCorteContable } from '../../../utils/useCorteContable';
import { getCostoTotal } from '../../../utils/costos';
import { calcularDiferencial, derivarTasaReal, calcularDestino } from '../../../utils/diferencialCambiario';
import { 
  TrendingUp, TrendingDown, Users, Wallet, ArrowRightLeft, PlusCircle, 
  Settings, AlertTriangle, ShieldCheck, DollarSign, Landmark, RefreshCw,
  Clock, CheckCircle, Package, Layers, ArrowDownRight, ArrowUpRight, Plus, Edit3
} from 'lucide-react';
import { Link } from 'react-router-dom';

const CUENTAS_FIJAS = [
  { key: 'efectivo', label: 'Efectivo', moneda: 'USD' },
  { key: 'zelle', label: 'Zelle', moneda: 'USD' },
  { key: 'binance', label: 'Binance (USDT)', moneda: 'USD' },
  { key: 'zinli', label: 'Zinli', moneda: 'USD' },
  { key: 'bancamiga', label: 'Bancamiga', moneda: 'USD' },
  { key: 'paypal', label: 'PayPal', moneda: 'USD' },
  { key: 'venezuela', label: 'Banco Venezuela', moneda: 'BS' },
  { key: 'bolivares_bs', label: 'Otros Bs', moneda: 'BS' },
];

export default function PanelPrincipal({ onNavigateTab }) {
  const { corte, loading: loadingCorte, tieneCorte } = useCorteContable();

  // Estados de datos
  const [caja, setCaja] = useState({});
  const [laptops, setLaptops] = useState([]);
  const [componentes, setComponentes] = useState([]);
  const [gastosOp, setGastosOp] = useState([]);
  const [gastosPers, setGastosPers] = useState([]);
  const [ingresos, setIngresos] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Modales de acciones rápidas
  const [modalGasto, setModalGasto] = useState({ open: false, categoria: 'publicidad', concepto: '', monto: '', metodo_pago: 'efectivo', tasa: '', saving: false });
  const [modalRetiro, setModalRetiro] = useState({ open: false, socio: 'ysmael', concepto: '', monto: '', cuenta_salida: 'efectivo', tasa: '', saving: false });
  const [modalTransfer, setModalTransfer] = useState({ 
    open: false, cuenta_origen: 'binance', cuenta_destino: 'efectivo', 
    monto_origen: '', monto_destino: '', tasa_cambio: '', concepto: '', saving: false 
  });
  const [modalVenta, setModalVenta] = useState({ open: false, concepto: '', monto: '', metodo_pago: 'efectivo', tasa: '', costo: '', saving: false });
  
  // Modal de ajuste de caja
  const [modalAjuste, setModalAjuste] = useState({ open: false, cuentaKey: '', cuentaLabel: '', saldoActual: 0, nuevoSaldo: '', ajustador: 'Ysmael', motivo: '', saving: false });

  // Modal: Nueva Cuenta Personalizada / Banco
  const [modalNuevaCuenta, setModalNuevaCuenta] = useState({ open: false, nombre: '', moneda: 'USD', saldoInicial: '', saving: false });

  // Modal / Edición de Tasa de Cambio Global
  const [modalTasa, setModalTasa] = useState({ open: false, nuevaTasa: '', saving: false });

  // Toggle vista saldos
  const [showSaldos, setShowSaldos] = useState(true);

  // Escuchar datos en tiempo real
  useEffect(() => {
    // 1. Caja saldos
    const unsubCaja = onSnapshot(doc(db, 'caja', 'saldos'), snap => {
      if (snap.exists()) setCaja(snap.data());
    });

    // 2. Inventario activo
    const unsubLaptops = onSnapshot(collection(db, 'laptops'), snap => {
      setLaptops(snap.docs.map(d => d.data()));
    });
    const unsubComp = onSnapshot(collection(db, 'componentes'), snap => {
      setComponentes(snap.docs.map(d => d.data()));
    });

    return () => {
      unsubCaja();
      unsubLaptops();
      unsubComp();
    };
  }, []);

  // Escuchar movimientos posteriores a la fecha del corte
  useEffect(() => {
    if (!corte?.fecha_corte) {
      setLoadingData(false);
      return;
    }

    const fechaCorte = corte.fecha_corte_js || (corte.fecha_corte ? corte.fecha_corte.toDate() : new Date(0));

    // Gastos Operativos post-corte
    const qGastosOp = query(collection(db, 'gastos_operativos'), where('fecha', '>=', fechaCorte), orderBy('fecha', 'desc'));
    const unsubOp = onSnapshot(qGastosOp, snap => {
      setGastosOp(snap.docs.map(d => ({ id: d.id, tipo_mov: 'gasto_op', ...d.data() })));
    }, err => console.error("Error gastos op:", err));

    // Gastos Personales (Retiros) post-corte
    const qGastosPers = query(collection(db, 'gastos_personales'), where('fecha', '>=', fechaCorte), orderBy('fecha', 'desc'));
    const unsubPers = onSnapshot(qGastosPers, snap => {
      setGastosPers(snap.docs.map(d => ({ id: d.id, tipo_mov: 'retiro', ...d.data() })));
    }, err => console.error("Error retiros:", err));

    // Ingresos por Ventas post-corte
    const qIngresos = query(collection(db, 'historico_ingresos'), where('fecha', '>=', fechaCorte), orderBy('fecha', 'desc'));
    const unsubIng = onSnapshot(qIngresos, snap => {
      setIngresos(snap.docs.map(d => ({ id: d.id, tipo_mov: 'venta', ...d.data() })));
    }, err => console.error("Error ingresos:", err));

    // Transferencias internas post-corte
    const qTrans = query(collection(db, 'transferencias_internas'), where('fecha', '>=', fechaCorte), orderBy('fecha', 'desc'));
    const unsubTrans = onSnapshot(qTrans, snap => {
      setTransferencias(snap.docs.map(d => ({ id: d.id, tipo_mov: 'transferencia', ...d.data() })));
      setLoadingData(false);
    }, err => {
      console.error("Error transferencias:", err);
      setLoadingData(false);
    });

    return () => {
      unsubOp();
      unsubPers();
      unsubIng();
      unsubTrans();
    };
  }, [corte]);

  const fmt = (v, moneda = 'USD') => moneda === 'USD'
    ? `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `Bs ${Number(v || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // --- Cuentas Dinámicas + Fijas ---
  const cuentasDinamicas = caja._cuentas_dinamicas || [];
  const todasCuentas = [...CUENTAS_FIJAS, ...cuentasDinamicas];

  // --- CÁLCULOS MATEMÁTICOS POST-CORTE ---
  const tasaCambio = Number(caja.tasa_cambio) || Number(corte?.tasa_cambio_corte) || 1;

  // Cuenta/moneda seleccionada para el gasto operativo
  const cuentaGasto = todasCuentas.find(c => c.key === modalGasto.metodo_pago);
  const esGastoBs = cuentaGasto?.moneda === 'BS';

  // Cuenta/moneda seleccionada para la venta rápida
  const cuentaVenta = todasCuentas.find(c => c.key === modalVenta.metodo_pago);
  const esVentaBs = cuentaVenta?.moneda === 'BS';

  // Cuenta/moneda seleccionada para el retiro de socio
  const cuentaRetiro = todasCuentas.find(c => c.key === modalRetiro.cuenta_salida);
  const esRetiroBs = cuentaRetiro?.moneda === 'BS';

  // Cuentas/monedas seleccionadas para la transferencia
  const cuentaTransOrigen = todasCuentas.find(c => c.key === modalTransfer.cuenta_origen);
  const cuentaTransDestino = todasCuentas.find(c => c.key === modalTransfer.cuenta_destino);
  const monedaTransOrigen = cuentaTransOrigen?.moneda || 'USD';
  const monedaTransDestino = cuentaTransDestino?.moneda || 'USD';
  const esCambioDivisa = monedaTransOrigen !== monedaTransDestino;

  // Handlers de sincronización bidireccional en el formulario de transferencia
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
    setModalTransfer(p => {
      const up = { ...p, monto_origen: val };
      if (esCambioDivisa && val && p.tasa_cambio) {
        up.monto_destino = syncDestinoDesdeTasa(p, val, p.tasa_cambio);
      }
      return up;
    });
  };
  const handleTransTasaChange = (e) => {
    const val = e.target.value;
    setModalTransfer(p => {
      const up = { ...p, tasa_cambio: val };
      if (esCambioDivisa && p.monto_origen && val) {
        up.monto_destino = syncDestinoDesdeTasa(p, p.monto_origen, val);
      }
      return up;
    });
  };
  const handleTransDestinoChange = (e) => {
    const val = e.target.value;
    setModalTransfer(p => {
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

  // 1. Caja Total USD
  const todasUSD = todasCuentas.filter(c => c.moneda === 'USD');
  const todasBS = todasCuentas.filter(c => c.moneda === 'BS');
  const totalCajaUSD = todasUSD.reduce((acc, c) => acc + (Number(caja[c.key]) || 0), 0);
  const totalCajaBSenUSD = tasaCambio > 0
    ? todasBS.reduce((acc, c) => acc + (Number(caja[c.key]) || 0) / tasaCambio, 0)
    : 0;
  const totalCajaGlobal = totalCajaUSD + totalCajaBSenUSD;

  // 2. Inventario Activo
  const estadosActivos = ['Disponible', 'Coming soon'];
  let totalInventarioActivo = 0;
  laptops.forEach(l => {
    if (estadosActivos.includes(l.disponibilidad)) {
      totalInventarioActivo += getCostoTotal(l);
    }
  });
  componentes.forEach(c => {
    if (estadosActivos.includes(c.disponibilidad)) {
      totalInventarioActivo += getCostoTotal(c);
    }
  });

  // 3. Utilidades y Capitales post-corte
  const gananciaVentasPostCorte = ingresos.reduce((acc, i) => acc + (Number(i.ganancia) || 0), 0);
  const gastosOpPostCorte = gastosOp.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
  const diferencialesPostCorte = transferencias.reduce((acc, t) => acc + (Number(t.diferencial_usd) || 0), 0);
  const utilidadNetaPostCorte = gananciaVentasPostCorte - gastosOpPostCorte + diferencialesPostCorte;
  const mitadUtilidad = utilidadNetaPostCorte / 2;
  const mitadUtilidadOperativa = (gananciaVentasPostCorte - gastosOpPostCorte) / 2;
  const mitadDiferencial = diferencialesPostCorte / 2;

  const retirosYsmael = gastosPers.filter(g => g.socio === 'ysmael').reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
  const retirosVictor = gastosPers.filter(g => g.socio === 'victor').reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

  const capInicialYsmael = Number(corte?.capital_inicial_ysmael) || 0;
  const capInicialVictor = Number(corte?.capital_inicial_victor) || 0;

  const capitalActualYsmael = capInicialYsmael + mitadUtilidad - retirosYsmael;
  const capitalActualVictor = capInicialVictor + mitadUtilidad - retirosVictor;
  const capitalTotalSocios = capitalActualYsmael + capitalActualVictor;

  // 4. Últimos Movimientos Combinados
  const todosMovimientos = [
    ...gastosOp,
    ...gastosPers,
    ...ingresos,
    ...transferencias
  ].sort((a, b) => {
    const fA = a.fecha?.toDate ? a.fecha.toDate().getTime() : 0;
    const fB = b.fecha?.toDate ? b.fecha.toDate().getTime() : 0;
    return fB - fA;
  }).slice(0, 6);

  // --- HANDLERS ACCIONES RÁPIDAS ---

  // 1. Gasto Operativo
  const handleGuardarGasto = async (e) => {
    e.preventDefault();
    if (!modalGasto.monto || !modalGasto.concepto) return alert("Completa todos los campos");
    const montoNum = Number(modalGasto.monto);
    if (isNaN(montoNum) || montoNum <= 0) return alert("Monto inválido");

    const cuentaSeleccionada = todasCuentas.find(c => c.key === modalGasto.metodo_pago);
    const esBs = cuentaSeleccionada?.moneda === 'BS';
    const tasaUsada = esBs ? (Number(modalGasto.tasa) || tasaCambio) : 1;
    const montoUsd = esBs ? montoNum / tasaUsada : montoNum;

    setModalGasto(p => ({ ...p, saving: true }));
    try {
      await addDoc(collection(db, 'gastos_operativos'), {
        categoria: modalGasto.categoria,
        concepto: modalGasto.concepto,
        monto: montoUsd,
        monto_original: montoNum,
        moneda_original: esBs ? 'BS' : 'USD',
        tasa_cambio: tasaUsada,
        metodo_pago: modalGasto.metodo_pago,
        fecha: serverTimestamp()
      });

      if (modalGasto.metodo_pago) {
        await updateDoc(doc(db, 'caja', 'saldos'), {
          [modalGasto.metodo_pago]: increment(-montoNum),
          updated_at: new Date()
        });
      }

      setModalGasto({ open: false, categoria: 'publicidad', concepto: '', monto: '', metodo_pago: 'efectivo', tasa: '', saving: false });
      alert("✅ Gasto operativo registrado correctamente.");
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
      setModalGasto(p => ({ ...p, saving: false }));
    }
  };

  // 1b. Venta Rápida (servicios, componentes sin estructura de costo)
  const handleGuardarVenta = async (e) => {
    e.preventDefault();
    if (!modalVenta.monto || !modalVenta.concepto) return alert("Completa los campos de concepto y monto.");
    const montoNum = Number(modalVenta.monto);
    if (isNaN(montoNum) || montoNum <= 0) return alert("Monto inválido.");

    const cuentaSeleccionada = todasCuentas.find(c => c.key === modalVenta.metodo_pago);
    const esBs = cuentaSeleccionada?.moneda === 'BS';
    const tasaUsada = esBs ? (Number(modalVenta.tasa) || tasaCambio) : 1;
    const montoUsd = esBs ? montoNum / tasaUsada : montoNum;
    const costoUsd = Math.max(Number(modalVenta.costo) || 0, 0);
    const ganancia = montoUsd - costoUsd;

    setModalVenta(p => ({ ...p, saving: true }));
    try {
      // 1. Sumar el dinero real a la cuenta de caja
      await updateDoc(doc(db, 'caja', 'saldos'), {
        [modalVenta.metodo_pago]: increment(montoNum),
        updated_at: new Date()
      });

      // 2. Registrar ingreso en historico_ingresos
      let idVentaDetalle = null;
      if (costoUsd > 0) {
        const ventaDetalle = await addDoc(collection(db, 'ventas'), {
          fecha: serverTimestamp(),
          modelo: modalVenta.concepto,
          cliente: 'Venta rápida',
          metodos_pago: [{ metodo: modalVenta.metodo_pago, montoUSD: montoUsd }],
          precio_venta_usd: montoUsd,
          costo_total: costoUsd,
          ganancia,
          tasa_venta: esBs ? tasaUsada : null,
          descripcion: modalVenta.concepto,
          es_venta_rapida: true
        });
        idVentaDetalle = ventaDetalle.id;
      }

      await addDoc(collection(db, 'historico_ingresos'), {
        fecha: serverTimestamp(),
        concepto: modalVenta.concepto,
        monto: montoUsd,
        monto_original: montoNum,
        moneda_original: esBs ? 'BS' : 'USD',
        tasa_cambio: esBs ? tasaUsada : null,
        ganancia,
        costo_usd: costoUsd,
        id_venta_detalle: idVentaDetalle,
        metodo_pago: modalVenta.metodo_pago,
        tipo: 'venta_rapida'
      });

      setModalVenta({ open: false, concepto: '', monto: '', metodo_pago: 'efectivo', tasa: '', costo: '', saving: false });
      alert("✅ Venta registrada en caja e historial.");
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
      setModalVenta(p => ({ ...p, saving: false }));
    }
  };

  // 2. Retiro Personal
  const handleGuardarRetiro = async (e) => {
    e.preventDefault();
    if (!modalRetiro.monto || !modalRetiro.concepto) return alert("Completa todos los campos");
    const montoNum = Number(modalRetiro.monto);
    if (isNaN(montoNum) || montoNum <= 0) return alert("Monto inválido");

    const cuentaSeleccionada = todasCuentas.find(c => c.key === modalRetiro.cuenta_salida);
    const esBs = cuentaSeleccionada?.moneda === 'BS';
    const tasaUsada = esBs ? (Number(modalRetiro.tasa) || tasaCambio) : 1;
    const montoUsd = esBs ? montoNum / tasaUsada : montoNum;

    setModalRetiro(p => ({ ...p, saving: true }));
    try {
      await addDoc(collection(db, 'gastos_personales'), {
        socio: modalRetiro.socio,
        concepto: modalRetiro.concepto,
        monto: montoUsd,
        monto_original: montoNum,
        moneda_original: esBs ? 'BS' : 'USD',
        tasa_cambio: esBs ? tasaUsada : null,
        metodo_pago: modalRetiro.cuenta_salida,
        cuenta_salida: modalRetiro.cuenta_salida,
        es_deuda: true,
        fecha: serverTimestamp()
      });

      if (modalRetiro.cuenta_salida) {
        await updateDoc(doc(db, 'caja', 'saldos'), {
          [modalRetiro.cuenta_salida]: increment(-montoNum),
          updated_at: new Date()
        });
      }

      setModalRetiro({ open: false, socio: 'ysmael', concepto: '', monto: '', cuenta_salida: 'efectivo', tasa: '', saving: false });
      alert("✅ Retiro registrado y descontado de caja.");
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
      setModalRetiro(p => ({ ...p, saving: false }));
    }
  };

  // 3. Transferencia Interna
  const handleGuardarTransfer = async (e) => {
    e.preventDefault();
    if (!modalTransfer.monto_origen) return alert("Ingresa el monto que sale.");
    if (modalTransfer.cuenta_origen === modalTransfer.cuenta_destino) {
      return alert("La cuenta origen y destino deben ser distintas.");
    }
    const montoSale = Number(modalTransfer.monto_origen);
    const monedaOrigen = monedaTransOrigen;
    const monedaDestino = monedaTransDestino;
    const cambioDivisa = monedaOrigen !== monedaDestino;
    const montoLlega = (() => {
      const destinoManual = Number(modalTransfer.monto_destino);
      if (destinoManual && destinoManual > 0) return destinoManual;
      if (cambioDivisa) {
        return calcularDestino({
          montoOrigen: montoSale,
          tasa: Number(modalTransfer.tasa_cambio) || tasaCambio,
          monedaOrigen,
          monedaDestino
        });
      }
      return montoSale;
    })();

    if (isNaN(montoSale) || montoSale <= 0 || isNaN(montoLlega) || montoLlega <= 0) {
      return alert("Montos inválidos.");
    }

    const tasaReal = cambioDivisa ? (Number(modalTransfer.tasa_cambio) || tasaCambio) : null;
    const tasaReferencia = tasaCambio;
    const diferencialUsd = calcularDiferencial({
      montoOrigen: montoSale,
      montoDestino: montoLlega,
      monedaOrigen,
      monedaDestino,
      tasaReferencia
    });

    setModalTransfer(p => ({ ...p, saving: true }));
    try {
      // 1. Guardar registro en transferencias_internas
      await addDoc(collection(db, 'transferencias_internas'), {
        cuenta_origen: modalTransfer.cuenta_origen,
        cuenta_destino: modalTransfer.cuenta_destino,
        monto_origen: montoSale,
        monto_destino: montoLlega,
        tasa_cambio: tasaReal,
        tasa_referencia: tasaReferencia,
        moneda_origen: monedaOrigen,
        moneda_destino: monedaDestino,
        diferencial_usd: diferencialUsd,
        concepto: modalTransfer.concepto || 'Transferencia entre cuentas propias',
        fecha: serverTimestamp()
      });

      // 2. Actualizar atómicamente la caja
      await updateDoc(doc(db, 'caja', 'saldos'), {
        [modalTransfer.cuenta_origen]: increment(-montoSale),
        [modalTransfer.cuenta_destino]: increment(montoLlega),
        updated_at: new Date()
      });

      setModalTransfer({
        open: false, cuenta_origen: 'binance', cuenta_destino: 'efectivo',
        monto_origen: '', monto_destino: '', tasa_cambio: '', concepto: '', saving: false
      });
      alert("✅ Transferencia interna realizada con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
      setModalTransfer(p => ({ ...p, saving: false }));
    }
  };

  // 4. Ajuste Manual Auditado
  const handleConfirmarAjuste = async () => {
    const { cuentaKey, cuentaLabel, saldoActual, nuevoSaldo, ajustador, motivo } = modalAjuste;
    if (!motivo.trim()) return alert("El motivo del ajuste es obligatorio.");
    const nuevoNum = Number(nuevoSaldo);
    if (isNaN(nuevoNum)) return alert("Monto inválido.");

    setModalAjuste(p => ({ ...p, saving: true }));
    const diferencia = nuevoNum - saldoActual;

    try {
      await updateDoc(doc(db, 'caja', 'saldos'), {
        [cuentaKey]: nuevoNum,
        updated_at: new Date()
      });
      await addDoc(collection(db, 'auditoria_caja'), {
        cuenta_key: cuentaKey,
        cuenta_label: cuentaLabel,
        saldo_anterior: saldoActual,
        saldo_nuevo: nuevoNum,
        diferencia,
        ajustador,
        motivo,
        fecha: serverTimestamp()
      });
      setModalAjuste({ open: false, cuentaKey: '', cuentaLabel: '', saldoActual: 0, nuevoSaldo: '', ajustador: 'Ysmael', motivo: '', saving: false });
      alert("Ajuste registrado en historial de auditoría.");
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
      setModalAjuste(p => ({ ...p, saving: false }));
    }
  };

  // 5. Crear Nueva Cuenta / Banco
  const handleCrearCuenta = async (e) => {
    e.preventDefault();
    const { nombre, moneda, saldoInicial } = modalNuevaCuenta;
    if (!nombre.trim()) return alert("Ingresa un nombre para la cuenta.");
    const safeKey = 'dinamica_' + nombre.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
    const nueva = { key: safeKey, label: nombre.trim(), moneda: moneda || 'USD' };
    const saldoNum = Number(saldoInicial) || 0;

    setModalNuevaCuenta(p => ({ ...p, saving: true }));
    try {
      const nuevasDinamicas = [...cuentasDinamicas, nueva];
      await updateDoc(doc(db, 'caja', 'saldos'), {
        [safeKey]: saldoNum,
        _cuentas_dinamicas: nuevasDinamicas,
        updated_at: new Date()
      });
      setModalNuevaCuenta({ open: false, nombre: '', moneda: 'USD', saldoInicial: '', saving: false });
      alert("✅ Nueva cuenta añadida a la caja.");
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
      setModalNuevaCuenta(p => ({ ...p, saving: false }));
    }
  };

  // 6. Cambiar Tasa de Cambio Global
  const handleGuardarTasa = async (e) => {
    e.preventDefault();
    const tasaNum = Number(modalTasa.nuevaTasa);
    if (isNaN(tasaNum) || tasaNum <= 0) return alert("Ingresa una tasa de cambio válida.");

    setModalTasa(p => ({ ...p, saving: true }));
    try {
      await updateDoc(doc(db, 'caja', 'saldos'), {
        tasa_cambio: tasaNum,
        updated_at: new Date()
      });
      setModalTasa({ open: false, nuevaTasa: '', saving: false });
      alert("✅ Tasa de cambio global actualizada.");
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
      setModalTasa(p => ({ ...p, saving: false }));
    }
  };

  if (loadingCorte) {
    return (
      <div className="p-12 text-center text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin" /> Cargando panel de finanzas...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* BANNER SI NO HAY CORTE CONTABLE DEFINIDO */}
      {!tieneCorte && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black">Punto Cero no configurado</h3>
              <p className="text-sm text-amber-100 mt-0.5">
                Para que el capital de socios y las utilidades calculen sin errores de arrastre, establece el corte contable inicial.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab ? onNavigateTab('reportes') : null}
            className="bg-white text-amber-800 font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-amber-50 transition-colors flex-shrink-0 shadow"
          >
            Configurar Punto Cero →
          </button>
        </div>
      )}

      {/* TARJETAS PRINCIPALES DE CAPITAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CAPITAL TOTAL */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-24 h-24" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Capital Total (Negocio)</p>
              {tieneCorte && (
                <span className="bg-emerald-500/20 text-emerald-300 text-[11px] px-2 py-0.5 rounded-full font-semibold border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Punto Cero
                </span>
              )}
            </div>
            <h2 className="text-3xl font-black mt-2">{fmt(totalCajaGlobal + totalInventarioActivo)}</h2>
            <p className="text-slate-400 text-xs mt-1">Caja disponible + Inventario activo</p>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-6 pt-4 border-t border-slate-700/60 text-xs">
            <div className="bg-white/5 p-2.5 rounded-xl">
              <span className="text-slate-400 block">Caja Real</span>
              <span className="text-white font-bold text-sm">{fmt(totalCajaGlobal)}</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl">
              <span className="text-slate-400 block">Costo Inventario</span>
              <span className="text-white font-bold text-sm">{fmt(totalInventarioActivo)}</span>
            </div>
          </div>
        </div>

        {/* CAPITAL YSMAEL */}
        <div className="bg-white rounded-2xl border-2 border-brand-100 p-6 shadow-sm flex flex-col justify-between hover:border-brand-300 transition-all">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-brand-500"></span> Ysmael
              </h3>
              <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-lg">50% Utilidades</span>
            </div>

            <div className="mt-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Capital Neto Actual</p>
              <h2 className={`text-3xl font-black mt-1 ${capitalActualYsmael < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {fmt(capitalActualYsmael)}
              </h2>
            </div>
          </div>

          <div className="space-y-2 mt-5 pt-4 border-t border-slate-100 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Capital inicial de corte</span>
              <span className="font-semibold text-slate-800">{fmt(capInicialYsmael)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>+ 50% Utilidad operativa</span>
              <span className="font-semibold text-emerald-600">+{fmt(mitadUtilidadOperativa)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>± 50% Diferencial cambiario</span>
              <span className={`font-semibold ${mitadDiferencial >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {mitadDiferencial >= 0 ? '+' : '-'}{fmt(Math.abs(mitadDiferencial))}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>- Retiros propios acumulados</span>
              <span className="font-semibold text-red-600">-{fmt(retirosYsmael)}</span>
            </div>
          </div>
        </div>

        {/* CAPITAL VÍCTOR */}
        <div className="bg-white rounded-2xl border-2 border-brand-100 p-6 shadow-sm flex flex-col justify-between hover:border-brand-300 transition-all">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500"></span> Víctor
              </h3>
              <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg">50% Utilidades</span>
            </div>

            <div className="mt-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Capital Neto Actual</p>
              <h2 className={`text-3xl font-black mt-1 ${capitalActualVictor < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {fmt(capitalActualVictor)}
              </h2>
            </div>
          </div>

          <div className="space-y-2 mt-5 pt-4 border-t border-slate-100 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Capital inicial de corte</span>
              <span className="font-semibold text-slate-800">{fmt(capInicialVictor)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>+ 50% Utilidad operativa</span>
              <span className="font-semibold text-emerald-600">+{fmt(mitadUtilidadOperativa)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>± 50% Diferencial cambiario</span>
              <span className={`font-semibold ${mitadDiferencial >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {mitadDiferencial >= 0 ? '+' : '-'}{fmt(Math.abs(mitadDiferencial))}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>- Retiros propios acumulados</span>
              <span className="font-semibold text-red-600">-{fmt(retirosVictor)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ACCIONES RÁPIDAS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Acciones Rápidas del Día</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => setModalGasto(p => ({ ...p, open: true, tasa: tasaCambio.toString() }))}
            className="flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 font-bold text-sm border border-orange-200/80 transition-colors"
          >
            <TrendingDown className="w-5 h-5 text-orange-600" />
            + Registrar Gasto Operativo
          </button>

          <button
            onClick={() => setModalVenta(p => ({ ...p, open: true, tasa: tasaCambio.toString() }))}
            className="flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-sm border border-emerald-200/80 transition-colors"
          >
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            + Añadir Venta Rápida
          </button>

          <button
            onClick={() => setModalRetiro(p => ({ ...p, open: true, tasa: tasaCambio.toString() }))}
            className="flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-800 font-bold text-sm border border-red-200/80 transition-colors"
          >
            <Users className="w-5 h-5 text-red-600" />
            + Registrar Retiro de Socio
          </button>

          <button
            onClick={() => setModalTransfer(p => ({ ...p, open: true, tasa_cambio: tasaCambio.toString() }))}
            className="flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-sm border border-blue-200/80 transition-colors"
          >
            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            ↔ Transferencia / Cambio Divisa
          </button>
        </div>
      </div>

      {/* SECCIÓN DESPLEGABLE: SALDOS DE CAJA POR CUENTA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-800 text-base">Saldos de Caja por Cuenta</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Tasa de cambio interactiva */}
            <button
              onClick={() => setModalTasa({ open: true, nuevaTasa: tasaCambio.toString(), saving: false })}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors border border-slate-200"
              title="Click para cambiar la tasa de cambio global"
            >
              <Edit3 className="w-3.5 h-3.5 text-brand-600" />
              <span>Tasa: <strong className="text-slate-900 font-black">Bs {tasaCambio.toFixed(2)}</strong>/$</span>
            </button>

            {/* Botón Añadir Cuenta */}
            <button
              onClick={() => setModalNuevaCuenta({ open: true, nombre: '', moneda: 'USD', saldoInicial: '', saving: false })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-colors border border-emerald-200"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Cuenta</span>
            </button>

            <button
              onClick={() => setShowSaldos(!showSaldos)}
              className="text-xs font-bold text-brand-600 hover:text-brand-700 ml-1"
            >
              {showSaldos ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>

        {showSaldos && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {todasCuentas.map(c => {
              const saldo = Number(caja[c.key]) || 0;
              const saldoUSD = c.moneda === 'BS' && tasaCambio > 0 ? saldo / tasaCambio : saldo;
              const esDinamica = c.key.startsWith('dinamica_');
              return (
                <div key={c.key} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between group hover:border-slate-300 transition-colors relative">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-500 block truncate max-w-[130px]">{c.label}</span>
                      {esDinamica && (
                        <span className="text-[10px] bg-brand-50 text-brand-700 font-bold px-1.5 py-0.2 rounded border border-brand-100">Nueva</span>
                      )}
                    </div>
                    <span className={`text-base font-black ${saldo < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                      {fmt(saldo, c.moneda)}
                    </span>
                    {c.moneda === 'BS' && tasaCambio > 0 && (
                      <span className="text-[11px] text-slate-400 block font-medium">≈ {fmt(saldoUSD, 'USD')}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setModalAjuste({
                      open: true,
                      cuentaKey: c.key,
                      cuentaLabel: c.label,
                      saldoActual: saldo,
                      nuevoSaldo: saldo.toString(),
                      ajustador: 'Ysmael',
                      motivo: '',
                      saving: false
                    })}
                    title="Ajuste manual auditado"
                    className="p-1.5 text-slate-300 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ÚLTIMOS MOVIMIENTOS POST-CORTE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            <h3 className="font-bold text-slate-800 text-base">Últimos Movimientos</h3>
          </div>
          <button
            onClick={() => onNavigateTab ? onNavigateTab('movimientos') : null}
            className="text-xs font-bold text-brand-600 hover:text-brand-700"
          >
            Ver todos los movimientos →
          </button>
        </div>

        {todosMovimientos.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            No hay movimientos registrados desde el último corte contable.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {todosMovimientos.map((m, idx) => {
              const fechaStr = m.fecha?.toDate
                ? m.fecha.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : 'Reciente';

              if (m.tipo_mov === 'gasto_op') {
                return (
                  <div key={m.id || idx} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{m.concepto}</p>
                        <p className="text-xs text-slate-400 capitalize">{m.categoria} • Cuenta: {m.metodo_pago || 'Caja'} • {fechaStr}</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-orange-600">-${Number(m.monto).toFixed(2)}</span>
                  </div>
                );
              }

              if (m.tipo_mov === 'retiro') {
                return (
                  <div key={m.id || idx} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          Retiro de <span className="capitalize font-black text-slate-900">{m.socio}</span>: {m.concepto}
                        </p>
                        <p className="text-xs text-slate-400 capitalize">Cuenta salida: {m.metodo_pago || m.cuenta_salida} • {fechaStr}</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-red-600">
                        {m.moneda_original === 'BS'
                          ? `-Bs ${Number(m.monto_original).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${m.monto ? ` (≈$${Number(m.monto).toFixed(2)})` : ''}`
                          : `-$${Number(m.monto).toFixed(2)}`}
                      </span>
                  </div>
                );
              }

              if (m.tipo_mov === 'transferencia') {
                return (
                  <div key={m.id || idx} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                        <ArrowRightLeft className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          Transferencia: {m.cuenta_origen} → {m.cuenta_destino}
                        </p>
                        <p className="text-xs text-slate-400">{m.concepto || 'Movimiento entre cuentas'} • {fechaStr}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg">
                        {fmtMontoMoneda(m.moneda_origen || monedaDeCuenta(m.cuenta_origen), m.monto_origen)} → {fmtMontoMoneda(m.moneda_destino || monedaDeCuenta(m.cuenta_destino), m.monto_destino)}
                      </span>
                      {Number(m.diferencial_usd) !== 0 && (
                        <span className={`text-[10px] font-black ${Number(m.diferencial_usd) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {Number(m.diferencial_usd) > 0 ? 'Ganancia' : 'Pérdida'} cambiaria: {fmt(Math.abs(Number(m.diferencial_usd)))}
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              if (m.tipo_mov === 'venta') {
                return (
                  <div key={m.id || idx} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{m.concepto || 'Venta de equipo'}</p>
                        <p className="text-xs text-slate-400">
                          {m.moneda_original === 'BS'
                            ? `Bs ${Number(m.monto_original).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (≈$${Number(m.monto).toFixed(2)})`
                            : `Ingreso: $${Number(m.monto).toFixed(2)}`}
                          {m.metodo_pago ? ` • Cuenta: ${m.metodo_pago}` : ''} • {fechaStr}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-emerald-600">
                      {m.ganancia != null ? `+$${Number(m.ganancia).toFixed(2)} ganancia` : `+$${Number(m.monto).toFixed(2)}`}
                    </span>
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}
      </div>

      {/* MODAL RÁPIDO: GASTO OPERATIVO */}
      {modalGasto.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-orange-600" />
              Registrar Gasto Operativo
            </h3>
            <form onSubmit={handleGuardarGasto} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Categoría</label>
                <select
                  value={modalGasto.categoria}
                  onChange={e => setModalGasto(p => ({ ...p, categoria: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="publicidad">Publicidad (Ads)</option>
                  <option value="gasolina">Gasolina / Transporte</option>
                  <option value="envio">Envíos y Deliverys</option>
                  <option value="software">Software / Hosting</option>
                  <option value="otros">Otros</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Concepto</label>
                <input
                  type="text"
                  placeholder="Ej: Meta Ads, Pago dominio..."
                  value={modalGasto.concepto}
                  onChange={e => setModalGasto(p => ({ ...p, concepto: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Monto ({esGastoBs ? 'Bs' : 'USD'})</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">{esGastoBs ? 'Bs' : '$'}</span>
                  <input
                    type="number" step="0.01" min="0.01"
                    placeholder="0.00"
                    value={modalGasto.monto}
                    onChange={e => setModalGasto(p => ({ ...p, monto: e.target.value }))}
                    className="w-full pl-9 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                    required
                  />
                </div>
              </div>

              {esGastoBs && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tasa de cambio (Bs/$)</label>
                  <div className="flex gap-2">
                    <input
                      type="number" step="0.01" min="0.01"
                      placeholder={tasaCambio.toFixed(2)}
                      value={modalGasto.tasa}
                      onChange={e => setModalGasto(p => ({ ...p, tasa: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setModalGasto(p => ({ ...p, tasa: tasaCambio.toString() }))}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg whitespace-nowrap"
                    >
                      Usar guardada (Bs {tasaCambio.toFixed(2)})
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Descontar de la cuenta</label>
                <select
                  value={modalGasto.metodo_pago}
                  onChange={e => setModalGasto(p => ({ ...p, metodo_pago: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  {todasCuentas.map(c => (
                    <option key={c.key} value={c.key}>{c.label} ({c.moneda})</option>
                  ))}
                  <option value="">No descontar (manual)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalGasto(p => ({ ...p, open: false }))}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalGasto.saving}
                  className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
                >
                  {modalGasto.saving ? 'Guardando...' : 'Registrar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RÁPIDO: VENTA RÁPIDA */}
      {modalVenta.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Añadir Venta Rápida
            </h3>
            <p className="text-xs text-slate-500">
              Para servicios técnicos o ventas de componentes sin estructura de costo.
            </p>
            <form onSubmit={handleGuardarVenta} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Concepto</label>
                <input
                  type="text"
                  placeholder="Ej: Venta RAM 16GB, Servicio técnico..."
                  value={modalVenta.concepto}
                  onChange={e => setModalVenta(p => ({ ...p, concepto: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cuenta donde entra el dinero</label>
                <select
                  value={modalVenta.metodo_pago}
                  onChange={e => setModalVenta(p => ({ ...p, metodo_pago: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  {todasCuentas.map(c => (
                    <option key={c.key} value={c.key}>{c.label} ({c.moneda})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Monto ({esVentaBs ? 'Bs' : 'USD'})</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">{esVentaBs ? 'Bs' : '$'}</span>
                  <input
                    type="number" step="0.01" min="0.01"
                    placeholder="0.00"
                    value={modalVenta.monto}
                    onChange={e => setModalVenta(p => ({ ...p, monto: e.target.value }))}
                    className="w-full pl-9 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                    required
                  />
                </div>
              </div>

              {esVentaBs && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tasa de cambio (Bs/$)</label>
                  <div className="flex gap-2">
                    <input
                      type="number" step="0.01" min="0.01"
                      placeholder={tasaCambio.toFixed(2)}
                      value={modalVenta.tasa}
                      onChange={e => setModalVenta(p => ({ ...p, tasa: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setModalVenta(p => ({ ...p, tasa: tasaCambio.toString() }))}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg whitespace-nowrap"
                    >
                      Usar guardada (Bs {tasaCambio.toFixed(2)})
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Costo del servicio/producto (USD) <span className="text-slate-400">(opcional, 0 = margen completo)</span></label>
                <input
                  type="number" step="0.01" min="0"
                  placeholder="0.00"
                  value={modalVenta.costo}
                  onChange={e => setModalVenta(p => ({ ...p, costo: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalVenta(p => ({ ...p, open: false }))}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalVenta.saving}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
                >
                  {modalVenta.saving ? 'Guardando...' : 'Registrar Venta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RÁPIDO: RETIRO SOCIO */}
      {modalRetiro.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-red-600" />
              Registrar Retiro de Socio
            </h3>
            <form onSubmit={handleGuardarRetiro} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Socio</label>
                <div className="flex gap-2">
                  {['ysmael', 'victor'].map(s => (
                    <label key={s} className={`flex-1 py-2 text-center rounded-xl border-2 cursor-pointer font-bold capitalize text-sm ${
                      modalRetiro.socio === s ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'
                    }`}>
                      <input
                        type="radio"
                        value={s}
                        checked={modalRetiro.socio === s}
                        onChange={() => setModalRetiro(p => ({ ...p, socio: s }))}
                        className="hidden"
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Concepto</label>
                <input
                  type="text"
                  placeholder="Ej: Adelanto quincena, pago personal..."
                  value={modalRetiro.concepto}
                  onChange={e => setModalRetiro(p => ({ ...p, concepto: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Monto ({esRetiroBs ? 'Bs' : 'USD'})</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">{esRetiroBs ? 'Bs' : '$'}</span>
                  <input
                    type="number" step="0.01" min="0.01"
                    placeholder="0.00"
                    value={modalRetiro.monto}
                    onChange={e => setModalRetiro(p => ({ ...p, monto: e.target.value }))}
                    className="w-full pl-9 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                    required
                  />
                </div>
              </div>

              {esRetiroBs && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tasa de cambio (Bs/$)</label>
                  <div className="flex gap-2">
                    <input
                      type="number" step="0.01" min="0.01"
                      placeholder={tasaCambio.toFixed(2)}
                      value={modalRetiro.tasa}
                      onChange={e => setModalRetiro(p => ({ ...p, tasa: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setModalRetiro(p => ({ ...p, tasa: tasaCambio.toString() }))}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg whitespace-nowrap"
                    >
                      Usar guardada (Bs {tasaCambio.toFixed(2)})
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cuenta de salida</label>
                <select
                  value={modalRetiro.cuenta_salida}
                  onChange={e => setModalRetiro(p => ({ ...p, cuenta_salida: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  {todasCuentas.map(c => (
                    <option key={c.key} value={c.key}>{c.label} ({c.moneda})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalRetiro(p => ({ ...p, open: false }))}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalRetiro.saving}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
                >
                  {modalRetiro.saving ? 'Guardando...' : 'Registrar Retiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RÁPIDO: TRANSFERENCIA INTERNA */}
      {modalTransfer.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              Transferencia / Cambio de Divisa
            </h3>
            <p className="text-xs text-slate-500">
              Movimiento neutro entre cuentas propias. No afecta ventas ni gastos operativos.
            </p>
            <form onSubmit={handleGuardarTransfer} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Cuenta Origen (Sale)</label>
                  <select
                    value={modalTransfer.cuenta_origen}
                    onChange={e => setModalTransfer(p => ({ ...p, cuenta_origen: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-medium"
                  >
                    {todasCuentas.map(c => (
                      <option key={c.key} value={c.key}>{c.label} ({c.moneda})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Cuenta Destino (Entra)</label>
                  <select
                    value={modalTransfer.cuenta_destino}
                    onChange={e => setModalTransfer(p => ({ ...p, cuenta_destino: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-medium"
                  >
                    {todasCuentas.map(c => (
                      <option key={c.key} value={c.key}>{c.label} ({c.moneda})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Monto que sale ({monedaTransOrigen})</label>
                  <input
                    type="number" step="0.01" min="0.01"
                    placeholder="0.00"
                    value={modalTransfer.monto_origen}
                    onChange={handleTransOrigenChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Monto que llega ({monedaTransDestino})</label>
                  <input
                    type="number" step="0.01" min="0.01"
                    placeholder={modalTransfer.monto_origen || '0.00'}
                    value={modalTransfer.monto_destino}
                    onChange={handleTransDestinoChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                    required
                  />
                </div>
              </div>

              {esCambioDivisa && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tasa real de la operación (Bs/$)</label>
                  <div className="flex gap-2">
                    <input
                      type="number" step="0.01" min="0.01"
                      placeholder={tasaCambio.toFixed(2)}
                      value={modalTransfer.tasa_cambio}
                      onChange={handleTransTasaChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setModalTransfer(p => ({ ...p, tasa_cambio: tasaCambio.toString() }))}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg whitespace-nowrap"
                    >
                      Usar guardada (Bs {tasaCambio.toFixed(2)})
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Concepto / Motivo</label>
                <input
                  type="text"
                  placeholder="Ej: Cambio USDT por Efectivo para compras..."
                  value={modalTransfer.concepto}
                  onChange={e => setModalTransfer(p => ({ ...p, concepto: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalTransfer(p => ({ ...p, open: false }))}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalTransfer.saving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
                >
                  {modalTransfer.saving ? 'Transfiriendo...' : 'Ejecutar Transferencia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AJUSTE MANUAL AUDITADO */}
      {modalAjuste.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Ajuste Manual Auditado</h3>
                <p className="text-xs text-slate-500">Cuenta: {modalAjuste.cuentaLabel}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Saldo Actual</label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700">
                  {modalAjuste.saldoActual.toFixed(2)}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nuevo Saldo</label>
                <input
                  type="number" step="0.01"
                  value={modalAjuste.nuevoSaldo}
                  onChange={e => setModalAjuste(p => ({ ...p, nuevoSaldo: e.target.value }))}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">¿Quién realiza el ajuste?</label>
              <div className="flex gap-2">
                {['Ysmael', 'Victor'].map(nombre => (
                  <label key={nombre} className={`flex-1 py-1.5 text-center rounded-lg border-2 cursor-pointer font-bold text-xs ${
                    modalAjuste.ajustador === nombre ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'
                  }`}>
                    <input
                      type="radio" value={nombre}
                      checked={modalAjuste.ajustador === nombre}
                      onChange={() => setModalAjuste(p => ({ ...p, ajustador: nombre }))}
                      className="hidden"
                    />
                    {nombre}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo del ajuste *</label>
              <textarea
                rows={2}
                placeholder="Ej: Corrección por compra de inventario no asentada..."
                value={modalAjuste.motivo}
                onChange={e => setModalAjuste(p => ({ ...p, motivo: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs resize-none"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalAjuste(p => ({ ...p, open: false }))}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarAjuste}
                disabled={modalAjuste.saving}
                className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
              >
                {modalAjuste.saving ? 'Guardando...' : 'Confirmar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AÑADIR NUEVA CUENTA BANCARIA / MÉTODO DE PAGO */}
      {modalNuevaCuenta.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Añadir Nueva Cuenta / Billetera</h3>
                <p className="text-xs text-slate-500">Agrega un nuevo banco, billetera digital o método de pago</p>
              </div>
            </div>

            <form onSubmit={handleCrearCuenta} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre de la Cuenta o Banco *</label>
                <input
                  type="text"
                  placeholder="Ej: Banesco Panamá, Wally, Mercantil..."
                  value={modalNuevaCuenta.nombre}
                  onChange={e => setModalNuevaCuenta(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Moneda Principal</label>
                <div className="flex gap-3">
                  <label className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border-2 cursor-pointer font-bold text-xs ${
                    modalNuevaCuenta.moneda === 'USD' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'
                  }`}>
                    <input
                      type="radio"
                      value="USD"
                      checked={modalNuevaCuenta.moneda === 'USD'}
                      onChange={() => setModalNuevaCuenta(p => ({ ...p, moneda: 'USD' }))}
                      className="hidden"
                    />
                    <span>Dólares (USD / USDT)</span>
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border-2 cursor-pointer font-bold text-xs ${
                    modalNuevaCuenta.moneda === 'BS' ? 'border-amber-600 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500'
                  }`}>
                    <input
                      type="radio"
                      value="BS"
                      checked={modalNuevaCuenta.moneda === 'BS'}
                      onChange={() => setModalNuevaCuenta(p => ({ ...p, moneda: 'BS' }))}
                      className="hidden"
                    />
                    <span>Bolívares (Bs)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Saldo Inicial (Opcional)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">
                    {modalNuevaCuenta.moneda === 'USD' ? '$' : 'Bs'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={modalNuevaCuenta.saldoInicial}
                    onChange={e => setModalNuevaCuenta(p => ({ ...p, saldoInicial: e.target.value }))}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNuevaCuenta(p => ({ ...p, open: false }))}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalNuevaCuenta.saving}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
                >
                  {modalNuevaCuenta.saving ? 'Creando...' : 'Crear Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CAMBIAR TASA DE CAMBIO GLOBAL */}
      {modalTasa.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Tasa de Cambio Global</h3>
                <p className="text-xs text-slate-500">Convierte las cuentas en Bolívares a USD</p>
              </div>
            </div>

            <form onSubmit={handleGuardarTasa} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nueva Tasa Referencial (Bs / USD) *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">Bs</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={modalTasa.nuevaTasa}
                    onChange={e => setModalTasa(p => ({ ...p, nuevaTasa: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 border border-brand-300 rounded-lg text-lg font-black text-slate-900 focus:ring-2 focus:ring-brand-500"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                Esta tasa se aplicará globalmente a toda la caja, reportes mensuales y conversiones en vivo de cuentas en Bolívares.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalTasa(p => ({ ...p, open: false }))}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalTasa.saving}
                  className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
                >
                  {modalTasa.saving ? 'Guardando...' : 'Guardar Tasa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
