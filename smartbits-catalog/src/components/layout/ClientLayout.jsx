import { Outlet, Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';

export default function ClientLayout() {
  return (
    <div className="min-h-screen flex flex-col pt-16">
      {/* Navbar Fixed */}
      <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link 
            to="/" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 group animate-welcome"
          >
            <img
              src="/logo-min.png"
              alt="Logo"
              className="w-10 h-10 md:w-12 md:h-12 object-contain drop-shadow-md transition-transform group-hover:scale-110"
            />
            <div className="flex flex-col items-center md:items-start text-left">
              <img
                src="/logo-black.png"
                alt="Smartbits"
                className="h-7 md:h-9 object-contain drop-shadow-md"
              />
              <p className="hidden md:block text-[10px] text-brand-500 font-bold tracking-wider -mt-1 uppercase">
                Compra inteligente, compra en Smartbits
              </p>
            </div>
          </Link>
          
          <div className="flex items-center gap-3 md:gap-4">
            {/* Instagram */}
            <a
              href="https://www.instagram.com/smartbits.ve/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-transform hover:scale-110 active:scale-95 duration-200"
              title="Síguenos en Instagram"
            >
              <img
                src="/instagram.png"
                alt="Instagram"
                className="w-10 h-10 md:w-12 md:h-12 drop-shadow-sm rounded-[22%] object-contain"
              />
            </a>

            {/* WhatsApp */}
            <a
              href="https://wa.me/584128444445"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-transform hover:scale-110 active:scale-95 duration-200 group relative"
              title="Contáctanos por WhatsApp"
            >
              <img
                src="/whatsapp.png"
                alt="WhatsApp"
                className="w-10 h-10 md:w-12 md:h-12 drop-shadow-sm object-contain"
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
      <footer className="bg-white border-t border-gray-100 py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex flex-col items-center gap-6">
            <Link to="/" className="inline-block hover:opacity-70 transition-opacity">
              <p className="text-gray-900 font-bold text-sm mb-2">Smartbits</p>
              <p className="text-gray-500 text-xs italic tracking-wide">"Compra inteligente, compra en smartbits"</p>
            </Link>

            <div className="flex items-center gap-4">
              <a
                href="https://www.instagram.com/smartbits.ve/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-transform hover:scale-110 active:scale-95 duration-200"
                title="Síguenos en Instagram"
              >
                <img
                  src="/instagram.png"
                  alt="Instagram"
                  className="w-10 h-10 drop-shadow-sm rounded-[22%]"
                />
              </a>
              <a
                href="https://wa.me/584128444445"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-transform hover:scale-110 active:scale-95 duration-200"
                title="WhatsApp"
              >
                <img
                  src="/whatsapp.png"
                  alt="WhatsApp"
                  className="w-10 h-10 drop-shadow-sm"
                />
              </a>
            </div>
          </div>
          <p className="text-gray-400 text-[10px] mt-8 uppercase">© {new Date().getFullYear()} Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
