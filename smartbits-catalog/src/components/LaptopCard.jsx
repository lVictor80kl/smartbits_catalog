import { Cpu, MemoryStick, Database, ArrowRight } from 'lucide-react';

export default function LaptopCard({ laptop, onClick }) {
  const isAvailable = laptop.disponibilidad === "Disponible";
  const badgeColor = isAvailable
    ? 'bg-green-100 text-green-700 border-green-200'
    : 'bg-orange-100 text-orange-700 border-orange-200';

  const shortCpu = `${laptop.cpu.split(' ')[0]} ${laptop.cpu.split(' ')[2] || ''}`;
  const shortRam = `${laptop.ram.split(' ')[0]} ${laptop.ram.split(' ')[1]}`;
  const shortStorage = laptop.almacenamiento.split(' ').slice(0, 3).join(' ');

  const mainImage = (laptop.imagenes && laptop.imagenes.length > 0) 
    ? laptop.imagenes[0] 
    : laptop.imagen;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col h-full group"
      onClick={() => onClick(laptop)}
    >
      {/* Imagen */}
      <div className="relative aspect-[4/3] bg-white p-4 flex items-center justify-center">
        <img
          src={mainImage}
          alt={laptop.modelo}
          className="max-w-full max-h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-4 left-4">
          <span className={`px-3 py-1 ${badgeColor} border text-xs font-bold rounded-full shadow-sm`}>
            {laptop.disponibilidad}
          </span>
        </div>
      </div>

      {/* Contenido Info */}
      <div className="p-5 flex flex-col flex-grow">
        <div className="mb-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{laptop.marca}</p>
          <h3 className="font-bold text-gray-900 leading-tight line-clamp-2">{laptop.modelo}</h3>
        </div>

        {/* Tags de Specs Resumidas */}
        <div className="flex flex-wrap gap-1 mt-3 mb-4">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-semibold">
            <Cpu className="w-3 h-3" /> {shortCpu}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-semibold">
            <MemoryStick className="w-3 h-3" /> {shortRam}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-semibold">
            <Database className="w-3 h-3" /> {shortStorage}
          </span>
        </div>

        <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Precio de Venta</p>
            <p className="text-xl font-extrabold text-blue-600">${laptop.precio}</p>
          </div>
          <div className="bg-blue-50 rounded-full p-2 h-10 w-10 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <ArrowRight className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
