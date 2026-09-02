import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, deleteDoc, increment, deleteField } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useCorteContable } from '../../../utils/useCorteContable';
import { useCuentasCaja } from '../../../utils/useCuentasCaja';
import { 
  Search, Download, Edit2, Trash2, Printer, X, Save, AlertTriangle, 
  Loader2, Plus, CreditCard, User, Laptop, RefreshCw, FileText
} from 'lucide-react';

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

export default function VentasNotas() {
  const { corte, loading: loadingCorte } = useCorteContable();
  const { todasCuentas } = useCuentasCaja();

  const [ventas, setVentas] = useState([]);
  const [laptopsDisponibles, setLaptopsDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  // Modales
  const [deleteModal, setDeleteModal] = useState({ open: false, item: null, processing: false });
  const [editClienteModal, setEditClienteModal] = useState({ open: false, item: null, processing: false });
  const [editPagoModal, setEditPagoModal] = useState({ 
    open: false, item: null, metodosPago: [], processing: false 
  });

  // Datos formulario edición cliente
  const [clienteData, setClienteData] = useState({
    nombre: '', tipoDoc: 'V-', cedula: '', prefijoTlf: '0414-', telefono: '', direccion: ''
  });
  const [laptopEdit, setLaptopEdit] = useState({ cambiar: false, selectedLaptopId: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      let qVentas;
      if (corte?.fecha_corte) {
        const fechaCorte = corte.fecha_corte_js || corte.fecha_corte.toDate();
        qVentas = query(collection(db, 'ventas'), where('fecha', '>=', fechaCorte), orderBy('fecha', 'desc'));
      } else {
        qVentas = query(collection(db, 'ventas'), orderBy('fecha', 'desc'));
      }

      const snap = await getDocs(qVentas);
      setVentas(snap.docs.map(d => ({ id: d.id, ...d.data() })));

      const qLaptops = query(collection(db, 'laptops'), where('disponibilidad', '==', 'Disponible'));
      const snapL = await getDocs(qLaptops);
      setLaptopsDisponibles(snapL.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error al cargar ventas:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [corte]);

  // Exportar CSV
  const exportCSV = () => {
    const headers = ['Fecha', 'Nota', 'Cliente', 'Cedula', 'Telefono', 'Equipo', 'Venta USD', 'Ganancia USD'];
    const rows = filtered.map(v => [
      v.fecha ? new Date(v.fecha.toDate()).toLocaleDateString() : '',
      `"${v.noteNumber || 'S/N'}"`,
      `"${v.cliente?.nombre || ''}"`,
      `"${v.cliente?.cedula || ''}"`,
      `"${v.cliente?.telefono || ''}"`,
      `"${v.marca || ''} ${v.modelo || ''}"`,
      v.precio_venta_usd || 0,
      v.ganancia || 0
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ventas_smartbits_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtrar
  const filtered = ventas.filter(v => {
    const q = filter.toLowerCase();
    return (
      (v.cliente?.nombre || '').toLowerCase().includes(q) ||
      (v.modelo || '').toLowerCase().includes(q) ||
      (v.marca || '').toLowerCase().includes(q) ||
      (v.cliente?.cedula || '').toLowerCase().includes(q) ||
      (v.noteNumber || '').toLowerCase().includes(q)
    );
  });

  // --- ABRIR MODAL EDICIÓN CLIENTE / LAPTOP ---
  const openEditCliente = (item) => {
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
    setEditClienteModal({ open: true, item, processing: false });
  };

  const handleSaveCliente = async () => {
    const { item } = editClienteModal;
    setEditClienteModal(p => ({ ...p, processing: true }));

    try {
      const updatedCliente = {
        nombre: clienteData.nombre.toUpperCase(),
        cedula: clienteData.cedula ? `${clienteData.tipoDoc}${clienteData.cedula}` : '',
        telefono: clienteData.telefono ? `${clienteData.prefijoTlf}${clienteData.telefono}` : '',
        direccion: clienteData.direccion
      };

      const updatesVenta = { cliente: updatedCliente };
      let oldLaptopId = item.laptopId;

      if (laptopEdit.cambiar && laptopEdit.selectedLaptopId && laptopEdit.selectedLaptopId !== oldLaptopId) {
        const newLaptopId = laptopEdit.selectedLaptopId;
        const nuevaLaptopDoc = laptopsDisponibles.find(l => l.id === newLaptopId);

        if (nuevaLaptopDoc) {
          const nuevoCostoTotal = nuevaLaptopDoc.costo_total || 0;
          const nuevaGanancia = (item.precio_venta_usd || 0) - nuevoCostoTotal;

          updatesVenta.laptopId = newLaptopId;
          updatesVenta.modelo = nuevaLaptopDoc.modelo || '';
          updatesVenta.marca = nuevaLaptopDoc.marca || '';
          updatesVenta.costo_total = nuevoCostoTotal;
          updatesVenta.ganancia = nuevaGanancia;

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
            } catch (e) { console.warn(e); }
          }

          await updateDoc(doc(db, 'laptops', newLaptopId), {
            disponibilidad: 'No disponible',
            cliente_venta: updatedCliente,
            metodos_pago: item.metodos_pago || [],
            precio_final_venta: item.precio_venta_usd || 0,
            fecha_venta: item.fecha
          });
        }
      } else if (oldLaptopId) {
        try {
          await updateDoc(doc(db, 'laptops', oldLaptopId), {
            cliente_venta: updatedCliente
          });
        } catch (e) { console.warn(e); }
      }

      await updateDoc(doc(db, 'ventas', item.id), updatesVenta);
      setEditClienteModal({ open: false, item: null, processing: false });
      alert("Venta actualizada correctamente.");
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
      setEditClienteModal(p => ({ ...p, processing: false }));
    }
  };

  // --- ABRIR MODAL EDICIÓN PAGOS ---
  const openEditPagos = (item) => {
    const metodos = JSON.parse(JSON.stringify(item.metodos_pago || []));
    if (metodos.length === 0) {
      metodos.push({ metodo: 'Zelle', montoUSD: item.precio_venta_usd || 0 });
    }
    setEditPagoModal({ open: true, item, metodosPago: metodos, processing: false });
  };

  const handleSavePagos = async () => {
    const { item, metodosPago } = editPagoModal;
    setEditPagoModal(p => ({ ...p, processing: true }));

    try {
      const cajaNetos = {};
      let nuevoTotalVentaUSD = 0;

      // 1. Revertir pagos anteriores
      const oldMetodos = item.metodos_pago || [];
      for (const pago of oldMetodos) {
        const cuenta = pago.cuentaKey || METODO_TO_CAJA_KEY[pago.metodo] || 'efectivo';
        if (cuenta) {
          const cuentaObj = todasCuentas.find(c => c.key === cuenta);
          const esBs = cuentaObj ? cuentaObj.moneda === 'BS' : (pago.metodo === 'Pago Móvil' || pago.metodo === 'Transferencia');
          const montoVal = esBs ? (Number(pago.monto) || 0) : (Number(pago.montoUSD) || 0);
          if (montoVal > 0) {
            cajaNetos[cuenta] = (cajaNetos[cuenta] || 0) - montoVal;
          }
        }
      }

      // 2. Aplicar nuevos pagos
      metodosPago.forEach(p => {
        const mUSD = parseFloat(p.montoUSD) || 0;
        nuevoTotalVentaUSD += mUSD;
        const cuenta = p.cuentaKey || METODO_TO_CAJA_KEY[p.metodo] || 'efectivo';
        if (cuenta) {
          const cuentaObj = todasCuentas.find(c => c.key === cuenta);
          const esBs = cuentaObj ? cuentaObj.moneda === 'BS' : (p.metodo === 'Pago Móvil' || p.metodo === 'Transferencia');
          const montoVal = esBs ? (Number(p.monto) || 0) : mUSD;
          if (montoVal > 0) {
            cajaNetos[cuenta] = (cajaNetos[cuenta] || 0) + montoVal;
          }
        }
      });

      // 3. Actualizar caja
      const cajaUpdates = { updated_at: new Date() };
      for (const [cuenta, neto] of Object.entries(cajaNetos)) {
        if (neto !== 0) {
          cajaUpdates[cuenta] = increment(neto);
        }
      }
      await updateDoc(doc(db, 'caja', 'saldos'), cajaUpdates);

      // 4. Actualizar venta
      const costoTotal = item.costo_total || 0;
      const nuevaGanancia = nuevoTotalVentaUSD - costoTotal;

      await updateDoc(doc(db, 'ventas', item.id), {
        metodos_pago: metodosPago,
        precio_venta_usd: nuevoTotalVentaUSD,
        ganancia: nuevaGanancia
      });

      if (item.laptopId) {
        await updateDoc(doc(db, 'laptops', item.laptopId), {
          metodos_pago: metodosPago,
          precio_final_venta: nuevoTotalVentaUSD
        });
      }

      setEditPagoModal({ open: false, item: null, metodosPago: [], processing: false });
      alert("Métodos de pago actualizados y caja cuadrada.");
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
      setEditPagoModal(p => ({ ...p, processing: false }));
    }
  };

  // --- BORRAR VENTA ---
  const handleConfirmDelete = async () => {
    const { item } = deleteModal;
    if (!item) return;
    setDeleteModal(p => ({ ...p, processing: true }));

    try {
      const cajaUpdates = { updated_at: new Date() };
      const metodos = item.metodos_pago || [];

      for (const pago of metodos) {
        const cuenta = pago.cuentaKey || METODO_TO_CAJA_KEY[pago.metodo] || 'efectivo';
        if (cuenta) {
          const cuentaObj = todasCuentas.find(c => c.key === cuenta);
          const esBs = cuentaObj ? cuentaObj.moneda === 'BS' : (pago.metodo === 'Pago Móvil' || pago.metodo === 'Transferencia');
          const montoVal = esBs ? (Number(pago.monto) || 0) : (Number(pago.montoUSD) || 0);
          if (montoVal > 0) {
            cajaUpdates[cuenta] = increment(-montoVal);
          }
        }
      }

      await updateDoc(doc(db, 'caja', 'saldos'), cajaUpdates);

      if (item.laptopId) {
        try {
          await updateDoc(doc(db, 'laptops', item.laptopId), {
            disponibilidad: 'Disponible',
            cliente_venta: deleteField(),
            metodos_pago: deleteField(),
            precio_final_venta: deleteField(),
            tasa_venta: deleteField(),
            fecha_venta: deleteField()
          });
        } catch (e) { console.warn(e); }
      }

      await deleteDoc(doc(db, 'ventas', item.id));
      setDeleteModal({ open: false, item: null, processing: false });
      alert("Venta eliminada y laptop liberada.");
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
      setDeleteModal(p => ({ ...p, processing: false }));
    }
  };

  // --- IMPRIMIR RECIBO / NOTA ---
  const handlePrint = (item) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Permite las ventanas emergentes para imprimir.');

    const fechaFormat = item.fecha ? new Date(item.fecha.toDate()).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
    const metodos = item.metodos_pago || [];
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
        <title>Nota de Entrega - ${item.cliente?.nombre}</title>
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
              ${metodos.filter(m => (Number(m.monto || m.montoUSD) || 0) > 0).map(m => {
                const montoVal = Number(m.montoUSD || m.monto || 0);
                const montoStr = isBs(m.metodo) && tasaNum > 0
                  ? `Bs ${formatMonto(montoVal * tasaNum)} (≈ $${formatMonto(montoVal)})`
                  : `$ ${formatMonto(montoVal)}`;
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
            <p style="margin:0">*El equipo se probó al momento de la entrega, disco duro, temperaturas, características, batería, pantalla, teclado, touchpad, cargador, puertos USB, speakers, micrófono, Wi-Fi, Bluetooth, webcam, bisagras, carcasa, sistema operativo, etc. La garantía cubre desperfectos que no se hayan probado y se somete a una inspección previa para valer la garantía.</p>
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
      
      {/* HEADER & BARRA DE ACCIÓN */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, nota, modelo..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors w-full sm:w-auto justify-center"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* TABLA UNIFICADA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Cargando ventas y notas...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No se encontraron registros de ventas posteriores al corte contable.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-4">Fecha</th>
                  <th className="px-5 py-4">Nro. Nota</th>
                  <th className="px-5 py-4">Equipo</th>
                  <th className="px-5 py-4">Cliente</th>
                  <th className="px-5 py-4 text-right">Venta (USD)</th>
                  <th className="px-5 py-4 text-right">Ganancia (USD)</th>
                  <th className="px-5 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                      {item.fecha ? new Date(item.fecha.toDate()).toLocaleDateString() : 'Pendiente'}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-800 text-xs">
                      {item.noteNumber || 'S/N'}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {item.marca} {item.modelo}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-800 text-xs">{item.cliente?.nombre || 'Sin nombre'}</div>
                      <div className="text-[11px] text-slate-400">{item.cliente?.telefono || item.cliente?.cedula}</div>
                    </td>
                    <td className="px-5 py-4 text-right font-black text-slate-900">
                      ${Number(item.precio_venta_usd || 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-emerald-600">
                      {item.ganancia != null ? `+$${Number(item.ganancia).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handlePrint(item)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Imprimir Nota de Entrega"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditCliente(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar Datos de Cliente / Laptop"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditPagos(item)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Editar Métodos de Pago"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ open: true, item, processing: false })}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Borrar Venta"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* MODAL: EDITAR CLIENTE / LAPTOP */}
      {editClienteModal.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Editar Datos de la Venta
              </h3>
              <button onClick={() => setEditClienteModal({ open: false, item: null, processing: false })} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre del Cliente</label>
                <input
                  type="text"
                  value={clienteData.nombre}
                  onChange={e => setClienteData(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cédula / RIF</label>
                <div className="flex gap-2">
                  <select
                    value={clienteData.tipoDoc}
                    onChange={e => setClienteData(p => ({ ...p, tipoDoc: e.target.value }))}
                    className="px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="V-">V-</option>
                    <option value="J-">J-</option>
                    <option value="E-">E-</option>
                  </select>
                  <input
                    type="text"
                    value={clienteData.cedula}
                    onChange={e => setClienteData(p => ({ ...p, cedula: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={clienteData.telefono}
                  onChange={e => setClienteData(p => ({ ...p, telefono: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Dirección</label>
                <input
                  type="text"
                  value={clienteData.direccion}
                  onChange={e => setClienteData(p => ({ ...p, direccion: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              {/* SECCIÓN CAMBIAR LAPTOP */}
              <div className="pt-3 border-t border-slate-100">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={laptopEdit.cambiar}
                    onChange={e => setLaptopEdit(p => ({ ...p, cambiar: e.target.checked }))}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  ¿Cambiar equipo vendido por equivocación?
                </label>

                {laptopEdit.cambiar && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                    <p className="text-[11px] text-blue-700 font-medium">Selecciona el equipo correcto de inventario disponible:</p>
                    <select
                      value={laptopEdit.selectedLaptopId}
                      onChange={e => setLaptopEdit(p => ({ ...p, selectedLaptopId: e.target.value }))}
                      className="w-full px-2.5 py-2 border border-blue-200 rounded-lg text-xs bg-white"
                    >
                      <option value="">-- Seleccionar --</option>
                      {laptopsDisponibles.map(l => (
                        <option key={l.id} value={l.id}>{l.marca} {l.modelo} (Costo: ${l.costo_total})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditClienteModal({ open: false, item: null, processing: false })}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={editClienteModal.processing}
                onClick={handleSaveCliente}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
              >
                {editClienteModal.processing ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR MÉTODOS DE PAGO */}
      {editPagoModal.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                Editar Métodos de Pago
              </h3>
              <button onClick={() => setEditPagoModal({ open: false, item: null, metodosPago: [], processing: false })} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {editPagoModal.metodosPago.map((pago, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <select
                    value={pago.metodo}
                    onChange={e => {
                      const list = [...editPagoModal.metodosPago];
                      list[index].metodo = e.target.value;
                      setEditPagoModal(p => ({ ...p, metodosPago: list }));
                    }}
                    className="flex-1 px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="Zelle">Zelle</option>
                    <option value="USDT">USDT / Binance</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Pago Móvil">Pago Móvil</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Zinli">Zinli</option>
                    <option value="PayPal">PayPal</option>
                  </select>

                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={pago.montoUSD}
                      onChange={e => {
                        const list = [...editPagoModal.metodosPago];
                        list[index].montoUSD = e.target.value;
                        setEditPagoModal(p => ({ ...p, metodosPago: list }));
                      }}
                      className="w-full pl-6 pr-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                      placeholder="0.00"
                    />
                  </div>

                  {editPagoModal.metodosPago.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const list = editPagoModal.metodosPago.filter((_, i) => i !== index);
                        setEditPagoModal(p => ({ ...p, metodosPago: list }));
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  setEditPagoModal(p => ({
                    ...p,
                    metodosPago: [...p.metodosPago, { metodo: 'Efectivo', montoUSD: 0 }]
                  }));
                }}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 pt-1"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar otro método
              </button>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-sm font-bold text-slate-800">
                <span>Nuevo Total:</span>
                <span>
                  ${editPagoModal.metodosPago.reduce((acc, p) => acc + (Number(p.montoUSD) || 0), 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditPagoModal({ open: false, item: null, metodosPago: [], processing: false })}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={editPagoModal.processing}
                onClick={handleSavePagos}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
              >
                {editPagoModal.processing ? 'Guardando...' : 'Re-calcular y Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BORRAR VENTA */}
      {deleteModal.open && deleteModal.item && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-center text-slate-900">¿Borrar esta venta?</h3>
            <p className="text-xs text-center text-slate-500">
              Esta acción descontará automáticamente el monto ingresado de la caja y pondrá el equipo nuevamente en estado "Disponible".
            </p>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <p><span className="font-bold text-slate-700">Equipo:</span> {deleteModal.item.marca} {deleteModal.item.modelo}</p>
              <p><span className="font-bold text-slate-700">Monto:</span> ${Number(deleteModal.item.precio_venta_usd).toFixed(2)}</p>
              <p><span className="font-bold text-slate-700">Cliente:</span> {deleteModal.item.cliente?.nombre}</p>
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
                {deleteModal.processing ? 'Borrando...' : 'Sí, confirmar borrado'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
