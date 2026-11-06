import { useState } from 'react';
import { useCuentasCaja } from '../utils/useCuentasCaja';
import { TIPO_TASA } from '../services/tasasCambioService';
import { parseTasaInput, formatearDecimalInput } from '../utils/numeros';
import TasasCambioModal from './TasasCambioModal';
import { Settings2 } from 'lucide-react';

/**
 * Componente de acceso rápido para seleccionar tasas en notas de entrega,
 * transferencias, ventas y gastos.
 *
 * Props:
 * - valorActual: string o number con la tasa actualmente escrita en el formulario.
 * - onSeleccionar: (tasa: number, tipo: string) => void
 * - showConfigBtn: boolean (opcional, default true) para abrir el modal completo de tasas.
 */
export default function TasasChipsSelector({ valorActual, onSeleccionar, showConfigBtn = true }) {
  const { tasas, tasaCambio } = useCuentasCaja();
  const [modalOpen, setModalOpen] = useState(false);

  const numActual = parseTasaInput(valorActual);

  const chips = [
    {
      tipo: TIPO_TASA.BCV_USD,
      label: 'BCV $',
      icono: '🇻🇪',
      valor: tasas.bcv_usd
    },
    {
      tipo: TIPO_TASA.BCV_EUR,
      label: 'BCV €',
      icono: '🇪🇺',
      valor: tasas.bcv_eur
    },
    {
      tipo: TIPO_TASA.BINANCE,
      label: 'Binance',
      icono: '🟡',
      valor: tasas.binance_usdt
    },
    {
      tipo: TIPO_TASA.CUSTOM,
      label: 'Custom',
      icono: '✏️',
      valor: tasas.custom
    }
  ].filter(c => c.valor && c.valor > 0);

  // Si no hay tasas cargadas aún, agregamos la tasa de cambio tradicional
  if (chips.length === 0 && tasaCambio > 0) {
    chips.push({
      tipo: 'caja',
      label: 'Caja',
      icono: '💵',
      valor: tasaCambio
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500 mr-0.5">
        Atajos:
      </span>

      {chips.map(chip => {
        const isSelected = Math.abs(numActual - chip.valor) < 0.005;
        return (
          <button
            key={chip.tipo}
            type="button"
            onClick={() => onSeleccionar(chip.valor, chip.tipo)}
            title={`Usar tasa ${chip.label}: Bs ${formatearDecimalInput(chip.valor)}`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
              isSelected
                ? 'bg-brand-600 text-white border-brand-700 shadow-xs ring-1 ring-brand-400'
                : 'bg-white dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 border-slate-200 dark:border-gray-700'
            }`}
          >
            <span>{chip.icono}</span>
            <span>{chip.label}</span>
            <span className={isSelected ? 'text-brand-100' : 'text-slate-500 dark:text-gray-400 font-semibold'}>
              {formatearDecimalInput(chip.valor)}
            </span>
          </button>
        );
      })}

      {showConfigBtn && (
        <>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="p-1 text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-lg transition-colors ml-0.5 cursor-pointer"
            title="Configurar y actualizar tasas en vivo"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>

          <TasasCambioModal 
            isOpen={modalOpen} 
            onClose={() => setModalOpen(false)} 
          />
        </>
      )}
    </div>
  );
}
