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
    <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
        onClick={handleBackdropClick}
      />

      <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0 pointer-events-none">
        {/* Modal Panel */}
        <div 
          className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-4xl pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-white/80 hover:bg-gray-100 rounded-full text-gray-500 transition-colors backdrop-blur-sm shadow-sm ring-1 ring-gray-200"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 bg-white h-full max-h-[90vh] overflow-y-auto w-full">
            {/* Left Column: Photos */}
            <div className="bg-gray-50 p-6 flex flex-col gap-4">
              <div className="aspect-[4/3] rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-gray-200 relative group">
                <img 
                  src={images[activeImageIndex]} 
                  alt={laptop.modelo}
                  className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-700"
                />
              </div>
              
              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((img, idx) => (
                    <div 
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`aspect-square bg-white rounded-lg ring-2 transition-all cursor-pointer overflow-hidden p-1 ${
                        activeImageIndex === idx ? 'ring-blue-500 scale-95 shadow-inner' : 'ring-gray-100 hover:ring-gray-300 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img} className="w-full h-full object-contain" alt={`thumb-${idx}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Details */}
            <div className="p-6 md:p-8 flex flex-col">
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-gray-900">{laptop.modelo}</h3>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-3xl font-extrabold text-blue-600">${laptop.precio}</span>
                  <span className={badgeClass}>{laptop.disponibilidad}</span>
                </div>
              </div>

              {/* Confidence Factor (Visual State) */}
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 mb-6">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-blue-500" />
                  Estado Certificado Smartbits
                </h4>

                <div className="space-y-4">
                  {/* Screen Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                      <span>Pantalla</span>
                      <span className="text-gray-900 bg-white px-2 rounded font-bold shadow-sm">{pScreen}/10</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-green-500 h-full rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: showBars ? `${pScreen * 10}%` : '0%' }}
                      />
                    </div>
                  </div>

                  {/* Body Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                      <span>Carcasa / Estética general</span>
                      <span className="text-gray-900 bg-white px-2 rounded font-bold shadow-sm">{pBody}/10</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out delay-150 ${pBody >= 9 ? 'bg-green-500' : 'bg-blue-400'}`} 
                        style={{ width: showBars ? `${pBody * 10}%` : '0%' }}
                      />
                    </div>
                  </div>

                  {/* Battery */}
                  <div className="flex items-center justify-between pt-2 border-t border-blue-100/50">
                    <div className="flex items-center gap-2">
                      <BatteryCharging className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-600">Salud de la batería</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{laptop.bateria}</span>
                  </div>
                </div>
              </div>

              {/* Tech Specs Grid */}
              <h4 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Especificaciones Técnicas</h4>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm flex-grow">
                <SpecItem icon={Cpu} label="Procesador" value={laptop.cpu} />
                <SpecItem icon={MemoryStick} label="Memoria RAM" value={laptop.ram} />
                <SpecItem icon={Database} label="Almacenamiento" value={laptop.almacenamiento} />
                <SpecItem icon={MonitorPlay} label="Gráficos" value={laptop.gpu} />
                <SpecItem icon={Monitor} label="Pantalla" value={screenTxt} />
                <SpecItem icon={LayoutDashboard} label="Sistema" value={laptop.windows} />
              </div>

              {/* Footer / Actions */}
              <div className="mt-8 pt-6 border-t border-gray-100 flex gap-3">
                <a 
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-xl font-bold transition-colors shadow-lg shadow-green-500/30 flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
                >
                  <MessageCircle className="w-5 h-5" />
                  Consultar por WhatsApp
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
