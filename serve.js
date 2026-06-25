// Minimaler statischer Server ohne Abhängigkeiten.
// Start:  node serve.js   →   http://localhost:8080
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    // PS#0005: Versionsendpunkt
    if (urlPath === '/.well-known/version') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end((process.env.BTV_IMAGE_VERSION || 'dev') + '\n');
      return;
    }
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(ROOT, path.normalize(urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Nicht gefunden: ' + urlPath);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (e) {
    res.writeHead(500);
    res.end('Serverfehler');
  }
});

server.listen(PORT, () => {
  console.log('Augsburger GenerativBibel läuft auf Port ' + PORT + ' (Version ' + (process.env.BTV_IMAGE_VERSION || 'dev') + ')');
});
