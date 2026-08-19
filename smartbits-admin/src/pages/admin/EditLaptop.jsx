import { useState, useRef, useEffect } from 'react';
import { Save, ArrowLeft, Image as ImageIcon, CheckCircle, X, Loader2, Plus, DollarSign, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadToCloudinary } from '../../utils/imageOptimizer';
import { getBancosConfig } from '../../utils/bancos';
import { useCuentasCaja } from '../../utils/useCuentasCaja';


export default function EditLaptop() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEditMode);
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
    estadoCarcasa: 9,
    otros: '',
    fecha_compra: '',
    precio_ebay: '',
    costo_banco: '',
    comision_banco: '2',
    costos_adicionales: '',
    envio_usd: '',
    envio_bs: '',
    envio_cuenta: '',
    envio_estado: 'Estimado',
    envio_pagado_monto_bs: 0,
    envio_pagado_monto_usd: 0,
    tasa_bcv: '',

    borrador: false,
  });

  const [bancosList, setBancosList] = useState([]);
  const [pagosCompra, setPagosCompra] = useState([
    { metodoId: 'paypal', bancoNombre: 'PayPal', monto: '', comisionPct: 0 }
  ]);
  const { todasCuentas } = useCuentasCaja();

  // Cargar datos actuales del equipo si estamos en modo edición
  useEffect(() => {
    const fetchLaptop = async () => {
      try {
        const bancos = await getBancosConfig();
        setBancosList(bancos);

        if (!isEditMode) {
          setLoading(false);
          return;
        }

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
            estadoCarcasa: data.estado?.carcasa || 9,
            otros: data.otros || '',
            fecha_compra: data.fecha_compra || '',
            precio_ebay: data.precio_ebay?.toString() || '',
            costos_adicionales: data.costos_adicionales?.toString() || '',
            envio_usd: data.envio_usd?.toString() || '',
            envio_bs: data.envio_bs?.toString() || '',
            envio_cuenta: data.envio_cuenta || '',
            envio_estado: data.envio_estado || 'Estimado',
            envio_pagado_monto_bs: data.envio_pagado_monto_bs || 0,
            envio_pagado_monto_usd: data.envio_pagado_monto_usd || 0,
            tasa_bcv: data.tasa_bcv?.toString() || '',
            borrador: data.borrador ?? false,
          });
          setExistingImages(imgs);

          if (data.pagos_compra && Array.isArray(data.pagos_compra) && data.pagos_compra.length > 0) {
            setPagosCompra(data.pagos_compra.map(p => ({
              metodoId: p.metodoId || p.bancoNombre || 'efectivo',
              bancoNombre: p.bancoNombre || 'Método',
              monto: p.monto?.toString() || '',
              comisionPct: p.comisionPct ?? 0
            })));
          } else if (data.precio_ebay) {
            setPagosCompra([
              { metodoId: 'paypal', bancoNombre: 'PayPal', monto: data.precio_ebay.toString(), comisionPct: 0 }
            ]);
          }
        } else {
          alert('El equipo no existe.');
          navigate('/admin');
        }
      } catch (err) {
        console.error('Error cargando equipo:', err);
        alert('Error al cargar datos: ' + err.message);
      }
      setLoading(false);
    };

    fetchLaptop();
  }, [id, isEditMode, navigate]);

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

  // --- Lógica de Pagos Combinados y Comisiones ---
  const getComisionPorCuenta = (cuentaKey, cuentaLabel) => {
    const banco = bancosList.find(b =>
      (b.id && b.id === cuentaKey) ||
      (b.nombre && b.nombre.toLowerCase() === (cuentaLabel || '').toLowerCase())
    );
    return banco ? (Number(banco.comision) || 0) : 0;
  };

  const handleAddPago = () => {
    const defaultCuenta = todasCuentas[0] || { key: 'efectivo', label: 'Efectivo' };
    setPagosCompra(prev => [
      ...prev,
      {
        metodoId: defaultCuenta.key,
        bancoNombre: defaultCuenta.label,
        monto: '',
        comisionPct: getComisionPorCuenta(defaultCuenta.key, defaultCuenta.label)
      }
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
        const cuentaObj = todasCuentas.find(c => c.key === value) || { key: value, label: value, moneda: 'USD' };
        newPagos[index].metodoId = cuentaObj.key;
        newPagos[index].bancoNombre = cuentaObj.label;
        newPagos[index].comisionPct = getComisionPorCuenta(cuentaObj.key, cuentaObj.label);
      } else if (field === 'monto') {
        newPagos[index].monto = value;
      }
      return newPagos;
    });
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
      const finalUrls = [...existingImages];

      // 1. Subir las nuevas imágenes a Cloudinary si las hay
      for (let i = 0; i < newImageFiles.length; i++) {
        const file = newImageFiles[i];
        setUploadProgress(`Subiendo foto ${i + 1} de ${newImageFiles.length}...`);
        const secureUrl = await uploadToCloudinary(file, (pct) => {
          setUploadProgress(`Subiendo foto ${i + 1} de ${newImageFiles.length}... ${pct}%`);
        });
        finalUrls.push(secureUrl);
      }

      // 2. Guardar o actualizar en Firestore
      setUploadProgress(isEditMode ? 'Actualizando base de datos...' : 'Guardando en base de datos...');

      // --- LOGICA DE CAJA ---
      let nuevoMontoPagadoBs = isEditMode ? (formData.envio_pagado_monto_bs || 0) : 0;
      let nuevoMontoPagadoUsd = isEditMode ? (formData.envio_pagado_monto_usd || 0) : 0;
      let cajaUpdates = {};
      let movimientosToCreate = [];

      // 1. Pago de Compra de Equipo (Solo al CREAR, Opción A)
      if (!isEditMode) {
        pagosCompra.forEach(p => {
          const montoNum = parseFloat(p.monto);
          if (montoNum > 0 && p.metodoId) {
            cajaUpdates[p.metodoId] = increment(-montoNum);
            movimientosToCreate.push({
              coleccion: 'compras_inventario',
              datos: {
                categoria: 'compra_inventario',
                concepto: `Compra equipo: ${formData.marca} ${formData.modelo}`,
                monto: montoNum,
                monto_original: montoNum,
                moneda_original: 'USD',
                metodo_pago: p.metodoId,
                fecha: serverTimestamp()
              }
            });
          }
        });
      }

      // 2. Pago de Envío
      if (formData.envio_estado === 'Pagado' && formData.envio_cuenta) {
        const cuentaObj = todasCuentas.find(c => c.key === formData.envio_cuenta);
        const esBs = cuentaObj?.moneda === 'BS';
        const montoEnvioActualBs = Number(formData.envio_bs) || 0;
        const montoEnvioActualUsd = Number(formData.envio_usd) || 0;

        if (!isEditMode) {
            const montoADescontar = esBs ? montoEnvioActualBs : montoEnvioActualUsd;
            if (montoADescontar > 0) {
                cajaUpdates[formData.envio_cuenta] = increment(-montoADescontar);
                nuevoMontoPagadoBs = esBs ? montoADescontar : 0;
                nuevoMontoPagadoUsd = !esBs ? montoADescontar : 0;
                
                movimientosToCreate.push({
                  coleccion: 'compras_inventario',
                  datos: {
                    categoria: 'envio',
                    concepto: `Envío equipo: ${formData.marca} ${formData.modelo}`,
                    monto: esBs ? (montoADescontar / (Number(formData.tasa_bcv)||1)) : montoADescontar,
                    monto_original: montoADescontar,
                    moneda_original: esBs ? 'BS' : 'USD',
                    metodo_pago: formData.envio_cuenta,
                    fecha: serverTimestamp()
                  }
                });
            }
        } else {
            const montoAnteriorBs = Number(formData.envio_pagado_monto_bs) || 0;
            const montoAnteriorUsd = Number(formData.envio_pagado_monto_usd) || 0;
            
            const montoADescontarBs = montoEnvioActualBs - montoAnteriorBs;
            const montoADescontarUsd = montoEnvioActualUsd - montoAnteriorUsd;

            if (esBs && montoADescontarBs !== 0) {
                cajaUpdates[formData.envio_cuenta] = increment(-montoADescontarBs);
                nuevoMontoPagadoBs = montoEnvioActualBs;
                
                movimientosToCreate.push({
                  coleccion: 'compras_inventario',
                  datos: {
                    categoria: 'envio',
                    concepto: `Ajuste envío equipo: ${formData.marca} ${formData.modelo}`,
                    monto: Math.abs(montoADescontarBs / (Number(formData.tasa_bcv)||1)),
                    monto_original: Math.abs(montoADescontarBs),
                    moneda_original: 'BS',
                    es_ingreso: montoADescontarBs < 0, 
                    metodo_pago: formData.envio_cuenta,
                    fecha: serverTimestamp()
                  }
                });
            } else if (!esBs && montoADescontarUsd !== 0) {
                cajaUpdates[formData.envio_cuenta] = increment(-montoADescontarUsd);
                nuevoMontoPagadoUsd = montoEnvioActualUsd;

                movimientosToCreate.push({
                  coleccion: 'compras_inventario',
                  datos: {
                    categoria: 'envio',
                    concepto: `Ajuste envío equipo: ${formData.marca} ${formData.modelo}`,
                    monto: Math.abs(montoADescontarUsd),
                    monto_original: Math.abs(montoADescontarUsd),
                    moneda_original: 'USD',
                    es_ingreso: montoADescontarUsd < 0,
                    metodo_pago: formData.envio_cuenta,
                    fecha: serverTimestamp()
                  }
                });
            }
        }
      }

      const laptopDataPayload = {
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
        imagen: finalUrls.length > 0 ? finalUrls[0] : '',
        estado: {
          pantalla: formData.estadoPantalla,
          carcasa: formData.estadoCarcasa,
        },
        otros: formData.otros,
        fecha_compra: formData.fecha_compra || null,
        precio_ebay: precioEbay,
        pagos_compra: pagosCompra.map(p => {
          const cuentaObj = todasCuentas.find(c => c.key === p.metodoId);
          return {
            ...p,
            moneda: cuentaObj?.moneda || 'USD',
            monto: parseFloat(p.monto) || 0,
            comisionMonto: (parseFloat(p.monto) || 0) * ((p.comisionPct || 0) / 100)
          };
        }),
        total_comisiones: totalComisiones,
        costo_mas_comision: costoMasComision,
        costos_adicionales: costosAdicionales,
        envio_usd: envioUsd,
        envio_bs: Number(formData.envio_bs) || 0,
        envio_cuenta: formData.envio_cuenta,
        envio_estado: formData.envio_estado,
        envio_pagado_monto_bs: nuevoMontoPagadoBs,
        envio_pagado_monto_usd: nuevoMontoPagadoUsd,
        tasa_bcv: Number(formData.tasa_bcv) || 0,
        borrador: formData.borrador,
        costo_total: costoTotal,
        costo_total_usd: costoTotalUsd,
        ganancia_estimada: gananciaEstimada,
      };

      if (isEditMode) {
        const laptopRef = doc(db, 'laptops', id);
        await updateDoc(laptopRef, {
          ...laptopDataPayload,
          actualizadoEn: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'laptops'), {
          ...laptopDataPayload,
          creadoEn: serverTimestamp(),
        });
      }

      if (Object.keys(cajaUpdates).length > 0) {
        cajaUpdates.updated_at = new Date();
        await updateDoc(doc(db, 'caja', 'saldos'), cajaUpdates);
      }
      for (const mov of movimientosToCreate) {
        await addDoc(collection(db, mov.coleccion), mov.datos);
      }

      setShowSuccess(true);
      setTimeout(() => navigate('/admin'), 1500);
    } catch (err) {
      console.error('Error:', err);
      alert('Error al guardar: ' + err.message);
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
            <h1 className="text-2xl font-bold text-slate-800">
              {isEditMode ? 'Editar Laptop' : 'Añadir Nuevo Equipo'}
            </h1>
            <p className="text-sm text-slate-500">
              {isEditMode ? 'Modifica las especificaciones, costos y fotos del equipo' : 'Registra una laptop en el catálogo público.'}
            </p>
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
                          className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                          title="Eliminar foto"
                        >
                          <X className="w-3.5 h-3.5" />
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
                          className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                          title="Quitar foto"
                        >
                          <X className="w-3.5 h-3.5" />
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
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              Datos de Compra y Métodos de Pago
            </h3>

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
                        {todasCuentas.map(c => (
                          <option key={c.key} value={c.key}>
                            {c.label} ({c.moneda})
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado del Envío</label>
                <select
                  name="envio_estado" value={formData.envio_estado} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="Estimado">Estimado (No pagado aún)</option>
                  <option value="Pagado">Pagado (Descontar de caja)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta de Pago</label>
                <select
                  name="envio_cuenta" value={formData.envio_cuenta} onChange={handleChange}
                  disabled={formData.envio_estado !== 'Pagado'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white disabled:opacity-50"
                  required={formData.envio_estado === 'Pagado'}
                >
                  <option value="">Seleccionar cuenta...</option>
                  {todasCuentas.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
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
                {costoTotal > 0 && (
                  <p className={`text-[10px] mt-1 ${gananciaEstimada >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {((gananciaEstimada / costoTotal) * 100).toFixed(1)}% de margen
                  </p>
                )}
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
