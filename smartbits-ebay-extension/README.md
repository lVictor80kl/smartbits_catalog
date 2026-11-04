# Smartbits - Extensión de Chrome para Sincronización de eBay

Esta extensión extrae tus compras realizadas en eBay directamente desde tu navegador y las sincroniza en tiempo real con la base de datos Firestore de tu panel administrativo de Smartbits.

## 🚀 Cómo instalarla en Google Chrome (1 minuto)

### Opción A — Descargando el .zip desde el panel administrativo

1. En el panel de Smartbits (Compras eBay o Logística/Trackings) abre el modal
   **"Instalar extensión"** y pulsa **"Descargar Extensión (.ZIP)"**.
2. Extrae el archivo descargado (clic derecho → **"Extraer todo..."**). Obtendrás
   una carpeta con `manifest.json` en la raíz.
3. Abre Google Chrome y escribe en la barra de direcciones:
   ```
   chrome://extensions
   ```
4. En la esquina superior derecha, activa el interruptor **"Modo de desarrollador"** (Developer mode).
5. Haz clic en el botón **"Cargar descomprimida"** (Load unpacked).
6. Selecciona la carpeta que acabas de extraer.
7. ¡Listo! Verás el icono de Smartbits en la barra de extensiones de Chrome (puedes fijarlo con el icono de chincheta).

### Opción B — Desde el código fuente

1. Abre Google Chrome y escribe `chrome://extensions` en la barra de direcciones.
2. En la esquina superior derecha, activa el interruptor **"Modo de desarrollador"** (Developer mode).
3. Haz clic en el botón **"Cargar descomprimida"** (Load unpacked).
4. Selecciona la carpeta `smartbits-ebay-extension` de este repositorio.
5. ¡Listo! Verás el icono de Smartbits en la barra de extensiones de Chrome.

---

## 🎨 Iconos / logo

Los iconos de la extensión se generan a partir del logo oficial de Smartbits
(`icons/logo-source.png`). Para regenerarlos tras un cambio de marca:

```bash
node icons/generate_icons.js
```

---

## 📦 Empaquetado para descarga

El `.zip` que se publica en el panel administrativo se genera con:

```bash
cd smartbits-admin
npm run build:extension-zip
```

> Importante: el script escribe un ZIP con rutas relativas limpias (`manifest.json`
> en la raíz). Si el ZIP se genera con `zip -r` desde Linux, las entradas quedan
> con prefijo `./` y el extractor nativo de Windows muestra el archivo vacío.

---

## 💻 Cómo utilizarla

1. Inicia sesión en tu cuenta de eBay y dirígete a tu **Historial de Compras**:
   [https://www.ebay.com/mye/buy/purchase-history](https://www.ebay.com/mye/buy/purchase-history)
2. Haz clic en el icono de la extensión **Smartbits Sync**.
3. Si es tu primera vez, ingresa tus credenciales de administrador de Smartbits.
4. La extensión leerá automáticamente los pedidos en pantalla (título, precio, fecha, fotos y números de tracking de USA).
5. Selecciona los pedidos que deseas registrar y haz clic en **"Sincronizar con Smartbits"**.
6. En tu panel de administración, entra en **"Compras eBay"** para ver las compras sincronizadas y agregarlas a inventario o tracking.
