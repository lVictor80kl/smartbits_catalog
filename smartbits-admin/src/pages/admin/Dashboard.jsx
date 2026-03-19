import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { PlusCircle, Edit, Trash2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [laptops, setLaptops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [filterDisp, setFilterDisp] = useState('Todas');
  const [priceSort, setPriceSort] = useState('default');

  useEffect(() => {
    const q = query(collection(db, 'laptops'), orderBy('modelo'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLaptops(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id, modelo) => {
    if (!confirm(`¿Seguro que quieres eliminar "${modelo}" del inventario? Esta acción es irreversible.`)) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'laptops', id));
    } catch (err) {
      alert('Error al eliminar el equipo: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredLaptops = laptops
    .filter(laptop => {
      if (filterDisp === 'Todas') return true;
      return laptop.disponibilidad === filterDisp;
    })
    .sort((a, b) => {
      if (priceSort === 'asc') return a.precio - b.precio;
      if (priceSort === 'desc') return b.precio - a.precio;
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario de Equipos</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? 'Cargando...' : `${filteredLaptops.length} equipo${filteredLaptops.length !== 1 ? 's' : ''} mostrado${filteredLaptops.length !== 1 ? 's' : ''} (de ${laptops.length} en total)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            to="/admin/sync" 
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            Sincronizar Sheets
          </Link>
          <Link 
            to="/admin/new" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <PlusCircle className="w-5 h-5" />
            Añadir Laptop
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Filtros */}
        {!loading && laptops.length > 0 && (
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex flex-wrap items-center gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1">Disponibilidad</label>
              <select 
                value={filterDisp} 
                onChange={(e) => setFilterDisp(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="Todas">Todas</option>
                <option value="Disponible">Disponible</option>
                <option value="Coming soon">Coming soon</option>
                <option value="No disponible">No disponible</option>
              </select>
            </div>
            
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1">Precio</label>
              <select 
                value={priceSort} 
                onChange={(e) => setPriceSort(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="default">Orden original</option>
                <option value="asc">Menor a mayor</option>
                <option value="desc">Mayor a menor</option>
              </select>
            </div>
          </div>
        )}
        {loading ? (
          <div className="py-24 flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Cargando inventario...</p>
          </div>
        ) : laptops.length === 0 ? (
          <div className="py-24 text-center text-gray-400">
            <p className="font-medium text-gray-500">No hay equipos registrados aún.</p>
            <Link to="/admin/new" className="mt-3 inline-block text-blue-600 hover:underline text-sm font-medium">
              Añade tu primer equipo →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Equipo</th>
                  <th className="px-6 py-4 font-semibold">Specs Rápidas</th>
                  <th className="px-6 py-4 font-semibold">Precio / Est. Visual</th>
                  <th className="px-6 py-4 font-semibold">Disponibilidad</th>
                  <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLaptops.map(laptop => (
                  <tr key={laptop.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center p-1 shrink-0">
                          <img 
                            src={laptop.imagen || '/default-laptop.png'} 
                            alt={laptop.modelo} 
                            onError={(e) => { e.target.onerror = null; e.target.src = '/default-laptop.png'; }}
                            className="max-h-full max-w-full object-contain" 
                          />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 line-clamp-1">{laptop.modelo}</div>
                          <div className="text-xs text-gray-500">{laptop.marca}</div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-xs">
                      <div className="text-gray-900 font-medium line-clamp-1 truncate max-w-[150px]" title={laptop.cpu}>{laptop.cpu}</div>
                      <div className="text-gray-500">{laptop.ram} • {laptop.almacenamiento}</div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">${laptop.precio}</div>
                      <div className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded inline-block mt-1">
                        P: {laptop.estado?.pantalla ?? laptop.estadoPantalla}/10 | C: {laptop.estado?.carcasa ?? laptop.estadoCarcasa}/10
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        laptop.disponibilidad === 'Disponible' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {laptop.disponibilidad}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/edit/${laptop.id}`}
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleDelete(laptop.id, laptop.modelo)}
                          disabled={deletingId === laptop.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="Eliminar"
                        >
                          {deletingId === laptop.id 
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
