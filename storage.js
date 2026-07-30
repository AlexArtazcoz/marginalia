/* Capa de almacenamiento de meditaciones (versión web).
   La biblioteca es pública: se LEE sin clave desde el propio repo.
   Para ESCRIBIR hace falta la clave de GitHub de Alex (fine-grained,
   Contents sobre AlexArtazcoz/marginalia), guardada una vez por dispositivo. */

const IS_SERVER = ['localhost', '127.0.0.1'].includes(location.hostname);
const GH_REPO = 'AlexArtazcoz/marginalia';
const GH_BRANCH = 'main';
const GH_PATH = 'data/books.json';
const RAW_BASE = `https://raw.githubusercontent.com/${GH_REPO}/${GH_BRANCH}/`;
const KEY_TOKEN = 'meditaciones_github_token';
const KEY_CACHE = 'meditaciones_cache';

const ghToken = () =>
  localStorage.getItem(KEY_TOKEN) ||
  localStorage.getItem('github_backup_token') || // Sistema comparte origen…
  localStorage.getItem('dades_github_backup_token') || // …y EgoDe también
  '';

const canEdit = () => IS_SERVER || ghToken().length > 0;

function enableEditPrompt() {
  const v = prompt('Clave de GitHub (token fine-grained con permiso Contents sobre ' + GH_REPO + '):');
  if (v && v.trim()) {
    localStorage.setItem(KEY_TOKEN, v.trim());
    location.reload();
  }
}

async function ghApi(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ghToken()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const err = new Error(`GitHub ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

const b64ToText = (b64) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

function textToB64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
}

// misma fusión que server.js: por libro gana el más reciente, los campos que el
// otro lado no conoce sobreviven, y solo se borra lo listado en `deleted`
function mergeBooks(disk, incomingBooks, deletedList) {
  const deleted = new Set(deletedList);
  const incoming = new Map(incomingBooks.filter((b) => b && b.id).map((b) => [b.id, b]));
  const merged = [];
  for (const d of Array.isArray(disk.books) ? disk.books : []) {
    const inc = incoming.get(d.id);
    if (inc) {
      merged.push(String(inc.updatedAt) >= String(d.updatedAt) ? { ...d, ...inc } : { ...inc, ...d });
      incoming.delete(d.id);
    } else if (!deleted.has(d.id)) {
      merged.push(d);
    }
  }
  for (const inc of incoming.values()) if (!deleted.has(inc.id)) merged.push(inc);
  return { books: merged };
}

let remoteSha = null; // sha del fichero en la punta (solo se sabe leyendo via API)
let lastRawText = ''; // último JSON visto por raw, para detectar cambios sin clave

const parseBooks = (text) => {
  const data = JSON.parse(text);
  return data && Array.isArray(data.books) ? data : { books: [] };
};

async function githubLoad() {
  const file = await ghApi(`/repos/${GH_REPO}/contents/${GH_PATH}?ref=${GH_BRANCH}`);
  remoteSha = file.sha;
  return parseBooks(b64ToText(file.content));
}

// lectura pública: el raw del repo, con la fecha como rompe-cachés del CDN
async function rawLoad() {
  const res = await fetch(`${RAW_BASE}${GH_PATH}?t=${Date.now()}`);
  if (!res.ok) throw new Error(`raw ${res.status}`);
  const text = await res.text();
  lastRawText = text;
  return parseBooks(text);
}

async function loadRemote() {
  if (ghToken()) {
    try {
      return await githubLoad();
    } catch { /* clave mala o sin red: prueba el raw público */ }
  }
  return rawLoad();
}

async function githubSave(books, deletedList) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let base = { books: [] };
    try {
      base = await githubLoad();
    } catch (e) {
      if (e.status !== 404) throw e; // 404: el fichero aún no existe
      remoteSha = null;
    }
    const merged = mergeBooks(base, books, deletedList);
    const body = {
      message: 'meditaciones: actualiza la biblioteca',
      // mismo formato que writeData() del servidor, para diffs limpios
      content: textToB64(JSON.stringify(merged, null, 2) + '\n'),
      branch: GH_BRANCH,
    };
    if (remoteSha) body.sha = remoteSha;
    try {
      const put = await ghApi(`/repos/${GH_REPO}/contents/${GH_PATH}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      remoteSha = put.content.sha;
      return merged;
    } catch (e) {
      if (e.status !== 409 && e.status !== 422) throw e;
      // la punta se movió entre lectura y escritura: refresca y refusiona
    }
  }
  throw new Error('conflicto persistente');
}

// red de seguridad al editar desde la web: copia local por si la pestaña
// se cierra con cambios en vuelo; se refusiona al volver a abrir
function cacheLocal() {
  try {
    localStorage.setItem(KEY_CACHE, JSON.stringify({ books: state.data.books, deleted: [...deletedIds] }));
  } catch { /* sin sitio: la próxima subida lo cubre */ }
}

function readCache() {
  try {
    const raw = localStorage.getItem(KEY_CACHE);
    const data = raw ? JSON.parse(raw) : null;
    return data && Array.isArray(data.books) ? data : null;
  } catch {
    return null;
  }
}

// cada minuto, si el remoto avanzó y aquí no se está escribiendo, refresca
function startPoll() {
  const tick = async () => {
    if (document.hidden || pendingSave) return;
    const active = document.activeElement;
    const typing = active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT');
    if (document.hasFocus() && typing) return;
    try {
      let fresh = null;
      if (ghToken()) {
        const before = remoteSha;
        const loaded = await githubLoad();
        if (remoteSha !== before) fresh = loaded;
      } else {
        const before = lastRawText;
        const loaded = await rawLoad();
        if (lastRawText !== before) fresh = loaded;
      }
      if (fresh) {
        state.data = fresh;
        if (canEdit() && !IS_SERVER) cacheLocal();
        if (state.currentId && !fresh.books.some((b) => b.id === state.currentId)) state.currentId = null;
        render();
        showStatus('actualizado', true);
      }
    } catch { /* sin conexión: se reintenta en el próximo tic */ }
  };
  setInterval(tick, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
}
