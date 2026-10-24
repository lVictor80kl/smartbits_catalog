import { Outlet, Link, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useEffect } from 'react';

export default function ClientLayout() {
  const location = useLocation();

  useEffect(() => {
    // Default to a dark theme preference visually, or sync with the system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-brand-50 dark:bg-brand-950 transition-colors duration-500 font-sans">
      {/* Navbar Fixed - Technical Brand Style */}
      <nav className="fixed top-0 left-0 right-0 h-[56px] bg-white/80 dark:bg-brand-900/80 border-b border-brand-100 dark:border-brand-800 backdrop-blur-md z-50 transition-all flex items-center">
        <div className="w-full max-w-[400px] sm:max-w-[600px] md:max-w-[720px] mx-auto px-3 flex items-center justify-between">
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center group h-full mr-2 sm:mr-3 shrink-0"
          >
            <img
              src="/icon-white.png"
              alt="Logo"
              className="hidden dark:block h-4 sm:h-5 object-contain opacity-80 group-hover:opacity-100"
            />
            <img
              src="/logo-black.png"
              alt="Logo"
              className="block dark:hidden h-4 sm:h-5 object-contain opacity-80 group-hover:opacity-100"
            />
          </Link>

          <div className="flex items-center gap-1 ml-2 sm:ml-4">
            <Link
              to="/"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className={`px-2.5 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                location.pathname === '/'
                  ? 'bg-brand-900 dark:bg-brand-700 text-white'
                  : 'text-brand-600 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-800'
              }`}
            >
              Equipos
            </Link>
            <Link
              to="/componentes"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className={`px-2.5 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                location.pathname === '/componentes'
                  ? 'bg-brand-900 dark:bg-brand-700 text-white'
                  : 'text-brand-600 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-800'
              }`}
            >
              Componentes
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3 text-sm font-semibold text-brand-600 dark:text-brand-300">

            <a
              href="https://www.instagram.com/smartbits.ve/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap"
              aria-label="Instagram"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="ig-grad" x1="0" y1="0" x2="24" y2="24">
                    <stop offset="0%" stopColor="#833AB4" />
                    <stop offset="50%" stopColor="#E1306C" />
                    <stop offset="100%" stopColor="#FCAF45" />
                  </linearGradient>
                </defs>
                <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-grad)" strokeWidth="2" fill="none" />
                <circle cx="12" cy="12" r="5" stroke="url(#ig-grad)" strokeWidth="2" fill="none" />
                <circle cx="17.5" cy="6.5" r="1.5" fill="url(#ig-grad)" />
              </svg>
              <span className="hidden sm:inline text-brand-600 dark:text-brand-300 font-semibold text-sm">Instagram</span>
            </a>
            <a
              href="https://wa.me/584128444445"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap"
              aria-label="WhatsApp"
            >
              <img
                src="/whatsapp.png"
                alt="WhatsApp"
                className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 object-contain"
              />
              <span className="hidden sm:inline text-brand-600 dark:text-brand-300 font-semibold text-sm">WhatsApp</span>
            </a>
            {import.meta.env.DEV && (
              <a
                href="http://localhost:5174/admin"
                className="hover:text-brand-900 dark:hover:text-white transition-colors flex items-center gap-1"
                title="Admin"
              >
                <Shield className="w-3.5 h-3.5" /> Admin
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content - padding top to match navbar */}
      <main className="flex-1 w-full max-w-full mx-auto pt-[56px]">
        <Outlet />
      </main>

      {/* Footer minimalista */}
      <footer className="bg-white dark:bg-brand-900 border-t border-brand-100 dark:border-brand-800 py-12 transition-colors duration-500">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col items-center gap-4">
          <Link to="/" className="flex flex-col items-center group">
            <img src="/icon-white.png" className="hidden dark:block h-5 opacity-60 hover:opacity-100 transition-opacity" alt="Smartbits" />
            <img src="/logo-black.png" className="block dark:hidden h-5 opacity-60 hover:opacity-100 transition-opacity" alt="Smartbits" />
          </Link>
          <div className="text-brand-500 dark:text-brand-300 text-sm flex gap-4 mt-4">
            <a href="https://www.instagram.com/smartbits.ve/" className="hover:opacity-80 transition-opacity flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
              <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="ig-grad-f" x1="0" y1="0" x2="24" y2="24">
                    <stop offset="0%" stopColor="#833AB4" />
                    <stop offset="50%" stopColor="#E1306C" />
                    <stop offset="100%" stopColor="#FCAF45" />
                  </linearGradient>
                </defs>
                <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-grad-f)" strokeWidth="2" fill="none" />
                <circle cx="12" cy="12" r="5" stroke="url(#ig-grad-f)" strokeWidth="2" fill="none" />
                <circle cx="17.5" cy="6.5" r="1.5" fill="url(#ig-grad-f)" />
              </svg>
              Instagram
            </a>
            <a href="https://wa.me/584128444445" className="hover:opacity-80 transition-opacity flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
              <img src="/whatsapp.png" alt="WhatsApp" className="w-5 h-5 flex-shrink-0 object-contain" />
              WhatsApp
            </a>
          </div>
          <p className="text-brand-400 dark:text-brand-500 text-xs mt-6">Copyright © {new Date().getFullYear()} Smartbits. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
