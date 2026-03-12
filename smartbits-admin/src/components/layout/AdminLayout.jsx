import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Laptop, LayoutDashboard, PlusCircle, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const navItems = [
    { path: '/admin', label: 'Inventario', icon: LayoutDashboard },
    { path: '/admin/new', label: 'Añadir Laptop', icon: PlusCircle },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const catalogUrl = import.meta.env.PROD ? "/" : "http://localhost:5173";

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img src="/logo-min.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-sm" />
            <div className="flex flex-col">
              <img src="/logo-black.png" alt="Smartbits" className="h-6 object-contain" />
              <p className="text-[8px] text-brand-500 font-bold uppercase tracking-tighter -mt-0.5">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-brand-700' : 'text-gray-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <a
            href={catalogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-bold text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors mb-2"
          >
            Ver Catálogo Público
          </a>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <span className="font-bold text-slate-800">Panel Admin</span>
          <div className="flex items-center gap-3">
            <a href={catalogUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 text-xs font-bold">Ver Tienda</a>
            <button onClick={handleLogout} className="text-red-500"><LogOut className="h-5 w-5" /></button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
