import { useState, useMemo, useEffect } from 'react';
import { Search, SlidersHorizontal, PackageSearch, X, Loader2, Filter } from 'lucide-react';
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
  const [selectedRam, setSelectedRam] = useState("Todas");
  const [selectedStorage, setSelectedStorage] = useState("Todas");
  const [maxPrice, setMaxPrice] = useState(1000);
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
  const ramOptions = ["Todas", "8 Gb", "12 Gb", "16 Gb", "32 Gb"];
  const storageOptions = ["Todas", "256 Gb", "512 Gb", "1 Tb"];

  const filteredLaptops = useMemo(() => {
    return laptops.filter(laptop => {
      const matchSearch = laptop.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          laptop.marca.toLowerCase().includes(searchTerm.toLowerCase());
      const matchBrand = selectedBrand === "Todas" || laptop.marca === selectedBrand;
      
      // Filtro de RAM (buscando coincidencia en el string, ej: "16 Gb DDR4")
      const laptopRam = (laptop.ram || "").toLowerCase();
      const matchRam = selectedRam === "Todas" || laptopRam.includes(selectedRam.toLowerCase());
      
      // Filtro de Almacenamiento
      const laptopStorage = (laptop.almacenamiento || "").toLowerCase();
      const matchStorage = selectedStorage === "Todas" || laptopStorage.includes(selectedStorage.toLowerCase());
      
      // Filtro de Precio
      const matchPrice = Number(laptop.precio) <= maxPrice;

      return matchSearch && matchBrand && matchRam && matchStorage && matchPrice;
    });
  }, [laptops, searchTerm, selectedBrand, selectedRam, selectedStorage, maxPrice]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-brand-600 animate-spin" />
        <p className="text-brand-500 font-bold uppercase tracking-widest text-xs">Cargando catálogo real...</p>
      </div>
    );
  }

  return (
    <div className="animate-welcome">
      {/* Search Header */}
      <div className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
          <div className="max-w-xl">
            <h1 className="text-4xl md:text-5xl font-black text-brand-900 mb-4 tracking-tighter">
              Catálogo Smartbits
            </h1>
            <p className="text-brand-500 font-medium text-sm md:text-base leading-relaxed">
              "Compra inteligente, compra en Smartbits". 
              Encuentra equipos corporativos certificados con la mejor garantía del mercado.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             {import.meta.env.DEV && (
              <button 
                onClick={migrateMockToFirestore}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all mr-4"
                title="Subir laptops de prueba a la base de datos real"
              >
                Migrar Datos Reales
              </button>
            )}
            <div className="bg-brand-50 rounded-full px-4 py-2 flex items-center gap-2 border border-brand-100">
               <PackageSearch className="w-5 h-5 text-brand-600" />
               <span className="text-xs font-black text-brand-800 uppercase tracking-widest">{filteredLaptops.length} Equipos encontrados</span>
            </div>
          </div>
        </div>

        {/* Search & Main Filter Bar - RESALTADO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center p-2 bg-white rounded-3xl border-2 border-brand-200 shadow-2xl shadow-brand-900/10 mb-8 transition-all hover:border-brand-300 focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-600/5">
          <div className="lg:col-span-8 relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-600 w-6 h-6 transition-colors group-focus-within:text-brand-800" />
            <input 
              type="text"
              placeholder="¿Qué modelo estás buscando?"
              className="w-full bg-transparent pl-16 pr-12 py-6 rounded-2xl text-brand-900 placeholder:text-brand-400 font-bold text-lg focus:outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-6 top-1/2 -translate-y-1/2 text-brand-300 hover:text-brand-600">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="hidden lg:block w-px h-10 bg-brand-100 col-span-1 place-self-center"></div>

          <div className="lg:col-span-3 flex items-center justify-center h-full px-4">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`w-full flex items-center justify-center gap-3 py-3 rounded-2xl font-black text-xs uppercase transition-all ${
                showFilters ? 'bg-brand-900 text-white shadow-lg' : 'bg-brand-50 text-brand-800 border-2 border-brand-100 hover:border-brand-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtros Avanzados
            </button>
          </div>
        </div>

        {/* Advanced Filters Drawer/Section */}
        {showFilters && (
          <div className="bg-brand-50/50 border border-brand-100 rounded-3xl p-6 mb-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Brand */}
            <div>
              <label className="block text-[10px] font-black text-brand-400 uppercase tracking-widest mb-3">Marca</label>
              <select 
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full bg-white px-4 py-3 rounded-xl border border-brand-100 text-sm font-bold text-brand-800 outline-none"
              >
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* RAM */}
            <div>
              <label className="block text-[10px] font-black text-brand-400 uppercase tracking-widest mb-3">Memoria RAM</label>
              <select 
                value={selectedRam}
                onChange={(e) => setSelectedRam(e.target.value)}
                className="w-full bg-white px-4 py-3 rounded-xl border border-brand-100 text-sm font-bold text-brand-800 outline-none"
              >
                {ramOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Storage */}
            <div>
              <label className="block text-[10px] font-black text-brand-400 uppercase tracking-widest mb-3">Disco</label>
              <select 
                value={selectedStorage}
                onChange={(e) => setSelectedStorage(e.target.value)}
                className="w-full bg-white px-4 py-3 rounded-xl border border-brand-100 text-sm font-bold text-brand-800 outline-none"
              >
                {storageOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Price Slider */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Precio Máx</label>
                <span className="text-sm font-black text-brand-900">${maxPrice}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1500" 
                step="50"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full h-2 bg-brand-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
              />
              <div className="flex justify-between text-[8px] text-brand-300 font-bold mt-2">
                <span>$0</span>
                <span>$1500+</span>
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
        <div className="py-24 flex flex-col items-center justify-center text-center opacity-40">
          <div className="w-24 h-24 rounded-full bg-brand-50 flex items-center justify-center mb-6">
            <Search className="w-12 h-12 text-brand-800" />
          </div>
          <h3 className="text-2xl font-black text-brand-900 mb-2">No encontramos equipos</h3>
          <p className="text-brand-500 font-bold uppercase tracking-widest text-xs">Prueba ajustando los filtros de búsqueda</p>
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
