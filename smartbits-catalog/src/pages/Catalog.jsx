import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronDown, PackageSearch, X, Loader2 } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { migrateMockToFirestore } from '../data/migrateData';
import LaptopCard from '../components/LaptopCard';
import LaptopModal from '../components/LaptopModal';

export default function Catalog() {
  const [laptops, setLaptops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("Todas");
  const [selectedCpu, setSelectedCpu] = useState("Todos");
  const [selectedRam, setSelectedRam] = useState("Todas");
  const [selectedStorage, setSelectedStorage] = useState("Todas");
  const [maxPrice, setMaxPrice] = useState(2500);
  const [selectedLaptop, setSelectedLaptop] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'laptops'), orderBy('creadoEn', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const laptopData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      const normalized = laptopData.map(l => {
        if (l.marca && l.marca.toLowerCase() === 'hp') {
          return { ...l, marca: 'HP' };
        }
        return l;
      });
      setLaptops(normalized);
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener laptops:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const brands = ["Todas", ...new Set(laptops.map(l => l.marca))];
  const cpuOptions = ["Todos", "Intel Core i3", "Intel Core i5", "Intel Core i7", "Intel Core i9", "AMD Ryzen 3", "AMD Ryzen 5", "AMD Ryzen 7", "AMD Ryzen 9"];
  const ramOptions = ["Todas", "8 Gb", "12 Gb", "16 Gb", "32 Gb"];
  const storageOptions = ["Todas", "256 Gb", "512 Gb", "1 Tb", "2 Tb"];

  const filteredLaptops = useMemo(() => {
    return laptops.filter(laptop => {
      let parsedSearch = searchTerm.toLowerCase();
      const searchWords = parsedSearch.split(' ').filter(w => w.trim() !== '');
      const matchSearch = searchWords.every(word => {
        const fullText = `${laptop.modelo} ${laptop.marca} ${laptop.cpu} ${laptop.ram} ${laptop.almacenamiento}`.toLowerCase();
        return fullText.includes(word);
      });

      const matchBrand = selectedBrand === "Todas" || laptop.marca === selectedBrand;
      const laptopCpu = (laptop.cpu || "").toLowerCase();
      const matchCpu = selectedCpu === "Todos" || laptopCpu.includes(selectedCpu.toLowerCase());
      const laptopRam = (laptop.ram || "").toLowerCase();
      const matchRam = selectedRam === "Todas" || laptopRam.includes(selectedRam.toLowerCase());
      const laptopStorage = (laptop.almacenamiento || "").toLowerCase();
      const matchStorage = selectedStorage === "Todas" || laptopStorage.includes(selectedStorage.toLowerCase());
      const matchPrice = Number(laptop.precio) <= maxPrice;

      return matchSearch && matchBrand && matchRam && matchStorage && matchCpu && matchPrice;
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
  }, [laptops, searchTerm, selectedBrand, selectedRam, selectedStorage, selectedCpu, maxPrice]);

  const chunkedLaptops = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < filteredLaptops.length; i += 2) {
      chunks.push(filteredLaptops.slice(i, i + 2));
    }
    return chunks;
  }, [filteredLaptops]);

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-brand-50 dark:bg-brand-950">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-4" />
        <p className="text-sm font-semibold text-brand-500">Cargando catálogo...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50 dark:bg-brand-950 w-full transition-colors duration-500 pt-[44px]">
      
      {/* Clean Hero Section - Tech / Brand Styled */}
      <section className="w-full flex flex-col items-center justify-center px-6 text-center pt-16 pb-8 md:pt-20 md:pb-10 bg-white dark:bg-brand-900 border-b border-brand-100 dark:border-brand-800">
        <h1 className="text-3xl md:text-5xl font-extrabold text-brand-800 dark:text-white mb-2 tracking-tight">
          Catálogo Smartbits
        </h1>
        <p className="text-sm md:text-base text-brand-500 dark:text-brand-300 max-w-2xl text-balance">
          Encuentra el equipo ideal para ti. Filtra por características, explora detalles completos y compra con confianza.
        </p>
        
        {import.meta.env.DEV && (
            <button
              onClick={migrateMockToFirestore}
              className="mt-4 px-3 py-1.5 bg-transparent border border-brand-300 text-brand-500 hover:text-brand-800 hover:border-brand-500 rounded-full text-xs font-semibold transition-colors dark:border-brand-700 dark:text-brand-300 dark:hover:text-white dark:hover:border-brand-500"
            >
              Migrar Datos Reales (Dev)
            </button>
        )}
      </section>

      {/* Main Container */}
      <div className="w-full max-w-[1400px] mx-auto px-6 py-6 md:py-10">
        
        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          
          <div className="relative w-full max-w-md">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por modelo, marca o especificaciones..."
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
          
          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className="w-full md:w-auto text-sm font-bold text-brand-800 dark:text-white bg-white dark:bg-brand-900 border border-brand-100 dark:border-brand-800 px-6 py-3.5 rounded-full flex items-center justify-center gap-2 shadow-sm hover:bg-brand-100 dark:hover:bg-brand-800 transition-colors shrink-0"
          >
            Filtros Avanzados <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Inline Advanced Filters */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full mb-10 p-6 bg-white dark:bg-brand-900 rounded-3xl border border-brand-100 dark:border-brand-800 shadow-sm text-left animate-in fade-in slide-in-from-top-4">
            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-brand-400 dark:text-brand-300 mb-2">Marca</label>
              <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className="w-full bg-brand-50 dark:bg-brand-800 px-4 py-3 rounded-xl border-none outline-none text-sm text-brand-800 dark:text-white font-medium cursor-pointer">
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-brand-400 dark:text-brand-300 mb-2">Procesador</label>
              <select value={selectedCpu} onChange={(e) => setSelectedCpu(e.target.value)} className="w-full bg-brand-50 dark:bg-brand-800 px-4 py-3 rounded-xl border-none outline-none text-sm text-brand-800 dark:text-white font-medium cursor-pointer">
                {cpuOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-brand-400 dark:text-brand-300 mb-2">RAM</label>
              <select value={selectedRam} onChange={(e) => setSelectedRam(e.target.value)} className="w-full bg-brand-50 dark:bg-brand-800 px-4 py-3 rounded-xl border-none outline-none text-sm text-brand-800 dark:text-white font-medium cursor-pointer">
                {ramOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-brand-400 dark:text-brand-300 mb-2">Disco</label>
              <select value={selectedStorage} onChange={(e) => setSelectedStorage(e.target.value)} className="w-full bg-brand-50 dark:bg-brand-800 px-4 py-3 rounded-xl border-none outline-none text-sm text-brand-800 dark:text-white font-medium cursor-pointer">
                {storageOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs uppercase font-bold tracking-wider text-brand-400 dark:text-brand-300 mb-3">Precio Max: ${maxPrice}</label>
              <input type="range" min="0" max="2500" step="50" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
          </div>
        )}

        {/* Grid Store Layout */}
        <div className="mb-8">
           <p className="text-sm font-semibold text-brand-500 dark:text-brand-300 mb-6 pl-2">Mostrando {filteredLaptops.length} resultados</p>
           {filteredLaptops.length > 0 ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {filteredLaptops.map(laptop => (
                 <LaptopCard 
                   key={laptop.id} 
                   laptop={laptop} 
                   onClick={() => setSelectedLaptop(laptop)} 
                 />
               ))}
             </div>
           ) : (
             <div className="w-full min-h-[40vh] flex flex-col items-center justify-center bg-white dark:bg-brand-900 rounded-3xl border border-brand-100 dark:border-brand-800 p-12 text-center">
               <PackageSearch className="w-12 h-12 text-brand-400 mb-4" />
               <h2 className="text-xl font-bold text-brand-800 dark:text-white mb-2">No se encontraron equipos</h2>
               <p className="text-sm text-brand-500 dark:text-brand-300">Intenta cambiar los filtros o el término de búsqueda.</p>
             </div>
           )}
        </div>
      </div>

      {/* Modal Selection */}
      {selectedLaptop && (
        <LaptopModal
          laptop={selectedLaptop}
          isOpen={!!selectedLaptop}
          onClose={() => setSelectedLaptop(null)}
        />
      )}
    </div>
  );
}
