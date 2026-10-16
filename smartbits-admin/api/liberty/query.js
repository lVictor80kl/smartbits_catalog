// smartbits-admin/api/liberty/query.js
// Vercel Serverless Function para consultar Liberty Express (iQPack) sin bloqueos de CORS

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const guide = req.query.guide || req.query.nGuia || '';
  const cleanGuide = String(guide).trim().replace(/\s+/g, '').toUpperCase();
  if (!cleanGuide) {
    return res.status(400).json({ success: false, error: 'Guía vacía' });
  }

  const fetchHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8'
  };

  try {
    // 1. Si es formato de guía Liberty (WR01-, WRTMP-, LIB-), GET directo
    if (/^(?:WR|LIB|VE)[0-9A-Z_-]+$/i.test(cleanGuide)) {
      try {
        const directUrl = `https://iqpack.libertyexpress.com/Tracking?nGuia=${encodeURIComponent(cleanGuide)}`;
        const directResp = await fetch(directUrl, { headers: fetchHeaders });
        if (directResp.ok) {
          const directHtml = await directResp.text();
          if (directHtml.includes('tr-summary') || directHtml.includes('tr-timeline')) {
            return res.status(200).json({
              success: true,
              status: 200,
              html: directHtml,
              guide: cleanGuide
            });
          }
        }
      } catch (_) {}
    }

    // 2. Consulta SearchGuide con token y cookies (para Tracking USA de USPS, UPS, FedEx)
    const getResp = await fetch('https://iqpack.libertyexpress.com/SearchGuide', { headers: fetchHeaders });
    if (!getResp.ok) {
      return res.status(getResp.status).json({ success: false, error: `Error HTTP ${getResp.status} al cargar página de Liberty` });
    }

    const getHtml = await getResp.text();
    const tokenMatch = getHtml.match(/name=["']__RequestVerificationToken["'][^>]*value=["']([^"']+)["']/i) ||
                       getHtml.match(/value=["']([^"']+)["'][^>]*name=["']__RequestVerificationToken["']/i);
    const token = tokenMatch ? tokenMatch[1] : '';

    const rawCookies = typeof getResp.headers.getSetCookie === 'function' 
      ? getResp.headers.getSetCookie() 
      : [getResp.headers.get('set-cookie')];
    const cookieHeader = rawCookies.filter(Boolean).map(c => c.split(';')[0]).join('; ');

    const formData = new URLSearchParams();
    if (token) formData.append('__RequestVerificationToken', token);
    formData.append('FromMobileApp', 'False');
    formData.append('FromReactApp', 'True');
    formData.append('hreflang', '');
    formData.append('NGuia', cleanGuide);

    const postResp = await fetch('https://iqpack.libertyexpress.com/SearchGuide', {
      method: 'POST',
      headers: {
        ...fetchHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieHeader,
        'Referer': 'https://iqpack.libertyexpress.com/SearchGuide',
        'Origin': 'https://iqpack.libertyexpress.com'
      },
      body: formData.toString(),
      redirect: 'follow'
    });

    const finalHtml = await postResp.text();
    return res.status(200).json({
      success: postResp.status >= 200 && postResp.status < 400,
      status: postResp.status,
      html: finalHtml,
      guide: cleanGuide
    });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
}
