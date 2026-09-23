import { useState, useRef } from 'react';
import { Save, ArrowLeft, Image as ImageIcon, CheckCircle, X, Loader2, Plus, DollarSign, Trash2 } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadToCloudinary } from '../../utils/imageOptimizer';
import { syncTrackingFromEbay } from '../../utils/syncTrackingFromEbay';
import { useCuentasCaja } from '../../utils/useCuentasCaja';
import { COMISIONES_POR_CUENTA } from '../../utils/bancos';

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
      precio: '',
      unidades: '1',
      disponibilidad: 'Disponible',
      imagenes: [],
      estadoPantalla: 10,
      estadoCarcasa: 9,
      otros: ebayData ? `Compra eBay #${ebayData.orderId || ''}\nItem URL: ${ebayData.item_url || ''}` : '',
      borrador: false,
      fecha_compra: ebayData?.fecha_compra || new Date().toISOString().split('T')[0],
      costo_compra: ebayData?.precio ? String(ebayData.precio) : '',
      observaciones_compra: ebayData ? `Orden eBay #${ebayData.orderId || ''}\nURL: ${ebayData.item_url || ''}` : '',
      generacion: '',
      velocidad: '',
      capacidad: '',
      interfaz: '',
      tipo_ssd: '',
      capacidad_bateria: '',
      ciclo: '',
      descripcion: '',
      descripcion_personalizada: '',
      bluetooth: '',
    };
  });

  const [pagosCompra, setPagosCompra] = useState(() => {
    if (ebayData?.precio) {
      return [
        { metodoId: 'paypal', bancoNombre: 'PayPal', monto: String(ebayData.precio), comisionPct: 0 }
      ];
    }
    return [
      { metodoId: 'efectivo', bancoNombre: 'Efectivo', monto: '', comisionPct: 0 }
    ];
  });

  const { todasCuentas, cuentasBS = [], cuentasUSD = [] } = useCuentasCaja();

  const normalizarLabel = (s) => (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const getComisionPorCuenta = (cuentaKey, cuentaLabel) => {
    const key = String(cuentaKey || '').toLowerCase();
    if (COMISIONES_POR_CUENTA[key] !== undefined) return COMISIONES_POR_CUENTA[key];
    return COMISIONES_POR_CUENTA[normalizarLabel(cuentaLabel)] ?? 0;
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

  const sumaPagosMonto = pagosCompra.reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0);
  const costoCompra = Number(formData.costo_compra) || sumaPagosMonto;
  const totalComisiones = pagosCompra.reduce((acc, p) => {
    const montoNum = parseFloat(p.monto) || 0;
    return acc + (montoNum * ((p.comisionPct || 0) / 100));
  }, 0);
  const costoTotal = costoCompra + totalComisiones;
  const precioVenta = Number(formData.precio) || 0;
  const gananciaEstimada = precioVenta - costoTotal;

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

      // --- LOGICA DE CAJA Y MOVIMIENTOS FINANCIEROS ---
      let cajaUpdates = {};
      let movimientosToCreate = [];

      pagosCompra.forEach(p => {
        const montoNum = parseFloat(p.monto);
        if (montoNum > 0 && p.metodoId) {
          cajaUpdates[p.metodoId] = increment(-montoNum);
          const cuentaObj = todasCuentas.find(c => c.key === p.metodoId);
          movimientosToCreate.push({
            coleccion: 'compras_inventario',
            datos: {
              categoria: 'compra_componente',
              concepto: `Compra componente: ${formData.nombre || formData.tipo}`,
              monto: montoNum,
              monto_original: montoNum,
              moneda_original: cuentaObj?.moneda || 'USD',
              metodo_pago: p.metodoId,
              fecha: serverTimestamp()
            }
          });
        }
      });

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
        borrador: Boolean(formData.borrador),
        fecha_compra: formData.fecha_compra || null,
        costo_compra: costoCompra,
        observaciones_compra: formData.observaciones_compra || '',
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
        costo_total: costoTotal,
        ganancia_estimada: gananciaEstimada,
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
      } else if (formData.tipo === 'OTROS') {
        componentData.descripcion = formData.descripcion;
        componentData.descripcion_personalizada = formData.descripcion;
      }

      const newCompRef = await addDoc(collection(db, 'componentes'), componentData);

      // Impactar en saldos de caja y crear movimientos contables
      if (Object.keys(cajaUpdates).length > 0) {
        cajaUpdates.updated_at = new Date();
        await updateDoc(doc(db, 'caja', 'saldos'), cajaUpdates);
      }
      for (const mov of movimientosToCreate) {
        mov.datos.componente_id = newCompRef.id;
        await addDoc(collection(db, mov.coleccion), mov.datos);
      }

      // Si viene de eBay, actualizar estado en compras_ebay y sincronizar con trackings
      if (ebayData?.id) {
        try {
          let trackingId = null;
          if (ebayData.tracking_usa) {
            trackingId = await syncTrackingFromEbay(db, {
              ebayItem: ebayData,
              inventoryItem: {
                id: newCompRef.id,
                nombre: formData.nombre,
                modelo: formData.marca || '',
                costo: costoCompra
              },
              tipo: 'componente'
            });
          }

          await updateDoc(doc(db, 'compras_ebay', ebayData.id), {
            estado: 'en_inventario',
            tipo_inventario: 'componente',
            inventario_id: newCompRef.id,
            tracking_id: trackingId || ebayData.tracking_id || null,
            fecha_actualizacion: serverTimestamp(),
          });
        } catch (eErr) {
          console.warn('Error actualizando compras_ebay o trackings:', eErr);
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
                      <option value="OTROS">OTROS</option>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Precio Venta Catálogo ($USD)</label>
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

                  <div className="sm:col-span-2 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        name="borrador"
                        checked={formData.borrador}
                        onChange={e => setFormData(prev => ({ ...prev, borrador: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span className="text-sm font-bold text-amber-950">Guardar como Borrador</span>
                        <p className="text-xs text-amber-800/80 mt-0.5">
                          Si está marcado como borrador, <strong>no se publicará</strong> en la página de catálogo de componentes.
                        </p>
                      </div>
                    </label>
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

                  {formData.tipo === 'OTROS' && (
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                      <textarea
                        name="descripcion"
                        value={formData.descripcion}
                        onChange={handleChange}
                        placeholder="Describe aquí las características o especificaciones del componente..."
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-y"
                      />
                    </div>
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

              {/* Sección de Costos y Finanzas de Compra */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                  Datos de Compra y Métodos de Pago
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Compra</label>
                    <input
                      type="date"
                      name="fecha_compra"
                      value={formData.fecha_compra}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Costo de Compra Total (USD)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        name="costo_compra"
                        min="0"
                        value={formData.costo_compra !== '' ? formData.costo_compra : (sumaPagosMonto > 0 ? sumaPagosMonto : '')}
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
                            {cuentasBS.length > 0 && (
                              <optgroup label="── Cuentas en Bolívares (BS) ──">
                                {cuentasBS.map(c => (
                                  <option key={c.key} value={c.key}>
                                    {c.label} ({c.moneda})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {cuentasUSD.length > 0 && (
                              <optgroup label="── Cuentas en Dólares (USD) ──">
                                {cuentasUSD.map(c => (
                                  <option key={c.key} value={c.key}>
                                    {c.label} ({c.moneda})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {cuentasBS.length === 0 && cuentasUSD.length === 0 && todasCuentas.map(c => (
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
                    <span className="font-bold text-slate-800 text-sm">Costo + Comisión: ${costoTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Observaciones de la compra */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observaciones de Compra
                    <span className="text-xs font-normal text-gray-400 ml-2">(interno — ej. lote, proveedor, tienda)</span>
                  </label>
                  <textarea
                    name="observaciones_compra"
                    value={formData.observaciones_compra}
                    onChange={handleChange}
                    placeholder='Ej. "Comprado por paquete de 5 unidades en eBay / Amazon..."'
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-y"
                  />
                </div>

                {/* Resumen de Costos y Ganancia */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3.5 border border-blue-100">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Costo Total Compra</p>
                    <p className="text-xl font-black text-blue-800">${costoTotal.toFixed(2)}</p>
                    <p className="text-[10px] text-blue-500 mt-0.5">Costo base + Comisiones</p>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-3.5 border border-purple-100">
                    <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Precio Venta Catálogo</p>
                    <p className="text-xl font-black text-purple-800">${precioVenta.toFixed(2)}</p>
                    <p className="text-[10px] text-purple-500 mt-0.5">Precio al público</p>
                  </div>

                  <div className={`${gananciaEstimada >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} rounded-lg p-3.5 border`}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${gananciaEstimada >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      Ganancia Estimada
                    </p>
                    <p className={`text-xl font-black ${gananciaEstimada >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                      ${gananciaEstimada.toFixed(2)}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${gananciaEstimada >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      Precio Venta − Costo
                    </p>
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
