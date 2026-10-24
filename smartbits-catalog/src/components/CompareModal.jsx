import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, GitCompareArrows, Crown, Gauge } from 'lucide-react';
import { getCloudinaryUrl } from '../utils/imageOptimizer.js';
import { percentDiff, formatPercent, powerBarClass } from '../utils/compare.js';

export default function CompareModal({ items, fields, getImage, bench, title = 'Comparar productos', onClose, onRemove }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!items || items.length < 2) return null;

  const base = items[0];

  const benchScores = bench
    ? items.map((item) => {
      const value = bench.get(item);
      return typeof value === 'number' ? value : null;
    })
    : [];
  const validScores = benchScores.filter((s) => typeof s === 'number');
  const maxScore = validScores.length ? Math.max(...validScores) : null;
  const topCount = maxScore !== null ? validScores.filter((s) => s === maxScore).length : 0;
  const hasData = validScores.length > 0;

  const isWinner = (score) => maxScore !== null && score === maxScore && topCount === 1;
  const isTie = (score) => maxScore !== null && score === maxScore && topCount > 1;

  const diffBadgeClass = (diff) => {
    if (diff > 0) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (diff < 0) return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    return 'bg-brand-100 text-brand-600 dark:bg-brand-800 dark:text-brand-300';
  };

  const headerSubtitle = bench
    ? (hasData
      ? 'Ganador por benchmark · Resto de características: % vs el primero'
      : 'Sin datos de benchmark para estos procesadores')
    : `Diferencial % respecto a ${base.modelo || base.nombre}`;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-4 md:p-6 lg:p-8" role="dialog" aria-modal="true">
      <div
        className="fixed inset-0 bg-brand-900/50 dark:bg-black/70 backdrop-blur-md animate-in fade-in duration-300"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      />

      <div className="relative w-full max-w-6xl h-full sm:h-auto max-h-screen sm:max-h-[90vh] flex flex-col bg-white dark:bg-brand-950 sm:rounded-[2rem] shadow-[0_25px_50px_-12px_rgba(15,23,42,0.25)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-welcome border border-brand-100/50 dark:border-brand-800/80">

        <div className="flex items-center justify-between gap-4 px-5 sm:px-8 py-4 border-b border-brand-100 dark:border-brand-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-900 dark:bg-brand-700 text-white flex items-center justify-center shrink-0">
              <GitCompareArrows className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-brand-900 dark:text-white truncate">{title}</h3>
              <p className="text-[11px] font-semibold text-brand-400 dark:text-brand-500">{headerSubtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-brand-100 dark:bg-brand-800 hover:bg-brand-200 dark:hover:bg-brand-700 rounded-full text-brand-800 dark:text-brand-300 transition-all"
            aria-label="Cerrar comparación"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-auto flex-grow custom-scrollbar">
          {bench && (
            <div className="px-4 sm:px-6 py-5 border-b border-brand-100 dark:border-brand-800 bg-brand-50/60 dark:bg-brand-900/30">
              <div className="flex items-center gap-2 mb-4">
                <Gauge className="w-4 h-4 text-brand-500" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-400 dark:text-brand-500">
                  {bench.label || 'Benchmark'} del procesador
                </h4>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${hasData ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-brand-100 text-brand-600 dark:bg-brand-800 dark:text-brand-300'}`}>
                  {hasData ? 'Benchmark real' : 'Sin datos'}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {items.map((item, idx) => {
                  const score = benchScores[idx];
                  const rel = typeof score === 'number' && maxScore ? (score / maxScore) * 100 : 0;
                  const winner = isWinner(score);
                  const tie = isTie(score);
                  const vsBest = maxScore !== null && typeof score === 'number' && score < maxScore
                    ? percentDiff(maxScore, score)
                    : null;

                  return (
                    <div
                      key={item.id}
                      className={`flex-1 min-w-[120px] rounded-2xl border p-3 bg-white dark:bg-brand-900 transition-colors ${
                        winner
                          ? 'border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-400/30'
                          : 'border-brand-100 dark:border-brand-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-brand-400 dark:text-brand-500 truncate">
                          {item.modelo || item.nombre}
                        </span>
                        {winner && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      </div>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-2xl font-black text-brand-900 dark:text-white tracking-tighter">
                          {typeof score === 'number' ? score.toFixed(2) : '—'}
                        </span>
                        <span className="text-[10px] font-bold text-brand-400 dark:text-brand-500">bench</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-brand-100 dark:bg-brand-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${powerBarClass(rel)} transition-all duration-700`}
                          style={{ width: `${rel}%` }}
                        />
                      </div>

                      {winner && (
                        <span className="inline-block mt-2 text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          Ganador
                        </span>
                      )}
                      {tie && (
                        <span className="inline-block mt-2 text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Empate
                        </span>
                      )}
                      {vsBest !== null && (
                        <p className="mt-1.5 text-[10px] font-black text-brand-500 dark:text-brand-400">
                          {formatPercent(vsBest)} vs el mejor
                        </p>
                      )}
                      {score === null && (
                        <span className="inline-block mt-2 text-[9px] font-black px-2 py-0.5 rounded-full bg-brand-100 text-brand-500 dark:bg-brand-800 dark:text-brand-400">
                          Sin dato
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white dark:bg-brand-950 px-4 sm:px-6 py-4 text-[10px] font-black uppercase tracking-wider text-brand-400 dark:text-brand-500 border-b border-brand-100 dark:border-brand-800 min-w-[120px]">
                  Característica
                </th>
                {items.map((item, idx) => {
                  const score = benchScores[idx];
                  return (
                    <th key={item.id} className="px-3 sm:px-5 py-4 border-b border-brand-100 dark:border-brand-800 align-top min-w-[160px]">
                      <div className="flex flex-col items-center gap-2">
                        <div className={`w-20 h-20 rounded-2xl overflow-hidden bg-brand-50 dark:bg-brand-900 border ${isWinner(score) ? 'border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-400/30' : 'border-brand-100 dark:border-brand-800'}`}>
                          <img
                            src={getCloudinaryUrl(getImage(item), 'card') || '/default-laptop.png'}
                            alt={item.modelo || item.nombre}
                            onError={(e) => { e.target.onerror = null; e.target.src = '/default-laptop.png'; }}
                            className="w-full h-full object-contain p-2"
                          />
                        </div>
                        <p className="text-xs font-black text-brand-800 dark:text-white leading-tight text-center line-clamp-2">
                          {item.modelo || item.nombre}
                        </p>
                        {isWinner(score) && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center gap-1">
                            <Crown className="w-3 h-3" /> Ganador
                          </span>
                        )}
                        <button
                          onClick={() => onRemove(item.id)}
                          className="text-[10px] font-bold text-brand-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Quitar
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.label} className="odd:bg-brand-50/40 dark:odd:bg-brand-900/30">
                  <td className="sticky left-0 z-10 bg-white dark:bg-brand-950 px-4 sm:px-6 py-4 text-[10px] sm:text-xs font-black uppercase tracking-wider text-brand-400 dark:text-brand-500 border-b border-brand-100 dark:border-brand-800">
                    {field.label}
                  </td>
                  {items.map((item, idx) => {
                    const raw = field.get(item);
                    const display = raw === null || raw === undefined || raw === '' ? '—' : raw;

                    let diff = null;
                    let benchValue = null;

                    if (field.isCpu) {
                      benchValue = field.benchParse ? field.benchParse(item) : null;
                      if (typeof benchValue === 'number' && maxScore !== null) {
                        diff = benchValue === maxScore ? 0 : percentDiff(maxScore, benchValue);
                      }
                    } else if (idx > 0 && field.parse) {
                      diff = percentDiff(field.parse(base), field.parse(item));
                    }

                    const cpuWinner = field.isCpu && typeof benchValue === 'number' && benchValue === maxScore && topCount === 1;
                    const cpuTie = field.isCpu && typeof benchValue === 'number' && benchValue === maxScore && topCount > 1;

                    return (
                      <td key={item.id} className="px-3 sm:px-5 py-4 border-b border-brand-100 dark:border-brand-800 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-brand-800 dark:text-brand-200 leading-snug">{display}</span>

                          {field.isCpu && typeof benchValue === 'number' && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-600 dark:bg-brand-800 dark:text-brand-300">
                              {benchValue.toFixed(2)} bench
                            </span>
                          )}

                          {cpuWinner && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              Ganador
                            </span>
                          )}
                          {cpuTie && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              Empate
                            </span>
                          )}
                          {!cpuWinner && !cpuTie && diff !== null && (
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${diffBadgeClass(diff)}`}>
                              {formatPercent(diff)}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body
  );
}
