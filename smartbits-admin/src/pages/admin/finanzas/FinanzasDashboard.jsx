import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, ArrowRightLeft, Package, FileText, PieChart, BarChart2 
} from 'lucide-react';
import PanelPrincipal from './PanelPrincipal';
import Movimientos from './Movimientos';
import InventarioFinanciero from './InventarioFinanciero';
import VentasNotas from './VentasNotas';
import InteligenciaVentas from './InteligenciaVentas';
import ReportesCierre from './ReportesCierre';

export default function FinanzasDashboard() {
  const navigate = useNavigate();

  const tabs = [
    { path: '/admin/finanzas/panel', key: 'panel', label: 'Panel Principal', icon: LayoutDashboard },
    { path: '/admin/finanzas/movimientos', key: 'movimientos', label: 'Movimientos', icon: ArrowRightLeft },
    { path: '/admin/finanzas/inventario', key: 'inventario', label: 'Inventario', icon: Package },
    { path: '/admin/finanzas/ventas', key: 'ventas', label: 'Ventas & Notas', icon: FileText },
    { path: '/admin/finanzas/inteligencia', key: 'inteligencia', label: 'Inteligencia de Ventas', icon: PieChart },
    { path: '/admin/finanzas/reportes', key: 'reportes', label: 'Cierre & Configuración', icon: BarChart2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Módulo de Finanzas</h1>
          <p className="text-xs text-slate-500 mt-0.5">Control de capital, caja, utilidades compartidas y movimientos</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* BARRA DE NAVEGACIÓN SUPERIOR (6 TABS) */}
        <div className="flex overflow-x-auto border-b border-slate-100 p-1.5 gap-1 bg-slate-50/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap rounded-xl transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </NavLink>
            );
          })}
        </div>

        {/* CONTENIDO DE LA PESTAÑA */}
        <div className="p-4 md:p-6 bg-slate-50/40 min-h-[550px]">
          <Routes>
            <Route index element={<Navigate to="panel" replace />} />
            <Route path="panel" element={<PanelPrincipal onNavigateTab={(tabKey) => navigate(`/admin/finanzas/${tabKey}`)} />} />
            <Route path="movimientos" element={<Movimientos />} />
            <Route path="inventario" element={<InventarioFinanciero />} />
            <Route path="ventas" element={<VentasNotas />} />
            <Route path="inteligencia" element={<InteligenciaVentas />} />
            <Route path="reportes" element={<ReportesCierre />} />
            <Route path="*" element={<Navigate to="panel" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
