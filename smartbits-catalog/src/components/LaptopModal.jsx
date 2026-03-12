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
      setActiveImageIndex(0);
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
    ? "bg-blue-50 text-brand-600 border border-blue-100"
    : "bg-orange-50 text-orange-600 border border-orange-100";

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
        className="fixed inset-0 bg-brand-900/60 backdrop-blur-md transition-opacity" 
        onClick={handleBackdropClick}
      />

      {/* Modal Panel Container */}
      <div className="relative w-full max-w-6xl max-h-[90vh] sm:max-h-[85vh] lg:max-h-[90vh] flex flex-col pointer-events-auto bg-white sm:rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(15,23,42,0.25)] overflow-hidden animate-welcome border border-brand-100/50">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-50 p-2 bg-white/80 hover:bg-brand-50 rounded-full text-brand-800 transition-all border border-brand-100 backdrop-blur-sm group"
        >
          <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
        </button>

        {/* Scrollable Content Area */}
        <div className="overflow-y-auto flex-grow h-full custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-[45%_55%] min-h-full">
            
            {/* Left Column: Photos */}
            <div className="bg-brand-50/50 p-4 sm:p-8 lg:p-10 flex flex-col gap-6 border-b md:border-b-0 md:border-r border-brand-100/50 h-full">
              <div className="flex-grow aspect-[4/3] md:aspect-auto md:h-full max-h-[400px] md:max-h-[500px] rounded-3xl overflow-hidden bg-white shadow-sm border border-brand-100 relative group flex items-center justify-center">
                <img 
                  src={images[activeImageIndex]} 
                  alt={laptop.modelo}
                  className="w-full h-full object-contain p-6 group-hover:scale-105 transition-all duration-700 ease-out"
                />
              </div>
              
              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex flex-wrap justify-center gap-3">
                  {images.map((img, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-16 h-16 sm:w-20 lg:w-24 aspect-square bg-white rounded-2xl border-2 transition-all overflow-hidden p-1.5 ${
                        activeImageIndex === idx ? 'border-brand-600 shadow-md scale-95' : 'border-brand-100 hover:border-brand-300 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} className="w-full h-full object-contain" alt={`thumb-${idx}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Details */}
            <div className="p-8 sm:p-12 lg:p-14 flex flex-col bg-white">
              <div className="mb-10">
                <p className="text-[10px] lg:text-xs font-black text-brand-400 uppercase tracking-[0.3em] mb-4">{laptop.marca}</p>
                <h3 className="text-3xl sm:text-4xl lg:text-6xl font-black text-brand-800 leading-[1.05] mb-8 tracking-tighter">{laptop.modelo}</h3>
                
                <div className="flex flex-wrap items-center gap-8">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl lg:text-6xl font-black text-brand-900 tracking-tighter">${laptop.precio}</span>
                    <span className="text-sm font-bold text-brand-400">USD</span>
                  </div>
                  <span className={`px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest ${badgeClass}`}>
                    {laptop.disponibilidad}
                  </span>
                </div>
              </div>

              {/* Certification Box */}
              <div className="bg-brand-50 border border-brand-100/60 rounded-[3rem] p-8 lg:p-12 mb-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-100/30 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                
                <h4 className="text-[11px] lg:text-xs font-black text-brand-800 flex items-center gap-4 mb-10 uppercase tracking-[0.2em]">
                  <div className="w-10 h-10 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/20">
                    <ShieldCheck className="w-6 h-6 text-white" />
                  </div>
                  Estado Smartbits
                </h4>

                <div className="space-y-10">
                  {/* Bars */}
                  {[
                    { label: "Integridad Pantalla", val: pScreen },
                    { label: "Estética / Chasis", val: pBody }
                  ].map((st, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs lg:text-sm font-black text-brand-800 mb-4 uppercase tracking-wider">
                        <span>{st.label}</span>
                        <span className="text-brand-600">{st.val}/10</span>
                      </div>
                      <div className="w-full bg-brand-200/50 rounded-full h-2">
                        <div 
                          className="bg-brand-600 h-full rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: showBars ? `${st.val * 10}%` : '0%', transitionDelay: `${i * 150}ms` }}
                        />
                      </div>
                    </div>
                  ))}

                  {/* Battery */}
                  <div className="flex items-center justify-between pt-8 border-t border-brand-200/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white border border-brand-100 flex items-center justify-center text-brand-600">
                        <BatteryCharging className="w-6 h-6" />
                      </div>
                      <span className="text-xs lg:text-sm font-black text-brand-800 uppercase tracking-widest">Salud Batería</span>
                    </div>
                    <span className="text-sm lg:text-xl font-black text-brand-900 uppercase tracking-tighter">{laptop.bateria}</span>
                  </div>
                </div>
              </div>

              {/* Specifications */}
              <h4 className="text-[10px] lg:text-xs font-black text-brand-400 mb-8 uppercase tracking-[0.4em]">Ficha Técnica</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-10 gap-x-12 mb-14">
                <SpecItem icon={Cpu} label="Procesador" value={laptop.cpu} />
                <SpecItem icon={MemoryStick} label="RAM" value={laptop.ram} />
                <SpecItem icon={Database} label="Almacenamiento" value={laptop.almacenamiento} />
                <SpecItem icon={MonitorPlay} label="Gráficos" value={laptop.gpu} />
                <SpecItem icon={Monitor} label="Pantalla" value={screenTxt} />
                <SpecItem icon={LayoutDashboard} label="Sistema" value={laptop.windows} />
              </div>

              {/* CTA Action */}
              <div className="mt-auto pt-10 border-t border-brand-100">
                <a 
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-brand-900 hover:bg-brand-800 text-white py-6 px-10 rounded-3xl font-black transition-all shadow-2xl shadow-brand-900/20 flex items-center justify-center gap-5 text-lg lg:text-xl transform hover:-translate-y-1.5 active:translate-y-0"
                >
                  <MessageCircle className="w-8 h-8 text-brand-400" />
                  CONSULTAR DISPONIBILIDAD
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
    <div className="flex gap-4 group">
      <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-500 group-hover:bg-brand-600 group-hover:text-white transition-all duration-300 shadow-sm">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex flex-col justify-center">
        <p className="text-brand-400 text-[9px] font-bold uppercase tracking-[0.2em] mb-1">{label}</p>
        <p className="font-extrabold text-brand-800 text-xs sm:text-sm leading-tight tracking-tight">{value}</p>
      </div>
    </div>
  );
}
