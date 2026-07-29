// marginalia — servidor mínimo sin dependencias: estáticos + guardado en data/books.json
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 7777;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'books.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { books: [] };
  }
}

function writeData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, DATA_FILE);
}

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

    if (pathname === '/api/books') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': MIME['.json'] });
        return res.end(JSON.stringify(readData()));
      }
      // PUT desde la app; POST desde sendBeacon al cerrar la pestaña
      if (req.method === 'PUT' || req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (!data || !Array.isArray(data.books)) throw new Error('formato inválido');
            writeData(data);
            res.writeHead(200, { 'Content-Type': MIME['.json'] });
            res.end('{"ok":true}');
          } catch (err) {
            res.writeHead(400, { 'Content-Type': MIME['.json'] });
            res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
          }
        });
        return;
      }
      res.writeHead(405);
      return res.end();
    }

    const rel = path.normalize(pathname === '/' ? 'index.html' : pathname.slice(1));
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('no encontrado');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  })
  .listen(PORT, () => {
    console.log(`marginalia · http://localhost:${PORT}`);
  });
