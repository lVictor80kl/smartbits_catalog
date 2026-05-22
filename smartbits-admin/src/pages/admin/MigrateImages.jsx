import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { compressImage } from '../../utils/imageOptimizer';
import { 
  CloudLightning, 
  Database, 
  Play, 
  Pause, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowLeft,
  Terminal,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MigrateImages() {
  const [laptops, setLaptops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [currentLaptopIndex, setCurrentLaptopIndex] = useState(-1);
  const [progress, setProgress] = useState({
    totalLaptops: 0,
    laptopsNeeded: 0,
    laptopsMigrated: 0,
    totalImages: 0,
    imagesMigrated: 0,
    failures: []
  });
  
  const [logs, setLogs] = useState([]);
  const consoleEndRef = useRef(null);

  // Cargar todos los equipos y analizar cuáles tienen Cloudinary
  const loadLaptops = async () => {
    setLoading(true);
    setLogs([]);
    try {
      addLog('Analizando base de datos en Firestore...', 'info');
      const querySnapshot = await getDocs(collection(db, 'laptops'));
      const allLaptops = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setLaptops(allLaptops);

      // Filtrar laptops que usan Cloudinary en 'imagenes' o 'imagen'
      const needed = allLaptops.filter(laptop => {
        const imgs = laptop.imagenes || (laptop.imagen ? [laptop.imagen] : []);
        return imgs.some(url => url && url.includes('cloudinary.com'));
      });

      let totalCloudImages = 0;
      needed.forEach(laptop => {
        const imgs = laptop.imagenes || (laptop.imagen ? [laptop.imagen] : []);
        const cloudCount = imgs.filter(url => url && url.includes('cloudinary.com')).length;
        totalCloudImages += cloudCount;
      });

      setProgress({
        totalLaptops: allLaptops.length,
        laptopsNeeded: needed.length,
        laptopsMigrated: 0,
        totalImages: totalCloudImages,
        imagesMigrated: 0,
        failures: []
      });

      addLog(`Análisis completado. Laptops en total: ${allLaptops.length}`, 'success');
      if (needed.length > 0) {
        addLog(`Se encontraron ${needed.length} laptops que usan Cloudinary (${totalCloudImages} imágenes en total).`, 'warn');
      } else {
        addLog('¡Excelente! No hay laptops utilizando Cloudinary actualmente en la base de datos.', 'success');
      }
    } catch (err) {
      console.error(err);
      addLog(`Error al cargar datos: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLaptops();
  }, []);

  // Scroll automático en la consola
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  // Lógica principal de migración secuencial
  const startMigration = async () => {
    if (migrating) return;
    setMigrating(true);
    addLog('Iniciando proceso de migración...', 'info');

    // Obtener laptops que necesitan migración
    const needed = laptops.filter(laptop => {
      const imgs = laptop.imagenes || (laptop.imagen ? [laptop.imagen] : []);
      return imgs.some(url => url && url.includes('cloudinary.com'));
    });

    let imagesCount = 0;
    let failedLaptops = [];

    for (let index = 0; index < needed.length; index++) {
      const laptop = needed[index];
      setCurrentLaptopIndex(index);
      addLog(`----------------------------------------`, 'info');
      addLog(`[${index + 1}/${needed.length}] Migrando: ${laptop.modelo} (${laptop.marca})`, 'info');

      try {
        const originalUrls = laptop.imagenes || (laptop.imagen ? [laptop.imagen] : []);
        const finalUrls = [];

        for (let imgIndex = 0; imgIndex < originalUrls.length; imgIndex++) {
          const url = originalUrls[imgIndex];

          // Si no es de Cloudinary, mantenerla igual
          if (!url || !url.includes('cloudinary.com')) {
            finalUrls.push(url);
            continue;
          }

          addLog(`  -> Descargando foto ${imgIndex + 1}: ${url.substring(0, 50)}...`, 'info');

          try {
            // 1. Descargar imagen
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status} al descargar`);
            const blob = await response.blob();

            // 2. Comprimir imagen en el cliente
            addLog(`  -> Comprimiendo y optimizando foto ${imgIndex + 1}...`, 'info');
            const compressedBlob = await compressImage(blob, 1200, 0.8);
            addLog(`  -> Tamaño reducido con éxito (Formato JPEG).`, 'success');

            // 3. Subir a Firebase Storage
            const cleanModel = laptop.modelo.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `migrated_${laptop.id}_${imgIndex}_${cleanModel}.jpg`;
            const storageRef = ref(storage, `laptops/${fileName}`);

            addLog(`  -> Subiendo foto ${imgIndex + 1} a Firebase Storage...`, 'info');
            const snapshot = await uploadBytes(storageRef, compressedBlob);
            const downloadUrl = await getDownloadURL(snapshot.ref);

            finalUrls.push(downloadUrl);
            imagesCount++;
            setProgress(prev => ({ ...prev, imagesMigrated: imagesCount }));
            addLog(`  -> ¡Subida exitosa! Nueva URL generada.`, 'success');

          } catch (imgError) {
            console.error(imgError);
            addLog(`  [ERROR] Falló migración de imagen ${imgIndex + 1}: ${imgError.message}. Manteniendo URL original.`, 'error');
            finalUrls.push(url); // Mantener original como fallback para no perder el dato
            setProgress(prev => ({
              ...prev,
              failures: [...prev.failures, { laptop: laptop.modelo, error: `Imagen ${imgIndex + 1}: ${imgError.message}` }]
            }));
          }
        }

        // 4. Actualizar documento en Firestore
        addLog(`  -> Actualizando base de datos en Firestore...`, 'info');
        const docRef = doc(db, 'laptops', laptop.id);
        await updateDoc(docRef, {
          imagenes: finalUrls,
          imagen: finalUrls.length > 0 ? finalUrls[0] : '',
          actualizadoEn: new Date()
        });

        addLog(`¡Equipo "${laptop.modelo}" migrado exitosamente!`, 'success');
        setProgress(prev => ({ ...prev, laptopsMigrated: index + 1 }));

      } catch (laptopError) {
        console.error(laptopError);
        addLog(`[ERROR GENERAL] No se pudo migrar "${laptop.modelo}": ${laptopError.message}`, 'error');
        failedLaptops.push({ modelo: laptop.modelo, error: laptopError.message });
      }

      // Pequeña pausa para no saturar al navegador
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setMigrating(false);
    setCurrentLaptopIndex(-1);
    addLog(`========================================`, 'success');
    addLog(`¡MIGRACIÓN FINALIZADA!`, 'success');
    addLog(`Laptops migradas con éxito: ${needed.length - failedLaptops.length}/${needed.length}`, 'success');
    addLog(`Imágenes migradas con éxito: ${imagesCount}`, 'success');
    
    // Recargar inventario para actualizar estadísticas iniciales
    loadLaptops();
  };

  const percentageLaptops = progress.laptopsNeeded > 0 
    ? Math.round((progress.laptopsMigrated / progress.laptopsNeeded) * 100) 
    : 0;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link 
          to="/admin"
          className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-900 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Migración de Imágenes a Firebase Storage</h1>
          <p className="text-gray-500 text-sm mt-1">Transfiere fotos de Cloudinary al almacenamiento seguro de Google con compresión de alto rendimiento.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Columna de Estadísticas e Inicio (1 fr) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Database className="w-5 h-5 text-blue-500" />
              Estado de la Base de Datos
            </h3>

            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="text-xs font-medium">Analizando datos...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Total de laptops:</span>
                  <span className="font-bold text-gray-900">{progress.totalLaptops}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Laptops con Cloudinary:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    progress.laptopsNeeded > 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {progress.laptopsNeeded}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Total de fotos en la nube:</span>
                  <span className="font-bold text-gray-900">{progress.totalImages}</span>
                </div>
                
                {progress.laptopsNeeded > 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-xs leading-relaxed flex gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
                    <div>
                      <p className="font-bold mb-1">Migración requerida</p>
                      Hay fotos almacenadas en Cloudinary que superaron el límite de solicitudes. Presiona Iniciar para migrarlas.
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 text-xs leading-relaxed flex gap-2">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-green-500" />
                    <div>
                      <p className="font-bold mb-1">Todo en orden</p>
                      Todas las imágenes del catálogo están perfectamente alojadas en Firebase Storage. ¡No se requiere acción!
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={startMigration}
                    disabled={progress.laptopsNeeded === 0 || migrating}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 text-white disabled:text-gray-400 px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:shadow-none"
                  >
                    {migrating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Migrando...
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        Iniciar Migración
                      </>
                    )}
                  </button>

                  <button
                    onClick={loadLaptops}
                    disabled={migrating}
                    className="w-full mt-2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Recargar Datos
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Tarjeta de Fallas si las hay */}
          {progress.failures.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-6 rounded-2xl shadow-sm text-red-900 space-y-3">
              <h4 className="font-bold text-sm flex items-center gap-1.5 text-red-800">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Errores Encontrados ({progress.failures.length})
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-2 text-xs">
                {progress.failures.map((fail, i) => (
                  <div key={i} className="bg-white/80 p-2 rounded border border-red-100">
                    <p className="font-bold text-red-800">{fail.laptop}</p>
                    <p className="text-[10px] text-red-600 mt-0.5">{fail.error}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Columna de Consola de Migración (2 fr) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Progreso Visual */}
          {migrating && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-gray-900">Progreso de la Migración</span>
                <span className="font-black text-blue-600">{percentageLaptops}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-300 shadow-md shadow-blue-500/25"
                  style={{ width: `${percentageLaptops}%` }}
                ></div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center pt-2">
                <div className="bg-blue-50/55 p-3 rounded-xl border border-blue-100/50">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Equipos Migrados</p>
                  <p className="text-xl font-black text-blue-700">{progress.laptopsMigrated} <span className="text-xs text-blue-400 font-normal">de {progress.laptopsNeeded}</span></p>
                </div>
                <div className="bg-green-50/55 p-3 rounded-xl border border-green-100/50">
                  <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-1">Fotos Procesadas</p>
                  <p className="text-xl font-black text-green-700">{progress.imagesMigrated} <span className="text-xs text-green-400 font-normal">de {progress.totalImages}</span></p>
                </div>
              </div>
            </div>
          )}

          {/* Consola Estilo Terminal */}
          <div className="bg-slate-950 text-slate-100 rounded-2xl shadow-xl overflow-hidden border border-slate-800 flex flex-col h-[500px]">
            <div className="bg-slate-900 px-6 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <Terminal className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-mono font-bold">consola-migrador-smartbits.log</span>
              </div>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
                <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></div>
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto font-mono text-xs space-y-2.5 selection:bg-blue-500/30">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 italic">
                  Esperando el inicio de actividades...
                </div>
              ) : (
                logs.map((log, i) => {
                  let color = 'text-slate-300';
                  if (log.type === 'success') color = 'text-emerald-400 font-bold';
                  if (log.type === 'warn') color = 'text-amber-400';
                  if (log.type === 'error') color = 'text-red-400 font-black';
                  
                  return (
                    <div key={i} className={`flex items-start gap-3.5 leading-relaxed ${color}`}>
                      <span className="text-slate-600 select-none">[{log.timestamp}]</span>
                      <span className="flex-1 whitespace-pre-wrap">{log.message}</span>
                    </div>
                  );
                })
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
