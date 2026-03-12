import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, PackageSearch, X } from 'lucide-react';
import { mockLaptops } from '../data/mockLaptops';
import LaptopCard from '../components/LaptopCard';
import LaptopModal from '../components/LaptopModal';

export default function Catalog() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("Todas");
  const [selectedLaptop, setSelectedLaptop] = useState(null);

  const brands = ["Todas", ...new Set(mockLaptops.map(l => l.marca))];

  const filteredLaptops = useMemo(() => {
    return mockLaptops.filter(laptop => {
      const matchSearch = laptop.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          laptop.marca.toLowerCase().includes(searchTerm.toLowerCase());
      const matchBrand = selectedBrand === "Todas" || laptop.marca === selectedBrand;
      return matchSearch && matchBrand;
    });
  }, [searchTerm, selectedBrand]);

  return (
    <div className="animate-welcome">
      {/* Search Header */}
      <div className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
          <div className="max-w-xl">
            <h1 className="text-4xl md:text-5xl font-black text-brand-900 mb-4 tracking-tighter">
              Catálogo de Equipos
            </h1>
            <p className="text-brand-500 font-medium text-sm md:text-base leading-relaxed">
              Equipos corporativos certificados con garantía Smartbits. 
              Encuentra la potencia que tu productividad necesita.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-brand-50 rounded-full px-4 py-2 flex items-center gap-2 border border-brand-100">
               <PackageSearch className="w-5 h-5 text-brand-600" />
               <span className="text-xs font-black text-brand-800 uppercase tracking-widest">{filteredLaptops.length} Equipos</span>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center p-2 bg-white rounded-3xl border border-brand-100 shadow-xl shadow-brand-900/5">
          {/* Search Input */}
          <div className="lg:col-span-8 relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-400 w-5 h-5 transition-colors group-focus-within:text-brand-600" />
            <input 
              type="text"
              placeholder="¿Qué modelo estás buscando?"
              className="w-full bg-transparent pl-14 pr-12 py-5 rounded-2xl text-brand-900 placeholder:text-brand-300 font-medium focus:outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-300 hover:text-brand-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="hidden lg:block w-px h-10 bg-brand-100 col-span-1 place-self-center"></div>

          {/* Brand Filter */}
          <div className="lg:col-span-3 pb-2 lg:pb-0 px-4 lg:px-0">
            <div className="flex items-center gap-2 mb-2 lg:hidden">
              <SlidersHorizontal className="w-4 h-4 text-brand-500" />
              <span className="text-xs font-bold text-brand-500 uppercase">Marca</span>
            </div>
            <select 
              className="w-full bg-brand-50 lg:bg-transparent py-4 lg:py-0 px-4 lg:px-0 rounded-xl lg:rounded-none text-brand-800 font-black focus:outline-none cursor-pointer appearance-none"
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
            >
              {brands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>
        </div>
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
