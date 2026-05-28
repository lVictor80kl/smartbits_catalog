// Vercel Serverless Function — CORS proxy for Google Sheets CSV
// This avoids the CORS block that happens when PapaParse tries to
// fetch docs.google.com directly from the browser.

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing "url" query parameter.' });
  }

  // Only allow Google Sheets/Docs URLs to prevent open-proxy abuse
  const allowed = [
    'https://docs.google.com/',
    'https://spreadsheets.google.com/',
  ];
  const isAllowed = allowed.some((prefix) => url.startsWith(prefix));

  if (!isAllowed) {
    return res.status(403).json({ error: 'Only Google Sheets URLs are allowed.' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SmartBits-Admin/1.0',
      },
    });

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: `Google returned status ${response.status}` });
    }

    const csvText = await response.text();

    // Return CSV text with permissive CORS headers so the browser can read it
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(csvText);
  } catch (err) {
    console.error('csv-proxy error:', err);
    res.status(500).json({ error: 'Failed to fetch CSV from Google.' });
  }
}
