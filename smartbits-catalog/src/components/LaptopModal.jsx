import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Plus, ShieldCheck, BatteryCharging,
  Cpu, MemoryStick, Database, MonitorPlay,
  Monitor, LayoutDashboard, MessageCircle, ZoomIn
} from 'lucide-react';

export default function LaptopModal({ laptop, isOpen, onClose }) {
  const [showBars, setShowBars] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  const images = (laptop?.imagenes && laptop.imagenes.length > 0)
    ? laptop.imagenes
    : (laptop?.imagen ? [laptop.imagen] : []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setActiveImageIndex(0);
      setIsZoomed(false);
      setZoomLevel(1);
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
    ? "bg-blue-50 dark:bg-brand-900 text-brand-600 dark:text-brand-400 border border-blue-100 dark:border-brand-700"
    : "bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/50";

  const pScreen = laptop.estado.pantalla;
  const pBody = laptop.estado.carcasa;
  const screenTxt = laptop.touch.toLowerCase() === 'sí' || laptop.touch.toLowerCase() === 'si'
    ? `${laptop.pantalla} (Táctil)`
    : laptop.pantalla;

  const whatsappMessage = `Hola Smartbits, estoy interesado en el equipo ${laptop.modelo} listado a $${laptop.precio}. ¿Aún está disponible?`;
  const whatsappUrl = `https://wa.me/584128444445?text=${encodeURIComponent(whatsappMessage)}`;

  // Función para manejar el zoom interno
  const handleZoomClick = (e) => {
    e.stopPropagation();
    setZoomLevel(prev => prev === 1 ? 1.5 : 1);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-4 md:p-6 lg:p-8" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-brand-900/40 dark:bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
        onClick={handleBackdropClick}
      />

      {/* Modal Panel Container */}
      <div className="relative w-full max-w-6xl h-full sm:h-auto max-h-screen sm:max-h-[85vh] lg:max-h-[90vh] flex flex-col pointer-events-auto bg-white dark:bg-brand-950 sm:rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(15,23,42,0.25)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-welcome border border-brand-100/50 dark:border-brand-800/80 transition-colors duration-500">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 p-2 bg-white/80 dark:bg-brand-900/80 hover:bg-brand-50 dark:hover:bg-brand-800 rounded-full text-brand-800 dark:text-brand-300 transition-all border border-brand-100 dark:border-brand-700 backdrop-blur-sm group"
        >
          <X className="w-5 h-5 sm:w-6 h-6 group-hover:rotate-90 transition-transform" />
        </button>

        {/* Scrollable Content Area */}
        <div className="overflow-y-auto flex-grow h-full custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-[45%_55%] min-h-full">

            {/* Left Column: Photos */}
            <div className="bg-brand-50/50 dark:bg-brand-900/30 p-6 sm:p-8 lg:p-10 flex flex-col gap-6 border-b md:border-b-0 md:border-r border-brand-100/50 dark:border-brand-800 h-full">
              {/* Contenedor de Imagen con Lupa */}
              <div
                className="flex-grow aspect-[4/3] md:aspect-auto md:min-h-[400px] rounded-3xl overflow-hidden bg-white dark:bg-brand-900 shadow-sm border border-brand-100 dark:border-brand-800 relative group flex items-center justify-center cursor-zoom-in group-zoom"
                onClick={() => setIsZoomed(true)}
                title="Conocer más de cerca"
              >
                <img
                  src={images[activeImageIndex] || '/default-laptop.png'}
                  alt={laptop.modelo}
                  onError={(e) => { e.target.onerror = null; e.target.src = '/default-laptop.png'; }}
                  className="w-full h-full object-contain p-6 group-hover:scale-105 transition-all duration-700 ease-out"
                />
                <div className="absolute top-4 right-4 bg-white/90 dark:bg-brand-950/90 p-2 rounded-xl text-brand-600 dark:text-brand-400 backdrop-blur-sm shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-5 h-5" />
                </div>
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex flex-wrap justify-center gap-3">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-14 h-14 sm:w-20 lg:w-24 aspect-square bg-white dark:bg-brand-900 rounded-2xl border-2 transition-all overflow-hidden p-1.5 ${activeImageIndex === idx ? 'border-brand-600 dark:border-brand-500 shadow-md scale-95' : 'border-brand-100 dark:border-brand-800 hover:border-brand-300 dark:hover:border-brand-600 opacity-60 hover:opacity-100'
                        }`}
                    >
                      <img src={img || '/default-laptop.png'} onError={(e) => { e.target.onerror = null; e.target.src = '/default-laptop.png'; }} className="w-full h-full object-contain" alt={`thumb-${idx}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Details */}
            <div className="p-8 sm:p-12 lg:p-14 flex flex-col bg-white dark:bg-brand-950 transition-colors">
              <div className="mb-10">
                <p className="text-[10px] lg:text-xs font-black text-brand-400 dark:text-brand-500 uppercase tracking-[0.3em] mb-4">{laptop.marca}</p>
                <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black text-brand-800 dark:text-white leading-[1.05] mb-8 tracking-tighter">{laptop.modelo}</h3>

                <div className="flex flex-wrap items-center gap-8">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl lg:text-6xl font-black text-brand-900 dark:text-white tracking-tighter">${laptop.precio}</span>
                    <span className="text-sm font-bold text-brand-400 dark:text-brand-500">USD</span>
                  </div>
                  <span className={`px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest ${badgeClass}`}>
                    {laptop.disponibilidad}
                  </span>
                </div>
              </div>

              {/* Certification Box */}
              <div className="bg-brand-50 dark:bg-brand-900 border border-brand-100/60 dark:border-brand-800/80 rounded-[3rem] p-8 lg:p-12 mb-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-100/30 dark:bg-brand-800/30 rounded-full -mr-16 -mt-16 blur-3xl"></div>

                <h4 className="text-[11px] lg:text-xs font-black text-brand-800 dark:text-brand-300 flex items-center gap-4 mb-10 uppercase tracking-[0.2em]">
                  <div className="w-10 h-10 rounded-2xl bg-brand-600 dark:bg-brand-700 flex items-center justify-center shadow-lg shadow-brand-600/20">
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
                      <div className="flex justify-between text-xs lg:text-sm font-black text-brand-800 dark:text-brand-300 mb-4 uppercase tracking-wider">
                        <span>{st.label}</span>
                        <span className="text-brand-600 dark:text-brand-400">{st.val}/10</span>
                      </div>
                      <div className="w-full bg-brand-200/50 dark:bg-brand-800 rounded-full h-2">
                        <div
                          className="bg-brand-600 dark:bg-brand-500 h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ width: showBars ? `${st.val * 10}%` : '0%', transitionDelay: `${i * 150}ms` }}
                        />
                      </div>
                    </div>
                  ))}

                  {/* Battery */}
                  <div className="flex items-center justify-between pt-8 border-t border-brand-200/50 dark:border-brand-800">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-brand-950 border border-brand-100 dark:border-brand-800 flex items-center justify-center text-brand-600 dark:text-brand-400">
                        <BatteryCharging className="w-6 h-6" />
                      </div>
                      <span className="text-xs lg:text-sm font-black text-brand-800 dark:text-brand-300 uppercase tracking-widest">Salud Batería</span>
                    </div>
                    <span className="text-sm lg:text-xl font-black text-brand-900 dark:text-white uppercase tracking-tighter">{laptop.bateria}</span>
                  </div>
                </div>
              </div>

              {/* Specifications */}
              <h4 className="text-[10px] lg:text-xs font-black text-brand-400 dark:text-brand-600 mb-8 uppercase tracking-[0.4em]">Ficha Técnica</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-10 gap-x-12 mb-14">
                <SpecItem icon={Cpu} label="Procesador" value={laptop.cpu} />
                <SpecItem icon={MemoryStick} label="RAM" value={laptop.ram} />
                <SpecItem icon={Database} label="Almacenamiento" value={laptop.almacenamiento} />
                <SpecItem icon={MonitorPlay} label="Gráficos" value={laptop.gpu} />
                <SpecItem icon={Monitor} label="Pantalla" value={screenTxt} />
                <SpecItem icon={LayoutDashboard} label="Sistema" value={laptop.windows} />
              </div>

              {/* CTA Action */}
              <div className="mt-auto pt-10 border-t border-brand-100 dark:border-brand-800">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-brand-900 dark:bg-brand-800 hover:bg-brand-800 dark:hover:bg-brand-700 text-white py-6 px-10 rounded-3xl font-black transition-all shadow-2xl shadow-brand-900/20 dark:shadow-none flex items-center justify-center gap-5 text-lg lg:text-xl transform hover:-translate-y-1.5 active:translate-y-0 text-center"
                >
                  <MessageCircle className="w-8 h-8 text-brand-400 dark:text-brand-500" />
                  CONSULTAR DISPONIBILIDAD
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OVERLAY DEL ZOOM DE IMAGEN */}
      {isZoomed && createPortal(
        <div
          className="fixed inset-0 z-[10000] bg-white/95 dark:bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center cursor-zoom-out animate-in fade-in duration-300 overflow-auto"
          onClick={() => {
            setIsZoomed(false);
            setZoomLevel(1);
          }}
        >
          {/* Instrucción Visual */}
          <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-brand-900/80 dark:bg-brand-100/10 text-white text-xs px-4 py-2 rounded-full backdrop-blur-sm shadow-xl flex items-center gap-2 pointer-events-none z-[10001]">
            <ZoomIn className="w-4 h-4" />
            Haz clic para alternar el Zoom
          </div>

          <img
            src={images[activeImageIndex] || '/default-laptop.png'}
            alt="Zoom"
            onError={(e) => { e.target.onerror = null; e.target.src = '/default-laptop.png'; }}
            className="w-full h-full max-w-[95vw] max-h-[95vh] md:max-w-[85vw] md:max-h-[85vh] object-contain transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]"
            style={{ transform: `scale(${zoomLevel})`, cursor: zoomLevel === 1 ? 'zoom-in' : 'zoom-out' }}
            onClick={handleZoomClick}
          />

          <button
            className="fixed top-6 right-6 p-3 bg-brand-900/10 dark:bg-white/10 hover:bg-brand-900/20 dark:hover:bg-white/20 rounded-full text-brand-900 dark:text-white transition-all backdrop-blur-sm z-[10001]"
            onClick={(e) => { e.stopPropagation(); setIsZoomed(false); setZoomLevel(1); }}
          >
            <X className="w-8 h-8" />
          </button>
        </div>,
        document.body
      )}

    </div>
  );

  return createPortal(modalContent, document.body);
}

function SpecItem({ icon: Icon, label, value }) {
  return (
    <div className="flex gap-4 group">
      <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900 border border-brand-100 dark:border-brand-800 flex items-center justify-center text-brand-500 dark:text-brand-400 group-hover:bg-brand-600 dark:group-hover:bg-brand-600 group-hover:text-white transition-all duration-300 shadow-sm">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex flex-col justify-center">
        <p className="text-brand-400 dark:text-brand-500 text-[9px] font-bold uppercase tracking-[0.2em] mb-1">{label}</p>
        <p className="font-extrabold text-brand-800 dark:text-brand-200 text-xs sm:text-sm leading-tight tracking-tight">{value}</p>
      </div>
    </div>
  );
}
