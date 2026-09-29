import { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  Check, 
  DollarSign, 
  ShieldCheck, 
  Clock, 
  ExternalLink,
  Edit2,
  Loader2,
  Euro,
  Coins
} from 'lucide-react';
import { useCuentasCaja } from '../utils/useCuentasCaja';
import { TIPO_TASA } from '../services/tasasCambioService';

export default function TasasCambioModal({ isOpen, onClose }) {
  const { 
    tasas, 
    tasaCambio, 
    sincronizarTasasOnline, 
    fijarTasaPredeterminada, 
    actualizarTasaCustom 
  } = useCuentasCaja();

  const [loadingSync, setLoadingSync] = useState(false);
  const [customInput, setCustomInput] = useState(tasas.custom ? String(tasas.custom) : '');
  const [savingCustom, setSavingCustom] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-sincronizar al abrir si aún no hay tasas cargadas en el sistema
  useEffect(() => {
    if (isOpen && (!tasas.bcv_usd || !tasas.updated_at)) {
      handleSync();
    }
  }, [isOpen]);

  useEffect(() => {
    if (tasas.custom) {
      setCustomInput(String(tasas.custom));
    }
  }, [tasas.custom]);

  if (!isOpen) return null;

  const handleSync = async () => {
    setLoadingSync(true);
    setErrorMsg('');
    setMensajeExito('');
    try {
      const res = await sincronizarTasasOnline();
      setMensajeExito('Tasas actualizadas exitosamente desde BCV Oficial y Binance P2P.');
      if (res?.updatedTasas?.custom) {
        setCustomInput(String(res.updatedTasas.custom));
      }
    } catch (err) {
      console.error('Error al sincronizar tasas:', err);
      setErrorMsg('No se pudo conectar a los servicios de tasas. Puedes ingresar la tasa manualmente.');
    } finally {
      setLoadingSync(false);
    }
  };

  const handleSeleccionarActiva = async (tipoClave) => {
    setErrorMsg('');
    try {
      await fijarTasaPredeterminada(tipoClave);
      const nombre = tipoClave === TIPO_TASA.BCV_USD ? 'BCV Dólar' 
                   : tipoClave === TIPO_TASA.BCV_EUR ? 'BCV Euro'
                   : tipoClave === TIPO_TASA.BINANCE ? 'Binance P2P'
                   : 'Personalizada';
      setMensajeExito(`Tasa predeterminada cambiada a ${nombre}.`);
    } catch (err) {
      setErrorMsg(err.message || 'Error al cambiar tasa predeterminada.');
    }
  };

  const handleGuardarCustom = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSavingCustom(true);
    try {
      await actualizarTasaCustom(customInput);
      setMensajeExito('Tasa personalizada guardada correctamente.');
    } catch (err) {
      setErrorMsg(err.message || 'Error al guardar tasa personalizada.');
    } finally {
      setSavingCustom(false);
    }
  };

  const formatearFecha = (isoString) => {
    if (!isoString) return 'Sincronizando ahora...';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
    } catch {
      return isoString;
    }
  };

  const getNombreFuenteActiva = () => {
    switch (tasas.tasa_predeterminada) {
      case TIPO_TASA.BCV_USD: return 'BCV Dólar Oficial';
      case TIPO_TASA.BCV_EUR: return 'BCV Euro Oficial';
      case TIPO_TASA.BINANCE: return 'Binance P2P (USDT)';
      case TIPO_TASA.CUSTOM: return 'Personalizada (Manual)';
      default: return 'Binance P2P';
    }
  };

  const itemsTasas = [
    {
      key: TIPO_TASA.BCV_USD,
      titulo: 'BCV Dólar Oficial',
      badgeMoneda: 'USD',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icono: <DollarSign className="w-5 h-5 text-emerald-600" />,
      valor: tasas.bcv_usd,
      fuente: 'Banco Central de Venezuela (DolarApi)',
      linkAuditoria: 'https://ve.dolarapi.com/v1/dolares/oficial'
    },
    {
      key: TIPO_TASA.BCV_EUR,
      titulo: 'BCV Euro Oficial',
      badgeMoneda: 'EUR',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      icono: <Euro className="w-5 h-5 text-blue-600" />,
      valor: tasas.bcv_eur,
      fuente: 'Banco Central de Venezuela (DolarApi)',
      linkAuditoria: 'https://ve.dolarapi.com/v1/euros/oficial'
    },
    {
      key: TIPO_TASA.BINANCE,
      titulo: 'Binance P2P (USDT)',
      badgeMoneda: 'USDT',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      icono: <Coins className="w-5 h-5 text-amber-600" />,
      valor: tasas.binance_usdt,
      fuente: 'CriptoYa Binance P2P (VES)',
      linkAuditoria: 'https://criptoya.com/ve'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 my-auto">
        
        {/* Cabecera del Modal con Alto Contraste (Fija, no se oculta) */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                Tasas de Cambio en Venezuela
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  En Vivo
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
                Consulta automática segura y definición de la tasa activa de la caja
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de acción rápida y estatus (Fija) */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Última sinc: <strong className="text-slate-900 font-bold">{formatearFecha(tasas.updated_at)}</strong></span>
          </div>

          <button
            onClick={handleSync}
            disabled={loadingSync}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSync ? 'animate-spin' : ''}`} />
            <span>{loadingSync ? 'Sincronizando...' : 'Actualizar Tasas Ahora'}</span>
          </button>
        </div>

        {/* Cuerpo del Modal con Scroll Interno Responsivo */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1 overscroll-contain">
          {/* Mensajes de Feedback */}
          {mensajeExito && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs flex items-center gap-2.5 font-medium shadow-xs">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{mensajeExito}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-300 text-red-800 rounded-2xl text-xs font-medium shadow-xs flex items-center justify-between">
              <span>{errorMsg}</span>
              <button 
                onClick={handleSync} 
                className="underline font-bold text-red-900 hover:text-red-950 ml-2 cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* BANNER DE TASA ACTIVA: FONDO SÓLIDO OSCURO DE ALTO CONTRASTE (Cero degradados lavados) */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  Tasa Predeterminada de la Caja
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white tracking-tight">
                  Bs {tasaCambio.toFixed(2)}
                </span>
                <span className="text-xs text-slate-300 font-semibold">
                  por cada $1.00 USD
                </span>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-3.5 sm:text-right shrink-0">
              <div className="text-xs text-slate-300">
                Fuente activa: <strong className="text-white font-bold bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700 ml-1 inline-block">{getNombreFuenteActiva()}</strong>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Aplica a conversiones de caja, notas de entrega y arqueos
              </p>
            </div>
          </div>

          {/* Grid de Tasas Oficiales y P2P con Skeletons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {itemsTasas.map((item) => {
              const esActiva = tasas.tasa_predeterminada === item.key;
              const tieneValor = item.valor && item.valor > 0;

              return (
                <div 
                  key={item.key}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                    esActiva 
                      ? 'border-emerald-500 bg-emerald-50/30 shadow-md ring-2 ring-emerald-500/20' 
                      : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div>
                    {/* Header de la tarjeta con icono y badge */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        {item.icono}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                          {item.badgeMoneda}
                        </span>
                        {esActiva && (
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3 text-emerald-700" /> Activa
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-800 text-xs mb-1.5">{item.titulo}</h3>

                    {/* Valor o Skeleton animado */}
                    {loadingSync && !tieneValor ? (
                      <div className="py-1">
                        <div className="h-7 w-28 bg-slate-200 rounded-lg animate-pulse mb-1.5" />
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin text-emerald-600" /> Consultando...
                        </span>
                      </div>
                    ) : (
                      <div className="text-2xl font-black text-slate-900 mb-1">
                        {tieneValor ? `Bs ${item.valor.toFixed(2)}` : (
                          <span className="text-sm font-bold text-slate-400">No disponible</span>
                        )}
                      </div>
                    )}

                    <p className="text-[10px] text-slate-500 line-clamp-1 mb-3" title={item.fuente}>
                      {item.fuente}
                    </p>
                  </div>

                  {/* Acciones */}
                  <div className="space-y-2 pt-2.5 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={!tieneValor || esActiva || loadingSync}
                      onClick={() => handleSeleccionarActiva(item.key)}
                      className={`w-full py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        esActiva
                          ? 'bg-emerald-600 text-white shadow-xs cursor-default'
                          : 'bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      {esActiva ? 'Tasa Actual de Caja' : 'Fijar como Activa'}
                    </button>

                    <a
                      href={item.linkAuditoria}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-slate-500 hover:text-emerald-700 flex items-center justify-center gap-1 font-semibold transition-colors"
                    >
                      <span>Auditar fuente</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tarjeta de Tasa Personalizada / Custom (Mercado Acordado) */}
          <div className={`p-4 rounded-2xl border-2 transition-all ${
            tasas.tasa_predeterminada === TIPO_TASA.CUSTOM 
              ? 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-400/20' 
              : 'border-slate-200 bg-white'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-100 text-amber-800 font-bold text-sm">
                  <Edit2 className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    Tasa Personalizada (Acordada entre Personas / Mercado)
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    Puedes fijar libremente una tasa manual personalizada cuando negocies con clientes o socios
                  </p>
                </div>
              </div>

              {tasas.tasa_predeterminada === TIPO_TASA.CUSTOM && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-900 bg-amber-200 px-2.5 py-0.5 rounded-full shrink-0">
                  <Check className="w-3 h-3" /> Activa en Caja
                </span>
              )}
            </div>

            <form onSubmit={handleGuardarCustom} className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[140px]">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">Bs</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Ej: 980.00"
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={savingCustom || !customInput}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                {savingCustom ? 'Guardando...' : 'Guardar Valor'}
              </button>

              <button
                type="button"
                disabled={tasas.tasa_predeterminada === TIPO_TASA.CUSTOM || !tasas.custom}
                onClick={() => handleSeleccionarActiva(TIPO_TASA.CUSTOM)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                  tasas.tasa_predeterminada === TIPO_TASA.CUSTOM
                    ? 'bg-amber-600 text-white cursor-default'
                    : 'bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                Fijar como Activa
              </button>
            </form>
          </div>

          {/* Información de Seguridad */}
          <div className="flex items-center gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Consultas protegidas por HTTPS con sanitización de tipo y timeout de seguridad de 6 segundos.
            </span>
          </div>

        </div>

        {/* Footer (Fijo) */}
        <div className="p-3.5 sm:p-4 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
