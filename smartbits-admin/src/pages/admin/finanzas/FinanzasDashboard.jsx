import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Wallet, PieChart, Users, TrendingUp, History, Receipt, FileText, DollarSign, Package, BarChart2 } from 'lucide-react';
import ResumenCaja from './ResumenCaja';
import CapitalSocios from './CapitalSocios';
import GastosPersonales from './GastosPersonales';
import GastosOperativos from './GastosOperativos';
import InteligenciaVentas from './InteligenciaVentas';
import Historico from './Historico';
import NotasDeEntrega from './NotasDeEntrega';
import InventarioFinanciero from './InventarioFinanciero';
import ReportesCierre from './ReportesCierre';

export default function FinanzasDashboard() {
  const tabs = [
    { path: '/admin/finanzas/inventario', label: 'Inventario', icon: Package },
    { path: '/admin/finanzas/caja', label: 'Caja', icon: Wallet },
    { path: '/admin/finanzas/capital', label: 'Capital Socios', icon: Users },
    { path: '/admin/finanzas/gastos-personales', label: 'Gastos Personales', icon: Receipt },
    { path: '/admin/finanzas/gastos-operativos', label: 'Gastos Operativos', icon: TrendingUp },
    { path: '/admin/finanzas/inteligencia', label: 'Inteligencia de Ventas', icon: PieChart },
    { path: '/admin/finanzas/historico', label: 'Histórico', icon: History },
    { path: '/admin/finanzas/notas-de-entrega', label: 'Notas de Entrega', icon: FileText },
    { path: '/admin/finanzas/reportes', label: 'Reportes / Cierre', icon: BarChart2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Módulo de Finanzas</h1>
          <p className="text-sm text-slate-500">Gestión de capital, gastos y métricas del negocio</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${isActive
                    ? 'border-brand-600 text-brand-600 bg-brand-50/50 rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </NavLink>
            );
          })}
        </div>

        <div className="p-4 md:p-6 bg-slate-50/50 min-h-[500px]">
          <Routes>
            <Route index element={<Navigate to="inventario" replace />} />
            <Route path="inventario" element={<InventarioFinanciero />} />
            <Route path="caja" element={<ResumenCaja />} />
            <Route path="capital" element={<CapitalSocios />} />
            <Route path="gastos-personales" element={<GastosPersonales />} />
            <Route path="gastos-operativos" element={<GastosOperativos />} />
            <Route path="inteligencia" element={<InteligenciaVentas />} />
            <Route path="historico" element={<Historico />} />
            <Route path="notas-de-entrega" element={<NotasDeEntrega />} />
            <Route path="reportes" element={<ReportesCierre />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
