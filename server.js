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
  '.epub': 'application/epub+zip',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8',
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
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // Subida del epub/pdf del libro (kind=book) o del imprescindible (kind=essential)
    if (pathname === '/api/upload') {
      if (req.method !== 'POST') {
        res.writeHead(405);
        return res.end();
      }
      const bookId = String(url.searchParams.get('book') || '');
      const field = url.searchParams.get('kind') === 'essential' ? 'essential' : 'file';
      const orig = url.searchParams.get('name') || 'archivo';
      const ext = path.extname(orig).toLowerCase();
      const allowed = field === 'file' ? ['.epub', '.pdf'] : ['.pdf', '.html', '.md'];
      const exists = readData().books.some((x) => x.id === bookId);
      if (!exists || !allowed.includes(ext)) {
        res.writeHead(400, { 'Content-Type': MIME['.json'] });
        return res.end('{"ok":false,"error":"libro o formato no válido"}');
      }
      const chunks = [];
      let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size > 200 * 1024 * 1024) return req.destroy();
        chunks.push(c);
      });
      req.on('end', () => {
        const dir = field === 'file' ? 'books' : 'essentials';
        const fname = bookId.replace(/[^\w-]/g, '') + ext;
        const dest = path.join(ROOT, dir, fname);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, Buffer.concat(chunks));
        const info = { path: `${dir}/${fname}`, name: orig };
        const data = readData(); // relee por si hubo guardados durante la subida
        const book = data.books.find((x) => x.id === bookId);
        if (book) {
          book[field] = info;
          writeData(data);
        }
        res.writeHead(200, { 'Content-Type': MIME['.json'] });
        res.end(JSON.stringify({ ok: true, [field]: info }));
      });
      return;
    }

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
            // Fusión por libro: una pestaña desactualizada nunca puede borrar
            // libros que no conoce; solo se elimina lo que llega en `deleted`.
            const disk = readData();
            const deleted = new Set(Array.isArray(data.deleted) ? data.deleted : []);
            const incoming = new Map(data.books.filter((b) => b && b.id).map((b) => [b.id, b]));
            const merged = [];
            for (const d of Array.isArray(disk.books) ? disk.books : []) {
              const inc = incoming.get(d.id);
              if (inc) {
                // el más reciente gana, pero los campos que el otro no conoce
                // (p. ej. `file`/`essential` de una subida) sobreviven
                merged.push(String(inc.updatedAt) >= String(d.updatedAt) ? { ...d, ...inc } : { ...inc, ...d });
                incoming.delete(d.id);
              } else if (!deleted.has(d.id)) {
                merged.push(d);
              }
            }
            for (const inc of incoming.values()) if (!deleted.has(inc.id)) merged.push(inc);
            writeData({ books: merged });
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
