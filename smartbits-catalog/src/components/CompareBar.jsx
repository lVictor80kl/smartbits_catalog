import { X, GitCompareArrows } from 'lucide-react';
import { getCloudinaryUrl } from '../utils/imageOptimizer.js';

export default function CompareBar({ items = [], getImage, max, canCompare, onCompare, onClear }) {
  if (items.length === 0) return null;

  const resolveImage = getImage || (() => '/default-laptop.png');

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-lg">
      <div className="flex items-center gap-3 bg-brand-900 dark:bg-brand-800 text-white rounded-2xl shadow-2xl shadow-brand-900/30 px-3 py-2.5 border border-brand-700 dark:border-brand-700">
        <div className="flex items-center gap-1.5 min-w-0">
          {items.map((item) => (
            <div
              key={item.id}
              className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 overflow-hidden shrink-0"
              title={item.modelo || item.nombre}
            >
              <img
                src={getCloudinaryUrl(resolveImage(item), 'thumb') || '/default-laptop.png'}
                alt={item.modelo || item.nombre}
                onError={(e) => { e.target.onerror = null; e.target.src = '/default-laptop.png'; }}
                className="w-full h-full object-contain p-0.5"
              />
            </div>
          ))}
          <span className="ml-1 text-[10px] font-bold text-brand-300 whitespace-nowrap shrink-0">
            {items.length}/{max}
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            onClick={onClear}
            className="p-1.5 rounded-full text-brand-300 hover:text-white hover:bg-brand-700 transition-colors"
            aria-label="Limpiar comparación"
            title="Limpiar"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={onCompare}
            disabled={!canCompare}
            className="bg-white text-brand-900 hover:bg-brand-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-full px-4 py-1.5 text-xs font-black transition-colors flex items-center gap-1.5"
          >
            <GitCompareArrows className="w-3.5 h-3.5" />
            Comparar
          </button>
        </div>
      </div>
    </div>
  );
}
