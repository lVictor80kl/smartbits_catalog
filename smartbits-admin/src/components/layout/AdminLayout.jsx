import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Laptop, LayoutDashboard, PlusCircle, LogOut, CloudLightning, 
  Package, Wrench, DollarSign, Menu, X, ExternalLink, Truck, ShoppingBag,
  Sun, Moon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { fetchTasasVenezolanas } from '../../services/tasasCambioService';
import { normalizarTasas, esTasaAceptable } from '../../utils/tasasCambio';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendientesEbay, setPendientesEbay] = useState(0);

  // Auto-actualizar tasas de cambio en vivo cada vez que se abre el panel de administración
  // (a no ser que esté seleccionada la tasa personalizada como activa)
  useEffect(() => {
    let cancel = false;

    const autoSyncTasas = async () => {
      try {
        const snap = await getDoc(doc(db, 'caja', 'saldos'));
        if (!snap.exists()) return;
        const data = snap.data();
        const tasasData = data.tasas || {};
        const predeterminada = tasasData.tasa_predeterminada || 'binance_usdt';

        // Si la tasa activa es la Personalizada (Custom), NO se sobreescribe
        if (predeterminada === 'custom') {
          console.log('[Tasas Admin] Tasa personalizada activa. Se omite actualización automática.');
          return;
        }

        const res = await fetchTasasVenezolanas();
        if (cancel) return;

        const cleanTasasBase = {
          bcv_usd: res.bcv_usd ?? tasasData.bcv_usd ?? null,
          bcv_eur: res.bcv_eur ?? tasasData.bcv_eur ?? null,
          binance_usdt: res.binance_usdt ?? tasasData.binance_usdt ?? null
        };

        // Se normalizan juntas (nuevas + guardadas): esto corrige el error de
        // separador de miles de la API ("1.006" en vez de "1.006,03" Bs).
        const { tasas: normalizadas, correcciones } = normalizarTasas(cleanTasasBase);
        correcciones.forEach(c => console.warn(`[Tasas Admin] ${c}`));

        const cleanTasas = {
          bcv_usd: normalizadas.bcv_usd,
          bcv_eur: normalizadas.bcv_eur,
          binance_usdt: normalizadas.binance_usdt,
          custom: tasasData.custom ?? null,
          tasa_predeterminada: predeterminada,
          updated_at: res.updated_at || new Date().toISOString(),
          fuentes: res.fuentes || {}
        };

        const nuevaTasaEfectiva = cleanTasas[predeterminada];
        const payload = {
          tasas: cleanTasas,
          updated_at: new Date()
        };

        // Nunca se guarda una tasa inválida: si la API devuelve basura se
        // conserva la última tasa válida que ya tenía el sistema.
        if (esTasaAceptable(nuevaTasaEfectiva)) {
          payload.tasa_cambio = nuevaTasaEfectiva;
        } else {
          console.warn('[Tasas Admin] Tasa activa inválida; se conserva la tasa anterior.');
        }

        await updateDoc(doc(db, 'caja', 'saldos'), payload);
        console.log(`[Tasas Admin] Tasa ${predeterminada} actualizada automáticamente a: Bs ${nuevaTasaEfectiva}`);
      } catch (err) {
        console.warn('[Tasas Admin] No se pudo auto-actualizar tasas al iniciar:', err.message);
      }
    };

    autoSyncTasas();

    return () => { cancel = true; };
  }, []);

  // Escuchar compras de eBay pendientes de inventario
  useEffect(() => {
    const q = query(collection(db, 'compras_ebay'), where('estado', '==', 'pendiente'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendientesEbay(snapshot.size);
    }, (err) => {
      console.warn('Error escuchando compras ebay pendientes:', err);
    });
    return () => unsubscribe();
  }, []);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { path: '/admin', label: 'Inventario', icon: LayoutDashboard },
    { path: '/admin/components', label: 'Componentes', icon: Package },
    { path: '/admin/compras-ebay', label: 'Compras y Logística', icon: ShoppingBag, badge: pendientesEbay },
    { path: '/admin/service', label: 'Servicio Técnico', icon: Wrench },
    { path: '/admin/finanzas', label: 'Finanzas', icon: DollarSign },
  ];

  const checkIsActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const catalogUrl = import.meta.env.PROD ? "/" : "http://localhost:5173";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col md:flex-row transition-colors duration-200">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 hidden md:flex flex-col flex-shrink-0 transition-colors duration-200">
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <img src="/logo-min.png" alt="Logo" className="w-9 h-9 object-contain drop-shadow-sm" />
            <div className="flex flex-col">
              <img src={isDark ? "/icon-white.png" : "/logo-black.png"} alt="Smartbits" className="h-5 object-contain" />
              <p className="text-[8px] text-brand-500 dark:text-brand-400 font-bold uppercase tracking-tighter -mt-0.5">Admin Panel</p>
            </div>
          </div>

          {/* Theme Toggle Button Desktop */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-amber-300 hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-colors cursor-pointer"
            title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            aria-label="Alternar tema claro/oscuro"
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400 animate-in fade-in zoom-in-75 duration-200" />
            ) : (
              <Moon className="h-4 w-4 text-gray-600 animate-in fade-in zoom-in-75 duration-200" />
            )}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = checkIsActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium text-sm ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 font-bold border border-brand-100/60 dark:border-brand-800/40'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-brand-700 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'}`} />
                <span className="flex-1">{item.label}</span>
                {item.badge > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-extrabold rounded-full bg-red-600 text-white shadow-xs animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <a
            href={catalogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors border border-transparent dark:border-brand-800/30"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver Catálogo Público
          </a>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors border border-transparent dark:border-red-900/30 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sticky top-0 z-30 shadow-xs transition-colors duration-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="p-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? <X className="h-6 w-6 text-brand-600 dark:text-brand-400" /> : <Menu className="h-6 w-6" />}
          </button>

          <div className="flex items-center gap-2">
            <img src="/logo-min.png" alt="Logo" className="w-7 h-7 object-contain" />
            <span className="font-extrabold text-slate-800 dark:text-gray-100 text-base tracking-tight">Admin Panel</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Toggle Button Mobile */}
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
            title={isDark ? "Modo claro" : "Modo oscuro"}
            aria-label="Alternar tema"
          >
            {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
          </button>

          <a
            href={catalogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 rounded-md flex items-center gap-1 border border-transparent dark:border-brand-800/30"
          >
            Tienda
          </a>
          <button
            onClick={handleLogout}
            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-md transition-colors cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay / Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col pt-16">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu Drawer */}
          <div className="relative bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-xl p-4 z-50 space-y-3 animate-in slide-in-from-top duration-200">
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2 pt-1">Módulos del Sistema</p>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = checkIsActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-semibold text-sm ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                        : 'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-slate-500 dark:text-gray-400'}`} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge > 0 && (
                      <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-extrabold rounded-full bg-red-600 text-white shadow-xs animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex gap-2">
              <a
                href={catalogUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/40 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900/50"
              >
                <ExternalLink className="h-4 w-4" />
                Catálogo Público
              </a>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50"
              >
                <LogOut className="h-4 w-4" />
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-4 md:p-8 pb-20 md:pb-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Fixed Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex justify-around items-center h-16 shadow-lg px-1 transition-colors duration-200">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = checkIsActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors ${
                isActive
                  ? 'text-brand-600 dark:text-brand-400 font-bold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-normal'
              }`}
            >
              <div className={`p-1 rounded-lg ${isActive ? 'bg-brand-50 dark:bg-brand-950/60' : ''}`}>
                <Icon className={`h-5 w-5 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'}`} />
              </div>
              <span className="text-[10px] tracking-tight leading-none mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
