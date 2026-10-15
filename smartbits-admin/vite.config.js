import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function libertyProxyPlugin() {
  return {
    name: 'liberty-proxy-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/liberty')) {
          return next();
        }

        try {
          const parsedUrl = new URL(req.url, 'http://localhost');
          
          // Endpoint optimizado para consultas completas de Liberty Express
          if (parsedUrl.pathname === '/api/liberty/query') {
            let guide = parsedUrl.searchParams.get('guide') || parsedUrl.searchParams.get('nGuia') || '';

            // Si vino por POST, leer el body
            if (req.method === 'POST') {
              const chunks = [];
              for await (const chunk of req) chunks.push(chunk);
              const rawBody = Buffer.concat(chunks).toString();
              try {
                const jsonBody = JSON.parse(rawBody);
                if (jsonBody.guide) guide = jsonBody.guide;
              } catch (_) {
                const params = new URLSearchParams(rawBody);
                if (params.get('guide')) guide = params.get('guide');
              }
            }

            // Conservar guiones en números de guía venezolanos (WR01-, WRTMP-, LIB-)
            const cleanGuide = String(guide).trim().replace(/\s+/g, '').toUpperCase();
            if (!cleanGuide) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: 'Guía vacía' }));
            }

            const fetchHeaders = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8'
            };

            // Si ya es un formato de guía Liberty (WR01-, WRTMP-, LIB-), intentar GET directo primero
            if (/^(?:WR|LIB|VE)[0-9A-Z_-]+$/i.test(cleanGuide)) {
              try {
                const directUrl = `https://iqpack.libertyexpress.com/Tracking?nGuia=${encodeURIComponent(cleanGuide)}`;
                const directResp = await fetch(directUrl, { headers: fetchHeaders });
                if (directResp.ok) {
                  const directHtml = await directResp.text();
                  if (directHtml.includes('tr-summary') || directHtml.includes('tr-timeline')) {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    return res.end(JSON.stringify({
                      success: true,
                      status: 200,
                      html: directHtml,
                      guide: cleanGuide
                    }));
                  }
                }
              } catch (_) {}
            }

            // 1. GET /SearchGuide para obtener token anti-falsificación y cookies ASP.NET
            const getResp = await fetch('https://iqpack.libertyexpress.com/SearchGuide', {
              headers: fetchHeaders
            });

            if (!getResp.ok) {
              res.statusCode = getResp.status;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: `Error HTTP ${getResp.status} en página de Tracking` }));
            }

            const getHtml = await getResp.text();
            const tokenMatch = getHtml.match(/name=["']__RequestVerificationToken["'][^>]*value=["']([^"']+)["']/i) ||
                               getHtml.match(/value=["']([^"']+)["'][^>]*name=["']__RequestVerificationToken["']/i);
            const token = tokenMatch ? tokenMatch[1] : '';

            const rawCookies = typeof getResp.headers.getSetCookie === 'function' 
              ? getResp.headers.getSetCookie() 
              : [getResp.headers.get('set-cookie')];
            const cookieHeader = rawCookies.filter(Boolean).map(c => c.split(';')[0]).join('; ');

            // 2. POST /SearchGuide emparejando token y cookies
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
              redirect: 'manual'
            });

            let finalHtml = '';
            let finalStatus = postResp.status;

            // Liberty redirige (302) a /Tracking?nGuia=... cuando encuentra la guía
            if (postResp.status === 302 || postResp.status === 301) {
              const location = postResp.headers.get('location');
              if (location) {
                const targetUrl = location.startsWith('http') 
                  ? location 
                  : `https://iqpack.libertyexpress.com${location.startsWith('/') ? '' : '/'}${location}`;
                
                const followResp = await fetch(targetUrl, {
                  headers: {
                    ...fetchHeaders,
                    'Cookie': cookieHeader
                  }
                });
                finalHtml = await followResp.text();
                finalStatus = followResp.status;
              }
            } else {
              finalHtml = await postResp.text();
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              success: finalStatus >= 200 && finalStatus < 400,
              status: finalStatus,
              html: finalHtml,
              guide: cleanGuide
            }));
          }

          // Fallback para otras rutas directas
          const targetPath = req.url.replace(/^\/api\/liberty/, '');
          const targetUrl = `https://iqpack.libertyexpress.com${targetPath}`;

          let bodyBuffer = null;
          if (req.method === 'POST') {
            const chunks = [];
            for await (const chunk of req) {
              chunks.push(chunk);
            }
            bodyBuffer = Buffer.concat(chunks);
          }

          const fetchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://iqpack.libertyexpress.com/Tracking',
            'Origin': 'https://iqpack.libertyexpress.com'
          };

          if (req.headers['content-type']) {
            fetchHeaders['Content-Type'] = req.headers['content-type'];
          }
          if (req.headers['cookie']) {
            fetchHeaders['Cookie'] = req.headers['cookie'];
          }

          const upstreamRes = await fetch(targetUrl, {
            method: req.method,
            headers: fetchHeaders,
            body: bodyBuffer,
            redirect: 'follow'
          });

          res.statusCode = upstreamRes.status;
          const rawCookies = typeof upstreamRes.headers.getSetCookie === 'function' 
            ? upstreamRes.headers.getSetCookie() 
            : [upstreamRes.headers.get('set-cookie')];
          if (rawCookies.length > 0) {
            res.setHeader('Set-Cookie', rawCookies.filter(Boolean));
          }
          res.setHeader('Content-Type', upstreamRes.headers.get('content-type') || 'text/html; charset=utf-8');

          const responseText = await upstreamRes.text();
          res.end(responseText);
        } catch (err) {
          console.error('[Liberty Proxy Error]:', err);
          res.statusCode = 502;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    libertyProxyPlugin(),
  ],
  server: {
    port: 3000,
  },
})
