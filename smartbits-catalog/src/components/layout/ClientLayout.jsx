import { Outlet, Link } from 'react-router-dom';
import { Instagram, Shield, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ClientLayout() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check local storage or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pt-16 bg-white dark:bg-brand-950 transition-colors duration-500">
      {/* Navbar Fixed - Estilo Responsivo y Centrado */}
      <nav className="fixed top-0 left-0 right-0 bg-brand-50/90 dark:bg-brand-950/90 backdrop-blur-xl border-b border-brand-200/50 dark:border-brand-800/50 z-50 shadow-sm transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between relative">

          {/* IZQUIERDA: Logo icono - siempre visible, se oculta en desktop a favor del centrado */}
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center justify-center group h-full py-1 z-10"
          >
            <img
              src="/logo-min.png"
              alt="Logo Min"
              className="w-8 h-8 md:w-9 md:h-9 object-contain transition-transform group-hover:scale-110"
            />
          </Link>

          {/* CENTRO: Logo texto + slogan - solo visible en tablet/desktop */}
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="absolute left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center justify-center group h-full py-1"
          >
            <img
              src="/logo-black.png"
              alt="Smartbits"
              className="h-6 md:h-7 object-contain transition-transform group-hover:scale-105 dark:invert"
            />
            <p className="text-[8px] md:text-[9px] text-brand-500 dark:text-brand-400 font-bold tracking-wider mt-[4px] uppercase text-center whitespace-nowrap">
              Compra inteligente, compra en Smartbits
            </p>
          </Link>

          {/* CONTENEDOR DERECHO: Íconos y Acciones */}
          <div className="flex-1 flex items-center justify-end gap-2 md:gap-4">

            {/* Animación del Botón Dark Mode */}
            <button
              onClick={toggleDarkMode}
              className="relative transition-all hover:scale-110 active:scale-95 flex items-center justify-center p-2 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-800 text-brand-600 dark:text-brand-300"
              title="Alternar Modo Oscuro"
            >
              <div className="relative w-6 h-6 md:w-7 md:h-7 flex justify-center items-center overflow-hidden">
                <Sun className={`absolute w-full h-full transition-all duration-500 ease-in-out ${isDarkMode ? 'translate-y-10 opacity-0' : 'translate-y-0 opacity-100'}`} />
                <Moon className={`absolute w-full h-full transition-all duration-500 ease-in-out ${isDarkMode ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`} />
              </div>
            </button>

            {/* Instagram con Color de Marca */}
            <a
              href="https://www.instagram.com/smartbits.ve/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-all hover:scale-110 active:scale-95 flex items-center justify-center p-2 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-800"
            >
              <Instagram className="w-5 h-5 md:w-6 md:h-6 text-[#E1306C]" />
            </a>

            {/* WhatsApp con Color de Marca */}
            <a
              href="https://wa.me/584128444445"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-all hover:scale-110 active:scale-95 flex items-center justify-center p-2 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-800"
            >
              <img
                src="/whatsapp.png"
                alt="WhatsApp"
                className="w-7 h-7 md:w-8 md:h-8 object-contain"
              />
            </a>

            {/* Admin Panel Access - Local Only */}
            {import.meta.env.DEV && (
              <a
                href="http://localhost:5174/admin"
                className="hidden xl:flex items-center gap-2 px-3 py-1.5 text-[10px] font-black text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-white border border-brand-200 dark:border-brand-700 hover:bg-white dark:hover:bg-brand-800 rounded-lg transition-all uppercase tracking-tighter shadow-sm ml-2"
                title="Volver al Panel Administrador (Local)"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-brand-50 dark:bg-brand-950 border-t border-brand-100 dark:border-brand-800 py-12 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col items-center gap-8">
            <Link to="/" className="flex flex-col items-center group">
              <img src="/logo-black.png" className="h-6 opacity-80 group-hover:opacity-100 transition-opacity dark:invert" alt="Smartbits" />
              <p className="text-brand-600 dark:text-brand-400 text-[10px] uppercase font-bold tracking-[0.2em] mt-3">
                "Compra inteligente, compra en Smartbits"
              </p>
            </Link>

            <div className="flex items-center gap-6">
              <a href="https://www.instagram.com/smartbits.ve/" className="transition-all hover:scale-110 text-[#E1306C] opacity-80 hover:opacity-100">
                <Instagram className="w-6 h-6" />
              </a>
              <a href="https://wa.me/584128444445" className="transition-all hover:scale-110 opacity-80 hover:opacity-100">
                <img src="/whatsapp.png" className="w-8 h-8" alt="WhatsApp" />
              </a>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-brand-100 dark:border-brand-800 flex flex-col items-center gap-3">
            <p className="text-brand-400 dark:text-brand-600 text-[10px] font-bold uppercase tracking-widest">© {new Date().getFullYear()} Smartbits de Venezuela</p>
            {import.meta.env.DEV && (
              <a
                href="http://localhost:5174/admin"
                className="text-[9px] text-brand-300 dark:text-brand-700 hover:text-brand-600 dark:hover:text-brand-400 transition-colors uppercase font-black tracking-tighter"
              >
                Acceso Administrador (Local)
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
