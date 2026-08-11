import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadToCloudinary } from '../../utils/imageOptimizer';;
import { getBancosConfig } from '../../utils/bancos';
import { Upload, X, Check, Laptop, Plus, Trash2 } from 'lucide-react';

export default function NewLaptop() {
  const navigate = useNavigate();

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
    costos_adicionales: '',
    envio_usd: '',
    envio_bs: '',
    tasa_bcv: '',
    borrador: true,
  });

  const [bancosList, setBancosList] = useState([]);
  const [pagosCompra, setPagosCompra] = useState([
    { metodoId: 'paypal', bancoNombre: 'PayPal', monto: '', comisionPct: 0 }
  ]);

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    getBancosConfig().then(list => {
      setBancosList(list);
      if (list.length > 0) {
        setPagosCompra([
          { metodoId: list[0].id || list[0].nombre, bancoNombre: list[0].nombre, monto: '', comisionPct: list[0].comision || 0 }
        ]);
      }
    });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'envio_bs') {
      const bsVal = parseFloat(value) || 0;
      const tasaVal = parseFloat(formData.tasa_bcv) || 0;
      const calcUsd = (bsVal > 0 && tasaVal > 0) ? (bsVal / tasaVal).toFixed(2) : formData.envio_usd;
      setFormData(prev => ({
        ...prev,
        envio_bs: value,
        envio_usd: calcUsd
      }));
      return;
    }

    if (name === 'tasa_bcv') {
      const tasaVal = parseFloat(value) || 0;
      const bsVal = parseFloat(formData.envio_bs) || 0;
      const calcUsd = (bsVal > 0 && tasaVal > 0) ? (bsVal / tasaVal).toFixed(2) : formData.envio_usd;
      setFormData(prev => ({
        ...prev,
        tasa_bcv: value,
        envio_usd: calcUsd
      }));
      return;
    }

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

  // --- Lógica de Pagos Combinados y Comisiones ---
  const handleAddPago = () => {
    const defaultBanco = bancosList[0] || { id: 'efectivo', nombre: 'Efectivo USD', comision: 0 };
    setPagosCompra(prev => [
      ...prev,
      { metodoId: defaultBanco.id || defaultBanco.nombre, bancoNombre: defaultBanco.nombre, monto: '', comisionPct: defaultBanco.comision || 0 }
    ]);
  };

  const handleRemovePago = (index) => {
    if (pagosCompra.length === 1) return;
    setPagosCompra(prev => prev.filter((_, i) => i !== index));
  };

  const handlePagoChange = (index, field, value) => {
    setPagosCompra(prev => {
      const newPagos = [...prev];
      if (field === 'metodoId') {
        const bancoObj = bancosList.find(b => (b.id || b.nombre) === value) || { nombre: value, comision: 0 };
        newPagos[index].metodoId = value;
        newPagos[index].bancoNombre = bancoObj.nombre;
        newPagos[index].comisionPct = bancoObj.comision || 0;
      } else if (field === 'monto') {
        newPagos[index].monto = value;
      }
      return newPagos;
    });
  };

  // --- Cálculos Matemáticos ---
  const sumaPagosMonto = pagosCompra.reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0);
  const precioEbay = Number(formData.precio_ebay) || sumaPagosMonto;

  const totalComisiones = pagosCompra.reduce((acc, p) => {
    const montoNum = parseFloat(p.monto) || 0;
    return acc + (montoNum * ((p.comisionPct || 0) / 100));
  }, 0);

  const costoMasComision = precioEbay + totalComisiones;
  const costosAdicionales = Number(formData.costos_adicionales) || 0;
  const envioUsd = Number(formData.envio_usd) || 0;

  const costoTotal = costoMasComision + costosAdicionales + envioUsd;
  const costoTotalUsd = costoTotal;
  const precioPublicado = Number(formData.precio) || 0;
  const gananciaEstimada = precioPublicado - costoTotal;

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
        pagos_compra: pagosCompra.map(p => ({
          ...p,
          monto: parseFloat(p.monto) || 0,
          comisionMonto: (parseFloat(p.monto) || 0) * ((p.comisionPct || 0) / 100)
        })),
        total_comisiones: totalComisiones,
        costo_mas_comision: costoMasComision,
        costos_adicionales: costosAdicionales,
        envio_usd: envioUsd,
        envio_bs: Number(formData.envio_bs) || 0,
        tasa_bcv: Number(formData.tasa_bcv) || 0,

        borrador: formData.borrador,
        costo_total: costoTotal,
        costo_total_usd: costoTotalUsd,
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Agregar Nueva Laptop</h1>
          <p className="text-sm text-slate-500">Llena los datos de la laptop para añadirla al catálogo</p>
        </div>
      </div>

      {showSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3">
          <Check className="w-5 h-5 text-emerald-600" />
          <span className="font-semibold">¡Laptop guardada exitosamente! Redirigiendo...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos Principales */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Laptop className="w-5 h-5 text-brand-600" /> Información Básica
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo *</label>
              <input
                type="text" name="modelo" required
                value={formData.modelo} onChange={handleChange}
                placeholder="Ej. ThinkPad T14 Gen 2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca *</label>
              <input
                type="text" name="marca" required
                value={formData.marca} onChange={handleChange}
                placeholder="Ej. Lenovo, Dell, HP..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Procesador (CPU) *</label>
              <input
                type="text" name="cpu" required
                value={formData.cpu} onChange={handleChange}
                placeholder="Ej. i7-1165G7"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Memoria RAM *</label>
              <input
                type="text" name="ram" required
                value={formData.ram} onChange={handleChange}
                placeholder="Ej. 16GB DDR4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Almacenamiento *</label>
              <input
                type="text" name="almacenamiento" required
                value={formData.almacenamiento} onChange={handleChange}
                placeholder="Ej. 512GB NVMe SSD"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tarjeta Gráfica (GPU)</label>
              <input
                type="text" name="gpu"
                value={formData.gpu} onChange={handleChange}
                placeholder="Ej. Intel Iris Xe / RTX 3050"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pantalla</label>
              <input
                type="text" name="pantalla"
                value={formData.pantalla} onChange={handleChange}
                placeholder='Ej. 14" FHD IPS'
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pantalla Táctil</label>
              <select
                name="touch" value={formData.touch} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="No">No</option>
                <option value="Sí">Sí</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sistema Operativo</label>
              <input
                type="text" name="windows"
                value={formData.windows} onChange={handleChange}
                placeholder="Ej. Windows 11 Pro"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado Batería</label>
              <select
                name="bateria" value={formData.bateria} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="Excelente">Excelente (&gt;80%)</option>
                <option value="Buena">Buena (60-80%)</option>
                <option value="Regular">Regular (40-60%)</option>
                <option value="Nueva">Nueva / Reemplazada</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Disponibilidad</label>
              <select
                name="disponibilidad" value={formData.disponibilidad} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
              >
                <option value="Disponible">Disponible</option>
                <option value="Coming soon">Coming soon</option>
                <option value="Vendida">Vendida</option>
                <option value="Reservada">Reservada</option>
              </select>
            </div>
          </div>
        </div>

        {/* Estado Físico */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Estado Físico</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-gray-700">Estado Pantalla</label>
                <span className="text-sm font-bold text-blue-600">{formData.estadoPantalla} / 10</span>
              </div>
              <input
                type="range" name="estadoPantalla" min="1" max="10"
                value={formData.estadoPantalla} onChange={handleSliderChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-gray-700">Estado Carcasa</label>
                <span className="text-sm font-bold text-blue-600">{formData.estadoCarcasa} / 10</span>
              </div>
              <input
                type="range" name="estadoCarcasa" min="1" max="10"
                value={formData.estadoCarcasa} onChange={handleSliderChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones / Detalles</label>
            <textarea
              name="otros" rows="2"
              value={formData.otros} onChange={handleChange}
              placeholder="Ej. Pequeño rayón imperceptible en tapa..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Costos y Finanzas */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Costos y Métodos de Pago de Compra</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Compra</label>
              <input
                type="date" name="fecha_compra"
                value={formData.fecha_compra} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio eBay / Compra Total (USD)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">$</span>
                <input
                  type="number" step="0.01" name="precio_ebay" min="0"
                  value={formData.precio_ebay !== '' ? formData.precio_ebay : (sumaPagosMonto > 0 ? sumaPagosMonto : '')}
                  onChange={handleChange}
                  placeholder={sumaPagosMonto > 0 ? sumaPagosMonto.toFixed(2) : "0.00"}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Desglose de Métodos de Pago de Compra */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Desglose de Pago de Compra (Bancos y Comisiones)
              </label>
              <button
                type="button"
                onClick={handleAddPago}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Método de Pago
              </button>
            </div>

            {pagosCompra.map((pago, idx) => {
              const montoNum = parseFloat(pago.monto) || 0;
              const comisionMonto = montoNum * ((pago.comisionPct || 0) / 100);
              return (
                <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-2.5 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <select
                      value={pago.metodoId}
                      onChange={e => handlePagoChange(idx, 'metodoId', e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      {bancosList.map(b => (
                        <option key={b.id || b.nombre} value={b.id || b.nombre}>
                          {b.nombre} ({b.comision}% comisión)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relative w-full sm:w-36">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400 text-xs">$</span>
                    <input
                      type="number" step="0.01" min="0" placeholder="Monto"
                      value={pago.monto}
                      onChange={e => handlePagoChange(idx, 'monto', e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 border border-gray-300 rounded text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="w-full sm:w-36 text-xs text-gray-500 flex items-center justify-between sm:justify-end gap-1 px-1">
                    <span>Comisión ({pago.comisionPct}%):</span>
                    <span className="font-bold text-gray-700">+${comisionMonto.toFixed(2)}</span>
                  </div>

                  {pagosCompra.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePago(idx)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}

            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-200 text-xs text-slate-600">
              <span>Suma Pagos: <strong className="text-slate-900">${sumaPagosMonto.toFixed(2)}</strong></span>
              <span>Total Comisiones: <strong className="text-amber-600">+${totalComisiones.toFixed(2)}</strong></span>
              <span className="font-bold text-slate-800 text-sm">Costo + Comisión: ${costoMasComision.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Tasa BCV (o tasa de pago)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">Bs</span>
                <input
                  type="number" step="0.01" name="tasa_bcv" min="0"
                  value={formData.tasa_bcv} onChange={handleChange}
                  placeholder="Ej. 36.50"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Envío (USD final)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">$</span>
                <input
                  type="number" step="0.01" name="envio_usd" min="0"
                  value={formData.envio_usd} onChange={handleChange}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Se calcula automáticamente al ingresar Bs y Tasa, o puede ingresarlo manualmente en USD.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio Publicado Venta (USD) *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">$</span>
                <input
                  type="number" step="0.01" name="precio" required min="0"
                  value={formData.precio} onChange={handleChange}
                  placeholder="Ej. 450.00"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-bold text-brand-700"
                />
              </div>
            </div>
          </div>

          {/* Resumen de Costos */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Costo Total USD</p>
              <p className="text-2xl font-black text-blue-800">${costoTotalUsd.toFixed(2)}</p>
              <p className="text-[10px] text-blue-500 mt-1">Costo + Comisión + Adicionales + Envíos</p>
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
                ${gananciaEstimada.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Subida de Imágenes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Upload className="w-5 h-5 text-brand-600" /> Galería de Imágenes
          </h2>

          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-brand-500 transition-colors">
            <input
              type="file" multiple accept="image/*"
              onChange={handleFileChange}
              id="file-upload" className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Haz clic para subir fotos o arrástralas aquí</span>
              <span className="text-xs text-gray-400">PNG, JPG, WEBP de hasta 5MB</span>
            </label>
          </div>

          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              {imagePreviews.map((src, index) => (
                <div key={index} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-video">
                  <img src={src} alt={`Vista previa ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {index === 0 && (
                    <span className="absolute bottom-1 left-1 bg-brand-600 text-white text-[10px] px-1.5 py-0.5 rounded">
                      Principal
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botón Submit */}
        <div className="flex items-center justify-end gap-4">
          <button
            type="button" onClick={() => navigate('/admin')}
            className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit" disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? uploadProgress : 'Guardar Laptop'}
          </button>
        </div>
      </form>
    </div>
  );
}
