import { useState, useMemo, useEffect } from 'react';
import { Search, SlidersHorizontal, PackageSearch, X, Loader2, Filter, Cpu } from 'lucide-react';
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
  const [selectedDisponibilidad, setSelectedDisponibilidad] = useState("Todas");
  const [maxPrice, setMaxPrice] = useState(1500);
  const [selectedLaptop, setSelectedLaptop] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Cargar datos reales desde Firestore
  useEffect(() => {
    const q = query(collection(db, 'laptops'), orderBy('creadoEn', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const laptopData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLaptops(laptopData);
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
      // Búsqueda inteligente
      let parsedSearch = searchTerm.toLowerCase()
        .replace(/décima generación|décima generacion|decima generación|decima generacion/g, "10th gen")
        .replace(/undécima generación|undecima generacion/g, "11th gen")
        .replace(/duodécima generación|duodecima generacion/g, "12th gen")
        .replace(/octava generación|octava generacion/g, "8th gen")
        .replace(/novena generación|novena generacion/g, "9th gen")
        .replace(/séptima generación|septima generacion/g, "7th gen");

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

      const laptopDisp = laptop.disponibilidad || "";
      const matchDisp = selectedDisponibilidad === "Todas" || laptopDisp === selectedDisponibilidad;

      return matchSearch && matchBrand && matchRam && matchStorage && matchCpu && matchPrice && matchDisp;
    }).sort((a, b) => {
      const getDispWeight = (disp) => {
        if (!disp) return 4;
        const d = disp.toLowerCase();
        if (d === 'disponible') return 1;
        if (d === 'coming soon') return 2;
        if (d === 'no disponible') return 3;
        return 4;
      };
      return getDispWeight(a.disponibilidad) - getDispWeight(b.disponibilidad);
    });
  }, [laptops, searchTerm, selectedBrand, selectedRam, selectedStorage, selectedCpu, maxPrice, selectedDisponibilidad]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 dark:bg-brand-950">
        <Loader2 className="w-12 h-12 text-brand-600 dark:text-brand-400 animate-spin" />
        <p className="text-brand-500 dark:text-brand-400 font-bold uppercase tracking-widest text-xs">Cargando catálogo real...</p>
      </div>
    );
  }

  return (
    <div className="animate-welcome transition-colors duration-500">
      {/* Search Header */}
      <div className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
          <div className="max-w-xl">
            <h1 className="text-4xl md:text-5xl font-black text-brand-900 dark:text-white mb-4 tracking-tighter">
              Catálogo Smartbits
            </h1>
            <p className="text-brand-500 dark:text-brand-400 font-medium text-sm md:text-base leading-relaxed">
              "Compra inteligente, compra en Smartbits". 
              Encuentra equipos corporativos certificados con la mejor garantía del mercado.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             {import.meta.env.DEV && (
              <button 
                onClick={migrateMockToFirestore}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all mr-4"
                title="Subir laptops de prueba a la base de datos real"
              >
                Migrar Datos Reales
              </button>
            )}
            <div className="bg-brand-50 dark:bg-brand-900 rounded-full px-4 py-2 flex items-center gap-2 border border-brand-100 dark:border-brand-800">
               <PackageSearch className="w-5 h-5 text-brand-600 dark:text-brand-400" />
               <span className="text-xs font-black text-brand-800 dark:text-brand-200 uppercase tracking-widest">{filteredLaptops.length} Equipos encontrados</span>
            </div>
          </div>
        </div>

        {/* Search & Main Filter Bar */}
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 items-center p-2 rounded-3xl border-2 transition-all hover:border-brand-300 dark:hover:border-brand-600 focus-within:ring-4 focus-within:ring-brand-600/5 ${showFilters ? 'bg-brand-50 dark:bg-brand-900 border-brand-300 dark:border-brand-600 shadow-md' : 'bg-white dark:bg-brand-900 border-brand-200 dark:border-brand-800 shadow-2xl shadow-brand-900/10'}`}>
          <div className="lg:col-span-8 relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-600 dark:text-brand-400 w-6 h-6 transition-colors group-focus-within:text-brand-800 dark:group-focus-within:text-brand-200" />
            <input 
              type="text"
              placeholder="Ej. i5, 16gb, 512gb, Lenovo..."
              className="w-full bg-transparent pl-16 pr-12 py-6 rounded-2xl text-brand-900 dark:text-white placeholder:text-brand-400 dark:placeholder:text-brand-600 font-bold text-lg focus:outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-6 top-1/2 -translate-y-1/2 text-brand-300 dark:text-brand-600 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="hidden lg:block w-px h-10 bg-brand-100 dark:bg-brand-800 col-span-1 place-self-center"></div>

          <div className="lg:col-span-3 flex items-center justify-center h-full px-4">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`w-full flex items-center justify-center gap-3 py-3 rounded-2xl font-black text-xs uppercase transition-all ${
                showFilters 
                ? 'bg-brand-900 dark:bg-brand-600 text-white shadow-lg' 
                : 'bg-brand-50 dark:bg-brand-950 text-brand-800 dark:text-brand-300 border-2 border-brand-100 dark:border-brand-800 hover:border-brand-200 dark:hover:border-brand-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtros Avanzados
            </button>
          </div>
        </div>

        {/* Advanced Filters Drawer/Section */}
        {showFilters && (
          <div className="bg-brand-50/50 dark:bg-brand-900/50 border border-brand-100 dark:border-brand-800 rounded-3xl p-6 mb-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-8 animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Brand */}
            <div>
              <label className="block text-[10px] font-black text-brand-400 dark:text-brand-500 uppercase tracking-widest mb-3">Marca</label>
              <select 
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full bg-white dark:bg-brand-950 px-4 py-3 rounded-xl border border-brand-100 dark:border-brand-800 text-sm font-bold text-brand-800 dark:text-white outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-colors"
              >
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Processor */}
            <div>
              <label className="block text-[10px] font-black text-brand-400 dark:text-brand-500 uppercase tracking-widest mb-3">Procesador</label>
              <select 
                value={selectedCpu}
                onChange={(e) => setSelectedCpu(e.target.value)}
                className="w-full bg-white dark:bg-brand-950 px-4 py-3 rounded-xl border border-brand-100 dark:border-brand-800 text-sm font-bold text-brand-800 dark:text-white outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-colors"
              >
                {cpuOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* RAM */}
            <div>
              <label className="block text-[10px] font-black text-brand-400 dark:text-brand-500 uppercase tracking-widest mb-3">Memoria RAM</label>
              <select 
                value={selectedRam}
                onChange={(e) => setSelectedRam(e.target.value)}
                className="w-full bg-white dark:bg-brand-950 px-4 py-3 rounded-xl border border-brand-100 dark:border-brand-800 text-sm font-bold text-brand-800 dark:text-white outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-colors"
              >
                {ramOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Storage */}
            <div>
              <label className="block text-[10px] font-black text-brand-400 dark:text-brand-500 uppercase tracking-widest mb-3">Disco</label>
              <select 
                value={selectedStorage}
                onChange={(e) => setSelectedStorage(e.target.value)}
                className="w-full bg-white dark:bg-brand-950 px-4 py-3 rounded-xl border border-brand-100 dark:border-brand-800 text-sm font-bold text-brand-800 dark:text-white outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-colors"
              >
                {storageOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Disponibilidad */}
            <div>
              <label className="block text-[10px] font-black text-brand-400 dark:text-brand-500 uppercase tracking-widest mb-3">Disponibilidad</label>
              <select 
                value={selectedDisponibilidad}
                onChange={(e) => setSelectedDisponibilidad(e.target.value)}
                className="w-full bg-white dark:bg-brand-950 px-4 py-3 rounded-xl border border-brand-100 dark:border-brand-800 text-sm font-bold text-brand-800 dark:text-white outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-colors"
              >
                {["Todas", "Disponible", "Coming soon", "No disponible"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Price Slider */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-[10px] font-black text-brand-400 dark:text-brand-500 uppercase tracking-widest">Precio Máx</label>
                <span className="text-sm font-black text-brand-900 dark:text-white">${maxPrice}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="2500" 
                step="50"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full h-2 bg-brand-200 dark:bg-brand-700 rounded-lg appearance-none cursor-pointer accent-brand-600 dark:accent-brand-500"
              />
              <div className="flex justify-between text-[8px] text-brand-300 dark:text-brand-600 font-bold mt-2">
                <span>$0</span>
                <span>$2500+</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      {filteredLaptops.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredLaptops.map(laptop => (
            <LaptopCard 
              key={laptop.id} 
              laptop={laptop} 
              onClick={() => setSelectedLaptop(laptop)}
            />
          ))}
        </div>
      ) : (
        <div className="py-24 flex flex-col items-center justify-center text-center opacity-40 dark:opacity-60">
          <div className="w-24 h-24 rounded-full bg-brand-50 dark:bg-brand-900 flex items-center justify-center mb-6">
            <Search className="w-12 h-12 text-brand-800 dark:text-brand-400" />
          </div>
          <h3 className="text-2xl font-black text-brand-900 dark:text-white mb-2">No encontramos equipos</h3>
          <p className="text-brand-500 dark:text-brand-400 font-bold uppercase tracking-widest text-xs">Prueba ajustando los filtros de búsqueda</p>
        </div>
      )}

      {/* Modal Selection */}
      <LaptopModal 
        laptop={selectedLaptop}
        isOpen={!!selectedLaptop}
        onClose={() => setSelectedLaptop(null)}
      />
    </div>
  );
}
