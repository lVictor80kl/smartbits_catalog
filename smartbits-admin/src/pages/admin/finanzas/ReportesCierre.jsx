import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { BarChart2, TrendingUp, TrendingDown, DollarSign, FileText, Loader2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Calendar, X } from 'lucide-react';

const MES_LABELS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function ReportesCierre() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed

  const [loading, setLoading] = useState(false);
  const [metricas, setMetricas] = useState(null);
  const [cierresHistorial, setCierresHistorial] = useState([]);
  const [loadingCierres, setLoadingCierres] = useState(true);

  // Modal cierre mes
  const [modalCierre, setModalCierre] = useState({ open: false, step: 1, processing: false });

  // Cargar historial de cierres
  useEffect(() => {
    const fetchCierres = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'cierres_mensuales'), orderBy('fecha_cierre', 'desc')));
        setCierresHistorial(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
      setLoadingCierres(false);
    };
    fetchCierres();
  }, []);

  const calcularMetricas = async () => {
    setLoading(true);
    setMetricas(null);
    try {
      const inicio = new Date(selectedYear, selectedMonth, 1);
      const fin = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      // 1. Ventas (historico_ingresos del mes)
      const qIngresos = query(
        collection(db, 'historico_ingresos'),
        where('fecha', '>=', inicio),
        where('fecha', '<=', fin)
      );
      const snapIngresos = await getDocs(qIngresos);
      const ingresos = snapIngresos.docs.map(d => ({ id: d.id, ...d.data() }));
      const ventasTotales = ingresos.reduce((acc, i) => acc + (Number(i.monto) || 0), 0);

      // 2. COGS (costo de equipos vendidos en el mes)
      const qVentas = query(
        collection(db, 'ventas'),
        where('fecha', '>=', inicio),
        where('fecha', '<=', fin)
      );
      const snapVentas = await getDocs(qVentas);
      const ventas = snapVentas.docs.map(d => d.data());
      const cogs = ventas.reduce((acc, v) => acc + (Number(v.costo_total) || 0), 0);

      // 3. Gastos Operativos del mes
      const qGastosOp = query(
        collection(db, 'gastos_operativos'),
        where('fecha', '>=', inicio),
        where('fecha', '<=', fin)
      );
      const snapGastosOp = await getDocs(qGastosOp);
      const gastosOp = snapGastosOp.docs.reduce((acc, d) => acc + (Number(d.data().monto) || 0), 0);

      // 4. Retiros personales del mes
      const qRetiros = query(
        collection(db, 'gastos_personales'),
        where('fecha', '>=', inicio),
        where('fecha', '<=', fin)
      );
      const snapRetiros = await getDocs(qRetiros);
      const retiros = snapRetiros.docs.map(d => d.data());
      const retirosYsmael = retiros.filter(r => r.socio === 'ysmael').reduce((a,b) => a + (Number(b.monto)||0), 0);
      const retirosVictor = retiros.filter(r => r.socio === 'victor').reduce((a,b) => a + (Number(b.monto)||0), 0);
      const retirosTotal = retirosYsmael + retirosVictor;

      // 5. Calculo de ganancias
      const gananciaBruta = ventasTotales - cogs;
      const gananciaNeta = gananciaBruta - gastosOp;
      const gananciaNetaPorSocio = gananciaNeta / 2;

      setMetricas({
        mes: `${MES_LABELS[selectedMonth]} ${selectedYear}`,
        ventasTotales, cogs, gananciaBruta, gastosOp, gananciaNeta,
        gananciaNetaPorSocio,
        retirosYsmael, retirosVictor, retirosTotal,
        cantidadVentas: ventas.length,
        detalleIngresos: ingresos.slice(0, 5),
      });
    } catch (e) {
      console.error(e);
      alert('Error al calcular: ' + e.message);
    }
    setLoading(false);
  };

  const handlePrint = () => {
    if (!metricas) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Permite las ventanas emergentes para imprimir.');
    const fmt = (v) => `$${Number(v||0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Estado de Cuenta Smartbits - ${metricas.mes}</title>
        <style>
          @page { size: letter; margin: 15mm; }
          body { font-family: 'Segoe UI', sans-serif; color: #1a1a1a; padding: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: 900; color: #0ea5e9; letter-spacing: -1px; }
          .subtitle { color: #6b7280; font-size: 13px; margin-top: 4px; }
          h2 { font-size: 18px; color: #1e293b; border-bottom: 2px solid #5ce1e6; padding-bottom: 6px; margin: 24px 0 12px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
          .card .label { font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
          .card .value { font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 4px; }
          .card.green .value { color: #16a34a; }
          .card.red .value { color: #dc2626; }
          .card.blue .value { color: #2563eb; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-weight: 700; color: #475569; font-size: 11px; text-transform: uppercase; }
          td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
          .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">SMARTBITS</div>
          <div class="subtitle">Estado de Cuenta Mensual &mdash; ${metricas.mes}</div>
          <div class="subtitle">Generado: ${new Date().toLocaleDateString('es-VE', { day:'2-digit', month:'long', year:'numeric' })}</div>
        </div>
        <h2>Resumen Contable</h2>
        <div class="grid">
          <div class="card blue"><div class="label">Ventas Totales</div><div class="value">${fmt(metricas.ventasTotales)}</div></div>
          <div class="card red"><div class="label">Costo Mercancia (COGS)</div><div class="value">${fmt(metricas.cogs)}</div></div>
          <div class="card green"><div class="label">Ganancia Bruta</div><div class="value">${fmt(metricas.gananciaBruta)}</div></div>
          <div class="card red"><div class="label">Gastos Operativos</div><div class="value">${fmt(metricas.gastosOp)}</div></div>
        </div>
        <div class="card ${metricas.gananciaNeta >= 0 ? 'green' : 'red'}" style="margin-bottom:20px">
          <div class="label">Ganancia Neta del Mes</div>
          <div class="value">${fmt(metricas.gananciaNeta)}</div>
        </div>
        <h2>Distribucion por Socio</h2>
        <table>
          <tr><th>Concepto</th><th>Ysmael</th><th>Victor</th></tr>
          <tr><td>Participacion (50/50)</td><td>${fmt(metricas.gananciaNetaPorSocio)}</td><td>${fmt(metricas.gananciaNetaPorSocio)}</td></tr>
          <tr><td>Retiros del mes</td><td style="color:#dc2626">-${fmt(metricas.retirosYsmael)}</td><td style="color:#dc2626">-${fmt(metricas.retirosVictor)}</td></tr>
          <tr style="font-weight:bold;background:#f8fafc"><td>Capital Neto del mes</td><td>${fmt(metricas.gananciaNetaPorSocio - metricas.retirosYsmael)}</td><td>${fmt(metricas.gananciaNetaPorSocio - metricas.retirosVictor)}</td></tr>
        </table>
        <div class="footer">Smartbits &bull; Compra inteligente, compra en Smartbits.</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { setTimeout(() => { printWindow.print(); printWindow.close(); }, 300); };
  };

  const ejecutarCierreMes = async () => {
    if (!metricas) return;
    setModalCierre(p => ({ ...p, processing: true }));
    try {
      const configSnap = await getDoc(doc(db, 'finanzas', 'config'));
      const config = configSnap.exists() ? configSnap.data() : {};
      const capitalAcumYsmael = Number(config.capital_acum_ysmael) || 0;
      const capitalAcumVictor = Number(config.capital_acum_victor) || 0;

      const nuevoCapYsmael = capitalAcumYsmael + metricas.gananciaNetaPorSocio - metricas.retirosYsmael;
      const nuevoCapVictor = capitalAcumVictor + metricas.gananciaNetaPorSocio - metricas.retirosVictor;

      // 1. Guardar snapshot del cierre
      const periodoKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      await addDoc(collection(db, 'cierres_mensuales'), {
        periodo: periodoKey,
        mes_label: metricas.mes,
        ventas_totales: metricas.ventasTotales,
        cogs: metricas.cogs,
        ganancia_bruta: metricas.gananciaBruta,
        gastos_operativos: metricas.gastosOp,
        ganancia_neta: metricas.gananciaNeta,
        retiros_ysmael: metricas.retirosYsmael,
        retiros_victor: metricas.retirosVictor,
        capital_neto_ysmael: metricas.gananciaNetaPorSocio - metricas.retirosYsmael,
        capital_neto_victor: metricas.gananciaNetaPorSocio - metricas.retirosVictor,
        fecha_cierre: serverTimestamp()
      });

      // 2. Actualizar capital acumulado en config
      await updateDoc(doc(db, 'finanzas', 'config'), {
        capital_acum_ysmael: nuevoCapYsmael,
        capital_acum_victor: nuevoCapVictor,
        ultimo_cierre: periodoKey
      });

      // 3. Refrescar historial
      const snap = await getDocs(query(collection(db, 'cierres_mensuales'), orderBy('fecha_cierre', 'desc')));
      setCierresHistorial(snap.docs.map(d => ({ id: d.id, ...d.data() })));

      setModalCierre({ open: false, step: 1, processing: false });
      alert(`Cierre de ${metricas.mes} completado. Capital acumulado actualizado para ambos socios.`);
    } catch (e) {
      console.error(e);
      alert('Error al cerrar mes: ' + e.message);
      setModalCierre(p => ({ ...p, processing: false }));
    }
  };

  const fmt = (v) => `$${Number(v||0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const MetricaCard = ({ label, value, color = 'default', subtitle = '' }) => {
    const colors = {
      green: 'bg-emerald-50 border-emerald-100 text-emerald-800',
      red: 'bg-red-50 border-red-100 text-red-800',
      blue: 'bg-blue-50 border-blue-100 text-blue-800',
      default: 'bg-white border-gray-200 text-slate-800',
    };
    const valueColors = {
      green: 'text-emerald-700',
      red: 'text-red-700',
      blue: 'text-blue-700',
      default: 'text-slate-900',
    };
    return (
      <div className={`rounded-2xl border p-5 shadow-sm ${colors[color]}`}>
        <p className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1">{label}</p>
        <p className={`text-2xl font-black ${valueColors[color]}`}>{value}</p>
        {subtitle && <p className="text-xs opacity-50 mt-1">{subtitle}</p>}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-brand-600" />
            Reporte Mensual
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Selecciona el periodo y genera el resumen contable</p>
        </div>
      </div>

      {/* Selector de periodo + Boton calcular */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-400" />
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
          >
            {MES_LABELS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button
          onClick={calcularMetricas}
          disabled={loading}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60 ml-auto"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
          {loading ? 'Calculando...' : 'Generar Reporte'}
        </button>
      </div>

      {/* Metricas del mes */}
      {metricas && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-700">{metricas.mes}</h3>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" /> Exportar PDF
              </button>
              <button
                onClick={() => setModalCierre({ open: true, step: 1, processing: false })}
                className="flex items-center gap-1.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4" /> Cerrar Mes
              </button>
            </div>
          </div>

          {/* KPIs principales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricaCard label="Ventas Totales" value={fmt(metricas.ventasTotales)} color="blue" subtitle={`${metricas.cantidadVentas} ventas`} />
            <MetricaCard label="COGS" value={fmt(metricas.cogs)} color="red" subtitle="Costo mercancia vendida" />
            <MetricaCard label="Ganancia Bruta" value={fmt(metricas.gananciaBruta)} color={metricas.gananciaBruta >= 0 ? 'green' : 'red'} />
            <MetricaCard label="Gastos Operativos" value={fmt(metricas.gastosOp)} color="red" />
          </div>

          {/* Ganancia Neta (destacada) */}
          <div className={`rounded-2xl p-6 shadow-sm border-2 ${metricas.gananciaNeta >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Ganancia Neta del Mes</p>
                <h2 className={`text-4xl font-black mt-1 ${metricas.gananciaNeta >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                  {fmt(metricas.gananciaNeta)}
                </h2>
              </div>
              {metricas.gananciaNeta >= 0
                ? <TrendingUp className="w-16 h-16 text-emerald-200" />
                : <TrendingDown className="w-16 h-16 text-red-200" />}
            </div>
          </div>

          {/* Distribucion por socio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { nombre: 'Ysmael', retiros: metricas.retirosYsmael },
              { nombre: 'Victor', retiros: metricas.retirosVictor }
            ].map(socio => {
              const neto = metricas.gananciaNetaPorSocio - socio.retiros;
              return (
                <div key={socio.nombre} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <h4 className="text-lg font-black text-slate-800 mb-4">{socio.nombre}</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Participacion 50% (ganancia neta)</span>
                      <span className="font-bold text-emerald-700">{fmt(metricas.gananciaNetaPorSocio)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Retiros del mes</span>
                      <span className="font-bold text-red-600">-{fmt(socio.retiros)}</span>
                    </div>
                    <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-600">Aporte neto al capital</span>
                      <span className={`text-2xl font-black ${neto >= 0 ? 'text-brand-600' : 'text-red-600'}`}>{fmt(neto)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Historial de Cierres */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-600" /> Historial de Cierres Mensuales
          </h3>
        </div>
        {loadingCierres ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando historial...
          </div>
        ) : cierresHistorial.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay cierres registrados aun. Genera tu primer reporte y cierra el mes.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-4">Periodo</th>
                  <th className="px-5 py-4 text-right">Ventas</th>
                  <th className="px-5 py-4 text-right">COGS</th>
                  <th className="px-5 py-4 text-right">G. Operativos</th>
                  <th className="px-5 py-4 text-right">G. Neta</th>
                  <th className="px-5 py-4 text-right">Neto Ysmael</th>
                  <th className="px-5 py-4 text-right">Neto Victor</th>
                </tr>
              </thead>
              <tbody>
                {cierresHistorial.map(cierre => (
                  <tr key={cierre.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-4">
                      <span className="font-bold text-slate-800">{cierre.mes_label || cierre.periodo}</span>
                    </td>
                    <td className="px-5 py-4 text-right text-blue-600 font-medium">{fmt(cierre.ventas_totales)}</td>
                    <td className="px-5 py-4 text-right text-red-500">{fmt(cierre.cogs)}</td>
                    <td className="px-5 py-4 text-right text-orange-500">{fmt(cierre.gastos_operativos)}</td>
                    <td className={`px-5 py-4 text-right font-bold ${cierre.ganancia_neta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmt(cierre.ganancia_neta)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-brand-700">{fmt(cierre.capital_neto_ysmael)}</td>
                    <td className="px-5 py-4 text-right font-semibold text-brand-700">{fmt(cierre.capital_neto_victor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Cerrar Mes */}
      {modalCierre.open && metricas && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !modalCierre.processing && setModalCierre({ open: false, step: 1, processing: false })} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
              {!modalCierre.processing && (
                <button onClick={() => setModalCierre({ open: false, step: 1, processing: false })} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              )}

              {modalCierre.step === 1 && (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Cerrar Mes: {metricas.mes}</h3>
                      <p className="text-sm text-slate-500">Confirma el resumen antes de continuar</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    {[
                      { label: 'Ventas Totales', value: fmt(metricas.ventasTotales), color: 'text-blue-700' },
                      { label: 'COGS', value: `-${fmt(metricas.cogs)}`, color: 'text-red-600' },
                      { label: 'Gastos Operativos', value: `-${fmt(metricas.gastosOp)}`, color: 'text-red-600' },
                      { label: 'Ganancia Neta', value: fmt(metricas.gananciaNeta), color: metricas.gananciaNeta >= 0 ? 'text-emerald-700' : 'text-red-700' },
                      { label: 'Retiros Ysmael', value: `-${fmt(metricas.retirosYsmael)}`, color: 'text-slate-600' },
                      { label: 'Retiros Victor', value: `-${fmt(metricas.retirosVictor)}`, color: 'text-slate-600' },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50">
                        <span className="text-gray-600">{r.label}</span>
                        <span className={`font-bold ${r.color}`}>{r.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex gap-2 mb-6">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Esta accion guardara un snapshot de los datos actuales y actualizara el capital acumulado de ambos socios en la configuracion.
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setModalCierre({ open: false, step: 1, processing: false })} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">
                      Cancelar
                    </button>
                    <button onClick={() => setModalCierre(p => ({ ...p, step: 2 }))} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors">
                      Continuar
                    </button>
                  </div>
                </>
              )}

              {modalCierre.step === 2 && (
                <>
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                      <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Confirmacion Final</h3>
                    <p className="text-sm text-slate-500 mt-1">Esta es la confirmacion definitiva del cierre de <strong>{metricas.mes}</strong>.</p>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-2 text-sm">
                    <p className="font-bold text-slate-700">Se realizaran las siguientes acciones:</p>
                    <ul className="space-y-1 text-slate-600 list-disc list-inside">
                      <li>Guardar snapshot del periodo en historial de cierres</li>
                      <li>Actualizar capital acumulado de Ysmael y Victor</li>
                    </ul>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setModalCierre(p => ({ ...p, step: 1 }))} disabled={modalCierre.processing} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">
                      Volver
                    </button>
                    <button onClick={ejecutarCierreMes} disabled={modalCierre.processing} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                      {modalCierre.processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      {modalCierre.processing ? 'Procesando...' : 'Ejecutar Cierre'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
