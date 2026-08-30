import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, Loader2, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCuentasCaja } from '../../utils/useCuentasCaja';

export default function ServiceDeliveryNote() {
  const noteRef = useRef(null);

  // Auto-generate note number
  const [noteNumber, setNoteNumber] = useState(() => {
    const num = Math.floor(10000 + Math.random() * 90000);
    return `${String(num).slice(0, 3)}-${String(num).slice(3)}`;
  });

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

  const [cliente, setCliente] = useState({
    nombre: '',
    tipoDoc: 'V-',
    cedula: '',
    prefijoTlf: '0414-',
    telefono: '',
    direccion: '',
  });

  const { todasCuentas, tasaCambio } = useCuentasCaja();

  const [pagos, setPagos] = useState([
    { metodo: 'Efectivo', cuentaKey: 'efectivo', monto: '' }
  ]);

  const [equipoRecibido, setEquipoRecibido] = useState('');
  const [descripcionServicio, setDescripcionServicio] = useState('');
  const [costoServicio, setCostoServicio] = useState('');
  const [garantia, setGarantia] = useState('1 mes');
  const [observaciones, setObservaciones] = useState('');

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

  const costoServicioNum = Number(costoServicio) || 0;

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

  const precioDisplay = costoServicioNum;

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
    const fileName = `${clientName}_NDE_ST_${formatDateFile(new Date())}`;

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

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 300);
    };
  };

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
            <h1 className="text-2xl font-bold text-gray-900">Nota de Entrega - Servicio Técnico</h1>
            <p className="text-gray-500 text-sm mt-1">Genera la nota para el servicio técnico</p>
          </div>
        </div>
        <button
          onClick={handleDownloadPDF}
          className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-md shadow-amber-500/20"
        >
          <Download className="w-5 h-5" /> Generar e Imprimir PDF
        </button>
      </div>

      {/* Editable fields */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6 space-y-4">
        <h2 className="font-semibold text-gray-900 text-lg">Datos del Cliente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="text" value={fecha} onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nro. de Nota</label>
            <input
              type="text" value={noteNumber} onChange={(e) => setNoteNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Cliente</label>
            <input
              type="text" value={cliente.nombre} onChange={(e) => setCliente(p => ({ ...p, nombre: e.target.value.toUpperCase() }))}
              placeholder="Ej: SALMA SILVA"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doc. Cliente (Cédula/RIF)</label>
            <div className="flex gap-2">
              <select
                value={cliente.tipoDoc}
                onChange={(e) => setCliente(p => ({ ...p, tipoDoc: e.target.value }))}
                className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input
              type="text" value={cliente.direccion} onChange={(e) => setCliente(p => ({ ...p, direccion: e.target.value }))}
              placeholder="Ej: Guacara, Carabobo"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nro. Teléfono</label>
            <div className="flex gap-2">
              <select
                value={cliente.prefijoTlf}
                onChange={(e) => setCliente(p => ({ ...p, prefijoTlf: e.target.value, telefono: '' }))}
                className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              ) : (
                <input
                  type="text" value={cliente.telefono}
                  onChange={(e) => {
                    const numbers = e.target.value.replace(/\D/g, '').slice(0, 7);
                    setCliente(p => ({ ...p, telefono: numbers }));
                  }}
                  placeholder="4229140"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              )}
            </div>
          </div>
        </div>

        <hr className="my-4 border-gray-200" />

        <h2 className="font-semibold text-gray-900 text-lg">Equipo Recibido</h2>
        <input
          type="text" value={equipoRecibido} onChange={(e) => setEquipoRecibido(e.target.value)}
          placeholder="Ej: Laptop Dell Inspiron 15, Mouse Logitech MX Master, etc."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
        />

        <hr className="my-4 border-gray-200" />

        <h2 className="font-semibold text-gray-900 text-lg">Descripción del Servicio Técnico</h2>
        <textarea
          value={descripcionServicio}
          onChange={(e) => setDescripcionServicio(e.target.value)}
          placeholder="Ej: Cambio de pantalla, limpieza interna, reinstalación de sistema operativo, cambio de batería..."
          rows="4"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-y"
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Costo del Servicio ($)</label>
            <input
              type="number" min="0" step="0.01"
              value={costoServicio}
              onChange={(e) => setCostoServicio(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Garantía del Servicio</label>
            <input
              type="text" value={garantia} onChange={(e) => setGarantia(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
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
                    className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                  >
                    {METODOS_OPCIONES.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
                  </select>

                  {/* Cuenta de Finanzas (Filtrada por moneda) */}
                  <select
                    value={pago.cuentaKey || (cuentasFiltradas[0]?.key || 'efectivo')}
                    onChange={(e) => updatePago(index, 'cuentaKey', e.target.value)}
                    className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 outline-none text-gray-700 font-medium"
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
                      className="w-full pl-8 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none font-semibold"
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
            className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors mt-2"
          >
            <Plus className="w-4 h-4" /> Agregar método de pago
          </button>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-y"
          />
        </div>
      </div>

      {/* ===== PDF PREVIEW ===== */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vista previa del PDF</span>
        </div>

        <div ref={noteRef} style={{ padding: '40px', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: '#222', background: '#fff', maxWidth: '720px', margin: '0 auto' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <img
              src="/logo-black.png"
              alt="Smartbits"
              style={{ height: '55px', display: 'block', margin: '0 auto' }}
              crossOrigin="anonymous"
            />
          </div>

          {/* Title */}
          <h1 style={{ textAlign: 'center', fontSize: '20px', fontWeight: '700', color: '#1a1a1a', borderBottom: '3px solid #f59e0b', paddingBottom: '8px', marginBottom: '20px', letterSpacing: '2px' }}>
            NOTA DE ENTREGA - SERVICIO TÉCNICO
          </h1>

          {/* Note number + date */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#666' }}>Fecha: </span>
              <strong>{fecha}</strong>
            </div>
            <div>
              <span style={{ color: '#b45309', fontWeight: '600' }}>Nro: </span>
              <span style={{ background: '#fffbeb', padding: '2px 10px', borderRadius: '4px', fontWeight: '700', border: '1px solid #fde68a' }}>{noteNumber}</span>
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

          {/* Equipo recibido */}
          {equipoRecibido && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '12px' }}>
              <span style={{ color: '#64748b', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase' }}>Equipo Recibido:</span>
              <div style={{ marginTop: '4px', fontWeight: '600', color: '#1e293b' }}>{equipoRecibido}</div>
            </div>
          )}

          {/* Descripción del servicio */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px', fontSize: '12px', lineHeight: '1.8' }}>
            <span style={{ color: '#b45309', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Descripción del Servicio Técnico:</span>
            <div style={{ marginTop: '6px', color: '#444', whiteSpace: 'pre-wrap' }}>{descripcionServicio || '—'}</div>
          </div>

          {/* Servicio table */}
          {(() => {
            const hasBsPayment = pagos.some(p => (Number(p.monto) || 0) > 0 && isPagoBs(p));
            const isPdfInBs = hasBsPayment && tasaNum > 0;
            const precioTotalPdf = isPdfInBs ? precioDisplay * tasaNum : precioDisplay;
            const currencySymbol = isPdfInBs ? 'Bs' : '$';

            return (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '20px' }}>
                  <thead>
                    <tr style={{ background: '#fffbeb', borderBottom: '2px solid #f59e0b' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: '#b45309', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Servicio</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#b45309', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '10px', fontWeight: '600' }}>Servicio Técnico</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>{currencySymbol} {formatMonto(precioTotalPdf)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Observaciones */}
                {observaciones && (
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ color: '#b45309', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Observaciones:</span>
                    <div style={{ marginTop: '4px', color: '#444', whiteSpace: 'pre-wrap', fontSize: '11px' }}>{observaciones}</div>
                  </div>
                )}

                {/* Payment + Total */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f59e0b' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: '#b45309', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Método de Pago</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#b45309', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Monto</th>
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

          {/* Garantía */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px 16px', fontSize: '11px', lineHeight: '1.7', color: '#15803d' }}>
            <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '6px', color: '#166534' }}>
              Garantía del Servicio: {garantia}. <span style={{ fontWeight: '400', fontStyle: 'italic' }}>*Ciertas condiciones aplican</span>
            </div>
            <p style={{ margin: 0 }}>
              *El servicio técnico se realizó de manera profesional. La garantía cubre el trabajo realizado y se aplica únicamente bajo las condiciones establecidas.
            </p>
            <p style={{ margin: '4px 0 0 0' }}>
              *Cualquier daño ocasionado por mal uso, golpes, líquidos o manipulación por terceros anula la garantía del servicio.
            </p>
          </div>

          {/* Footer */}
          <div style={{ marginTop: '30px', borderTop: '1px solid #e5e7eb', paddingTop: '12px', textAlign: 'center', color: '#aaa', fontSize: '10px' }}>
            Compra inteligente, compra en Smartbits.
          </div>
        </div>
      </div>
    </div>
  );
}
