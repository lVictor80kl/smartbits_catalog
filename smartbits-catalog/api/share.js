// GET /api/share?id=<laptopId> — HTML con Open Graph para vistas previas
// (WhatsApp, Facebook, Telegram). Lee el producto de Firestore (lectura
// pública) y responde metadatos + enlace canónico. No expone colecciones
// privadas: solo lee el documento `laptops/<id>` permitido por las reglas.
//
// Requiere en Vercel: FIREBASE_PROJECT_ID y FIREBASE_API_KEY,
// o las ya existentes VITE_FIREBASE_PROJECT_ID y VITE_FIREBASE_API_KEY
// (la API key web es pública; ya viaja en el cliente).

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const fstr = (f) => f?.stringValue ?? '';

function ogImage(url) {
  if (!url) return null;
  if (url.includes('res.cloudinary.com/') && url.includes('/upload/')) {
    return url.replace(
      /\/upload\/(?:[^/]*[_ ,][^/]*\/)?/,
      '/upload/f_auto,q_auto,c_pad,b_white,w_1200,h_630/'
    );
  }
  return url;
}

function page({ title, description, image, url, host }) {
  const img = image || `https://${host}/logo-black.png`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Smartbits" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(img)}" />
${url ? `<meta property="og:url" content="${esc(url)}" />` : ''}
<meta name="twitter:card" content="summary_large_image" />
</head>
<body>
<main style="font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 24px;text-align:center">
<h1>${esc(title)}</h1>
<p>${esc(description)}</p>
${url ? `<p><a href="${esc(url)}">Ver en Smartbits</a></p>` : ''}
</main>
</body>
</html>`;
}

export default async function handler(req, res) {
  const id = String(req.query?.id || '').trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=60');

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;

  if (!id || !projectId || !apiKey || !host) {
    return res.status(404).send(page({
      title: 'Smartbits | Compra Inteligente',
      description: 'Catálogo de laptops y componentes. Compra inteligente, compra en Smartbits.',
      host: host || 'localhost',
    }));
  }

  const canonical = `https://${host}/equipo/${encodeURIComponent(id)}`;

  let doc;
  try {
    const r = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/laptops/${encodeURIComponent(id)}?key=${apiKey}`
    );
    if (!r.ok) throw new Error(`firestore ${r.status}`);
    doc = await r.json();
  } catch {
    return res.status(404).send(page({
      title: 'Equipo no encontrado | Smartbits',
      description: 'Este equipo ya no está disponible en el catálogo de Smartbits.',
      url: canonical,
      host,
    }));
  }

  const f = doc.fields || {};
  if (f.borrador?.booleanValue) {
    return res.status(404).send(page({
      title: 'Equipo no disponible | Smartbits',
      description: 'Este equipo ya no está disponible en el catálogo de Smartbits.',
      url: canonical,
      host,
    }));
  }

  const marca = fstr(f.marca);
  const modelo = fstr(f.modelo);
  const precio = f.precio?.integerValue ?? f.precio?.doubleValue ?? f.precio?.stringValue ?? '';
  const specs = [fstr(f.cpu), fstr(f.ram), fstr(f.almacenamiento)].filter(Boolean).join(' · ');
  const disp = fstr(f.disponibilidad);

  const title = `${marca} ${modelo} | Smartbits`.trim();
  const description = [
    specs,
    precio !== '' ? `$${precio} USD` : '',
    disp,
  ].filter(Boolean).join(' · ') || 'Catálogo Smartbits. Compra inteligente, compra en Smartbits.';

  const imgs = f.imagenes?.arrayValue?.values || [];
  let image = null;
  for (const v of imgs) {
    if (v?.stringValue) { image = ogImage(v.stringValue); break; }
  }
  if (!image && fstr(f.imagen)) image = ogImage(fstr(f.imagen));

  return res.status(200).send(page({ title, description, image, url: canonical, host }));
}
