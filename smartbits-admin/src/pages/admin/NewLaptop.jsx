import { useState, useRef } from 'react';
import { Save, ArrowLeft, Image as ImageIcon, CheckCircle, Upload, X, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

// CONFIGURACIÓN CLOUDINARY
const CLOUD_NAME = "dhzdul8vt";
const UPLOAD_PRESET = "laptops_preset";

export default function NewLaptop() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
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
    imagen: '',
    estadoPantalla: 10,
    estadoCarcasa: 9
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Validar que sea imagen y no pese más de 5MB
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede pesar más de 5 MB.');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSliderChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: parseInt(value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      alert('Por favor selecciona una foto para el equipo.');
      return;
    }
    setIsSubmitting(true);
    
    try {
      // 1. Subir imagen a Cloudinary (GRATIS y sin tarjeta)
      setUploadProgress('Subiendo imagen a Cloudinary...');
      
      const cloudinaryData = new FormData();
      cloudinaryData.append('file', imageFile);
      cloudinaryData.append('upload_preset', UPLOAD_PRESET);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: cloudinaryData,
        }
      );

      if (!response.ok) {
        throw new Error('Fallo al subir la imagen a Cloudinary');
      }

      const uploadResult = await response.json();
      const imagenUrl = uploadResult.secure_url;

      // 2. Guardar datos en Firestore con la URL real de Cloudinary
      setUploadProgress('Guardando en base de datos...');
      await addDoc(collection(db, 'laptops'), {
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
        imagen: imagenUrl,
        estado: {
          pantalla: formData.estadoPantalla,
          carcasa: formData.estadoCarcasa,
        },
        creadoEn: serverTimestamp(),
      });

      setShowSuccess(true);
      setTimeout(() => navigate('/admin'), 1500);
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
          to="/admin"
          className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-900 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Añadir Nuevo Equipo</h1>
          <p className="text-gray-500 text-sm mt-1">Registra una laptop en el catálogo público.</p>
        </div>
      </div>

      {showSuccess ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-green-800 mb-2">¡Equipo Guardado!</h2>
          <p className="text-green-600">La laptop ha sido añadida exitosamente al inventario.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Columna Izquierda: Imagen y Estado (1 fr) */}
            <div className="space-y-6">
              {/* Imagen URL */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                  Foto Principal
                </h3>
                
                <div className="space-y-4">
                  {/* Input oculto para el archivo real */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="foto-input"
                  />

                  {imagePreview ? (
                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-gray-200">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-contain bg-gray-50 p-2" />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        title="Eliminar imagen"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="foto-input"
                      className="flex flex-col items-center justify-center aspect-[4/3] rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-sm font-medium text-gray-600">Haz clic para seleccionar</span>
                      <span className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — máx. 5 MB</span>
                    </label>
                  )}

                  {imageFile && (
                    <p className="text-xs text-gray-500 truncate" title={imageFile.name}>
                      📎 {imageFile.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Estado Visual (Sliders) */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Estado Visual Certificado</h3>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="font-medium text-gray-700">Estado de Pantalla</label>
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
                      <label className="font-medium text-gray-700">Estado de Carcasa</label>
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salud de Batería</label>
                    <select 
                      name="bateria"
                      value={formData.bateria}
                      onChange={handleChange}
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

            {/* Columna Derecha: Specs (2 fr) */}
            <div className="md:col-span-2 space-y-6">
              
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Información Básica</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Modelo Exacto</label>
                    <input 
                      type="text" name="modelo" required
                      value={formData.modelo} onChange={handleChange}
                      placeholder="Ej. DELL Inspiron 5570"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                    <input 
                      type="text" name="marca" required
                      value={formData.marca} onChange={handleChange}
                      placeholder="Ej. Dell"
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
                      placeholder="Ej. Intel Core i5-8250U 3.40 GHz"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Memoria RAM</label>
                    <input 
                      type="text" name="ram" required
                      value={formData.ram} onChange={handleChange}
                      placeholder="Ej. 16 Gb DDR4"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Almacenamiento</label>
                    <input 
                      type="text" name="almacenamiento" required
                      value={formData.almacenamiento} onChange={handleChange}
                      placeholder="Ej. 512 Gb SSD NVMe"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gráficos (GPU)</label>
                    <input 
                      type="text" name="gpu" required
                      value={formData.gpu} onChange={handleChange}
                      placeholder="Ej. Intel Iris Xe Graphics"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pantalla</label>
                    <input 
                      type="text" name="pantalla" required
                      value={formData.pantalla} onChange={handleChange}
                      placeholder="Ej. 15.6&quot; FHD 1920x1080"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sistema Operativo</label>
                    <input 
                      type="text" name="windows" required
                      value={formData.windows} onChange={handleChange}
                      placeholder="Ej. W11 PRO original"
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
                        <option value="Coming soon">Coming soon (Próximamente)</option>
                        <option value="Vendido">Vendido</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 gap-3">
            <Link 
              to="/admin"
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
                  Guardar Equipo
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
