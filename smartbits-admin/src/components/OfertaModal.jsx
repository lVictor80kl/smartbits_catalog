import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Flame, X, Loader2 } from 'lucide-react';

export default function OfertaModal({ open, item, collectionName = 'componentes', onClose, onSaved }) {
  const [enOferta, setEnOferta] = useState(false);
  const [precioOferta, setPrecioOferta] = useState('');
  const [etiquetaOferta, setEtiquetaOferta] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item && open) {
      setEnOferta(Boolean(item.en_oferta));
      setPrecioOferta(
        item.precio_oferta
          ? item.precio_oferta.toString()
          : item.precio
            ? Math.round(Number(item.precio) * 0.85).toString()
            : ''
      );
      setEtiquetaOferta(item.etiqueta_oferta || '');
      setSaving(false);
    }
  }, [item, open]);

  if (!open || !item) return null;

  const itemName = item.nombre || item.modelo || 'Elemento';
  const regularPrice = Number(item.precio) || 0;
  const precioOfertaNum = Number(precioOferta);

  const handleGuardarOferta = async (e) => {
    e.preventDefault();
    if (enOferta && (isNaN(precioOfertaNum) || precioOfertaNum <= 0)) {
      alert('Ingresa un precio de oferta válido.');
      return;
    }

    setSaving(true);
    try {
      const itemRef = doc(db, collectionName, item.id);
      await updateDoc(itemRef, {
        en_oferta: enOferta,
        precio_oferta: enOferta ? precioOfertaNum : null,
        etiqueta_oferta: enOferta ? (etiquetaOferta.trim() || '') : '',
        updatedAt: new Date().toISOString()
      });

      if (onSaved) onSaved({ ...item, en_oferta: enOferta, precio_oferta: enOferta ? precioOfertaNum : null, etiqueta_oferta: etiquetaOferta });
      onClose();
    } catch (err) {
      console.error('Error al actualizar oferta:', err);
      alert('Error al actualizar oferta: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const calculatedDiscountPct = regularPrice > 0 && precioOfertaNum > 0 && precioOfertaNum < regularPrice
    ? Math.round(((regularPrice - precioOfertaNum) / regularPrice) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 border border-gray-100 space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
              <Flame className="w-5 h-5 fill-orange-500 text-orange-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 leading-tight">Configurar Oferta</h3>
              <p className="text-xs text-gray-500">Destaca este producto en el catálogo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Producto info */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-between text-xs">
          <div className="min-w-0 pr-2">
            <span className="font-bold text-gray-800 truncate block" title={itemName}>{itemName}</span>
            <span className="text-gray-500">{item.tipo || item.marca || ''}</span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Precio Actual</span>
            <span className="font-black text-gray-900 text-sm">${regularPrice} USD</span>
          </div>
        </div>

        <form onSubmit={handleGuardarOferta} className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-200">
            <span className="text-xs font-bold text-orange-950">Activar Oferta en Catálogo</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enOferta}
                onChange={(e) => setEnOferta(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
            </label>
          </div>

          {enOferta && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Precio Promocional ($USD)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-orange-600 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={precioOferta}
                    onChange={(e) => setPrecioOferta(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
                    required={enOferta}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Texto del Badge (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: OFERTA IMPERDIBLE, PRECIO ESPECIAL..."
                  value={etiquetaOferta}
                  onChange={(e) => setEtiquetaOferta(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">Si lo dejas en blanco se mostrará el porcentaje calculado (ej. -15% OFF).</p>
              </div>

              {regularPrice > 0 && precioOfertaNum > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Badge a mostrar:</span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-xs">
                    {etiquetaOferta.trim() || (calculatedDiscountPct > 0 ? `-${calculatedDiscountPct}% OFF` : 'OFERTA')}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs sm:text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs sm:text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-orange-600/20 transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Guardando...' : 'Guardar Oferta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
