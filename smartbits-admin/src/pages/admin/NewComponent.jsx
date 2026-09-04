import { useState, useRef } from 'react';
import { Save, ArrowLeft, Image as ImageIcon, CheckCircle, X, Loader2, Plus } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadToCloudinary } from '../../utils/imageOptimizer';

export default function NewComponent() {
  const navigate = useNavigate();
  const location = useLocation();
  const ebayData = location.state?.ebayData;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState(() => ebayData?.foto_url ? [ebayData.foto_url] : []);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState(() => {
    let tipo = 'RAM';
    let marca = '';
    const t = (ebayData?.titulo || '').toLowerCase();
    if (t.includes('ssd') || t.includes('nvme') || t.includes('disco') || t.includes('m.2')) tipo = 'SSD';
    else if (t.includes('ram') || t.includes('ddr') || t.includes('sodimm')) tipo = 'RAM';
    else if (t.includes('bateria') || t.includes('battery')) tipo = 'Batería';
    else if (t.includes('pantalla') || t.includes('screen') || t.includes('display')) tipo = 'Pantalla';
    else if (t.includes('cargador') || t.includes('charger') || t.includes('ac adapter')) tipo = 'Cargador';
    else if (t.includes('teclado') || t.includes('keyboard')) tipo = 'Teclado';
    else if (t.includes('mouse')) tipo = 'Mouse';

    if (t.includes('samsung')) marca = 'Samsung';
    else if (t.includes('crucial')) marca = 'Crucial';
    else if (t.includes('kingston')) marca = 'Kingston';
    else if (t.includes('sk hynix') || t.includes('hynix')) marca = 'SK Hynix';
    else if (t.includes('dell')) marca = 'Dell';
    else if (t.includes('hp')) marca = 'HP';
    else if (t.includes('lenovo')) marca = 'Lenovo';
    else if (t.includes('asus')) marca = 'Asus';

    return {
      tipo,
      nombre: ebayData?.titulo || '',
      marca,
      precio: ebayData?.precio ? String(ebayData.precio) : '',
      unidades: '1',
      disponibilidad: 'Disponible',
      imagenes: [],
      estadoPantalla: 10,
      estadoCarcasa: 9,
      otros: ebayData ? `Compra eBay #${ebayData.orderId || ''}\nItem URL: ${ebayData.item_url || ''}` : '',
      generacion: '',
      velocidad: '',
      capacidad: '',
      interfaz: '',
      tipo_ssd: '',
      capacidad_bateria: '',
      ciclo: '',
      descripcion_personalizada: '',
      bluetooth: '',
    };
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} no es una imagen válida.`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} pesa demasiado (máx 5MB).`);
        return false;
      }
      return true;
    });

    setImageFiles(prev => [...prev, ...validFiles]);
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const handleRemoveImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSliderChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: parseInt(value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const uploadedUrls = [];

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        setUploadProgress(`Subiendo foto ${i + 1} de ${imageFiles.length}...`);
        const secureUrl = await uploadToCloudinary(file, (pct) => {
          setUploadProgress(`Subiendo foto ${i + 1} de ${imageFiles.length}... ${pct}%`);
        });
        uploadedUrls.push(secureUrl);
      }

      setUploadProgress('Guardando en base de datos...');

      const finalUrls = [...existingImages, ...uploadedUrls];

      const componentData = {
        tipo: formData.tipo,
        nombre: formData.nombre,
        marca: formData.marca,
        precio: Number(formData.precio),
        unidades: Number(formData.unidades) || 0,
        disponibilidad: formData.disponibilidad,
        imagenes: finalUrls,
        imagen: finalUrls.length > 0 ? finalUrls[0] : '',
        estado: {
          pantalla: formData.estadoPantalla,
          carcasa: formData.estadoCarcasa,
        },
        otros: formData.otros,
        creadoEn: serverTimestamp(),
      };

      if (formData.tipo === 'RAM') {
        componentData.generacion = formData.generacion;
        componentData.velocidad = formData.velocidad;
        componentData.capacidad = formData.capacidad;
      } else if (formData.tipo === 'SSD') {
        componentData.capacidad = formData.capacidad;
        componentData.interfaz = formData.interfaz;
        componentData.tipo_ssd = formData.tipo_ssd;
      } else if (formData.tipo === 'Bateria') {
        componentData.capacidad_bateria = formData.capacidad_bateria;
        componentData.ciclo = formData.ciclo;
      } else if (formData.tipo === 'Teclado' || formData.tipo === 'Mouse') {
        componentData.bluetooth = formData.bluetooth;
        componentData.descripcion_personalizada = formData.descripcion_personalizada;
      }

      const newCompRef = await addDoc(collection(db, 'componentes'), componentData);

      // Si viene de eBay, actualizar estado en compras_ebay
      if (ebayData?.id) {
        try {
          await updateDoc(doc(db, 'compras_ebay', ebayData.id), {
            estado: 'en_inventario',
            tipo_inventario: 'componente',
            inventario_id: newCompRef.id,
            fecha_actualizacion: serverTimestamp(),
          });
        } catch (eErr) {
          console.warn('Error actualizando compras_ebay:', eErr);
        }
      }

      setShowSuccess(true);
      setTimeout(() => navigate('/admin/components'), 1500);
    } catch (err) {
      console.error('Error:', err);
      alert('Error al guardar: ' + err.message);
      setIsSubmitting(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-4 mb-8">
        <Link
          to="/admin/components"
          className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-900 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Añadir Nuevo Componente</h1>
          <p className="text-gray-500 text-sm mt-1">Registra un componente o accesorio en el catálogo.</p>
        </div>
      </div>

      {showSuccess ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-green-800 mb-2">¡Componente Guardado!</h2>
          <p className="text-green-600">El componente ha sido añadido exitosamente al inventario.</p>
        </div>
      ) : (
        <>
          {ebayData && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-blue-900 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg font-bold text-xs">eBay Sync</span>
                <div className="text-sm">
                  <p className="font-bold text-blue-950">Prellenado desde compra de eBay</p>
                  <p className="text-xs text-blue-700">Orden #{ebayData.orderId || 'S/N'} • Costo base: ${ebayData.precio} USD</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md border border-blue-200 self-start sm:self-auto">
                Al guardar se marcará "En Inventario"
              </span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                  Fotos del Componente
                </h3>

                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="foto-input"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative aspect-[4/3] rounded-lg overflow-hidden border border-gray-200 group">
                        <img src={preview} alt={`Preview ${index}`} className="w-full h-full object-contain bg-gray-50 p-1" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 shadow-sm"
                          title="Eliminar imagen"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    <label
                      htmlFor="foto-input"
                      className="flex flex-col items-center justify-center aspect-[4/3] rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <Plus className="w-6 h-6 text-gray-400 mb-1" />
                      <span className="text-[10px] font-medium text-gray-600">Añadir Fotos</span>
                    </label>
                  </div>

                  {imageFiles.length > 0 && (
                    <p className="text-[10px] text-gray-500 italic">
                      {imageFiles.length} foto{imageFiles.length !== 1 ? 's' : ''} seleccionada{imageFiles.length !== 1 ? 's' : ''}.
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Estado Visual</h3>

                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="font-medium text-gray-700">Estado Visual</label>
                      <span className="font-bold text-gray-900">{formData.estadoPantalla}/10</span>
                    </div>
                    <input
                      type="range"
                      name="estadoPantalla"
                      min="1" max="10" step="1"
                      value={formData.estadoPantalla}
                      onChange={handleSliderChange}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="font-medium text-gray-700">Estado Funcional</label>
                      <span className="font-bold text-gray-900">{formData.estadoCarcasa}/10</span>
                    </div>
                    <input
                      type="range"
                      name="estadoCarcasa"
                      min="1" max="10" step="1"
                      value={formData.estadoCarcasa}
                      onChange={handleSliderChange}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 space-y-6">

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Información General</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      name="tipo"
                      value={formData.tipo}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="RAM">RAM</option>
                      <option value="SSD">SSD</option>
                      <option value="Bateria">Batería</option>
                      <option value="Teclado">Teclado</option>
                      <option value="Mouse">Mouse</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                    <input
                      type="text" name="nombre" required
                      value={formData.nombre} onChange={handleChange}
                      placeholder="Ej. Memoria RAM DDR4"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                    <input
                      type="text" name="marca"
                      value={formData.marca} onChange={handleChange}
                      placeholder="Ej. Kingston"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Precio ($USD)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number" name="precio" required min="0"
                        value={formData.precio} onChange={handleChange}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unidades Disponibles</label>
                    <input
                      type="number" name="unidades" min="0"
                      value={formData.unidades} onChange={handleChange}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Disponibilidad</label>
                    <select
                      name="disponibilidad" value={formData.disponibilidad} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                    >
                      <option value="Disponible">Disponible</option>
                      <option value="Coming soon">Coming soon (Próximamente)</option>
                      <option value="No disponible">No disponible</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Especificaciones por Tipo</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {formData.tipo === 'RAM' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Generación</label>
                        <select
                          name="generacion"
                          value={formData.generacion} onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="" disabled>Seleccionar...</option>
                          <option value="DDR3">DDR3</option>
                          <option value="DDR4">DDR4</option>
                          <option value="DDR5">DDR5</option>
                          <option value="LPDDR4">LPDDR4</option>
                          <option value="LPDDR5">LPDDR5</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Velocidad</label>
                        <input
                          type="text" name="velocidad"
                          value={formData.velocidad} onChange={handleChange}
                          placeholder="Ej. 3200 MHz"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad</label>
                        <select
                          name="capacidad"
                          value={formData.capacidad} onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="" disabled>Seleccionar...</option>
                          <option value="2 Gb">2 Gb</option>
                          <option value="4 Gb">4 Gb</option>
                          <option value="8 Gb">8 Gb</option>
                          <option value="16 Gb">16 Gb</option>
                          <option value="32 Gb">32 Gb</option>
                          <option value="64 Gb">64 Gb</option>
                        </select>
                      </div>
                    </>
                  )}

                  {formData.tipo === 'SSD' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad</label>
                        <select
                          name="capacidad"
                          value={formData.capacidad} onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="" disabled>Seleccionar...</option>
                          <option value="128 Gb">128 Gb</option>
                          <option value="256 Gb">256 Gb</option>
                          <option value="512 Gb">512 Gb</option>
                          <option value="1 Tb">1 Tb</option>
                          <option value="2 Tb">2 Tb</option>
                          <option value="4 Tb">4 Tb</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Interfaz</label>
                        <select
                          name="interfaz"
                          value={formData.interfaz} onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="" disabled>Seleccionar...</option>
                          <option value="SATA III">SATA III</option>
                          <option value="NVMe">NVMe</option>
                          <option value="PCIe 3.0">PCIe 3.0</option>
                          <option value="PCIe 4.0">PCIe 4.0</option>
                          <option value="USB 3.0">USB 3.0</option>
                          <option value="USB 3.1">USB 3.1</option>
                          <option value="M.2">M.2</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de SSD</label>
                        <select
                          name="tipo_ssd"
                          value={formData.tipo_ssd} onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="" disabled>Seleccionar...</option>
                          <option value="Interno">Interno</option>
                          <option value="Externo">Externo</option>
                          <option value="M.2 NVMe">M.2 NVMe</option>
                          <option value="2.5&quot; SATA">2.5" SATA</option>
                          <option value="M.2 SATA">M.2 SATA</option>
                        </select>
                      </div>
                    </>
                  )}

                  {formData.tipo === 'Bateria' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad</label>
                        <input
                          type="text" name="capacidad_bateria"
                          value={formData.capacidad_bateria} onChange={handleChange}
                          placeholder="Ej. 4000 mAh"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ciclos de Carga</label>
                        <input
                          type="text" name="ciclo"
                          value={formData.ciclo} onChange={handleChange}
                          placeholder="Ej. 300 ciclos"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </>
                  )}

                  {(formData.tipo === 'Teclado' || formData.tipo === 'Mouse') && (
                    <>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Conexión</label>
                        <select
                          name="bluetooth"
                          value={formData.bluetooth} onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="" disabled>Seleccionar...</option>
                          <option value="USB">USB (Cable)</option>
                          <option value="Bluetooth">Bluetooth</option>
                          <option value="USB + Bluetooth">USB + Bluetooth</option>
                          <option value="2.4 GHz">Inalámbrico 2.4 GHz</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                        <textarea
                          name="descripcion_personalizada"
                          value={formData.descripcion_personalizada} onChange={handleChange}
                          placeholder="Ej: Teclado mecánico RGB, Mouse ergonómico..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-y"
                        />
                      </div>
                    </>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Otros Detalles</label>
                    <textarea
                      name="otros"
                      value={formData.otros}
                      onChange={handleChange}
                      placeholder="Información adicional del componente..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-y"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 gap-3">
            <Link
              to="/admin/components"
              className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 min-w-[180px] disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-blue-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">{uploadProgress || 'Procesando...'}</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Guardar Componente
                </>
              )}
            </button>
          </div>
        </form>
        </>
      )}
    </div>
  );
}
