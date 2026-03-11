import { useState, useEffect } from 'react';
import { Search, PackageX, Loader2 } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import LaptopCard from '../components/LaptopCard';
import LaptopModal from '../components/LaptopModal';

export default function Catalog() {
  const [laptops, setLaptops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFilter, setCurrentFilter] = useState('all');

  const [selectedLaptop, setSelectedLaptop] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Suscripción en tiempo real a Firestore
  useEffect(() => {
    const q = query(collection(db, 'laptops'), orderBy('modelo'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLaptops(data);
      setLoading(false);
    }, (error) => {
      console.error('Error cargando laptops:', error);
      setLoading(false);
    });
    // Limpiar la suscripción cuando el componente se desmonta
    return () => unsubscribe();
  }, []);

  // Filtrado
  const filteredLaptops = laptops.filter(laptop => {
    const matchesFilter = currentFilter === 'all' || laptop.disponibilidad === currentFilter;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      laptop.modelo.toLowerCase().includes(searchLower) ||
      laptop.marca.toLowerCase().includes(searchLower) ||
      laptop.cpu.toLowerCase().includes(searchLower);

    return matchesFilter && matchesSearch;
  });

  const handleOpenModal = (laptop) => {
    setSelectedLaptop(laptop);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedLaptop(null), 300); // Limpiar después de la animación
  };

  const filters = [
    { id: 'all', label: 'Todas' },
    { id: 'Disponible', label: 'Disponibles' },
    { id: 'Coming soon', label: 'Próximamente' },
  ];

  return (
    <div className="w-full">
      {/* Header de Sección y Filtros */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Catálogo de Laptops</h2>
          <p className="mt-2 text-gray-500 max-w-2xl">
            Descubre nuestro inventario de equipos usados y nuevos. Todos inspeccionados y con garantía de calidad visual y técnica.
          </p>
        </div>

        {/* Buscador Integrado (Móvil prioritario, pero visible en desktop tb) */}
        <div className="flex flex-col gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-full leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all sm:text-sm shadow-sm"
              placeholder="Buscar por modelo, marca o CPU..."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => setCurrentFilter(f.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${currentFilter === f.id
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de Laptops */}
      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center gap-4 text-gray-400">
          <Loader2 className="w-10 h-10 animate-spin text-brand-400" />
          <p className="text-sm font-medium">Cargando inventario...</p>
        </div>
      ) : filteredLaptops.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredLaptops.map(laptop => (
            <LaptopCard
              key={laptop.id}
              laptop={laptop}
              onClick={handleOpenModal}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <PackageX className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-bold text-gray-900 mb-1">No se encontraron equipos</h3>
          <p className="text-gray-500">Intenta ajustar los filtros o el término de búsqueda.</p>
          <button
            onClick={() => { setSearchQuery(''); setCurrentFilter('all'); }}
            className="mt-4 text-blue-600 font-medium hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Modal */}
      <LaptopModal
        laptop={selectedLaptop}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
