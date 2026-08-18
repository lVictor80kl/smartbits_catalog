import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useCorteContable } from '../../../utils/useCorteContable';
import ConfiguracionCorte from './ConfiguracionCorte';
import { 
  BarChart2, TrendingUp, TrendingDown, DollarSign, FileText, Loader2, 
  AlertTriangle, CheckCircle, Calendar, X, Settings, ShieldCheck 
} from 'lucide-react';

const MES_LABELS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function ReportesCierre() {
  const now = new Date();
  const { corte, loading: loadingCorte } = useCorteContable();

  // Sub-tab activa: 'reporte' | 'configuracion_corte'
  const [subTab, setSubTab] = useState('reporte');

  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed

  const [loading, setLoading] = useState(false);
  const [metricas, setMetricas] = useState(null);
  const [cierresHistorial, setCierresHistorial] = useState([]);
  const [loadingCierres, setLoadingCierres] = useState(true);

  // Modal cierre mes
  const [modalCierre, setModalCierre] = useState({ open: false, step: 1, processing: false });

  // Cargar historial de cierres
  const fetchCierres = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'cierres_mensuales'), orderBy('fecha_cierre', 'desc')));
      setCierresHistorial(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setLoadingCierres(false);
  };

  useEffect(() => {
    fetchCierres();
  }, []);

  const calcularMetricas = async () => {
    setLoading(true);
    setMetricas(null);
    try {
      let inicio = new Date(selectedYear, selectedMonth, 1, 0, 0, 0);
      const fin = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      // Si existe corte y el mes consultado es igual o anterior al corte, respetar la fecha_corte
      if (corte?.fecha_corte) {
        const fechaCorte = corte.fecha_corte_js || corte.fecha_corte.toDate();
        if (fechaCorte > inicio && fechaCorte <= fin) {
          inicio = fechaCorte;
        } else if (fechaCorte > fin) {
          // El corte fue posterior a este mes y se eligió start limpio
          setMetricas({
            mes: `${MES_LABELS[selectedMonth]} ${selectedYear}`,
            ventasTotales: 0, cogs: 0, gananciaBruta: 0, gastosOp: 0, gananciaNeta: 0,
            gananciaNetaPorSocio: 0, retirosYsmael: 0, retirosVictor: 0, retirosTotal: 0,
            cantidadVentas: 0, preCorte: true
          });
          setLoading(false);
          return;
        }
      }

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

      // 5. Cálculo de ganancias
      const gananciaBruta = ventasTotales - cogs;
      const gananciaNeta = gananciaBruta - gastosOp;
      const gananciaNetaPorSocio = gananciaNeta / 2;

      setMetricas({
        mes: `${MES_LABELS[selectedMonth]} ${selectedYear}`,
        ventasTotales, cogs, gananciaBruta, gastosOp, gananciaNeta,
        gananciaNetaPorSocio,
        retirosYsmael, retirosVictor, retirosTotal,
        cantidadVentas: ventas.length,
        preCorte: false
      });
    } catch (e) {
      console.error(e);
      alert('Error al calcular reporte: ' + e.message);
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
          <div class="card red"><div class="label">Costo Mercancía (COGS)</div><div class="value">${fmt(metricas.cogs)}</div></div>
          <div class="card green"><div class="label">Ganancia Bruta</div><div class="value">${fmt(metricas.gananciaBruta)}</div></div>
          <div class="card red"><div class="label">Gastos Operativos</div><div class="value">${fmt(metricas.gastosOp)}</div></div>
        </div>
        <div class="card ${metricas.gananciaNeta >= 0 ? 'green' : 'red'}" style="margin-bottom:20px">
          <div class="label">Ganancia Neta del Mes</div>
          <div class="value">${fmt(metricas.gananciaNeta)}</div>
        </div>
        <h2>Distribución por Socio</h2>
        <table>
          <tr><th>Concepto</th><th>Ysmael</th><th>Víctor</th></tr>
          <tr><td>Participación (50/50)</td><td>${fmt(metricas.gananciaNetaPorSocio)}</td><td>${fmt(metricas.gananciaNetaPorSocio)}</td></tr>
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

      await updateDoc(doc(db, 'finanzas', 'config'), {
        capital_acum_ysmael: nuevoCapYsmael,
        capital_acum_victor: nuevoCapVictor,
        ultimo_cierre: periodoKey
      });

      fetchCierres();
      setModalCierre({ open: false, step: 1, processing: false });
      alert(`✅ Cierre de ${metricas.mes} completado exitosamente.`);
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
      default: 'bg-white border-slate-200 text-slate-800',
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

      {/* SUB-TABS: Reporte Mensual vs Configuración Punto Cero */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
        <button
          onClick={() => setSubTab('reporte')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
            subTab === 'reporte' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart2 className="w-4 h-4" /> Reporte Mensual & Cierres
        </button>
        <button
          onClick={() => setSubTab('configuracion_corte')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
            subTab === 'configuracion_corte' ? 'bg-brand-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Punto Cero (Corte Contable)
        </button>
      </div>

      {/* VISTA 1: CONFIGURACIÓN CORTE CONTABLE */}
      {subTab === 'configuracion_corte' && (
        <ConfiguracionCorte onCorteRealizado={() => setSubTab('reporte')} />
      )}

      {/* VISTA 2: REPORTE MENSUAL & CIERRES */}
      {subTab === 'reporte' && (
        <>
          {/* Selector de periodo */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-slate-400" />
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-brand-500 bg-white"
              >
                {MES_LABELS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-brand-500 bg-white"
              >
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button
              onClick={calcularMetricas}
              disabled={loading}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-60 ml-auto text-sm shadow"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
              {loading ? 'Calculando...' : 'Generar Reporte'}
            </button>
          </div>

          {/* Métricas generadas */}
          {metricas && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">{metricas.mes}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl transition-colors"
                  >
                    <FileText className="w-4 h-4" /> Exportar PDF
                  </button>
                  <button
                    onClick={() => setModalCierre({ open: true, step: 1, processing: false })}
                    className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors shadow"
                  >
                    <CheckCircle className="w-4 h-4" /> Cerrar Mes
                  </button>
                </div>
              </div>

              {metricas.preCorte ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center text-amber-800 text-sm">
                  Este periodo es anterior al corte contable inicial y se encuentra archivado.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricaCard label="Ventas Totales" value={fmt(metricas.ventasTotales)} color="blue" subtitle={`${metricas.cantidadVentas} ventas`} />
                    <MetricaCard label="COGS" value={fmt(metricas.cogs)} color="red" subtitle="Costo mercancía vendida" />
                    <MetricaCard label="Ganancia Bruta" value={fmt(metricas.gananciaBruta)} color={metricas.gananciaBruta >= 0 ? 'green' : 'red'} />
                    <MetricaCard label="Gastos Operativos" value={fmt(metricas.gastosOp)} color="red" />
                  </div>

                  <div className={`rounded-2xl p-6 shadow-sm border-2 ${metricas.gananciaNeta >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Ganancia Neta del Mes</p>
                        <h2 className={`text-4xl font-black mt-1 ${metricas.gananciaNeta >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                          {fmt(metricas.gananciaNeta)}
                        </h2>
                      </div>
                      {metricas.gananciaNeta >= 0
                        ? <TrendingUp className="w-16 h-16 text-emerald-200" />
                        : <TrendingDown className="w-16 h-16 text-red-200" />}
                    </div>
                  </div>

                  {/* Distribución por socio */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { nombre: 'Ysmael', retiros: metricas.retirosYsmael },
                      { nombre: 'Víctor', retiros: metricas.retirosVictor }
                    ].map(socio => {
                      const neto = metricas.gananciaNetaPorSocio - socio.retiros;
                      return (
                        <div key={socio.nombre} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                          <h4 className="text-lg font-black text-slate-800 mb-4">{socio.nombre}</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Participación 50% (ganancia neta)</span>
                              <span className="font-bold text-emerald-700">{fmt(metricas.gananciaNetaPorSocio)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Retiros propios del mes</span>
                              <span className="font-bold text-red-600">-{fmt(socio.retiros)}</span>
                            </div>
                            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                              <span className="text-sm font-bold text-slate-600">Aporte neto al capital</span>
                              <span className={`text-2xl font-black ${neto >= 0 ? 'text-brand-600' : 'text-red-600'}`}>{fmt(neto)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Historial de Cierres */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-600" /> Historial de Cierres Mensuales
              </h3>
            </div>
            {loadingCierres ? (
              <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando historial...
              </div>
            ) : cierresHistorial.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No hay cierres registrados aún.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-4">Periodo</th>
                      <th className="px-5 py-4 text-right">Ventas</th>
                      <th className="px-5 py-4 text-right">COGS</th>
                      <th className="px-5 py-4 text-right">G. Operativos</th>
                      <th className="px-5 py-4 text-right">G. Neta</th>
                      <th className="px-5 py-4 text-right">Neto Ysmael</th>
                      <th className="px-5 py-4 text-right">Neto Víctor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cierresHistorial.map(cierre => (
                      <tr key={cierre.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4 font-bold text-slate-800">{cierre.mes_label || cierre.periodo}</td>
                        <td className="px-5 py-4 text-right text-blue-600 font-semibold">{fmt(cierre.ventas_totales)}</td>
                        <td className="px-5 py-4 text-right text-red-500">{fmt(cierre.cogs)}</td>
                        <td className="px-5 py-4 text-right text-orange-500">{fmt(cierre.gastos_operativos)}</td>
                        <td className={`px-5 py-4 text-right font-black ${cierre.ganancia_neta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {fmt(cierre.ganancia_neta)}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-brand-700">{fmt(cierre.capital_neto_ysmael)}</td>
                        <td className="px-5 py-4 text-right font-bold text-brand-700">{fmt(cierre.capital_neto_victor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* MODAL: Cerrar Mes */}
          {modalCierre.open && metricas && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Cerrar Mes: {metricas.mes}</h3>
                    <p className="text-xs text-slate-500">Confirma el resumen antes de consolidar el periodo</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs border border-slate-100 rounded-xl p-4 bg-slate-50">
                  <div className="flex justify-between font-medium"><span>Ventas Totales:</span><span className="font-bold text-blue-600">{fmt(metricas.ventasTotales)}</span></div>
                  <div className="flex justify-between font-medium"><span>Costo Mercancía (COGS):</span><span className="font-bold text-red-600">-{fmt(metricas.cogs)}</span></div>
                  <div className="flex justify-between font-medium"><span>Gastos Operativos:</span><span className="font-bold text-orange-600">-{fmt(metricas.gastosOp)}</span></div>
                  <div className="flex justify-between font-bold pt-2 border-t border-slate-200 text-sm">
                    <span>Ganancia Neta:</span>
                    <span className={metricas.gananciaNeta >= 0 ? 'text-emerald-700' : 'text-red-700'}>{fmt(metricas.gananciaNeta)}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setModalCierre({ open: false, step: 1, processing: false })} className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm">
                    Cancelar
                  </button>
                  <button
                    onClick={ejecutarCierreMes}
                    disabled={modalCierre.processing}
                    className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow disabled:opacity-50"
                  >
                    {modalCierre.processing ? 'Procesando...' : 'Confirmar Cierre'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
