import { Outlet, Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ClientLayout() {
  const { isAuthenticated } = useAuth();
  
  return (
    <div className="min-h-screen flex flex-col pt-16">
      {/* Navbar Fixed */}
      <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-400 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-brand-400/40">
              S
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 leading-none">Smartbits</h1>
              <p className="text-xs text-brand-600 font-medium">Equipos de Confianza</p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link 
              to="/admin" 
              className="text-gray-400 hover:text-brand-600 transition-colors text-xs font-medium"
              title={isAuthenticated ? "Ir al Panel" : "Iniciar Sesión"}
            >
              {isAuthenticated ? "Panel Admin" : "Iniciar Sesión"}
            </Link>
            <a 
              href="https://wa.me/591" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full font-medium hover:bg-green-600 transition-colors shadow-sm shadow-green-200"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} Smartbits. Equipos garantizados.</p>
        </div>
      </footer>
    </div>
  );
}
