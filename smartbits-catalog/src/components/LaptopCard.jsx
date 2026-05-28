import { useState } from 'react';
import { Cpu, MemoryStick, Database, ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCloudinaryUrl } from '../utils/imageOptimizer.js';

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

  // Safe check for current image using either the array of `imagenes` or the fallback `imagen` string
  const currentImage = laptop.imagenes && laptop.imagenes.length > 0
    ? laptop.imagenes[currentImageIndex]
    : (laptop.imagen || '/default-laptop.png');

  return (
    <div
      onClick={onClick}
      className="flex flex-col h-full bg-white dark:bg-brand-900 premium-shadow rounded-[24px] p-6 cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative group"
    >
      {/* Etiqueta (Brand / Availability) */}
      <div className="flex justify-between items-start mb-4">
        <span className="text-[12px] font-semibold text-brand-500 uppercase tracking-widest">
          {laptop.marca}
        </span>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${isAvailable ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
          {laptop.disponibilidad}
        </span>
      </div>
      
      {/* Carrusel de Imágenes */}
      <div className="w-full relative flex justify-center mb-6 h-48 group/slider mt-2">
        <img 
          src={getCloudinaryUrl(currentImage, 'card') || '/default-laptop.png'}
          alt={laptop.modelo}
          loading="lazy"
          onError={(e) => { e.target.onerror = null; e.target.src = '/default-laptop.png'; }}
          className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-500 ease-out z-10"
        />

        {/* Badge de cantidad de fotos */}
        {hasGallery && (
          <div className="absolute top-2 left-2 z-20 bg-white/90 dark:bg-brand-800/90 backdrop-blur-sm px-2 py-1 rounded border border-brand-100 dark:border-brand-700 flex items-center gap-1.5 text-brand-700 dark:text-brand-300 text-xs font-semibold shadow-sm">
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{currentImageIndex + 1} / {imageCount}</span>
          </div>
        )}

        {/* Controles del Slider */}
        {hasGallery && (
          <>
            <button 
              onClick={handlePrevImage}
              className="absolute left-0 top-1/2 -translate-y-1/2 -ms-2 z-20 bg-white/90 dark:bg-brand-800/90 text-brand-700 dark:text-brand-300 p-2 rounded-full shadow-md opacity-0 group-hover/slider:opacity-100 transition-opacity hover:bg-brand-50 dark:hover:bg-brand-700 border border-brand-100 dark:border-brand-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={handleNextImage}
              className="absolute right-0 top-1/2 -translate-y-1/2 -me-2 z-20 bg-white/90 dark:bg-brand-800/90 text-brand-700 dark:text-brand-300 p-2 rounded-full shadow-md opacity-0 group-hover/slider:opacity-100 transition-opacity hover:bg-brand-50 dark:hover:bg-brand-700 border border-brand-100 dark:border-brand-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
      
      {/* Título Principal */}
      <h3 className="text-[20px] font-semibold leading-tight tracking-[-0.3px] mb-5 text-gray-900 dark:text-white line-clamp-2">
        {laptop.modelo}
      </h3>
      
      {/* Specs Icons */}
      <div className="flex flex-col gap-2.5 mb-6">
        <div className="flex items-center gap-3 text-[14px] text-gray-600 dark:text-brand-300 font-medium bg-brand-50 dark:bg-brand-800/50 p-2.5 rounded-lg">
           <Cpu className="w-4 h-4 text-brand-500" /> <span className="truncate">{laptop.cpu}</span>
        </div>
        <div className="flex items-center gap-3 text-[14px] text-gray-600 dark:text-brand-300 font-medium bg-brand-50 dark:bg-brand-800/50 p-2.5 rounded-lg">
           <MemoryStick className="w-4 h-4 text-brand-500" /> <span className="truncate">{laptop.ram}</span>
        </div>
        <div className="flex items-center gap-3 text-[14px] text-gray-600 dark:text-brand-300 font-medium bg-brand-50 dark:bg-brand-800/50 p-2.5 rounded-lg">
           <Database className="w-4 h-4 text-brand-500" /> <span className="truncate">{laptop.almacenamiento}</span>
        </div>
      </div>

      <div className="flex-grow"></div>

      {/* Footer: Price and CTA */}
      <div className="flex items-end justify-between pt-5 border-t border-gray-100 dark:border-brand-800 mt-auto">
        <div>
          <p className="text-[11px] font-semibold text-gray-500 dark:text-brand-400 uppercase tracking-widest mb-1">Precio</p>
          <div className="flex items-baseline gap-1">
            <span className="text-[22px] font-semibold text-brand-600 dark:text-brand-400 tracking-tight">
              ${laptop.precio}
            </span>
            <span className="text-[12px] font-bold text-gray-400 dark:text-brand-500">USD</span>
          </div>
        </div>
        
        <button 
           onClick={(e) => { e.stopPropagation(); onClick(); }}
           className="bg-brand-900 hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500 text-white rounded-full px-5 py-2.5 text-[14px] font-bold transition-all hover:scale-105"
        >
          Comprar
        </button>
      </div>
    </div>
  );
}
