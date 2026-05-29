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
         <div className="w-full max-w-[400px] sm:max-w-[600px] md:max-w-[720px] mx-auto px-3 flex items-center justify-between">
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center group h-full mr-3"
          >
            <img
              src="/icon-white.png"
              alt="Logo"
              className="h-5 object-contain opacity-80 group-hover:opacity-100 transition-opacity invert dark:invert-0"
            />
          </Link>

          <div className="flex flex-1 items-center justify-end gap-3 text-sm font-semibold text-brand-600 dark:text-brand-300">
            <span className="text-[10px] font-bold text-brand-400 dark:text-brand-500 uppercase tracking-wider">Contáctanos:</span>
            <a
              href="https://www.instagram.com/smartbits.ve/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity flex items-center gap-1.5"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="ig-grad" x1="0" y1="0" x2="24" y2="24">
                    <stop offset="0%" stopColor="#833AB4"/>
                    <stop offset="50%" stopColor="#E1306C"/>
                    <stop offset="100%" stopColor="#FCAF45"/>
                  </linearGradient>
                </defs>
                <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-grad)" strokeWidth="2" fill="none"/>
                <circle cx="12" cy="12" r="5" stroke="url(#ig-grad)" strokeWidth="2" fill="none"/>
                <circle cx="17.5" cy="6.5" r="1.5" fill="url(#ig-grad)"/>
              </svg>
              <span className="text-brand-600 dark:text-brand-300 font-semibold text-sm">Instagram</span>
            </a>
            <a
              href="https://wa.me/584128444445"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity flex items-center gap-1.5"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 2.08.64 4.01 1.73 5.62L2 22l4.53-1.57C8.04 21.4 9.96 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" fill="#25D366"/>
                <path d="M17 13.5c-.27-.14-1.63-.8-1.88-.9s-.44-.1-.62.1-.7.9-.87 1.08c-.16.18-.32.23-.6.1s-1.16-.43-2.21-1.37c-.82-.73-1.37-1.63-1.53-1.9-.16-.28-.02-.43.12-.56.12-.12.28-.32.41-.5.14-.18.18-.32.28-.5.1-.18.04-.37-.02-.5-.08-.14-.62-1.5-.85-2.06-.23-.56-.46-.5-.64-.5-.16 0-.34-.02-.52-.02-.18 0-.46.08-.7.37-.24.3-.92 1.01-.92 2.49 0 1.48.96 2.9 1.1 3.1.14.2 1.88 2.88 4.58 4.06.64.28 1.14.44 1.53.58.64.23 1.24.18 1.71.14.53-.05 1.6-.69 1.82-1.36.23-.66.23-1.24.16-1.35-.07-.11-.23-.18-.5-.32z" fill="white"/>
              </svg>
              <span className="text-brand-600 dark:text-brand-300 font-semibold text-sm">WhatsApp</span>
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
            <a href="https://www.instagram.com/smartbits.ve/" className="hover:opacity-80 transition-opacity flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="ig-grad-f" x1="0" y1="0" x2="24" y2="24">
                    <stop offset="0%" stopColor="#833AB4"/>
                    <stop offset="50%" stopColor="#E1306C"/>
                    <stop offset="100%" stopColor="#FCAF45"/>
                  </linearGradient>
                </defs>
                <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-grad-f)" strokeWidth="2" fill="none"/>
                <circle cx="12" cy="12" r="5" stroke="url(#ig-grad-f)" strokeWidth="2" fill="none"/>
                <circle cx="17.5" cy="6.5" r="1.5" fill="url(#ig-grad-f)"/>
              </svg>
              Instagram
            </a>
            <a href="https://wa.me/584128444445" className="hover:opacity-80 transition-opacity flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 2.08.64 4.01 1.73 5.62L2 22l4.53-1.57C8.04 21.4 9.96 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" fill="#25D366"/>
                <path d="M17 13.5c-.27-.14-1.63-.8-1.88-.9s-.44-.1-.62.1-.7.9-.87 1.08c-.16.18-.32.23-.6.1s-1.16-.43-2.21-1.37c-.82-.73-1.37-1.63-1.53-1.9-.16-.28-.02-.43.12-.56.12-.12.28-.32.41-.5.14-.18.18-.32.28-.5.1-.18.04-.37-.02-.5-.08-.14-.62-1.5-.85-2.06-.23-.56-.46-.5-.64-.5-.16 0-.34-.02-.52-.02-.18 0-.46.08-.7.37-.24.3-.92 1.01-.92 2.49 0 1.48.96 2.9 1.1 3.1.14.2 1.88 2.88 4.58 4.06.64.28 1.14.44 1.53.58.64.23 1.24.18 1.71.14.53-.05 1.6-.69 1.82-1.36.23-.66.23-1.24.16-1.35-.07-.11-.23-.18-.5-.32z" fill="white"/>
              </svg>
              WhatsApp
            </a>
          </div>
          <p className="text-brand-400 dark:text-brand-500 text-xs mt-6">Copyright © {new Date().getFullYear()} Smartbits. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
