import { useState, useRef, useEffect } from 'react';
import { Save, ArrowLeft, Image as ImageIcon, CheckCircle, Upload, X, Loader2, Plus } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

// CONFIGURACIÓN CLOUDINARY
const CLOUD_NAME = "dhzdul8vt";
const UPLOAD_PRESET = "laptops_preset";

export default function EditLaptop() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [newImagePreviews, setNewImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    modelo: '',
    marca: '',
    cpu: '',
    ram: '',
    almacenamiento: '',
    gpu: '',
    pantalla: '',
    touch: 'No',
    windows: '',
    bateria: 'Excelente',
    precio: '',
    disponibilidad: 'Disponible',
    imagenes: [],
    estadoPantalla: 10,
    estadoCarcasa: 9
  });

  // Cargar datos actuales del equipo
  useEffect(() => {
    const fetchLaptop = async () => {
      try {
        const laptopRef = doc(db, 'laptops', id);
        const laptopSnap = await getDoc(laptopRef);

        if (laptopSnap.exists()) {
          const data = laptopSnap.data();
          const imgs = data.imagenes || (data.imagen ? [data.imagen] : []);
          setFormData({
            modelo: data.modelo || '',
            marca: data.marca || '',
            cpu: data.cpu || '',
            ram: data.ram || '',
            almacenamiento: data.almacenamiento || '',
            gpu: data.gpu || '',
            pantalla: data.pantalla || '',
            touch: data.touch || 'No',
            windows: data.windows || '',
            bateria: data.bateria || 'Excelente',
            precio: data.precio || '',
            disponibilidad: data.disponibilidad || 'Disponible',
            imagenes: imgs,
            estadoPantalla: data.estado?.pantalla || 10,
            estadoCarcasa: data.estado?.carcasa || 9
          });
          setExistingImages(imgs);
        } else {
          alert('El equipo no existe.');
          navigate('/admin');
        }
      } catch (err) {
        console.error('Error cargando equipo:', err);
        alert('Error al cargar datos: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLaptop();
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} no es una imagen.`);
        return false;
      }
      return true;
    });

    setNewImageFiles(prev => [...prev, ...validFiles]);
    const previews = validFiles.map(file => URL.createObjectURL(file));
    setNewImagePreviews(prev => [...prev, ...previews]);
  };

  const handleRemoveExisting = (url) => {
    setExistingImages(prev => prev.filter(item => item !== url));
  };

  const handleRemoveNew = (index) => {
    setNewImageFiles(prev => prev.filter((_, i) => i !== index));
    setNewImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSliderChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: parseInt(value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (existingImages.length === 0 && newImageFiles.length === 0) {
      alert('El equipo debe tener al menos una imagen.');
      return;
    }
    setIsSubmitting(true);
    
    try {
      const finalUrls = [...existingImages];

      // 1. Subir las nuevas imágenes si las hay
      for (let i = 0; i < newImageFiles.length; i++) {
        setUploadProgress(`Subiendo foto ${i + 1} de ${newImageFiles.length}...`);
        
        const cloudinaryData = new FormData();
        cloudinaryData.append('file', newImageFiles[i]);
        cloudinaryData.append('upload_preset', UPLOAD_PRESET);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          { method: 'POST', body: cloudinaryData }
        );

        if (!response.ok) throw new Error('Fallo al subir nuevas imágenes');
        const result = await response.json();
        finalUrls.push(result.secure_url);
      }

      // 2. Actualizar en Firestore
      setUploadProgress('Actualizando base de datos...');
      const laptopRef = doc(db, 'laptops', id);
      await updateDoc(laptopRef, {
        modelo: formData.modelo,
        marca: formData.marca,
        cpu: formData.cpu,
        ram: formData.ram,
        almacenamiento: formData.almacenamiento,
        gpu: formData.gpu,
        pantalla: formData.pantalla,
        touch: formData.touch,
        windows: formData.windows,
        bateria: formData.bateria,
        precio: Number(formData.precio),
        disponibilidad: formData.disponibilidad,
        imagenes: finalUrls,
        imagen: finalUrls[0], // Fallback
        estado: {
          pantalla: formData.estadoPantalla,
          carcasa: formData.estadoCarcasa,
        },
        actualizadoEn: serverTimestamp(),
      });

      setShowSuccess(true);
      setTimeout(() => navigate('/admin'), 1500);
    } catch (err) {
      console.error('Error:', err);
      alert('Error al actualizar: ' + err.message);
      setIsSubmitting(false);
      setUploadProgress('');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-500">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="font-medium">Cargando datos del equipo...</p>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Editar Equipo</h1>
          <p className="text-gray-500 text-sm mt-1">Modifica los detalles de la laptop seleccionada.</p>
        </div>
      </div>

      {showSuccess ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-green-800 mb-2">¡Cambios Guardados!</h2>
          <p className="text-green-600">El equipo ha sido actualizado exitosamente.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                  Foto del Equipo
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
                    {/* Imágenes Existentes */}
                    {existingImages.map((url, index) => (
                      <div key={`exist-${index}`} className="relative aspect-[4/3] rounded-lg overflow-hidden border border-gray-200 group">
                        <img src={url} alt={`Existente ${index}`} className="w-full h-full object-contain bg-gray-50 p-1" />
                        <button
                          type="button"
                          onClick={() => handleRemoveExisting(url)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 shadow-sm"
                          title="Eliminar de la galería"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span className="absolute bottom-1 left-1 bg-white/80 text-[8px] px-1 rounded border border-gray-200 text-gray-500 font-bold">Cloud</span>
                      </div>
                    ))}

                    {/* Imágenes Nuevas (Previews) */}
                    {newImagePreviews.map((preview, index) => (
                      <div key={`new-${index}`} className="relative aspect-[4/3] rounded-lg overflow-hidden border border-blue-200 group ring-1 ring-blue-100">
                        <img src={preview} alt={`Nueva ${index}`} className="w-full h-full object-contain bg-blue-50/30 p-1" />
                        <button
                          type="button"
                          onClick={() => handleRemoveNew(index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 shadow-sm"
                          title="Quitar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span className="absolute bottom-1 left-1 bg-blue-500 text-white text-[8px] px-1 rounded font-bold">Local</span>
                      </div>
                    ))}
                    
                    <label
                      htmlFor="foto-input"
                      className="flex flex-col items-center justify-center aspect-[4/3] rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <Plus className="w-6 h-6 text-gray-400 mb-1" />
                      <span className="text-[10px] font-medium text-gray-600 text-center px-2">Añadir más fotos</span>
                    </label>
                  </div>
                  
                  <p className="text-[10px] text-gray-400 italic">
                    {existingImages.length} en la nube • {newImageFiles.length} nuevas por subir
                  </p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Estado Visual Certificado</h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="font-medium text-gray-700">Estado de Pantalla</label>
                      <span className="font-bold text-gray-900">{formData.estadoPantalla}/10</span>
                    </div>
                    <input 
                      type="range" name="estadoPantalla" min="1" max="10" step="1"
                      value={formData.estadoPantalla} onChange={handleSliderChange}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="font-medium text-gray-700">Estado de Carcasa</label>
                      <span className="font-bold text-gray-900">{formData.estadoCarcasa}/10</span>
                    </div>
                    <input 
                      type="range" name="estadoCarcasa" min="1" max="10" step="1"
                      value={formData.estadoCarcasa} onChange={handleSliderChange}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salud de Batería</label>
                    <select 
                      name="bateria" value={formData.bateria} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="Nueva">Nueva</option>
                      <option value="Excelente">Excelente</option>
                      <option value="Buena">Buena</option>
                      <option value="Regular">Regular</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Información Básica</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Modelo Exacto</label>
                    <input 
                      type="text" name="modelo" required
                      value={formData.modelo} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                    <select 
                      name="marca" required
                      value={formData.marca} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="" disabled>Seleccionar marca...</option>
                      <option value="Dell">Dell</option>
                      <option value="Lenovo">Lenovo</option>
                      <option value="HP">HP</option>
                      <option value="Asus">Asus</option>
                      <option value="Acer">Acer</option>
                      <option value="Apple">Apple</option>
                      <option value="Microsoft">Microsoft</option>
                    </select>
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
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Especificaciones Técnicas</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Procesador (CPU)</label>
                    <input 
                      type="text" name="cpu" required
                      value={formData.cpu} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Memoria RAM</label>
                    <input 
                      type="text" name="ram" required
                      value={formData.ram} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Almacenamiento</label>
                    <input 
                      type="text" name="almacenamiento" required
                      value={formData.almacenamiento} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gráficos (GPU)</label>
                    <input 
                      type="text" name="gpu" required
                      value={formData.gpu} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pantalla</label>
                    <input 
                      type="text" name="pantalla" required
                      value={formData.pantalla} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sistema Operativo</label>
                    <input 
                      type="text" name="windows" required
                      value={formData.windows} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:col-span-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">¿Pantalla Táctil?</label>
                      <select 
                        name="touch" value={formData.touch} onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="No">No</option>
                        <option value="Sí">Sí</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Disponibilidad</label>
                      <select 
                        name="disponibilidad" value={formData.disponibilidad} onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                      >
                        <option value="Disponible">Disponible</option>
                        <option value="Coming soon">Coming soon</option>
                        <option value="Vendido">Vendido</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 gap-3">
            <Link to="/admin" className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </Link>
            <button 
              type="submit" disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 min-w-[180px] disabled:opacity-70 shadow-md shadow-blue-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">{uploadProgress || 'Actualizando...'}</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
