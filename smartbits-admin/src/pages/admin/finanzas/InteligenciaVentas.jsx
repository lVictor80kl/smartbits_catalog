import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, Laptop, Cpu, Percent, Award } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658'];

export default function InteligenciaVentas() {
  const [laptops, setLaptops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const snap = await getDocs(collection(db, 'laptops'));
      setLaptops(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Analizando datos de ventas...</div>;

  // Filtrar solo las vendidas
  const vendidas = laptops.filter(l => l.fecha_venta !== null && l.fecha_venta !== undefined);

  // Cálculo en vivo (no depende de campos guardados por cloud functions)
  const gananciaDe = (l) => (Number(l.precio_final_venta) || 0) - (Number(l.costo_total) || 0);
  const porcentajeDe = (l) => {
    const costo = Number(l.costo_total) || 0;
    const g = gananciaDe(l);
    return costo > 0 ? (g / costo) * 100 : 0;
  };
  const diasDe = (l) => {
    if (!l.fecha_compra || !l.fecha_venta) return 0;
    const fc = l.fecha_compra.toDate ? l.fecha_compra.toDate() : new Date(l.fecha_compra);
    const fv = l.fecha_venta.toDate ? l.fecha_venta.toDate() : new Date(l.fecha_venta);
    return Math.floor((fv.getTime() - fc.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Ganancia total
  const gananciaTotal = vendidas.reduce((sum, l) => sum + gananciaDe(l), 0);
  
  // Procesadores más vendidos
  const cpuCount = {};
  vendidas.forEach(l => {
    const cpu = l.procesador || 'Desconocido';
    cpuCount[cpu] = (cpuCount[cpu] || 0) + 1;
  });
  const cpuData = Object.keys(cpuCount).map(key => ({ name: key, value: cpuCount[key] })).sort((a,b) => b.value - a.value);

  // Marcas más vendidas
  const marcaCount = {};
  vendidas.forEach(l => {
    const marca = l.marca || 'Otra';
    marcaCount[marca] = (marcaCount[marca] || 0) + 1;
  });
  const marcaData = Object.keys(marcaCount).map(key => ({ name: key, value: marcaCount[key] })).sort((a,b) => b.value - a.value);

  // Días promedio en inventario
  const totalDias = vendidas.reduce((sum, l) => sum + diasDe(l), 0);
  const promDias = vendidas.length > 0 ? Math.round(totalDias / vendidas.length) : 0;

  // Top Modelos por Ganancia
  const topModelos = [...vendidas].sort((a, b) => gananciaDe(b) - gananciaDe(a)).slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col items-center justify-center text-center">
          <TrendingUp className="w-8 h-8 text-emerald-500 mb-2" />
          <p className="text-sm font-medium text-gray-500">Ganancia Acumulada</p>
          <h3 className="text-2xl font-black text-gray-900">${gananciaTotal.toFixed(2)}</h3>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col items-center justify-center text-center">
          <Laptop className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-sm font-medium text-gray-500">Laptops Vendidas</p>
          <h3 className="text-2xl font-black text-gray-900">{vendidas.length}</h3>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col items-center justify-center text-center">
          <Percent className="w-8 h-8 text-purple-500 mb-2" />
          <p className="text-sm font-medium text-gray-500">Promedio Días Inv.</p>
          <h3 className="text-2xl font-black text-gray-900">{promDias} días</h3>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col items-center justify-center text-center">
          <Award className="w-8 h-8 text-amber-500 mb-2" />
          <p className="text-sm font-medium text-gray-500">Mejor Marca</p>
          <h3 className="text-xl font-black text-gray-900">{marcaData[0]?.name || '-'}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart Marcas */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Ventas por Marca</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={marcaData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {marcaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart Procesadores */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Top Procesadores</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cpuData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{fill: '#f3f4f6'}} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sugerencias y Ranking */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Mejores Modelos (Mayor Ganancia Neta)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Modelo</th>
                <th className="px-4 py-3">Marca</th>
                <th className="px-4 py-3">Días Inv.</th>
                <th className="px-4 py-3 text-right">Costo</th>
                <th className="px-4 py-3 text-right">Venta</th>
                <th className="px-4 py-3 text-right">Ganancia</th>
                <th className="px-4 py-3 text-right">Margen</th>
              </tr>
            </thead>
            <tbody>
              {topModelos.map(l => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{l.item}</td>
                  <td className="px-4 py-3">{l.marca}</td>
                  <td className="px-4 py-3">{diasDe(l)}</td>
                  <td className="px-4 py-3 text-right">${l.costo_total?.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-medium">${l.precio_final_venta?.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">${gananciaDe(l).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-brand-600">{porcentajeDe(l).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
