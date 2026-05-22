/**
 * Comprime y redimensiona una imagen en el cliente utilizando la API nativa de HTML5 Canvas.
 * 
 * @param {File} file - El archivo original seleccionado por el usuario.
 * @param {number} maxWidth - El ancho máximo permitido para la imagen (por defecto 1200px).
 * @param {number} quality - Calidad de compresión entre 0.0 y 1.0 (por defecto 0.8).
 * @returns {Promise<Blob>} Un Promise que se resuelve con el Blob de la imagen comprimida en formato JPEG.
 */
export function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    // Si no es una imagen, resolver con el archivo original inmediatamente
    if (!file.type.startsWith('image/')) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcular nuevas dimensiones manteniendo la relación de aspecto si supera el ancho máximo
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        // Crear elemento Canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('No se pudo obtener el contexto 2D del Canvas'));
        }

        // Dibujar imagen redimensionada en el canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir el canvas a un Blob JPEG con la calidad especificada
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Error al comprimir la imagen en Canvas'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = (err) => {
        reject(err);
      };
    };

    reader.onerror = (err) => {
      reject(err);
    };
  });
}
