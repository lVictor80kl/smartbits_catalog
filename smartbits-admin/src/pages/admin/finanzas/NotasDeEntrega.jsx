import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, updateDoc, where, deleteField } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Search, Edit2, Save, Loader2, X, Printer, Laptop } from 'lucide-react';

export default function NotasDeEntrega() {
  const [ventas, setVentas] = useState([]);
  const [laptopsDisponibles, setLaptopsDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  
  const [editModal, setEditModal] = useState({ isOpen: false, item: null, processing: false });
  const [clienteData, setClienteData] = useState({
    nombre: '',
    tipoDoc: 'V-',
    cedula: '',
    prefijoTlf: '0414-',
    telefono: '',
    direccion: ''
  });
  
  // Estado para manejar el cambio de laptop
  const [laptopEdit, setLaptopEdit] = useState({ cambiar: false, selectedLaptopId: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'ventas'), orderBy('fecha', 'desc'));
      const snap = await getDocs(q);
      setVentas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching ventas:", error);
    }
    setLoading(false);
  };

  const fetchLaptopsDisponibles = async () => {
    try {
      const q = query(collection(db, 'laptops'), where('disponibilidad', '==', 'Disponible'));
      const snap = await getDocs(q);
      setLaptopsDisponibles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error fetching laptops:", e);
    }
  };

  useEffect(() => {
    fetchData();
    fetchLaptopsDisponibles();
  }, []);

  const filtered = ventas.filter(v => 
    v.cliente?.nombre?.toLowerCase().includes(filter.toLowerCase()) ||
    v.modelo?.toLowerCase().includes(filter.toLowerCase()) ||
    v.cliente?.cedula?.toLowerCase().includes(filter.toLowerCase()) ||
    v.noteNumber?.toLowerCase().includes(filter.toLowerCase())
  );

  const openEditModal = (item) => {
    // Parsear datos antiguos que pueden venir unidos (ej: V-25535271)
    let tipoDoc = 'V-';
    let cedula = item.cliente?.cedula || '';
    if (cedula.startsWith('V-') || cedula.startsWith('J-') || cedula.startsWith('E-')) {
      tipoDoc = cedula.substring(0, 2);
      cedula = cedula.substring(2);
    }

    let prefijoTlf = '0414-';
    let telefono = item.cliente?.telefono || '';
    const prefijosComunes = ['0414-', '0424-', '0412-', '0416-', '0426-'];
    for (const pref of prefijosComunes) {
      if (telefono.startsWith(pref)) {
        prefijoTlf = pref;
        telefono = telefono.substring(pref.length);
        break;
      }
    }
    if (!prefijosComunes.some(p => item.cliente?.telefono?.startsWith(p))) {
      prefijoTlf = '';
    }

    setClienteData({
      nombre: item.cliente?.nombre || '',
      tipoDoc,
      cedula,
      prefijoTlf,
      telefono,
      direccion: item.cliente?.direccion || ''
    });
    
    setLaptopEdit({ cambiar: false, selectedLaptopId: '' });
    setEditModal({ isOpen: true, item, processing: false });
  };

  const handleSaveEdit = async () => {
    const { item } = editModal;
    setEditModal(prev => ({ ...prev, processing: true }));

    try {
      const updatedCliente = {
        nombre: clienteData.nombre.toUpperCase(),
        cedula: clienteData.cedula ? `${clienteData.tipoDoc}${clienteData.cedula}` : '',
        telefono: clienteData.telefono ? `${clienteData.prefijoTlf}${clienteData.telefono}` : '',
        direccion: clienteData.direccion
      };

      const updatesVenta = { cliente: updatedCliente };
      let oldLaptopId = item.laptopId;

      // Logica de cambio de laptop
      if (laptopEdit.cambiar && laptopEdit.selectedLaptopId && laptopEdit.selectedLaptopId !== oldLaptopId) {
         const newLaptopId = laptopEdit.selectedLaptopId;
         const nuevaLaptopDoc = laptopsDisponibles.find(l => l.id === newLaptopId);
         
         if (nuevaLaptopDoc) {
             // 1. Recalcular ganancia
             const nuevoCostoTotal = nuevaLaptopDoc.costo_total || 0;
             const nuevaGanancia = (item.precio_venta_usd || 0) - nuevoCostoTotal;
             
             updatesVenta.laptopId = newLaptopId;
             updatesVenta.modelo = nuevaLaptopDoc.modelo || '';
             updatesVenta.marca = nuevaLaptopDoc.marca || '';
             updatesVenta.costo_total = nuevoCostoTotal;
             updatesVenta.ganancia = nuevaGanancia;
             
             // 2. Rollback Laptop Vieja
             if (oldLaptopId) {
                try {
                  await updateDoc(doc(db, 'laptops', oldLaptopId), {
                    disponibilidad: 'Disponible',
                    cliente_venta: deleteField(),
                    metodos_pago: deleteField(),
                    precio_final_venta: deleteField(),
                    tasa_venta: deleteField(),
                    fecha_venta: deleteField()
                  });
                } catch(e) { console.warn("Error rollback vieja laptop:", e); }
             }
             
             // 3. Update Laptop Nueva
             await updateDoc(doc(db, 'laptops', newLaptopId), {
                disponibilidad: 'No disponible',
                cliente_venta: updatedCliente,
                metodos_pago: item.metodos_pago || [],
                precio_final_venta: item.precio_venta_usd || 0,
                fecha_venta: item.fecha
             });
             
             // 4. Actualizar Historico de Ingresos
             if (oldLaptopId) {
                 const qHist = query(collection(db, 'historico_ingresos'), where('laptopId', '==', oldLaptopId));
                 const snapHist = await getDocs(qHist);
                 if (!snapHist.empty) {
                   const histDoc = snapHist.docs[0];
                   await updateDoc(doc(db, 'historico_ingresos', histDoc.id), {
                      laptopId: newLaptopId,
                      concepto: `Venta de ${nuevaLaptopDoc.marca || ''} ${nuevaLaptopDoc.modelo || ''}`,
                      ganancia: nuevaGanancia
                   });
                 }
             }
         }
      } else {
        // Solo actualizar el cliente en la laptop actual si existe
        if (oldLaptopId) {
          try {
            await updateDoc(doc(db, 'laptops', oldLaptopId), {
              cliente_venta: updatedCliente
            });
          } catch(e) { console.warn("Laptop actual ya no existe o error:", e); }
        }
      }

      // Actualizar registro principal en ventas
      await updateDoc(doc(db, 'ventas', item.id), updatesVenta);

      alert('Datos de venta actualizados correctamente.');
      setEditModal({ isOpen: false, item: null, processing: false });
      fetchData();
      fetchLaptopsDisponibles(); // refrescar por si hubo cambio de inventario
    } catch (error) {
      console.error("Error al actualizar venta:", error);
      alert('Error: ' + error.message);
      setEditModal(prev => ({ ...prev, processing: false }));
    }
  };

  const handlePrint = (item) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Permite las ventanas emergentes para imprimir.');

    const fechaFormat = item.fecha ? new Date(item.fecha.toDate()).toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' }) : '';
    const metodos = item.metodos_pago || [];
    
    // Variables guardadas o por defecto
    const noteNum = item.noteNumber || 'S/N';
    const desc = item.descripcion || `${item.marca || ''} ${item.modelo || ''}`;
    const obs = item.observaciones || '';
    const cant = item.unidades || 1;
    const garan = item.garantia || '3 meses';
    
    const isBs = (m) => ['Pago Móvil', 'Transferencia', 'Otro'].includes(m);
    const tasaNum = item.tasa_venta || 0;

    const formatMonto = (val) => Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 });

    const precioDisplay = item.precio_venta_usd || 0;
    const precioUnitDisplay = precioDisplay / cant;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recibo de Venta - ${item.cliente?.nombre}</title>
        <style>
          @page { size: letter; margin: 15mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #222; background: #fff; margin:0; }
          .container { max-width: 720px; margin: 0 auto; }
          .logo { text-align: center; margin-bottom: 24px; }
          .logo img { height: 55px; display: block; margin: 0 auto; }
          .title { text-align: center; font-size: 20px; font-weight: 700; color: #1a1a1a; border-bottom: 3px solid #5ce1e6; padding-bottom: 8px; margin-bottom: 20px; letter-spacing: 2px; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
          .client-table { width: 100%; font-size: 13px; margin-bottom: 20px; border-collapse: collapse; }
          .client-table td { padding: 5px 0; }
          .client-table td:first-child { color: #666; width: 120px; }
          .client-table td:last-child { font-weight: 600; }
          .prod-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 6px; }
          .prod-table th { padding: 8px 10px; text-align: left; color: #0ea5e9; font-weight: 700; font-size: 11px; text-transform: uppercase; background: #f0f9ff; border-bottom: 2px solid #5ce1e6; }
          .prod-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
          .desc-box { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 12px; line-height: 1.8; }
          .pay-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px; }
          .pay-table th { padding: 8px 10px; text-align: left; color: #0ea5e9; font-weight: 700; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #5ce1e6; }
          .pay-table td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; }
          .warranty { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px; font-size: 11px; line-height: 1.7; color: #15803d; }
          .footer { margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 12px; text-align: center; color: #aaa; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo"><img src="/logo-black.png" alt="Smartbits" crossorigin="anonymous" /></div>
          <h1 class="title">NOTA DE ENTREGA</h1>
          <div class="meta">
            <div><span style="color:#666">Fecha:</span> <strong>${fechaFormat}</strong></div>
            <div>
              <span style="color:#5ce1e6; font-weight:600">Nro:</span> 
              <span style="background:#f0f9ff; padding:2px 10px; border-radius:4px; font-weight:700; border:1px solid #bae6fd">${noteNum}</span>
            </div>
          </div>
          
          <table class="client-table">
            <tr><td>Cliente:</td><td>${item.cliente?.nombre || '—'}</td></tr>
            <tr><td>Doc. Cliente:</td><td>${item.cliente?.cedula || '—'}</td></tr>
            <tr><td>Dirección:</td><td>${item.cliente?.direccion || '—'}</td></tr>
            <tr><td>Nro Teléfono:</td><td>${item.cliente?.telefono || '—'}</td></tr>
          </table>

          <table class="prod-table">
            <thead>
              <tr>
                <th>Cantidad</th>
                <th>Concepto/Referencia</th>
                <th style="text-align:right">Precio</th>
                <th style="text-align:right">Sub-Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${cant}</td>
                <td style="font-weight:600">${item.modelo}</td>
                <td style="text-align:right">$ ${formatMonto(precioUnitDisplay)}</td>
                <td style="text-align:right; font-weight:700">$ ${formatMonto(precioDisplay)}</td>
              </tr>
            </tbody>
          </table>

          <div class="desc-box">
            <span style="color:#0ea5e9; font-weight:700; font-size:11px; text-transform:uppercase">Descripción:</span>
            <div style="margin-top:4px; color:#444; white-space:pre-wrap">${desc}</div>
          </div>
          
          ${obs ? `
          <div style="margin-top:16px">
            <span style="color:#0ea5e9; font-weight:700; font-size:11px; text-transform:uppercase">Observaciones:</span>
            <div style="margin-top:4px; color:#444; white-space:pre-wrap; font-size:11px">${obs}</div>
          </div>` : ''}

          <table class="pay-table">
            <thead>
              <tr>
                <th>Método de Pago</th>
                <th style="text-align:right">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${metodos.filter(m => (Number(m.monto) || 0) > 0).map(m => {
  const montoUSD = isBs(m.metodo) && tasaNum > 0 ? Number(m.monto) / tasaNum : Number(m.monto) || 0;
  const montoStr = isBs(m.metodo) 
    ? `Bs ${formatMonto(m.monto)} (≈ $${formatMonto(montoUSD)})` 
    : `$ ${formatMonto(m.monto)}`;
  return `<tr><td>${m.metodo}</td><td style="text-align:right">${montoStr}</td></tr>`;
}).join('')}
              <tr style="border-top: 2px solid #222;">
                <td style="font-weight:800; font-size:14px">Total:</td>
                <td style="text-align:right; font-weight:800; font-size:14px">$ ${formatMonto(precioDisplay)}</td>
              </tr>
            </tbody>
          </table>

          <div class="warranty">
            <div style="font-weight:700; font-size:13px; margin-bottom:6px; color:#166534">
              Garantía: ${garan}. <span style="font-weight:400; font-style:italic">*Ciertas condiciones aplican</span>
            </div>
            <p style="margin:0">*El equipo se probó al momento de la entrega, disco duro, temperaturas, caracteristicas, bateria, pantalla, teclado, touchpad, cargador, puertos usb, speakers, microfono, wifi, bluetooth, webcam, bisagras, carcasa, sistema operativo, etc. La garantía cubre desperfectos que no se hayan probado y se somete una inspección previa para valer la garantía.</p>
            <p style="margin:4px 0 0 0">*El sello de garantía tanto de cargador como laptop debe estar intacto, golpes no existentes en el momento de la entrega así como marcas de humedad invalidan la garantía.</p>
          </div>

          <div class="footer">Compra inteligente, compra en Smartbits.</div>
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            placeholder="Buscar por cliente, modelo o nota..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando registros de ventas...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No se encontraron ventas registradas</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Nro. Nota</th>
                  <th className="px-6 py-4">Equipo</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4 text-right">Total ($)</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {item.fecha ? new Date(item.fecha.toDate()).toLocaleDateString() : ''}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">
                      {item.noteNumber || 'S/N'}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {item.marca} {item.modelo}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{item.cliente?.nombre || 'Sin nombre'}</div>
                      <div className="text-xs text-slate-500">{item.cliente?.telefono}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-blue-600">
                      ${item.precio_venta_usd?.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handlePrint(item)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Imprimir Copia Original"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openEditModal(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar Datos o Laptop"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE EDICIÓN (CLIENTE + LAPTOP) */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !editModal.processing && setEditModal({ isOpen: false, item: null, processing: false })} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all w-full max-w-md p-6">
              
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Editar Venta</h3>
                </div>
                {!editModal.processing && (
                  <button onClick={() => setEditModal({ isOpen: false, item: null, processing: false })} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {/* FORMULARIO CLIENTE */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Cliente</label>
                  <input
                    type="text" value={clienteData.nombre} 
                    onChange={(e) => setClienteData(p => ({ ...p, nombre: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cédula/RIF</label>
                  <div className="flex gap-2">
                    <select
                      value={clienteData.tipoDoc}
                      onChange={(e) => setClienteData(p => ({ ...p, tipoDoc: e.target.value }))}
                      className="px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="V-">V-</option>
                      <option value="J-">J-</option>
                      <option value="E-">E-</option>
                    </select>
                    <input
                      type="text" value={clienteData.cedula}
                      onChange={(e) => {
                        const numbers = e.target.value.replace(/\D/g, '');
                        const formatted = numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                        setClienteData(p => ({ ...p, cedula: formatted }));
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                  <div className="flex gap-2">
                    <select
                      value={clienteData.prefijoTlf}
                      onChange={(e) => setClienteData(p => ({ ...p, prefijoTlf: e.target.value, telefono: '' }))}
                      className="px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="0414-">0414</option>
                      <option value="0424-">0424</option>
                      <option value="0412-">0412</option>
                      <option value="0416-">0416</option>
                      <option value="0426-">0426</option>
                      <option value="">Manual</option>
                    </select>
                    <input
                      type="text" value={clienteData.telefono}
                      onChange={(e) => {
                        const val = clienteData.prefijoTlf === '' ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 7);
                        setClienteData(p => ({ ...p, telefono: val }));
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                  <input
                    type="text" value={clienteData.direccion} 
                    onChange={(e) => setClienteData(p => ({ ...p, direccion: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                {/* SECCIÓN DE CAMBIO DE LAPTOP */}
                {editModal.item?.laptopId && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2 cursor-pointer select-none hover:text-blue-600 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={laptopEdit.cambiar} 
                        onChange={e => setLaptopEdit(p => ({ ...p, cambiar: e.target.checked }))} 
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      ¿Equivocación en el equipo? Cambiar Laptop vendida
                    </label>
                    
                    {laptopEdit.cambiar && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 mt-2">
                        <p className="text-xs text-blue-700 mb-2 flex items-center gap-1">
                          <Laptop className="w-3 h-3" />
                          Selecciona la laptop correcta (catálogo de disponibles):
                        </p>
                        <select 
                          value={laptopEdit.selectedLaptopId} 
                          onChange={e => setLaptopEdit(p => ({ ...p, selectedLaptopId: e.target.value }))} 
                          className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          <option value="">-- Seleccionar --</option>
                          {laptopsDisponibles.map(l => (
                            <option key={l.id} value={l.id}>
                              {l.marca} {l.modelo} (Costo: ${l.costo_total})
                            </option>
                          ))}
                        </select>
                        {laptopEdit.selectedLaptopId && (
                           <p className="text-[11px] text-blue-600 mt-2 opacity-80 leading-tight">
                             Al guardar, la laptop antigua volverá a estar "Disponible" y esta nueva pasará a estado "Vendido", recalculando la ganancia automáticamente en el historial.
                           </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  disabled={editModal.processing}
                  onClick={() => setEditModal({ isOpen: false, item: null, processing: false })}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={editModal.processing}
                  onClick={handleSaveEdit}
                  className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {editModal.processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar Cambios
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
