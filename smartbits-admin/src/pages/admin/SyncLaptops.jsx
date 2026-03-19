import { useState, useEffect } from 'react';
import { ArrowLeft, UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle, Save, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

export default function SyncLaptops() {
  const navigate = useNavigate();
  const [csvUrl, setCsvUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  const [existingModels, setExistingModels] = useState(new Set());
  const [previewData, setPreviewData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  // 1. Cargar modelos existentes para evitar duplicados
  useEffect(() => {
    const fetchExistingLaptops = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'laptops'));
        const models = new Set();
        snapshot.forEach(doc => {
          models.add(doc.data().modelo?.trim().toLowerCase());
        });
        setExistingModels(models);
      } catch (err) {
        console.error("Error cargando laptops existentes:", err);
      }
    };
    fetchExistingLaptops();
  }, []);

  const normalizeKey = (key) => {
    if (!key) return '';
    const map = {
      'modelo': 'modelo',
      'marca': 'marca',
      'procesador': 'cpu',
      'cpu': 'cpu',
      'ram': 'ram',
      'almacenamiento': 'almacenamiento',
      'disco': 'almacenamiento',
      'graficos': 'gpu',
      'gpu': 'gpu',
      'pantalla': 'pantalla',
      'tactil': 'touch',
      'táctil': 'touch',
      'touch': 'touch',
      'windows': 'windows',
      'os': 'windows',
      'sistema': 'windows',
      'bateria': 'bateria',
      'batería': 'bateria',
      'precio': 'precio',
      'disponibilidad': 'disponibilidad',
      'estado': 'disponibilidad'
    };
    
    const normalized = key.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, '');
      
    for (const [k, v] of Object.entries(map)) {
      if (normalized.includes(k)) return v;
    }
    
    return normalized;
  };

  const handleSimulate = () => {
    if (!csvUrl) {
      setError("Por favor, introduce la URL del CSV.");
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setPreviewData(null);
    setSavedCount(0);

    Papa.parse(csvUrl, {
      download: true,
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        setIsProcessing(false);
        if (results.errors && results.errors.length > 0) {
          setError(`Error al leer el CSV: ${results.errors[0].message}`);
          return;
        }

        const rawData = results.data;
        if (rawData.length === 0) {
          setError("El archivo CSV está vacío.");
          return;
        }

        let headerIndex = -1;
        for (let i = 0; i < rawData.length; i++) {
          const row = rawData[i];
          if (row.some(cell => typeof cell === 'string' && cell.toLowerCase().trim() === 'modelo')) {
            headerIndex = i;
            break;
          }
        }

        if (headerIndex === -1) {
          setError("No se encontró la columna 'MODELO' en ninguna fila. Verifica el formato del Excel.");
          return;
        }

        const headers = rawData[headerIndex];
        const dataRows = rawData.slice(headerIndex + 1);

        const processed = dataRows.map((rowArray, idx) => {
          const rowObj = {};
          headers.forEach((h, i) => {
            if (h) rowObj[h] = rowArray[i];
          });

          const mappedRow = {};
          Object.keys(rowObj).forEach(key => {
            const newKey = normalizeKey(key);
            mappedRow[newKey] = rowObj[key]?.trim() || '';
          });

          const modelName = mappedRow['modelo'] || mappedRow['model'] || '';
          const hasSpecs = !!(mappedRow['cpu'] || mappedRow['ram'] || mappedRow['almacenamiento'] || mappedRow['precio']);
          if (!modelName || !hasSpecs) {
            return { isValid: false, originalModelo: '', data: {} };
          }

          const isDuplicate = existingModels.has(modelName.toLowerCase());
          
          // Verificar disponibilidad
          const dispRaw = mappedRow['disponibilidad']?.toLowerCase().trim() || 'disponible';
          const isAvailable = dispRaw === 'disponible' || dispRaw === 'coming soon';
          
          return {
            id: `row-${idx}`, // ID único para usar en React keys y checkboxes
            originalModelo: modelName,
            isDuplicate,
            isAvailable,
            isValid: true,
            isSelected: !isDuplicate && isAvailable, // Seleccionado por defecto si es válido, no duplicado y disponible
            data: {
              modelo: modelName,
              marca: mappedRow['marca'] || '',
              cpu: mappedRow['cpu'] || 'N/A',
              ram: mappedRow['ram'] || 'N/A',
              almacenamiento: mappedRow['almacenamiento'] || 'N/A',
              gpu: mappedRow['gpu'] || 'N/A',
              pantalla: mappedRow['pantalla'] || 'N/A',
              touch: (mappedRow['touch']?.toLowerCase()?.includes('si') || mappedRow['touch']?.toLowerCase()?.includes('sí')) ? 'Sí' : 'No',
              windows: mappedRow['windows'] || 'W11 PRO',
              bateria: mappedRow['bateria'] || 'Excelente',
              precio: Number(mappedRow['precio']?.replace(/[^0-9.-]+/g,"")) || 0,
              disponibilidad: mappedRow['disponibilidad']?.trim() || 'No disponible',
              
              imagenes: [],
              imagen: '', 
              estadoPantalla: 10,
              estadoCarcasa: 9
            }
          };
        });

        const validProcessed = processed.filter(item => item.isValid || item.originalModelo);

        setPreviewData({
          total: validProcessed.length,
          allProcessingObjects: validProcessed
        });
      },
      error: (err) => {
        setIsProcessing(false);
        setError("No se pudo conectar con la URL. Asegúrate de que es pública y formato CSV.");
      }
    });
  };

  const toggleSelection = (id) => {
    setPreviewData(prev => ({
      ...prev,
      allProcessingObjects: prev.allProcessingObjects.map(item => 
        item.id === id ? { ...item, isSelected: !item.isSelected } : item
      )
    }));
  };

  const handleSync = async () => {
    const itemsToSave = previewData.allProcessingObjects.filter(item => item.isSelected);
    if (!previewData || itemsToSave.length === 0) return;
    
    setIsSaving(true);
    let count = 0;

    try {
      for (const item of itemsToSave) {
        await addDoc(collection(db, 'laptops'), {
          ...item.data,
          estado: {
            pantalla: item.data.estadoPantalla,
            carcasa: item.data.estadoCarcasa,
          },
          creadoEn: serverTimestamp(),
        });
        count++;
      }
      
      setSavedCount(count);
      
      const updatedSet = new Set(existingModels);
      itemsToSave.forEach(item => updatedSet.add(item.data.modelo.toLowerCase()));
      setExistingModels(updatedSet);
      
      // Marcar los guardados como duplicados para que no se puedan volver a guardar sin recargar
      setPreviewData(prev => ({
        ...prev,
        allProcessingObjects: prev.allProcessingObjects.map(item => {
          if (item.isSelected) {
            return { ...item, isDuplicate: true, isSelected: false };
          }
          return item;
        })
      }));
      
    } catch (err) {
      console.error("Error guardando:", err);
      setError("Ocurrió un error guardando en Firebase: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getStats = () => {
    if (!previewData) return { toAdd: 0, duplicates: 0, unavailable: 0, total: 0 };
    const toAdd = previewData.allProcessingObjects.filter(i => i.isSelected).length;
    const duplicates = previewData.allProcessingObjects.filter(i => i.isValid && i.isDuplicate).length;
    const unavailable = previewData.allProcessingObjects.filter(i => i.isValid && !i.isDuplicate && !i.isAvailable).length;
    return { toAdd, duplicates, unavailable, total: previewData.total };
  };

  const stats = getStats();

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-4 mb-8">
        <Link 
          to="/admin"
          className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-900 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sincronizar Google Sheets</h1>
          <p className="text-gray-500 text-sm mt-1">Importa laptops de un archivo de Excel publicado en la web (CSV).</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8 text-sm text-blue-800">
        <h3 className="font-bold flex items-center gap-2 text-blue-900 mb-2">
          <FileSpreadsheet className="w-5 h-5" />
          ¿Cómo preparar tu Google Sheet?
        </h3>
        <ol className="list-decimal pl-5 space-y-1 mt-3">
          <li>Abre tu tabla en Google Sheets. Se recomiendan columnas como: <strong>Modelo, Marca, CPU, RAM, Almacenamiento, Precio</strong>.</li>
          <li>Ve a <strong>Archivo {">"} Compartir {">"} Publicar en la Web</strong>.</li>
          <li>Selecciona la pestaña correcta y cambia "Página web" a <strong>Valores separados por comas (.csv)</strong>.</li>
          <li>Haz clic en <strong>Publicar</strong> y copia el link generado. Tu Google Sheet no necesita estar público para lectura general, pero esta opción publica el CSV sin contraseñas.</li>
        </ol>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-2">URL del CSV (Publicado en la web)</label>
        <div className="flex gap-3">
          <input 
            type="url"
            value={csvUrl}
            onChange={(e) => setCsvUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSimulate}
            disabled={isProcessing || !csvUrl}
            className="px-6 py-2 bg-gray-100 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
            Simular
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4"/> {error}</p>}
      </div>

      {previewData && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
              <div className="text-3xl font-black text-blue-600 mb-1">{stats.toAdd}</div>
              <div className="text-xs text-gray-500 uppercase font-bold">Seleccionados</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
              <div className="text-3xl font-black text-orange-500 mb-1">{stats.duplicates}</div>
              <div className="text-xs text-gray-500 uppercase font-bold">Duplicados</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
              <div className="text-3xl font-black text-red-500 mb-1">{stats.unavailable}</div>
              <div className="text-xs text-gray-500 uppercase font-bold">No Disponibles</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
              <div className="text-3xl font-black text-gray-500 mb-1">{stats.total}</div>
              <div className="text-xs text-gray-500 uppercase font-bold">Total Leídos</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Vista Previa de Equipos</h3>
              
              {stats.toAdd > 0 && !savedCount && (
                <button
                  onClick={handleSync}
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm shadow-md shadow-blue-500/20"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSaving ? 'Guardando...' : `Guardar ${stats.toAdd} Seleccionados`}
                </button>
              )}
            </div>

            {savedCount > 0 && (
              <div className="bg-green-50 p-4 border-b border-green-200 flex items-center gap-3 text-green-800">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <strong>¡Sincronización Completada!</strong> Se han añadido {savedCount} equipos al catálogo.
              </div>
            )}

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr className="text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 font-semibold text-center">Añadir</th>
                    <th className="px-6 py-3 font-semibold">Estado</th>
                    <th className="px-6 py-3 font-semibold">Modelo</th>
                    <th className="px-6 py-3 font-semibold">Specs Rápidas</th>
                    <th className="px-6 py-3 font-semibold">Precio / Disp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewData.allProcessingObjects.map((item) => (
                    <tr key={item.id} className={!item.isSelected ? "bg-gray-50/50 opacity-60" : "bg-white"}>
                      
                      {/* Columna de Checkbox */}
                      <td className="px-6 py-3 text-center">
                        {item.isValid && !item.isDuplicate && item.isAvailable ? (
                          <input 
                            type="checkbox" 
                            checked={item.isSelected} 
                            onChange={() => toggleSelection(item.id)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                        ) : (
                          <input type="checkbox" disabled className="w-4 h-4 opacity-30" />
                        )}
                      </td>

                      {/* Columna de Estado del Proceso */}
                      <td className="px-6 py-3">
                        {!item.isValid ? (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded font-medium">Inválido</span>
                        ) : item.isDuplicate ? (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded font-medium">Existe</span>
                        ) : !item.isAvailable ? (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium">No Disp.</span>
                        ) : item.isSelected ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">NUEVO</span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded font-medium">Omitido</span>
                        )}
                      </td>
                      
                      <td className="px-6 py-3">
                        <div className="font-medium text-gray-900">{item.originalModelo || "Sin Modelo"}</div>
                        {item.data.marca && <div className="text-xs text-gray-500">{item.data.marca}</div>}
                      </td>
                      
                      <td className="px-6 py-3 text-gray-500 text-xs">
                        {item.data.cpu} • {item.data.ram} • {item.data.almacenamiento}
                      </td>
                      
                      <td className="px-6 py-3">
                        <div className="font-semibold text-gray-900">${item.data.precio}</div>
                        <div className={`text-xs font-medium mt-0.5 ${
                          item.data.disponibilidad.toLowerCase().includes('coming') ? 'text-blue-600' :
                          item.data.disponibilidad.toLowerCase().includes('no') ? 'text-red-500' :
                          'text-green-600'
                        }`}>
                          {item.data.disponibilidad}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.allProcessingObjects.length === 0 && (
                <div className="p-8 text-center text-gray-500">No hay datos procesables en la URL proporcionada.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
