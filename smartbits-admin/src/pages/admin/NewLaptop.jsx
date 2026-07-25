import { useState, useRef } from 'react';
import { Save, ArrowLeft, Image as ImageIcon, CheckCircle, X, Loader2, Plus, DollarSign, Calculator, TrendingUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadToCloudinary } from '../../utils/imageOptimizer';


export default function NewLaptop() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
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
    estadoCarcasa: 9,
    otros: '',
    fecha_compra: '',
    precio_ebay: '',
    costo_banco: '',
    comision_banco: '2',
    costos_adicionales: '',
    envio_usd: '',
    envio_bs: '',
    tasa_bcv: '',
    socio_compra: 'ysmael',
    borrador: true,
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

  const precioEbay = Number(formData.precio_ebay) || 0;
  const costoBanco = Number(formData.costo_banco) || 0;
  const comisionBanco = Number(formData.comision_banco) || 0;
  const costosAdicionales = Number(formData.costos_adicionales) || 0;
  const envioUsd = Number(formData.envio_usd) || 0;
  const envioBs = Number(formData.envio_bs) || 0;
  const tasaBcv = Number(formData.tasa_bcv) || 1;

  const costoReal = precioEbay + costoBanco + comisionBanco;
  const envioUsdConvertido = envioBs / tasaBcv;
  const costoTotal = costoReal + costosAdicionales + envioUsd + envioUsdConvertido;
  const precioPublicado = Number(formData.precio) || 0;
  const gananciaEstimada = precioPublicado - costoTotal;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const uploadedUrls = [];

      // 1. Subir cada imagen a Cloudinary
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        setUploadProgress(`Subiendo foto ${i + 1} de ${imageFiles.length}...`);
        const secureUrl = await uploadToCloudinary(file, (pct) => {
          setUploadProgress(`Subiendo foto ${i + 1} de ${imageFiles.length}... ${pct}%`);
        });
        uploadedUrls.push(secureUrl);
      }

      // 2. Guardar datos en Firestore con el array de URLs
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
        imagenes: uploadedUrls,
        imagen: uploadedUrls.length > 0 ? uploadedUrls[0] : '',
        estado: {
          pantalla: formData.estadoPantalla,
          carcasa: formData.estadoCarcasa,
        },
        otros: formData.otros,
        fecha_compra: formData.fecha_compra || null,
        precio_ebay: precioEbay,
        costo_banco: costoBanco,
        comision_banco: comisionBanco,
        costo_real: costoReal,
        costos_adicionales: costosAdicionales,
        envio_usd: envioUsd,
        envio_bs: envioBs,
        tasa_bcv: tasaBcv,
        envio_usd_convertido: envioUsdConvertido,
        socio_compra: formData.socio_compra,
        borrador: formData.borrador,
        costo_total: costoTotal,
        ganancia_estimada: gananciaEstimada,
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
                        <option value="No disponible">No disponible</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formData.borrador}
                          onChange={e => setFormData(prev => ({ ...prev, borrador: e.target.checked }))}
                          className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Borrador</span>
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                          No se muestra en el catálogo público
                        </span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Otros</label>
                      <textarea
                        name="otros"
                        value={formData.otros}
                        onChange={handleChange}
                        placeholder="Ej. Teclado retroiluminado&#10;Batería de larga duración&#10;Carga rápida"
                        rows={3} // Controla la altura inicial del cuadro
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-y"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sección de Costos y Finanzas */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              Datos de Compra y Costos
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Compra</label>
                <input
                  type="date" name="fecha_compra"
                  value={formData.fecha_compra} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comprador</label>
                <select
                  name="socio_compra" value={formData.socio_compra} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="ysmael">Ysmael</option>
                  <option value="victor">Víctor</option>
                  <option value="both">Ambos</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio eBay (USD)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">$</span>
                  <input
                    type="number" step="0.01" name="precio_ebay" min="0"
                    value={formData.precio_ebay} onChange={handleChange}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Costo al Banco (USD)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">$</span>
                  <input
                    type="number" step="0.01" name="costo_banco" min="0"
                    value={formData.costo_banco} onChange={handleChange}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comisión Banco (USD)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">$</span>
                  <input
                    type="number" step="0.01" name="comision_banco" min="0"
                    value={formData.comision_banco} onChange={handleChange}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Costo Real</p>
                <p className="text-lg font-black text-gray-900">${costoReal.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RAM / Cargador / Otros (USD)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">$</span>
                  <input
                    type="number" step="0.01" name="costos_adicionales" min="0"
                    value={formData.costos_adicionales} onChange={handleChange}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Envío (USD)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">$</span>
                  <input
                    type="number" step="0.01" name="envio_usd" min="0"
                    value={formData.envio_usd} onChange={handleChange}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Envío en Bs.</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">Bs</span>
                  <input
                    type="number" step="0.01" name="envio_bs" min="0"
                    value={formData.envio_bs} onChange={handleChange}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tasa BCV</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">Bs</span>
                  <input
                    type="number" step="0.01" name="tasa_bcv" min="0"
                    value={formData.tasa_bcv} onChange={handleChange}
                    placeholder="Ej. 36.50"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                {envioBs > 0 && tasaBcv > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">= ${envioUsdConvertido.toFixed(2)} USD</p>
                )}
              </div>
            </div>

            {/* Resumen de Costos */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Costo Total (USD)</p>
                <p className="text-2xl font-black text-blue-800">${costoTotal.toFixed(2)}</p>
                <p className="text-[10px] text-blue-400 mt-1">Real + Adicionales + Envíos</p>
              </div>

              <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Precio Publicado</p>
                <p className="text-2xl font-black text-purple-800">${precioPublicado.toFixed(2)}</p>
              </div>

              <div className={`rounded-lg p-4 border ${gananciaEstimada >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${gananciaEstimada >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  Ganancia Estimada
                </p>
                <p className={`text-2xl font-black ${gananciaEstimada >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                  {gananciaEstimada >= 0 ? '+' : ''}${gananciaEstimada.toFixed(2)}
                </p>
                {costoTotal > 0 && (
                  <p className={`text-[10px] mt-1 ${gananciaEstimada >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {((gananciaEstimada / costoTotal) * 100).toFixed(1)}% de margen
                  </p>
                )}
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
