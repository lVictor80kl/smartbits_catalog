import { useEffect, useState } from 'react';
import { 
  X, Plus, ShieldCheck, BatteryCharging, 
  Cpu, MemoryStick, Database, MonitorPlay, 
  Monitor, LayoutDashboard, MessageCircle 
} from 'lucide-react';

export default function LaptopModal({ laptop, isOpen, onClose }) {
  const [showBars, setShowBars] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const images = (laptop?.imagenes && laptop.imagenes.length > 0) 
    ? laptop.imagenes 
    : (laptop?.imagen ? [laptop.imagen] : []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setActiveImageIndex(0); // Reiniciar al abrir
      const timer = setTimeout(() => setShowBars(true), 100);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
       setShowBars(false);
    }
  }, [isOpen]);

  if (!isOpen || !laptop) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const isAvailable = laptop.disponibilidad === "Disponible";
  const badgeClass = isAvailable
    ? "px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase tracking-wider"
    : "px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full uppercase tracking-wider";

  const pScreen = laptop.estado.pantalla;
  const pBody = laptop.estado.carcasa;
  const screenTxt = laptop.touch.toLowerCase() === 'sí' || laptop.touch.toLowerCase() === 'si' 
    ? `${laptop.pantalla} (Táctil)` 
    : laptop.pantalla;

  const whatsappMessage = `Hola Smartbits, estoy interesado en el equipo ${laptop.modelo} (ID: ${laptop.id}) listado a $${laptop.precio}. ¿Aún está disponible?`;
  const whatsappUrl = `https://wa.me/584128444445?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 overflow-hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm transition-opacity" 
        onClick={handleBackdropClick}
      />

      {/* Modal Panel Container */}
      <div className="relative w-full max-w-6xl max-h-[90vh] sm:max-h-[85vh] lg:max-h-[90vh] flex flex-col pointer-events-auto bg-white sm:rounded-3xl shadow-2xl overflow-hidden animate-welcome">
        
        {/* Close Button - Fixed position */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-50 p-2.5 bg-white/90 hover:bg-gray-100 rounded-full text-gray-500 transition-all shadow-md border border-gray-100 backdrop-blur-sm"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Scrollable Content Area */}
        <div className="overflow-y-auto flex-grow h-full custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-[45%_55%] min-h-full">
            
            {/* Left Column: Photos */}
            <div className="bg-gray-50 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 border-b md:border-b-0 md:border-r border-gray-100 h-full">
              <div className="flex-grow aspect-[4/3] md:aspect-auto md:h-full max-h-[400px] md:max-h-[500px] rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-gray-200 relative group flex items-center justify-center">
                <img 
                  src={images[activeImageIndex]} 
                  alt={laptop.modelo}
                  className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              
              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex flex-wrap justify-center gap-3">
                  {images.map((img, idx) => (
                    <div 
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-white rounded-xl ring-2 transition-all cursor-pointer overflow-hidden p-1.5 ${
                        activeImageIndex === idx ? 'ring-brand-500 scale-95 shadow-inner' : 'ring-gray-100 hover:ring-gray-300 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img} className="w-full h-full object-contain" alt={`thumb-${idx}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Details */}
            <div className="p-6 sm:p-10 lg:p-12 flex flex-col bg-white">
              <div className="mb-8">
                <p className="text-[10px] lg:text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3">{laptop.marca}</p>
                <h3 className="text-2xl sm:text-3xl lg:text-5xl font-black text-gray-900 leading-[1.1] mb-6 tracking-tight">{laptop.modelo}</h3>
                
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-brand-600">${laptop.precio}</span>
                    <span className="text-sm font-bold text-gray-400">USD</span>
                  </div>
                  <span className={`${badgeClass} lg:text-sm lg:px-5 lg:py-2`}>{laptop.disponibilidad}</span>
                </div>
              </div>

              {/* Confidence Factor */}
              <div className="bg-brand-50/50 border border-brand-100/50 rounded-[2.5rem] p-6 lg:p-10 mb-10">
                <h4 className="text-[11px] lg:text-xs font-black text-gray-800 flex items-center gap-3 mb-8 uppercase tracking-widest">
                  <ShieldCheck className="w-6 h-6 text-brand-500" />
                  Estado Certificado Smartbits
                </h4>

                <div className="space-y-8">
                  {/* Screen Bar */}
                  <div>
                    <div className="flex justify-between text-xs lg:text-sm font-bold text-gray-700 mb-3">
                      <span>Integridad Pantalla</span>
                      <span className="text-brand-600 font-black">{pScreen}/10</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-brand-500 h-full rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: showBars ? `${pScreen * 10}%` : '0%' }}
                      />
                    </div>
                  </div>

                  {/* Body Bar */}
                  <div>
                    <div className="flex justify-between text-xs lg:text-sm font-bold text-gray-700 mb-3">
                      <span>Estética / Chasis</span>
                      <span className="text-brand-600 font-black">{pBody}/10</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out delay-150 ${pBody >= 9 ? 'bg-brand-500' : 'bg-brand-400'}`} 
                        style={{ width: showBars ? `${pBody * 10}%` : '0%' }}
                      />
                    </div>
                  </div>

                  {/* Battery */}
                  <div className="flex items-center justify-between pt-6 border-t border-brand-100/50">
                    <div className="flex items-center gap-3">
                      <BatteryCharging className="w-6 h-6 text-brand-600" />
                      <span className="text-xs lg:text-sm font-bold text-gray-600"> Salud de Batería</span>
                    </div>
                    <span className="text-sm lg:text-lg font-black text-gray-900 uppercase">{laptop.bateria}</span>
                  </div>
                </div>
              </div>

              {/* Tech Specs */}
              <h4 className="text-[10px] lg:text-xs font-black text-gray-400 mb-6 uppercase tracking-[0.3em]">Ficha Técnica</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                <SpecItem icon={Cpu} label="Procesador" value={laptop.cpu} />
                <SpecItem icon={MemoryStick} label="Memoria RAM" value={laptop.ram} />
                <SpecItem icon={Database} label="Disco" value={laptop.almacenamiento} />
                <SpecItem icon={MonitorPlay} label="Gráficos" value={laptop.gpu} />
                <SpecItem icon={Monitor} label="Pantalla" value={screenTxt} />
                <SpecItem icon={LayoutDashboard} label="Sistema" value={laptop.windows} />
              </div>

              {/* Actions */}
              <div className="mt-auto pt-10 border-t border-gray-100">
                <a 
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-6 px-10 rounded-2xl font-black transition-all shadow-xl shadow-green-500/30 flex items-center justify-center gap-4 text-lg lg:text-xl cursor-pointer transform hover:-translate-y-1.5 active:translate-y-0"
                >
                  <MessageCircle className="w-8 h-8" />
                  Consultar Disponibilidad
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecItem({ icon: Icon, label, value }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div>
        <p className="text-gray-500 text-[10px] font-medium uppercase">{label}</p>
        <p className="font-semibold text-gray-900 line-clamp-2 leading-tight mt-0.5 text-xs">{value}</p>
      </div>
    </div>
  );
}
