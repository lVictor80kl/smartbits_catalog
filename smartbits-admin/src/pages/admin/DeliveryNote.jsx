import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, Loader2, Plus, X, Check, Clock, Ban } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, collection, addDoc, increment } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCuentasCaja } from '../../utils/useCuentasCaja';

export default function DeliveryNote() {
  const { id } = useParams();
  const [laptop, setLaptop] = useState(null);
  const [loading, setLoading] = useState(true);
  const noteRef = useRef(null);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Auto-generate 5-digit note number
  const [noteNumber, setNoteNumber] = useState(() => {
    const num = Math.floor(10000 + Math.random() * 90000);
    return `${String(num).slice(0, 3)}-${String(num).slice(3)}`;
  });

  // Current date formatted
  const formatDate = (date) => {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${date.getDate()} de ${months[date.getMonth()]} del ${date.getFullYear()}`;
  };

  const formatDateFile = (date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const [fecha, setFecha] = useState(formatDate(new Date()));

  // Customer form
  const [cliente, setCliente] = useState({
    nombre: '',
    tipoDoc: 'V-',
    cedula: '',
    prefijoTlf: '0414-',
    telefono: '',
    direccion: '',
  });

  const { todasCuentas, tasaCambio } = useCuentasCaja();

  // Payment methods (dynamic with finance account key)
  const [pagos, setPagos] = useState([
    { metodo: 'Efectivo', cuentaKey: 'efectivo', monto: '' }
  ]);

  const [unidades, setUnidades] = useState(1);
  const [garantia, setGarantia] = useState('3 meses');
  const [descripcion, setDescripcion] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Fetch laptop data
  useEffect(() => {
    const fetchLaptop = async () => {
      try {
        const laptopRef = doc(db, 'laptops', id);
        const laptopSnap = await getDoc(laptopRef);
        if (laptopSnap.exists()) {
          const data = laptopSnap.data();
          setLaptop({ id: laptopSnap.id, ...data });

          const initialDesc = [
            data.cpu,
            data.ram,
            data.almacenamiento,
            `GPU: ${data.gpu}`,
            `${data.pantalla}${data.touch?.toLowerCase() === 'sí' ? ' (Táctil)' : ''}`,
            `BAT: ${data.bateria}`,
            data.windows ? `SO: ${data.windows}` : ''
          ].filter(Boolean).join('\n');
          setDescripcion(initialDesc);
        } else {
          alert('Equipo no encontrado.');
        }
      } catch (err) {
        console.error('Error:', err);
        alert('Error al cargar equipo: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLaptop();
  }, [id]);

  const METODO_TO_CAJA_KEY = {
    'Zelle': 'zelle',
    'Efectivo': 'efectivo',
    'USDT': 'binance',
    'Binance Pay': 'binance',
    'Zinli': 'zinli',
    'PayPal': 'paypal',
    'Pago Móvil': 'venezuela',
    'Transferencia': 'venezuela',
  };

  const handleUpdateAvailability = async (newStatus) => {
    if (newStatus === 'keep') {
      setShowStatusModal(false);
      return;
    }

    setUpdatingStatus(true);
    try {
      const laptopRef = doc(db, 'laptops', id);
      const updateData = { disponibilidad: newStatus };

      if (newStatus === 'No disponible') {
        const tasaNum = Number(tasa) || 0;
        let totalPagadoUSD = 0;

        const metodosPago = pagos
          .filter(p => (Number(p.monto) || 0) > 0)
          .map(p => {
            const monto = Number(p.monto) || 0;
            let montoUSD;
            if (isBs(p.metodo)) {
              montoUSD = tasaNum > 0 ? monto / tasaNum : 0;
            } else {
              montoUSD = monto;
            }
            totalPagadoUSD += montoUSD;
            return { metodo: p.metodo, cuentaKey: p.cuentaKey || 'efectivo', monto, montoUSD };
          });

        const costoTotal = laptop.costo_total || 0;
        const ganancia = totalPagadoUSD - costoTotal;
        const porcentaje_ganancia = costoTotal > 0 ? (ganancia / costoTotal) * 100 : 0;
        let dias_en_inventario = 0;
        if (laptop.fecha_compra) {
          const fechaCompra = laptop.fecha_compra?.toDate ? laptop.fecha_compra.toDate() : new Date(laptop.fecha_compra);
          const msDiferencia = new Date().getTime() - fechaCompra.getTime();
          dias_en_inventario = Math.floor(msDiferencia / (1000 * 60 * 60 * 24));
        }

        updateData.fecha_venta = serverTimestamp();
        updateData.precio_final_venta = totalPagadoUSD;
        updateData.ganancia = ganancia;
        updateData.porcentaje_ganancia = porcentaje_ganancia;
        updateData.dias_en_inventario = dias_en_inventario;
        updateData.metodos_pago = metodosPago;
        updateData.tasa_venta = tasaNum;
        updateData.cliente_venta = {
          nombre: cliente.nombre,
          cedula: cliente.cedula ? `${cliente.tipoDoc}${cliente.cedula}` : '',
          telefono: cliente.telefono ? `${cliente.prefijoTlf}${cliente.telefono}` : '',
          direccion: cliente.direccion,
        };

        // 1. Actualizar documento de la laptop
        await updateDoc(laptopRef, updateData);

        // 2. Sumar dinero a las cuentas correctas de caja
        const cajaRef = doc(db, 'caja', 'saldos');
        const cajaSnap = await getDoc(cajaRef);
        if (cajaSnap.exists()) {
          const cajaUpdates = { updated_at: new Date() };
          for (const pago of metodosPago) {
            const cuenta = pago.cuentaKey || METODO_TO_CAJA_KEY[pago.metodo] || 'efectivo';
            if (cuenta && pago.montoUSD > 0) {
              cajaUpdates[cuenta] = increment(pago.montoUSD);
            }
          }
          if (metodosPago.length === 0 && totalPagadoUSD > 0) {
            cajaUpdates.ventas_no_asignadas = increment(totalPagadoUSD);
          }
          await updateDoc(cajaRef, cajaUpdates);
        }

        // 3. Registrar en historico de ingresos
        await addDoc(collection(db, 'historico_ingresos'), {
          fecha: serverTimestamp(),
          concepto: `Venta de ${laptop.marca || 'Laptop'} ${laptop.modelo || ''}`,
          monto: totalPagadoUSD,
          ganancia: ganancia,
          laptopId: id,
          tipo: 'venta_laptop',
        });

        // 4. Registrar venta completa en coleccion ventas
        await addDoc(collection(db, 'ventas'), {
          fecha: serverTimestamp(),
          laptopId: id,
          modelo: laptop.modelo || '',
          marca: laptop.marca || '',
          cliente: updateData.cliente_venta,
          metodos_pago: metodosPago,
          precio_venta_usd: totalPagadoUSD,
          costo_total: laptop.costo_total || 0,
          ganancia: ganancia,
          tasa_venta: tasaNum,
          noteNumber: noteNumber,
          descripcion: descripcion,
          observaciones: observaciones,
          unidades: unidades,
          garantia: garantia
        });
      } else {
        // Para "Coming soon" o cualquier otro status, solo actualizar disponibilidad
        await updateDoc(laptopRef, updateData);
      }

      setLaptop(prev => ({ ...prev, ...updateData }));
      setShowStatusModal(false);
    } catch (err) {
      console.error('Error al actualizar disponibilidad:', err);
      alert('Hubo un error al actualizar la disponibilidad: ' + err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const METODOS_OPCIONES = [
    { label: 'Efectivo', defaultCuenta: 'efectivo' },
    { label: 'Zelle', defaultCuenta: 'zelle' },
    { label: 'Pago Móvil', defaultCuenta: 'venezuela' },
    { label: 'Transferencia', defaultCuenta: 'venezuela' },
    { label: 'USDT', defaultCuenta: 'binance' },
    { label: 'Binance Pay', defaultCuenta: 'binance' },
    { label: 'Zinli', defaultCuenta: 'zinli' },
    { label: 'PayPal', defaultCuenta: 'paypal' },
    { label: 'Bancamiga', defaultCuenta: 'bancamiga' },
    { label: 'Otro', defaultCuenta: 'bolivares_bs' }
  ];

  const addPago = () => {
    setPagos(prev => [...prev, { metodo: 'Zelle', cuentaKey: 'zelle', monto: '' }]);
  };

  const removePago = (index) => {
    setPagos(prev => prev.filter((_, i) => i !== index));
  };

  const updatePago = (index, field, value) => {
    setPagos(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const updatePagoMetodo = (index, nuevoMetodo) => {
    const esBs = METODOS_BS.includes(nuevoMetodo);
    const cuentasValidas = todasCuentas.filter(c => esBs ? c.moneda === 'BS' : c.moneda !== 'BS');
    const defaultCuenta = cuentasValidas[0]?.key || (esBs ? 'venezuela' : 'efectivo');
    setPagos(prev => prev.map((p, i) => i === index ? { ...p, metodo: nuevoMetodo, cuentaKey: defaultCuenta } : p));
  };

  const subtotal = laptop ? laptop.precio * unidades : 0;

  const [tasa, setTasa] = useState('');

  // Auto-populate default rate from Finanzas
  useEffect(() => {
    if (tasaCambio && !tasa) {
      setTasa(String(tasaCambio));
    }
  }, [tasaCambio]);

  const METODOS_BS = ['Pago Móvil', 'Transferencia'];
  const isPagoBs = (pago) => {
    if (METODOS_BS.includes(pago.metodo)) return true;
    const c = todasCuentas.find(acc => acc.key === pago.cuentaKey);
    return c?.moneda === 'BS';
  };

  const isBs = (metodo) => METODOS_BS.includes(metodo);

  const tasaNum = Number(tasa) || 0;
  const formatMonto = (val) => Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 });

  // USD is always the base currency
  const precioUnitUSD = laptop?.precio ?? 0;
  const precioDisplay = subtotal; // always USD
  const precioUnitDisplay = precioUnitUSD; // always USD

  // Per-payment USD equivalence
  const getMontoUSD = (pago) => {
    const monto = Number(pago.monto) || 0;
    if (isPagoBs(pago) && tasaNum > 0) return monto / tasaNum;
    return monto;
  };

  const totalPaidUSD = pagos.reduce((sum, p) => sum + getMontoUSD(p), 0);
  const remainingUSD = precioDisplay - totalPaidUSD;

  const handleDownloadPDF = () => {
    const element = noteRef.current;
    if (!element) return;

    const clientName = cliente.nombre.trim().replace(/\s+/g, '_') || 'Cliente';
    const fileName = `${clientName}_NDE_${formatDateFile(new Date())}`;

    // Abrir una ventana nueva con solo el contenido de la nota
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes para descargar el PDF.');
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
            margin: 15mm;
          }
          body {
            margin: 0;
            padding: 0;
            background: #fff;
          }
        </style>
      </head>
      <body>
        ${element.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();

    // Esperar a que los recursos carguen (como el logo)
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
        setShowStatusModal(true);
      }, 300);
    };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-500">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="font-medium">Cargando datos del equipo...</p>
      </div>
    );
  }

  if (!laptop) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">No se encontró el equipo.</p>
        <Link to="/admin" className="text-blue-600 hover:underline mt-4 inline-block">Volver al Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-900 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nota de Entrega</h1>
            <p className="text-gray-500 text-sm mt-1">Genera la nota para <strong>{laptop.modelo}</strong></p>
          </div>
        </div>
        <button
          onClick={handleDownloadPDF}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-md shadow-blue-500/20"
        >
          <Download className="w-5 h-5" /> Generar e Imprimir PDF
        </button>
      </div>

      {/* Editable fields (NOT part of PDF) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6 space-y-4">
        <h2 className="font-semibold text-gray-900 text-lg">Datos del Cliente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="text" value={fecha} onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nro. de Nota</label>
            <input
              type="text" value={noteNumber} onChange={(e) => setNoteNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Cliente</label>
            <input
              type="text" value={cliente.nombre} onChange={(e) => setCliente(p => ({ ...p, nombre: e.target.value.toUpperCase() }))}
              placeholder="Ej: SALMA SILVA"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doc. Cliente (Cédula/RIF)</label>
            <div className="flex gap-2">
              <select
                value={cliente.tipoDoc}
                onChange={(e) => setCliente(p => ({ ...p, tipoDoc: e.target.value }))}
                className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="V-">V-</option>
                <option value="J-">J-</option>
                <option value="E-">E-</option>
              </select>
              <input
                type="text" value={cliente.cedula}
                onChange={(e) => {
                  const numbers = e.target.value.replace(/\D/g, '');
                  const formatted = numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                  setCliente(p => ({ ...p, cedula: formatted }));
                }}
                placeholder="25.535.271"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input
              type="text" value={cliente.direccion} onChange={(e) => setCliente(p => ({ ...p, direccion: e.target.value }))}
              placeholder="Ej: Guacara, Carabobo"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nro. Teléfono</label>
            <div className="flex gap-2">
              <select
                value={cliente.prefijoTlf}
                onChange={(e) => setCliente(p => ({ ...p, prefijoTlf: e.target.value, telefono: '' }))}
                className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="0414-">0414</option>
                <option value="0424-">0424</option>
                <option value="0412-">0412</option>
                <option value="0416-">0416</option>
                <option value="0426-">0426</option>
                <option value="">Manual</option>
              </select>
              {cliente.prefijoTlf === '' ? (
                <input
                  type="text" value={cliente.telefono}
                  onChange={(e) => setCliente(p => ({ ...p, telefono: e.target.value }))}
                  placeholder="Ej: +58 414 1234567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              ) : (
                <input
                  type="text" value={cliente.telefono}
                  onChange={(e) => {
                    const numbers = e.target.value.replace(/\D/g, '').slice(0, 7);
                    setCliente(p => ({ ...p, telefono: numbers }));
                  }}
                  placeholder="4229140"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              )}
            </div>
          </div>
        </div>

        <hr className="my-4 border-gray-200" />

        <h2 className="font-semibold text-gray-900 text-lg">Métodos de Pago</h2>
        <div className="space-y-3">
          {pagos.map((pago, index) => {
            const esEnBs = isPagoBs(pago);
            const cuentasFiltradas = todasCuentas.filter(c => esEnBs ? c.moneda === 'BS' : c.moneda !== 'BS');
            return (
              <div key={index} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 flex-1">
                  {/* Método (Nombre para PDF) */}
                  <select
                    value={pago.metodo}
                    onChange={(e) => updatePagoMetodo(index, e.target.value)}
                    className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  >
                    {METODOS_OPCIONES.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
                  </select>

                  {/* Cuenta de Finanzas (Filtrada por moneda) */}
                  <select
                    value={pago.cuentaKey || (cuentasFiltradas[0]?.key || 'efectivo')}
                    onChange={(e) => updatePago(index, 'cuentaKey', e.target.value)}
                    className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 font-medium"
                    title="Cuenta de Finanzas a la que ingresa el dinero"
                  >
                    {cuentasFiltradas.map(acc => (
                      <option key={acc.key} value={acc.key}>
                        {acc.label} ({acc.moneda})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">{esEnBs ? 'Bs' : '$'}</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={pago.monto}
                      onChange={(e) => updatePago(index, 'monto', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                    />
                  </div>
                  {esEnBs && tasaNum > 0 && (
                    <span className="text-xs text-gray-500 font-medium whitespace-nowrap bg-white px-2 py-1.5 border border-gray-200 rounded-md">
                      ≈ ${formatMonto(Number(pago.monto) / tasaNum)}
                    </span>
                  )}
                  {pagos.length > 1 && (
                    <button onClick={() => removePago(index)} className="p-1.5 text-red-400 hover:text-red-600 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <button
            onClick={addPago}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors mt-2"
          >
            <Plus className="w-4 h-4" /> Agregar método de pago
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidades</label>
            <input
              type="number" min="1" value={unidades} onChange={(e) => setUnidades(Number(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Garantía</label>
            <input
              type="text" value={garantia} onChange={(e) => setGarantia(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-amber-800">Tasa de cambio (Bs por $)</label>
            {tasaCambio > 0 && (
              <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-semibold">
                Tasa predeterminada Finanzas: {formatMonto(tasaCambio)} Bs/$
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-amber-700 font-medium">1 $ =</span>
            <input
              type="number" min="0" step="0.01"
              value={tasa}
              onChange={(e) => setTasa(e.target.value)}
              placeholder="Ej: 95.50"
              className="w-40 px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none bg-white"
            />
            <span className="text-sm text-amber-700 font-medium">Bs</span>
            {tasaCambio > 0 && Number(tasa) !== tasaCambio && (
              <button
                type="button"
                onClick={() => setTasa(String(tasaCambio))}
                className="text-xs text-amber-800 underline hover:text-amber-900 font-medium ml-2"
              >
                Usar tasa de Finanzas
              </button>
            )}
          </div>
          <p className="text-xs text-amber-600 mt-1">Se usa para calcular el equivalente en USD de los pagos en Bs.</p>
        </div>

        {/* Summary Panel */}
        <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Resumen de Venta</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total de la Venta:</span>
              <span className="font-bold text-slate-900">${formatMonto(precioDisplay)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Pagado (Equivalente USD):</span>
              <span className="font-bold text-blue-600">${formatMonto(totalPaidUSD)}</span>
            </div>
            <hr className="border-slate-200" />
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Resta por Pagar:</span>
              <span className={`font-bold ${remainingUSD > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ${formatMonto(remainingUSD)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del Equipo</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows="5"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
          />
          {/* Observaciones */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
            />
          </div>
        </div>
      </div>

      {/* ===== PDF PREVIEW ===== */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vista previa del PDF</span>
        </div>

        <div ref={noteRef} style={{ padding: '40px', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: '#222', background: '#fff', maxWidth: '720px', margin: '0 auto' }}>
          {/* Logo + Title */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <img
              src="/logo-black.png"
              alt="Smartbits"
              style={{ height: '55px', display: 'block', margin: '0 auto' }}
              crossOrigin="anonymous"
            />
          </div>

          <h1 style={{ textAlign: 'center', fontSize: '20px', fontWeight: '700', color: '#1a1a1a', borderBottom: '3px solid #5ce1e6', paddingBottom: '8px', marginBottom: '20px', letterSpacing: '2px' }}>
            NOTA DE ENTREGA
          </h1>

          {/* Note number + date */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#666' }}>Fecha: </span>
              <strong>{fecha}</strong>
            </div>
            <div>
              <span style={{ color: '#5ce1e6', fontWeight: '600' }}>Nro: </span>
              <span style={{ background: '#f0f9ff', padding: '2px 10px', borderRadius: '4px', fontWeight: '700', border: '1px solid #bae6fd' }}>{noteNumber}</span>
            </div>
          </div>

          {/* Client info */}
          <table style={{ width: '100%', fontSize: '13px', marginBottom: '20px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '5px 0', color: '#666', width: '120px' }}>Cliente:</td>
                <td style={{ padding: '5px 0', fontWeight: '600' }}>{cliente.nombre || '—'}</td>
              </tr>
              <tr>
                <td style={{ padding: '5px 0', color: '#666' }}>Doc. Cliente:</td>
                <td style={{ padding: '5px 0', fontWeight: '600' }}>{cliente.cedula ? `${cliente.tipoDoc}${cliente.cedula}` : '—'}</td>
              </tr>
              <tr>
                <td style={{ padding: '5px 0', color: '#666' }}>Dirección:</td>
                <td style={{ padding: '5px 0', fontWeight: '600' }}>{cliente.direccion || '—'}</td>
              </tr>
              <tr>
                <td style={{ padding: '5px 0', color: '#666' }}>Nro Teléfono:</td>
                <td style={{ padding: '5px 0', fontWeight: '600' }}>{cliente.telefono ? `${cliente.prefijoTlf}${cliente.telefono}` : '—'}</td>
              </tr>
            </tbody>
          </table>

          {/* Product table */}
          {(() => {
            const hasBsPayment = pagos.some(p => (Number(p.monto) || 0) > 0 && isPagoBs(p));
            const isPdfInBs = hasBsPayment && tasaNum > 0;
            const precioUnitPdf = isPdfInBs ? precioUnitUSD * tasaNum : precioUnitUSD;
            const precioTotalPdf = isPdfInBs ? precioDisplay * tasaNum : precioDisplay;
            const currencySymbol = isPdfInBs ? 'Bs' : '$';

            return (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '6px' }}>
                  <thead>
                    <tr style={{ background: '#f0f9ff', borderBottom: '2px solid #5ce1e6' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: '#0ea5e9', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Cantidad</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: '#0ea5e9', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Concepto/Referencia</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#0ea5e9', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Precio</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#0ea5e9', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Sub-Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px' }}>{unidades}</td>
                      <td style={{ padding: '10px', fontWeight: '600' }}>{laptop.modelo}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{currencySymbol} {formatMonto(precioUnitPdf)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>{currencySymbol} {formatMonto(precioTotalPdf)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Specs Description */}
                <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '12px', lineHeight: '1.8' }}>
                  <span style={{ color: '#0ea5e9', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Descripción:</span>
                  <div style={{ marginTop: '4px', color: '#444', whiteSpace: 'pre-wrap' }}>{descripcion}</div>
                </div>
                {/* Observaciones section */}
                {observaciones && (
                  <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                    <span style={{ color: '#0ea5e9', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Observaciones:</span>
                    <div style={{ marginTop: '4px', color: '#444', whiteSpace: 'pre-wrap', fontSize: '11px' }}>{observaciones}</div>
                  </div>
                )}

                {/* Payment + Total */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '20px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #5ce1e6' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: '#0ea5e9', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Método de Pago</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#0ea5e9', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.filter(p => (Number(p.monto) || 0) > 0).map((p, i) => {
                      const esEnBs = isPagoBs(p);
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '7px 10px', fontWeight: '500' }}>{p.metodo}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '600' }}>
                            {esEnBs ? `Bs ${formatMonto(p.monto)}` : `$ ${formatMonto(p.monto)}`}
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderTop: '2px solid #222' }}>
                      <td style={{ padding: '10px', fontWeight: '800', fontSize: '14px' }}>Total:</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', fontSize: '14px' }}>
                        {currencySymbol} {formatMonto(precioTotalPdf)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            );
          })()}

          {/* Warranty */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px 16px', fontSize: '11px', lineHeight: '1.7', color: '#15803d' }}>
            <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '6px', color: '#166534' }}>
              Garantía: {garantia}. <span style={{ fontWeight: '400', fontStyle: 'italic' }}>*Ciertas condiciones aplican</span>
            </div>
            <p style={{ margin: 0 }}>
              *El equipo se probó al momento de la entrega, disco duro, temperaturas, caracteristicas, bateria, pantalla, teclado, touchpad, cargador, puertos usb, speakers, microfono, wifi, bluetooth, webcam, bisagras, carcasa, sistema operativo, etc.
              La garantía cubre desperfectos que no se hayan probado y se somete una inspección previa para valer la garantía.
            </p>
            <p style={{ margin: '4px 0 0 0' }}>
              *El sello de garantía tanto de cargador como laptop debe estar intacto, golpes no existentes en el momento de la entrega así como marcas de humedad invalidan la garantía.
            </p>
          </div>

          {/* Footer */}
          <div style={{ marginTop: '30px', borderTop: '1px solid #e5e7eb', paddingTop: '12px', textAlign: 'center', color: '#aaa', fontSize: '10px' }}>
            Compra inteligente, compra en Smartbits.
          </div>
        </div>
      </div>

      {/* Modern Availability Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          {/* Backdrop with beautiful blur */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300"
            onClick={() => !updatingStatus && setShowStatusModal(false)}
          />

          <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0 pointer-events-none">
            {/* Modal Panel */}
            <div className="relative transform overflow-hidden rounded-3xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md pointer-events-auto border border-slate-100 animate-in fade-in-0 zoom-in-95 duration-300 ease-out">

              {/* Top accent line */}
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400" />

              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-slate-900" id="modal-title">
                    Actualizar disponibilidad
                  </h3>
                  {!updatingStatus && (
                    <button
                      onClick={() => setShowStatusModal(false)}
                      className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                  Se generó correctamente el PDF para la nota de entrega de <strong className="text-slate-800">{laptop.modelo}</strong>. ¿Deseas actualizar el estado de disponibilidad del equipo en el catálogo?
                </p>

                {/* Current Status Badge */}
                <div className="flex items-center gap-2 mb-6 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado actual:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${laptop.disponibilidad === 'Disponible'
                    ? 'bg-green-100 text-green-700'
                    : laptop.disponibilidad === 'Coming soon'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                    {laptop.disponibilidad || 'No disponible'}
                  </span>
                </div>

                {/* Action Cards */}
                <div className="space-y-3">
                  {/* Option 1: No disponible */}
                  <button
                    disabled={updatingStatus}
                    onClick={() => handleUpdateAvailability('No disponible')}
                    className="w-full text-left group flex items-start gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-red-500/30 hover:bg-red-50/20 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-red-100">
                      {updatingStatus ? <Loader2 className="w-5 h-5 animate-spin" /> : <Ban className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900 group-hover:text-red-700 transition-colors text-sm">
                        Marcar como "No disponible"
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Útil si acabas de vender este equipo y no hay más stock.
                      </p>
                    </div>
                  </button>

                  {/* Option 2: Coming soon */}
                  <button
                    disabled={updatingStatus}
                    onClick={() => handleUpdateAvailability('Coming soon')}
                    className="w-full text-left group flex items-start gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-blue-500/30 hover:bg-blue-50/20 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-blue-100">
                      {updatingStatus ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors text-sm">
                        Marcar como "Coming soon"
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Si esperas recibir más unidades de este modelo pronto.
                      </p>
                    </div>
                  </button>

                  {/* Option 3: Keep Current / Seguir sin cambiar */}
                  <button
                    disabled={updatingStatus}
                    onClick={() => handleUpdateAvailability('keep')}
                    className="w-full text-left group flex items-start gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-slate-100">
                      <Check className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900 group-hover:text-slate-700 transition-colors text-sm">
                        Seguir sin cambiar
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Mantener el estado actual del equipo sin realizar cambios.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
