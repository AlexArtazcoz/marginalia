const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const state = {
  data: { books: [] },
  currentId: null,
  tab: 'notes', // 'notes' | 'review'
};

const current = () => state.data.books.find((b) => b.id === state.currentId) || null;

/* ---- guardado ---- */

let saveTimer = null;
let statusTimer = null;
let pendingSave = false;
const deletedIds = new Set(); // borrados explícitos de esta sesión, para la fusión del servidor

function showStatus(text, fade) {
  const el = $('#save-status');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(statusTimer);
  if (fade) statusTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

function scheduleSave() {
  pendingSave = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 600);
}

async function flushSave() {
  clearTimeout(saveTimer);
  if (!pendingSave) return;
  pendingSave = false;
  try {
    const res = await fetch('/api/books', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ books: state.data.books, deleted: [...deletedIds] }),
    });
    if (!res.ok) throw new Error(res.status);
    showStatus('guardado', true);
  } catch {
    pendingSave = true;
    showStatus('no se pudo guardar — reintentando…');
    saveTimer = setTimeout(flushSave, 2500);
  }
}

function touch(b) {
  b.updatedAt = new Date().toISOString();
  scheduleSave();
}

/* ---- biblioteca por años ---- */

function renderSidebar() {
  const nav = $('#library');
  const books = [...state.data.books].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  if (!books.length) {
    nav.innerHTML = '<p class="hint">Todavía no hay libros.</p>';
    return;
  }
  const years = [...new Set(books.map((b) => b.year))].sort((a, b) => b - a);
  nav.innerHTML = '';
  for (const year of years) {
    const section = document.createElement('section');
    section.className = 'year';
    section.innerHTML = `<h2>${esc(year)}</h2>`;
    for (const b of books.filter((x) => x.year === year)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'book' +
        (b.id === state.currentId ? ' active' : '') +
        (b.status === 'terminado' ? ' done' : '');
      btn.innerHTML =
        `<span class="t">${b.title ? esc(b.title) : '<em>Sin título</em>'}</span>` +
        (b.author ? `<span class="a">${esc(b.author)}</span>` : '');
      btn.addEventListener('click', () => {
        state.currentId = b.id;
        state.tab = 'notes';
        render();
      });
      section.appendChild(btn);
    }
    nav.appendChild(section);
  }
}

/* ---- página del libro ---- */

function renderMain() {
  const main = $('#main');
  const b = current();
  if (!b) {
    main.innerHTML = '<div class="empty">Elige un libro o añade uno nuevo.</div>';
    $('#focus-toggle').classList.add('hidden');
    document.title = 'meditaciones';
    return;
  }
  $('#focus-toggle').classList.remove('hidden');
  document.title = (b.title ? b.title + ' · ' : '') + 'meditaciones';

  const isNotes = state.tab === 'notes';
  main.innerHTML = `
    <article class="page">
      <header>
        <input class="title" placeholder="Título" value="${esc(b.title)}">
        <input class="author" placeholder="Autor" value="${esc(b.author)}">
        <div class="meta">
          <input class="year-input" inputmode="numeric" value="${esc(b.year)}">
          <span>·</span>
          <button type="button" class="status">${b.status === 'terminado' ? '● terminado' : '○ leyendo'}</button>
        </div>
      </header>
      <nav class="tabs">
        <button type="button" class="tab${isNotes ? ' active' : ''}" data-tab="notes">Apuntes</button>
        <button type="button" class="tab${!isNotes ? ' active' : ''}" data-tab="review">Reseña</button>
      </nav>
      <textarea class="canvas" placeholder="${isNotes
        ? 'Escribe aquí las reflexiones que te vayan acompañando durante la lectura…'
        : 'Cuando termines el libro, deja aquí tu reseña…'}"></textarea>
      <footer class="page-footer">
        <span class="words"></span>
        <button type="button" class="delete">eliminar libro</button>
      </footer>
    </article>`;

  const ta = $('.canvas', main);
  ta.value = isNotes ? b.notes || '' : b.review || '';
  autosize(ta);
  updateWords(ta.value);

  $('.title', main).addEventListener('input', (e) => {
    b.title = e.target.value;
    document.title = (b.title ? b.title + ' · ' : '') + 'meditaciones';
    touch(b);
    renderSidebar();
  });
  $('.author', main).addEventListener('input', (e) => {
    b.author = e.target.value;
    touch(b);
    renderSidebar();
  });
  $('.year-input', main).addEventListener('change', (e) => {
    b.year = parseInt(e.target.value, 10) || new Date().getFullYear();
    e.target.value = b.year;
    touch(b);
    renderSidebar();
  });
  $('.status', main).addEventListener('click', (e) => {
    b.status = b.status === 'terminado' ? 'leyendo' : 'terminado';
    e.target.textContent = b.status === 'terminado' ? '● terminado' : '○ leyendo';
    touch(b);
    renderSidebar();
  });
  for (const tab of main.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => {
      state.tab = tab.dataset.tab;
      renderMain();
    });
  }
  ta.addEventListener('input', () => {
    if (state.tab === 'notes') b.notes = ta.value;
    else b.review = ta.value;
    touch(b);
    autosize(ta);
    updateWords(ta.value);
  });

  const del = $('.delete', main);
  let disarmTimer = null;
  del.addEventListener('click', () => {
    if (!del.dataset.armed) {
      del.dataset.armed = '1';
      del.textContent = '¿seguro? esto lo elimina del todo';
      disarmTimer = setTimeout(() => {
        delete del.dataset.armed;
        del.textContent = 'eliminar libro';
      }, 4000);
      return;
    }
    clearTimeout(disarmTimer);
    deletedIds.add(b.id);
    state.data.books = state.data.books.filter((x) => x.id !== b.id);
    state.currentId = null;
    scheduleSave();
    render();
  });

  // clic en el margen de la página → seguir escribiendo
  $('.page', main).addEventListener('click', (e) => {
    if (e.target.classList.contains('page')) ta.focus();
  });
}

