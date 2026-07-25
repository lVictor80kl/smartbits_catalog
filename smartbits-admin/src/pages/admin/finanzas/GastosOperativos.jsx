import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { TrendingDown, Calendar, PlusCircle, AlertCircle } from 'lucide-react';

export default function GastosOperativos() {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    categoria: 'publicidad',
    concepto: '',
    monto: '',
    metodo_pago: 'efectivo' // vinculada a una cuenta en caja
  });

  useEffect(() => {
    const q = query(collection(db, 'gastos_operativos'), orderBy('fecha', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGastos(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.monto || !formData.concepto) return alert("Completa todos los campos");
    
    setSaving(true);
    try {
      const montoNum = Number(formData.monto);
      
      // 1. Guardar el gasto
      await addDoc(collection(db, 'gastos_operativos'), {
        ...formData,
        monto: montoNum,
        fecha: serverTimestamp()
      });

      // 2. Reducir de la caja correspondiente si aplica
      if (formData.metodo_pago) {
        const cajaRef = doc(db, 'caja', 'saldos');
        const cajaSnap = await getDoc(cajaRef);
        const cajaData = cajaSnap.exists() ? cajaSnap.data() : {};
        const currentValue = Number(cajaData[formData.metodo_pago] || 0);
        await setDoc(cajaRef, {
          [formData.metodo_pago]: currentValue - montoNum,
          updated_at: new Date()
        }, { merge: true });
      }

      setFormData({ categoria: 'publicidad', concepto: '', monto: '', metodo_pago: 'efectivo' });
      alert("Gasto operativo registrado y descontado de la caja seleccionada.");
    } catch (e) {
      console.error(e);
      alert("Error al guardar");
    }
    setSaving(false);
  };

  const totalMesActual = gastos.filter(g => {
    if (!g.fecha) return false;
    const date = g.fecha.toDate();
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).reduce((a,b) => a + (b.monto||0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Resumen */}
      <div className="bg-orange-50 border border-orange-100 rounded-xl p-6 flex items-center justify-between">
        <div>
          <p className="text-orange-600 text-sm font-bold uppercase tracking-wider">Gastos Operativos del Mes</p>
          <h3 className="text-3xl font-black text-orange-700 mt-1">${totalMesActual.toFixed(2)}</h3>
        </div>
        <TrendingDown className="w-10 h-10 text-orange-200" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sticky top-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
              <PlusCircle className="w-5 h-5 text-brand-600" />
              Registrar Gasto del Negocio
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select 
                  value={formData.categoria}
                  onChange={e => setFormData({...formData, categoria: e.target.value})}
                  className="w-full border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="publicidad">Publicidad (Ads)</option>
                  <option value="gasolina">Gasolina / Transporte</option>
                  <option value="envio">Envíos y Deliverys</option>
                  <option value="software">Software / Hosting</option>
                  <option value="otros">Otros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Concepto</label>
                <input 
                  type="text" 
                  value={formData.concepto}
                  onChange={e => setFormData({...formData, concepto: e.target.value})}
                  placeholder="Ej: Meta Ads Quincena"
                  className="w-full border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (USD)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.monto}
                    onChange={e => setFormData({...formData, monto: e.target.value})}
                    className="w-full pl-8 border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descontar de la cuenta:</label>
                <select 
                  value={formData.metodo_pago}
                  onChange={e => setFormData({...formData, metodo_pago: e.target.value})}
                  className="w-full border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="bancamiga">Bancamiga</option>
                  <option value="zelle">Zelle</option>
                  <option value="binance">Binance</option>
                  <option value="zinli">Zinli</option>
                  <option value="bolivares_bs">Otros Bs</option>
                  <option value="caja_envios">Caja Envíos</option>
                  <option value="">No descontar (Ya ajustado manualmente)</option>
                </select>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mt-2">
                <p className="text-xs text-blue-800 flex gap-2 items-start">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                  Este gasto afecta al capital base de Smartbits, dividiendo su impacto 50/50 entre los socios.
                </p>
              </div>

              <button 
                type="submit" 
                disabled={saving}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 rounded-lg transition-colors mt-2"
              >
                {saving ? 'Guardando...' : 'Registrar Gasto'}
              </button>
            </div>
          </form>
        </div>

        {/* Lista */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-slate-800">Historial de Gastos Operativos</h3>
            </div>
            
            {loading ? (
              <div className="p-8 text-center text-gray-500">Cargando historial...</div>
            ) : gastos.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No hay gastos registrados</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Categoría</th>
                      <th className="px-4 py-3">Concepto</th>
                      <th className="px-4 py-3">Cuenta</th>
                      <th className="px-4 py-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastos.map(gasto => (
                      <tr key={gasto.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {gasto.fecha ? new Date(gasto.fecha.toDate()).toLocaleDateString() : 'Pendiente'}
                        </td>
                        <td className="px-4 py-3 capitalize">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            {gasto.categoria}
                          </span>
                        </td>
                        <td className="px-4 py-3">{gasto.concepto}</td>
                        <td className="px-4 py-3 capitalize">{gasto.metodo_pago || 'N/A'}</td>
                        <td className="px-4 py-3 text-right font-bold text-orange-600">
                          ${gasto.monto?.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
