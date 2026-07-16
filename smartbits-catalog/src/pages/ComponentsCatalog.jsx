import { useState, useMemo, useEffect } from 'react';
import { Search, PackageSearch, X, Loader2 } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import ComponentCard from '../components/ComponentCard';
import ComponentModal from '../components/ComponentModal';

export default function ComponentsCatalog() {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('Todos');
  const [selectedComponent, setSelectedComponent] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'componentes'), orderBy('creadoEn', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComponents(data);
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener componentes:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const tipos = ['Todos', 'RAM', 'SSD', 'Bateria', 'Teclado', 'Mouse'];

  const filteredComponents = useMemo(() => {
    return components.filter(comp => {
      const searchWords = searchTerm.toLowerCase().split(' ').filter(w => w.trim() !== '');
      const matchSearch = searchWords.every(word => {
        const fullText = `${comp.nombre} ${comp.marca} ${comp.tipo}`.toLowerCase();
        return fullText.includes(word);
      });

      const matchTipo = selectedTipo === 'Todos' || comp.tipo === selectedTipo;

      return matchSearch && matchTipo;
    }).sort((a, b) => {
      const getDispWeight = (disp) => {
        if (!disp) return 4;
        const d = disp.toLowerCase();
        if (d === 'disponible') return 1;
        if (d === 'coming soon') return 2;
        if (d === 'no disponible') return 3;
        return 4;
      };
      const weightA = getDispWeight(a.disponibilidad);
      const weightB = getDispWeight(b.disponibilidad);
      if (weightA !== weightB) return weightA - weightB;
      return Number(a.precio) - Number(b.precio);
    });
  }, [components, searchTerm, selectedTipo]);

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-brand-50 dark:bg-brand-950">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-4" />
        <p className="text-sm font-semibold text-brand-500">Cargando componentes...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50 dark:bg-brand-950 w-full transition-colors duration-500 pt-[44px]">

      <section className="w-full flex flex-col items-center justify-center px-6 text-center pt-6 pb-4 bg-white dark:bg-brand-900 border-b border-brand-100 dark:border-brand-800">
        <h1 className="contrail-one-regular main-color text-3xl md:text-2xl font-bold text-brand-600 dark:text-white mb-4 tracking-tight animate-welcome">
          Componentes Smartbits
        </h1>
        <p className="text-lg text-brand-800 dark:text-brand-100 max-w-1x1 text-center contrail-one-regular  ">
          {"Accesorios y repuestos para tu equipo".split(" ").map((word, i) => (
            <span key={i} className="stagger-word" style={{ '--word-index': i }}>
              {word}
            </span>
          ))}
        </p>
      </section>

      <div className="w-full max-w-[1400px] mx-auto px-6 py-12">

        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">

          <div className="relative w-full max-w-md">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, marca o tipo..."
              className="w-full bg-white dark:bg-brand-900 text-brand-800 dark:text-white rounded-full py-3.5 pl-12 pr-10 text-sm font-medium border border-brand-100 dark:border-brand-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-600 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-600 dark:hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-10 justify-center">
          {tipos.map(tipo => (
            <button
              key={tipo}
              onClick={() => setSelectedTipo(tipo)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
                selectedTipo === tipo
                  ? 'bg-brand-900 dark:bg-brand-700 text-white shadow-lg shadow-brand-900/20 dark:shadow-brand-700/30'
                  : 'bg-white dark:bg-brand-900 text-brand-800 dark:text-brand-200 border border-brand-100 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-800'
              }`}
            >
              {tipo}
            </button>
          ))}
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold text-brand-500 dark:text-brand-300 mb-6 pl-2">Mostrando {filteredComponents.length} resultados</p>
          {filteredComponents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredComponents.map(comp => (
                <ComponentCard
                  key={comp.id}
                  component={comp}
                  onClick={() => setSelectedComponent(comp)}
                />
              ))}
            </div>
          ) : (
            <div className="w-full min-h-[40vh] flex flex-col items-center justify-center bg-white dark:bg-brand-900 rounded-3xl border border-brand-100 dark:border-brand-800 p-12 text-center">
              <PackageSearch className="w-12 h-12 text-brand-400 mb-4" />
              <h2 className="text-xl font-bold text-brand-800 dark:text-white mb-2">No se encontraron componentes</h2>
              <p className="text-sm text-brand-500 dark:text-brand-300">Intenta cambiar los filtros o el término de búsqueda.</p>
            </div>
          )}
        </div>
      </div>

      {selectedComponent && (
        <ComponentModal
          component={selectedComponent}
          isOpen={!!selectedComponent}
          onClose={() => setSelectedComponent(null)}
        />
      )}
    </div>
  );
}
