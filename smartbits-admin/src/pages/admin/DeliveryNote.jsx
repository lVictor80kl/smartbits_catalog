import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, Loader2, Plus, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function DeliveryNote() {
  const { id } = useParams();
  const [laptop, setLaptop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const noteRef = useRef(null);

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
    cedula: '',
    direccion: '',
    telefono: '',
  });

  // Payment methods (dynamic)
  const [pagos, setPagos] = useState([
    { metodo: 'Zelle', monto: '' }
  ]);

  const [unidades, setUnidades] = useState(1);
  const [garantia, setGarantia] = useState('3 meses');

  // Fetch laptop data
  useEffect(() => {
    const fetchLaptop = async () => {
      try {
        const laptopRef = doc(db, 'laptops', id);
        const laptopSnap = await getDoc(laptopRef);
        if (laptopSnap.exists()) {
          setLaptop({ id: laptopSnap.id, ...laptopSnap.data() });
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

  const addPago = () => {
    setPagos(prev => [...prev, { metodo: 'Efectivo', monto: '' }]);
  };

  const removePago = (index) => {
    setPagos(prev => prev.filter((_, i) => i !== index));
  };

  const updatePago = (index, field, value) => {
    setPagos(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const subtotal = laptop ? laptop.precio * unidades : 0;
  const totalPagado = pagos.reduce((sum, p) => sum + (Number(p.monto) || 0), 0);

  const handleDownloadPDF = async () => {
    setGenerating(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = noteRef.current;

      const clientName = cliente.nombre.trim().replace(/\s+/g, '_') || 'Cliente';
      const fileName = `${clientName}_NDE_${formatDateFile(new Date())}.pdf`;

      const opt = {
        margin: [10, 10, 10, 10],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: {
          unit: 'mm',
          format: 'letter',
          orientation: 'portrait'
        }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('Error generando PDF:', err);
      alert('Error al generar PDF: ' + err.message);
    } finally {
      setGenerating(false);
    }
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
          disabled={generating}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-70"
        >
          {generating ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Generando...</>
          ) : (
            <><Download className="w-5 h-5" /> Descargar PDF</>
          )}
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
              type="text" value={cliente.nombre} onChange={(e) => setCliente(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Salma Silva"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doc. Cliente (Cédula)</label>
            <input
              type="text" value={cliente.cedula} onChange={(e) => setCliente(p => ({ ...p, cedula: e.target.value }))}
              placeholder="Ej: V-30.430.572"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
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
            <input
              type="text" value={cliente.telefono} onChange={(e) => setCliente(p => ({ ...p, telefono: e.target.value }))}
              placeholder="Ej: 0414-4229140"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <hr className="my-4 border-gray-200" />

        <h2 className="font-semibold text-gray-900 text-lg">Métodos de Pago</h2>
        <div className="space-y-3">
          {pagos.map((pago, index) => (
            <div key={index} className="flex items-center gap-3">
              <select
                value={pago.metodo}
                onChange={(e) => updatePago(index, 'metodo', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Zelle">Zelle</option>
                <option value="USDT">USDT</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Pago Móvil">Pago Móvil</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Binance Pay">Binance Pay</option>
                <option value="Otro">Otro</option>
              </select>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number" min="0" step="0.01"
                  value={pago.monto}
                  onChange={(e) => updatePago(index, 'monto', e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              {pagos.length > 1 && (
                <button onClick={() => removePago(index)} className="p-1.5 text-red-400 hover:text-red-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addPago}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
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
      </div>

      {/* ===== PDF PREVIEW ===== */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vista previa del PDF</span>
        </div>

        <div ref={noteRef} style={{ padding: '40px', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: '#222', background: '#fff', maxWidth: '720px', margin: '0 auto' }}>
          {/* Logo + Title */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <img src="/logo-black.png" alt="Smartbits" style={{ height: '50px', marginBottom: '4px' }} crossOrigin="anonymous" />
          </div>

          <h1 style={{ textAlign: 'center', fontSize: '20px', fontWeight: '700', color: '#1a1a1a', borderBottom: '3px solid #38bdf8', paddingBottom: '8px', marginBottom: '20px', letterSpacing: '2px' }}>
            NOTA DE ENTREGA
          </h1>

          {/* Note number + date */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#666' }}>Fecha: </span>
              <strong>{fecha}</strong>
            </div>
            <div>
              <span style={{ color: '#38bdf8', fontWeight: '600' }}>Nro: </span>
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
                <td style={{ padding: '5px 0', fontWeight: '600' }}>{cliente.cedula || '—'}</td>
              </tr>
              <tr>
                <td style={{ padding: '5px 0', color: '#666' }}>Dirección:</td>
                <td style={{ padding: '5px 0', fontWeight: '600' }}>{cliente.direccion || '—'}</td>
              </tr>
              <tr>
                <td style={{ padding: '5px 0', color: '#666' }}>Nro Teléfono:</td>
                <td style={{ padding: '5px 0', fontWeight: '600' }}>{cliente.telefono || '—'}</td>
              </tr>
            </tbody>
          </table>

          {/* Product table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '6px' }}>
            <thead>
              <tr style={{ background: '#f0f9ff', borderBottom: '2px solid #38bdf8' }}>
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
                <td style={{ padding: '10px', textAlign: 'right' }}>{Number(laptop.precio).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>{subtotal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          {/* Specs Description */}
          <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '12px', lineHeight: '1.8' }}>
            <span style={{ color: '#0ea5e9', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Descripción:</span>
            <div style={{ marginTop: '4px', color: '#444' }}>
              <div>{laptop.cpu}</div>
              <div>{laptop.ram}</div>
              <div>{laptop.almacenamiento}</div>
              <div>GPU: {laptop.gpu}</div>
              <div>{laptop.pantalla}{laptop.touch?.toLowerCase() === 'sí' ? ' (Táctil)' : ''}</div>
              <div>BAT: {laptop.bateria}</div>
              {laptop.windows && <div>SO: {laptop.windows}</div>}
            </div>
          </div>

          {/* Payment + Total */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '20px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #38bdf8' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', color: '#0ea5e9', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Método de Pago</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', color: '#0ea5e9', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '7px 10px' }}>{p.metodo}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>${Number(p.monto || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #222' }}>
                <td style={{ padding: '10px', fontWeight: '800', fontSize: '14px' }}>Total:</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', fontSize: '14px' }}>${subtotal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          {/* Warranty */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px 16px', fontSize: '11px', lineHeight: '1.7', color: '#15803d' }}>
            <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '6px', color: '#166534' }}>
              Garantía: {garantia}. <span style={{ fontWeight: '400', fontStyle: 'italic' }}>*Ciertas condiciones aplican</span>
            </div>
            <p style={{ margin: 0 }}>
              *El equipo se recibió por completo al momento de la entrega. La garantía cubre desperfectos que no se hayan probado y se requiera una inspección previa.
            </p>
            <p style={{ margin: '4px 0 0 0' }}>
              *El sello de garantía tanto de cargador como laptop debe estar intacto, golpes no existentes en el momento de la entrega así como marcas de humedad invalidan la garantía.
            </p>
          </div>

          {/* Footer */}
          <div style={{ marginTop: '30px', borderTop: '1px solid #e5e7eb', paddingTop: '12px', textAlign: 'center', color: '#aaa', fontSize: '10px' }}>
            Smartbits — Equipos certificados de calidad
          </div>
        </div>
      </div>
    </div>
  );
}
