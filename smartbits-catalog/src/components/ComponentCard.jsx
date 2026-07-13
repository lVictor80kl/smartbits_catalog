import { getCloudinaryUrl } from "../utils/imageOptimizer.js";

const tipoBadgeColors = {
  RAM: 'bg-blue-100 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  SSD: 'bg-green-100 text-green-700 border-green-100 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  Bateria: 'bg-amber-100 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  Otros: 'bg-purple-100 text-purple-700 border-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
};

const tipoTextColors = {
  RAM: 'text-blue-600 dark:text-blue-400',
  SSD: 'text-green-600 dark:text-green-400',
  Bateria: 'text-amber-600 dark:text-amber-400',
  Otros: 'text-purple-600 dark:text-purple-400',
};

export default function ComponentCard({ component, onClick }) {
  const isAvailable = component.disponibilidad === "Disponible";
  const image = component.imagenes && component.imagenes.length > 0
    ? component.imagenes[0]
    : (component.imagen || '/default-laptop.png');

  return (
    <div
      onClick={onClick}
      className="group bg-white dark:bg-brand-900 rounded-[2rem] border border-brand-100 dark:border-brand-800 hover:border-brand-300 dark:hover:border-brand-600 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col h-full hover:shadow-[0_20px_40px_-15px_rgba(30,41,59,0.1)] dark:hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.4)] transform hover:-translate-y-2 relative"
    >
      <div className="aspect-[4/3] p-6 bg-brand-50/50 dark:bg-brand-800/50 overflow-hidden relative border-b border-brand-50 dark:border-brand-800/50">
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border backdrop-blur-sm ${isAvailable ? 'bg-white/90 dark:bg-brand-950/80 text-brand-600 dark:text-brand-300 border-brand-100 dark:border-brand-700' : 'bg-white/90 dark:bg-brand-950/80 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900'}`}>
            {component.disponibilidad}
          </span>
          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border backdrop-blur-sm ${tipoBadgeColors[component.tipo] || tipoBadgeColors.Otros}`}>
            {component.tipo}
          </span>
        </div>

        <img
          src={getCloudinaryUrl(image, 'card') || '/default-laptop.png'}
          alt={component.nombre}
          loading="lazy"
          onError={(e) => { e.target.onerror = null; e.target.src = '/default-laptop.png'; }}
          className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110"
        />
      </div>

      <div className="p-7 flex flex-col flex-grow">
        <div className="mb-4">
          <p className="text-[10px] font-black text-brand-400 dark:text-brand-500 uppercase tracking-[0.2em] mb-1">{component.marca || component.tipo}</p>
          <h3 className="text-lg font-extrabold text-brand-800 dark:text-white leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2">{component.nombre}</h3>
        </div>

        <div className="flex items-center gap-2 mb-6 py-4 border-y border-brand-50 dark:border-brand-800/50">
          <span className={`text-xs font-bold ${tipoTextColors[component.tipo] || 'text-brand-800 dark:text-brand-200'}`}>
            {component.tipo}
          </span>
          {component.capacidad && (
            <>
              <span className="text-brand-300 dark:text-brand-600">•</span>
              <span className="text-xs font-bold text-brand-800 dark:text-brand-200">{component.capacidad}</span>
            </>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-brand-900 dark:text-white tracking-tighter">${component.precio}</span>
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
