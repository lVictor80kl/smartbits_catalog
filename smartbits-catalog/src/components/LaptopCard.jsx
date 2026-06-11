import { Cpu, MemoryStick, Database, ChevronRight, ChevronLeft } from 'lucide-react';
// 1. IMPORTA TU FUNCIÓN DE UTILIDADES AQUÍ (Ajusta la ruta según tus carpetas)
import { getCloudinaryUrl } from "../utils/imageOptimizer.js";
import { useState, useEffect, useCallback } from 'react';


export default function LaptopCard({ laptop, onClick }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const isAvailable = laptop.disponibilidad === "Disponible";
  const imageCount = laptop.imagenes?.length || (laptop.imagen ? 1 : 0);
  const hasGallery = imageCount > 1;

  const handlePrevImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : imageCount - 1));
  };

  const handleNextImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev < imageCount - 1 ? prev + 1 : 0));
  };

  const currentImage = laptop.imagenes && laptop.imagenes.length > 0
    ? laptop.imagenes[currentImageIndex]
    : (laptop.imagen || '/default-laptop.png');

  return (
    <div
      onClick={onClick}
      className="group bg-white dark:bg-brand-900 rounded-[2rem] border border-brand-100 dark:border-brand-800 hover:border-brand-300 dark:hover:border-brand-600 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col h-full hover:shadow-[0_20px_40px_-15px_rgba(30,41,59,0.1)] dark:hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.4)] transform hover:-translate-y-2 relative"
    >
      {/* Image Area con Carrusel */}
      <div className="aspect-[4/3] p-6 bg-brand-50/50 dark:bg-brand-800/50 overflow-hidden relative border-b border-brand-50 dark:border-brand-800/50 group/slider">
        {/* Badge disponibilidad */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border backdrop-blur-sm ${isAvailable ? 'bg-white/90 dark:bg-brand-950/80 text-brand-600 dark:text-brand-300 border-brand-100 dark:border-brand-700' : 'bg-white/90 dark:bg-brand-950/80 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900'}`}>
            {laptop.disponibilidad}
          </span>
        </div>

        {/* Imagen */}
        <img
          src={getCloudinaryUrl(currentImage, 'card') || '/default-laptop.png'}
          alt={laptop.modelo}
          loading="lazy"
          onError={(e) => { e.target.onerror = null; e.target.src = '/default-laptop.png'; }}
          className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110"
        />

        {/* Flechas del carrusel — solo si hay múltiples fotos */}
        {hasGallery && (
          <>
            <button
              onClick={handlePrevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/90 dark:bg-brand-800/90 text-brand-700 dark:text-brand-300 p-1.5 rounded-full shadow-md opacity-0 group-hover/slider:opacity-100 transition-opacity hover:bg-brand-50 dark:hover:bg-brand-700 border border-brand-100 dark:border-brand-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/90 dark:bg-brand-800/90 text-brand-700 dark:text-brand-300 p-1.5 rounded-full shadow-md opacity-0 group-hover/slider:opacity-100 transition-opacity hover:bg-brand-50 dark:hover:bg-brand-700 border border-brand-100 dark:border-brand-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Info Area */}
      <div className="p-7 flex flex-col flex-grow">
        <div className="mb-4">
          <p className="text-[10px] font-black text-brand-400 dark:text-brand-500 uppercase tracking-[0.2em] mb-1">{laptop.marca}</p>
          <h3 className="text-lg font-extrabold text-brand-800 dark:text-white leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2">{laptop.modelo}</h3>
        </div>

        {/* Quick Specs */}
        <div className="flex items-center gap-4 text-brand-500 dark:text-brand-400 mb-6 py-4 border-y border-brand-50 dark:border-brand-800/50">
          <div className="flex items-center gap-1.5" title="Procesador">
            <Cpu className="w-4 h-4 text-brand-400 dark:text-brand-500" />
            <span className="text-xs font-bold text-brand-800 dark:text-brand-200">{laptop.cpu.split(' ').slice(0, 3).join(' ')}</span>
          </div>
          <div className="flex items-center gap-1.5" title="RAM">
            <MemoryStick className="w-4 h-4 text-brand-400 dark:text-brand-500" />
            <span className="text-xs font-bold text-brand-800 dark:text-brand-200">
              {laptop.ram.split(' ').slice(0, 2).join(' ')}
            </span>
          </div>
          <div className="flex items-center gap-1.5" title="Almacenamiento">
            <Database className="w-4 h-4 text-brand-400 dark:text-brand-500" />
            <span className="text-xs font-bold text-brand-800 dark:text-brand-200">{laptop.almacenamiento.split(' ').slice(0, 2).join(' ')}</span>
          </div>
        </div>

        {/* Footer Card */}
        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-brand-900 dark:text-white tracking-tighter">${laptop.precio}</span>
            <span className="text-[10px] font-bold text-brand-400 dark:text-brand-500 uppercase">USD</span>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="bg-brand-900 hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500 text-white rounded-full px-4 py-1 text-[12px] font-bold transition-all hover:scale-105 ring-2 ring-brand-300 dark:ring-brand-400 hover:ring-brand-500"
          >
            Ver más
          </button>
        </div>
      </div>
    </div>
  );
}
