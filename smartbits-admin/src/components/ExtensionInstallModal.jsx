import React, { useState } from 'react';
import { 
  X, Download, Check, Copy, ExternalLink, ShieldCheck, 
  Chrome, Sparkles, FolderArchive, ArrowRight, KeyRound
} from 'lucide-react';

export default function ExtensionInstallModal({ isOpen, onClose }) {
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const copyChromeUrl = () => {
    navigator.clipboard.writeText('chrome://extensions');
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 dark:from-slate-800/60 dark:to-slate-800/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <Chrome className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Extensión Smartbits Sync
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-full">
                  v1.1.0
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sincronizador en vivo de compras eBay y rastreo de couriers
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
          
          {/* BOTÓN DESCARGA PRINCIPAL */}
          <div className="p-4 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-purple-500/5 rounded-2xl border border-blue-200/70 dark:border-blue-900/40 text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <FolderArchive className="w-4 h-4" />
              <span>Paquete oficial de instalación para administradores</span>
            </div>

            <a
              href="/smartbits-ebay-extension.zip"
              download="smartbits-ebay-extension.zip"
              className="inline-flex items-center justify-center gap-2.5 w-full py-3 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all transform active:scale-[0.99] cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Extensión (.ZIP)</span>
            </a>
            
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Listo para instalar en Google Chrome, Brave, Edge o navegadores Chromium.
            </p>
          </div>

          {/* PASOS DE INSTALACIÓN */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Instrucciones de instalación (1 minuto)
            </h4>

            {/* Paso 1 */}
            <div className="flex gap-3 items-start bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-bold text-xs flex items-center justify-center mt-0.5">
                1
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">
                  Descomprime el archivo descargado
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Haz clic derecho en el archivo <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-[11px]">smartbits-ebay-extension.zip</code> y selecciona <strong>"Extraer todo..."</strong> en una carpeta de tu preferencia.
                </p>
              </div>
            </div>

            {/* Paso 2 */}
            <div className="flex gap-3 items-start bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-bold text-xs flex items-center justify-center mt-0.5">
                2
              </span>
              <div className="space-y-1.5 flex-1">
                <p className="font-semibold text-slate-900 dark:text-white">
                  Abre la página de extensiones en Chrome
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Abre una pestaña en tu navegador y accede a:
                </p>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="font-mono text-xs text-slate-800 dark:text-slate-200 flex-1 px-1">
                    chrome://extensions
                  </span>
                  <button
                    onClick={copyChromeUrl}
                    className="px-2 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded flex items-center gap-1 transition cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Paso 3 */}
            <div className="flex gap-3 items-start bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-bold text-xs flex items-center justify-center mt-0.5">
                3
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">
                  Activa el Modo de desarrollador y carga la carpeta
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Activa el interruptor <strong>"Modo de desarrollador"</strong> (arriba a la derecha). Luego presiona el botón <strong>"Cargar descomprimida"</strong> y selecciona la carpeta extraída.
                </p>
              </div>
            </div>

            {/* Paso 4 */}
            <div className="flex gap-3 items-start bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 font-bold text-xs flex items-center justify-center mt-0.5">
                4
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Inicia sesión con tu cuenta de Smartbits
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Abre la extensión haciendo clic en su icono en la barra de Chrome e ingresa con el <strong>mismo correo y contraseña</strong> que usas en este panel administrativo.
                </p>
              </div>
            </div>

          </div>

          {/* NOTA DE COURIERS & EBAY */}
          <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Acceso global autorizado:</strong> Esta extensión ya incluye la clave de seguridad institucional fijada, permitiendo a cualquier administrador sincronizar pedidos de eBay y consultar Liberty/UPS sin bloqueos.
            </span>
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
          <span className="text-[11px] text-slate-400">
            ID: <code className="font-mono text-slate-500">lcmnomjoiak...</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
