import { useState } from 'react';
import { useCuentasCaja } from '../utils/useCuentasCaja';
import { TIPO_TASA } from '../services/tasasCambioService';
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

  const numActual = typeof valorActual === 'number' ? valorActual : parseFloat(String(valorActual || '').trim().replace(',', '.'));

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
      <span className="text-[10px] uppercase font-bold text-slate-400 mr-0.5">
        Atajos:
      </span>

      {chips.map(chip => {
        const isSelected = Math.abs(numActual - chip.valor) < 0.005;
        return (
          <button
            key={chip.tipo}
            type="button"
            onClick={() => onSeleccionar(chip.valor, chip.tipo)}
            title={`Usar tasa ${chip.label}: Bs ${chip.valor.toFixed(2)}`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all border ${
              isSelected
                ? 'bg-brand-600 text-white border-brand-700 shadow-xs ring-1 ring-brand-400'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <span>{chip.icono}</span>
            <span>{chip.label}</span>
            <span className={isSelected ? 'text-brand-100' : 'text-slate-500 font-semibold'}>
              {chip.valor.toFixed(2)}
            </span>
          </button>
        );
      })}

      {showConfigBtn && (
        <>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ml-0.5"
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