function autosize(ta) {
  const main = $('#main');
  const sc = main.scrollTop;
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
  main.scrollTop = sc;
}

function updateWords(text) {
  const el = $('.words');
  if (!el) return;
  const n = (text.trim().match(/\S+/g) || []).length;
  el.textContent = n === 0 ? '' : n === 1 ? '1 palabra' : `${n.toLocaleString('es-ES')} palabras`;
}

function render() {
  renderSidebar();
  renderMain();
}

/* ---- arranque ---- */

$('#add-book').addEventListener('click', () => {
  const now = new Date().toISOString();
  const b = {
    id: crypto.randomUUID(),
    title: '',
    author: '',
    year: new Date().getFullYear(),
    status: 'leyendo',
    notes: '',
    review: '',
    createdAt: now,
    updatedAt: now,
  };
  state.data.books.push(b);
  state.currentId = b.id;
  state.tab = 'notes';
  scheduleSave();
  render();
  $('.title')?.focus();
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    flushSave();
  }
});

/* ---- modo lienzo: sin biblioteca y a pantalla completa ---- */

function setFocus(on) {
  document.body.classList.toggle('focus', on);
  $('#focus-toggle').textContent = on ? '× salir' : '⤢ lienzo';
  if (on) {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      try {
        const p = req.call(el);
        if (p && p.catch) p.catch(() => {});
      } catch { /* si el navegador lo deniega, el modo lienzo funciona igual */ }
    }
    $('.canvas')?.focus();
  } else if (document.fullscreenElement || document.webkitFullscreenElement) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  }
}

$('#focus-toggle').addEventListener('click', () => {
  setFocus(!document.body.classList.contains('focus'));
});

// al salir de pantalla completa con Esc, vuelve también la biblioteca
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) {
  document.addEventListener(ev, () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement && document.body.classList.contains('focus')) {
      setFocus(false);
    }
  });
}

// guardar también al cambiar de app o esconder la pestaña
window.addEventListener('blur', flushSave);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushSave();
});

window.addEventListener('pagehide', () => {
  if (pendingSave) {
    const payload = JSON.stringify({ books: state.data.books, deleted: [...deletedIds] });
    navigator.sendBeacon('/api/books', new Blob([payload], { type: 'application/json' }));
  }
});

(async function init() {
  try {
    const res = await fetch('/api/books');
    if (!res.ok) throw new Error(res.status);
    state.data = await res.json();
  } catch {
    $('#main').innerHTML =
      '<div class="empty">No se pudo cargar la biblioteca — arranca el servidor con «node server.js».</div>';
    return;
  }
  if (!Array.isArray(state.data.books)) state.data = { books: [] };
  const last = [...state.data.books].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  if (last) state.currentId = last.id;
  render();
})();
