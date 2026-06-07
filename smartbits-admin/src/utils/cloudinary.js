/**
 * Utilidad de URLs de Cloudinary para el catálogo público de Smartbits.
 *
 * Tamaños fijos definidos para evitar transformaciones dinámicas en Cloudinary:
 *  - thumb : 200 px  → miniaturas en galería del modal
 *  - card  : 640 px  → imagen principal en tarjetas del catálogo
 *  - full  : 1200 px → imagen en detalle / modal principal
 *
 * Para URLs que NO sean de Cloudinary (Firebase Storage, etc.) retorna la URL sin cambios.
 */

const IMAGE_SIZES = {
  thumb: 200,
  card:  640,
  full:  1200,
};

/**
 * Transforma una URL de Cloudinary para aplicar f_auto, q_auto y un ancho fijo.
 *
 * @param {string} url - URL original almacenada en Firestore.
 * @param {'thumb' | 'card' | 'full'} [size='card'] - Tamaño fijo a aplicar.
 * @returns {string} URL con transformaciones o la misma URL si no es de Cloudinary.
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

  return url.replace('/upload/', `/upload/${transformation}/`);
}
