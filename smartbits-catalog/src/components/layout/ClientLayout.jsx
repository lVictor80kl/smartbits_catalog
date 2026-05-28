import { Outlet, Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ClientLayout() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Default to a dark theme preference visually, or sync with the system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-brand-50 dark:bg-brand-950 transition-colors duration-500 font-sans">
      {/* Navbar Fixed - Technical Brand Style */}
      <nav className="fixed top-0 left-0 right-0 h-[56px] bg-white/80 dark:bg-brand-900/80 border-b border-brand-100 dark:border-brand-800 backdrop-blur-md z-50 transition-all flex items-center">
        <div className="w-full max-w-[1400px] mx-auto px-6 flex items-center justify-between">
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center group h-full"
          >
            <img
              src="/icon-white.png"
              alt="Logo"
              className="h-5 object-contain opacity-80 group-hover:opacity-100 transition-opacity invert dark:invert-0"
            />
          </Link>

          <div className="flex flex-1 items-center justify-end gap-6 text-sm font-semibold text-brand-600 dark:text-brand-300">
            <a
              href="https://www.instagram.com/smartbits.ve/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-900 dark:hover:text-white transition-colors"
            >
              Instagram
            </a>
            <a
              href="https://wa.me/584128444445"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-900 dark:hover:text-white transition-colors"
            >
              WhatsApp
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
            <img src="/icon-white.png" className="h-5 opacity-60 hover:opacity-100 transition-opacity invert dark:invert-0" alt="Smartbits" />
          </Link>
          <div className="text-brand-500 dark:text-brand-300 text-sm flex gap-4 mt-4">
            <a href="https://www.instagram.com/smartbits.ve/" className="hover:text-brand-900 dark:hover:text-white transition-colors">Instagram</a>
            <a href="https://wa.me/584128444445" className="hover:text-brand-900 dark:hover:text-white transition-colors">WhatsApp</a>
          </div>
          <p className="text-brand-400 dark:text-brand-500 text-xs mt-6">Copyright © {new Date().getFullYear()} Smartbits. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
