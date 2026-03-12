import { Outlet, Link } from 'react-router-dom';
import { Instagram, Shield } from 'lucide-react';

export default function ClientLayout() {
  return (
    <div className="min-h-screen flex flex-col pt-16 bg-white">
      {/* Navbar Fixed */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-brand-100/50 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 group"
          >
            <img
              src="/logo-min.png"
              alt="Logo"
              className="w-10 h-10 md:w-11 md:h-11 object-contain transition-transform group-hover:scale-110"
            />
            <div className="flex flex-col items-center md:items-start text-left">
              <img
                src="/logo-black.png"
                alt="Smartbits"
                className="h-6 md:h-8 object-contain"
              />
              <p className="hidden md:block text-[9px] text-brand-600 font-bold tracking-wider -mt-1 uppercase">
                Compra inteligente, compra en Smartbits
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3 md:gap-5">
            {/* Admin Panel Access - Local Only */}
            {import.meta.env.DEV && (
              <>
                <a
                  href="http://localhost:5174/admin"
                  className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-[10px] font-black text-brand-500 hover:text-brand-600 border border-brand-100 hover:border-brand-200 rounded-lg transition-all uppercase tracking-tighter"
                  title="Volver al Panel Administrador (Local)"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Configuración</span>
                </a>
                <div className="h-6 w-px bg-brand-100 hidden lg:block mx-1"></div>
              </>
            )}

            {/* Instagram */}
            <a
              href="https://www.instagram.com/smartbits.ve/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-all hover:scale-110 active:scale-95 opacity-80 hover:opacity-100"
            >
              <img
                src="/instagram.png"
                alt="Instagram"
                className="w-8 h-8 md:w-9 md:h-9 object-contain"
              />
            </a>

            {/* WhatsApp */}
            <a
              href="https://wa.me/584128444445"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-all hover:scale-110 active:scale-95 opacity-80 hover:opacity-100"
            >
              <img
                src="/whatsapp.png"
                alt="WhatsApp"
                className="w-8 h-8 md:w-9 md:h-9 object-contain"
              />
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-brand-50 border-t border-brand-100 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col items-center gap-8">
            <Link to="/" className="flex flex-col items-center group">
              <img src="/logo-black.png" className="h-6 opacity-80 group-hover:opacity-100 transition-opacity" alt="Smartbits" />
              <p className="text-brand-600 text-[10px] uppercase font-bold tracking-[0.2em] mt-3">
                "Compra inteligente, compra en Smartbits"
              </p>
            </Link>

            <div className="flex items-center gap-6">
              <a href="https://www.instagram.com/smartbits.ve/" className="opacity-60 hover:opacity-100 transition-all">
                <img src="/instagram.png" className="w-8 h-8" alt="Instagram" />
              </a>
              <a href="https://wa.me/584128444445" className="opacity-60 hover:opacity-100 transition-all">
                <img src="/whatsapp.png" className="w-8 h-8" alt="WhatsApp" />
              </a>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-brand-100 flex flex-col items-center gap-3">
            <p className="text-brand-400 text-[10px] font-bold uppercase tracking-widest">© {new Date().getFullYear()} Smartbits de Venezuela</p>
            {import.meta.env.DEV && (
              <a 
                href="http://localhost:5174/admin" 
                className="text-[9px] text-brand-300 hover:text-brand-600 transition-colors uppercase font-black tracking-tighter"
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
