/**
 * Utilidades de imágenes para Smartbits.
 *
 * - uploadToCloudinary: sube un archivo a Cloudinary con un upload preset sin firma.
 * - getCloudinaryUrl: transforma una URL de Cloudinary para agregar f_auto, q_auto
 *   y uno de los 3 tamaños fijos definidos. Evita transformaciones dinámicas en runtime.
 * - compressImage: comprime una imagen en el cliente (se mantiene como utilidad auxiliar).
 */

const CLOUDINARY_CLOUD_NAME  = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME  || 'dhzdul8vt';
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'laptops_preset';

/**
 * Tamaños fijos de imagen para evitar transformaciones dinámicas en Cloudinary.
 *  - thumb : miniaturas en el Dashboard del admin (48–80 px rendereados).
 *  - card  : tarjetas del catálogo público (aspect 4/3, máx ~600 px de ancho visual).
 *  - full  : imagen principal en el modal / vista de detalle.
 */
export const IMAGE_SIZES = {
  thumb: 200,
  card:  640,
  full:  1200,
};

/**
 * Sube un archivo File/Blob a Cloudinary usando un preset sin firma (unsigned).
 * @param {File|Blob} file - Archivo de imagen a subir.
 * @param {(pct: number) => void} [onProgress] - Callback de progreso (0-100).
 * @returns {Promise<string>} URL segura (https) de la imagen en Cloudinary.
 */
export async function uploadToCloudinary(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`
    );

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.secure_url);
      } else {
        let errMsg = `Cloudinary error ${xhr.status}`;
        try {
          const err = JSON.parse(xhr.responseText);
          errMsg = err.error?.message || errMsg;
        } catch (_) { /* ignorar */ }
        reject(new Error(errMsg));
      }
    };

    xhr.onerror = () => reject(new Error('Error de red al subir a Cloudinary'));
    xhr.send(formData);
  });
}

/**
 * Transforma una URL de Cloudinary para agregar f_auto, q_auto y un ancho fijo.
 * Para URLs que NO son de Cloudinary (Firebase Storage, etc.) retorna la URL sin cambios.
 *
 * @param {string} url - URL original de la imagen.
 * @param {'thumb' | 'card' | 'full'} [size='card'] - Tamaño fijo a aplicar.
 * @returns {string} URL transformada.
 *
 * @example
 * getCloudinaryUrl('https://res.cloudinary.com/dhzdul8vt/image/upload/v123/photo.jpg', 'card')
 * // → 'https://res.cloudinary.com/dhzdul8vt/image/upload/f_auto,q_auto,w_640/v123/photo.jpg'
 */
export function getCloudinaryUrl(url, size = 'card') {
  if (!url || !url.includes('res.cloudinary.com')) return url;

  const width = IMAGE_SIZES[size] ?? IMAGE_SIZES.card;
  const transformation = `f_auto,q_auto,w_${width}`;

  // Evitar duplicar transformaciones si ya las tiene
  if (url.includes(transformation)) return url;

  // Insertar transformación justo después de '/upload/'
  return url.replace('/upload/', `/upload/${transformation}/`);
}

/**
 * Comprime y redimensiona una imagen en el cliente utilizando la API nativa de Canvas.
 * Útil para pre-comprimir antes de subir cuando se requiera.
 *
 * @param {File|Blob} file - El archivo original.
 * @param {number} maxWidth - Ancho máximo (default 1200).
 * @param {number} quality  - Calidad JPEG 0.0–1.0 (default 0.82).
 * @returns {Promise<Blob>} Blob comprimido en JPEG.
 */
export function compressImage(file, maxWidth = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return resolve(file);

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No se pudo obtener el contexto 2D del Canvas'));

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Error al comprimir la imagen en Canvas'));
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = reject;
    };

    reader.onerror = reject;
  });
}
