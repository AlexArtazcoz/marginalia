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
  // en la web cada guardado es un commit: agrupa más que en localhost
  saveTimer = setTimeout(flushSave, IS_SERVER ? 600 : 8000);
  if (!IS_SERVER) cacheLocal();
}

async function flushSave() {
  clearTimeout(saveTimer);
  if (!pendingSave) return;
  pendingSave = false;
  try {
    if (IS_SERVER) {
      const res = await fetch('/api/books', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books: state.data.books, deleted: [...deletedIds] }),
      });
      if (!res.ok) throw new Error(res.status);
    } else {
      await githubSave(state.data.books, [...deletedIds]);
      cacheLocal();
    }
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

// en la web sin clave se puede leer todo, pero no tocar nada
function applyReadOnly(scope) {
  if (canEdit()) return;
  for (const el of scope.querySelectorAll('input, textarea')) el.readOnly = true;
  for (const el of scope.querySelectorAll('.status, .attach, .delete')) el.classList.add('hidden');
}

/* ---- página del libro ---- */

function renderMain() {
  const main = $('#main');
  const b = current();
  if (!b) {
    main.innerHTML = '<div class="empty">Elige un libro o añade uno nuevo.</div>';
    $('#focus-toggle').classList.add('hidden');
    $('#dictation').classList.add('hidden');
    stopDictation();
    document.title = 'meditaciones';
    return;
  }
  $('#focus-toggle').classList.remove('hidden');
  $('#dictation').classList.toggle('hidden', !DICT_OK || !canEdit());
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
          <span>·</span>
          ${!IS_SERVER
            ? ''
            : b.file
              ? `<a class="file-link" href="${esc(b.file.path)}" download="${esc(b.file.name)}">${esc((b.file.path.split('.').pop() || 'libro'))} ↓</a>
               <button type="button" class="attach">cambiar</button>`
              : '<button type="button" class="attach">+ adjuntar epub/pdf</button>'}
          ${b.essential
            ? `<span>·</span>
               <a class="file-link" href="${esc(IS_SERVER ? b.essential.path : RAW_BASE + b.essential.path)}"${IS_SERVER ? ` download="${esc(b.essential.name)}"` : ' target="_blank" rel="noopener"'}>imprescindible ↓</a>`
            : ''}
        </div>
        <input type="file" class="file-input hidden" accept=".epub,.pdf">
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

  // listo para escribir: cursor al final de lo escrito, a media pantalla
  main.scrollTop = 0;
  ta.focus({ preventScroll: true });
  ta.setSelectionRange(ta.value.length, ta.value.length);
  keepCaretComfortable(ta);

  // Enter en título o autor salta al lienzo
  for (const field of [$('.title', main), $('.author', main)]) {
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        ta.focus();
      }
    });
  }

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
  const fileInput = $('.file-input', main);
  const attach = $('.attach', main);
  if (attach) attach.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    showStatus('subiendo…');
    try {
      const res = await fetch(
        `/api/upload?book=${encodeURIComponent(b.id)}&kind=book&name=${encodeURIComponent(f.name)}`,
        { method: 'POST', body: f }
      );
      if (!res.ok) throw new Error();
      b.file = (await res.json()).file;
      showStatus('libro adjuntado', true);
      renderMain();
    } catch {
      showStatus('no se pudo adjuntar');
    }
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
    keepCaretComfortable(ta);
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

  applyReadOnly(main);
}

function autosize(ta) {
  if (!ta.clientWidth) return; // sin layout todavía (pestaña en segundo plano)
  const main = $('#main');
  const sc = main.scrollTop;
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
  main.scrollTop = sc;
}

/* ---- escritura cómoda: la página baja sola para que el cursor no quede pegado al fondo ---- */

let mirror = null;

// altura del texto desde el inicio del lienzo hasta la línea del cursor,
// medida con un div espejo con la misma tipografía y anchura
function caretOffset(ta) {
  if (!mirror) {
    mirror = document.createElement('div');
    mirror.setAttribute('aria-hidden', 'true');
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.pointerEvents = 'none';
    document.body.appendChild(mirror);
  }
  const cs = getComputedStyle(ta);
  mirror.style.width = ta.clientWidth + 'px';
  mirror.style.fontFamily = cs.fontFamily;
  mirror.style.fontSize = cs.fontSize;
  mirror.style.lineHeight = cs.lineHeight;
  mirror.style.letterSpacing = cs.letterSpacing;
  mirror.textContent = ta.value.slice(0, ta.selectionStart) + '​';
  return mirror.offsetHeight;
}

function keepCaretComfortable(ta) {
  const main = $('#main');
  if (!main.clientHeight || !ta.clientWidth) return; // sin layout todavía
  const caretY = ta.getBoundingClientRect().top - main.getBoundingClientRect().top + caretOffset(ta);
  const comfort = main.clientHeight * 0.6;
  if (caretY > comfort) main.scrollTop += caretY - comfort;
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

/* ---- dictado por voz: escribir sin tocar el teclado ---- */

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const DICT_OK = Boolean(SR);
let rec = null;
let dictating = false;
let dictLang = localStorage.getItem('dict-lang') || 'ca-ES';

// inserta un fragmento dictado en el cursor, con mayúsculas y espacios bien puestos
function insertDictation(text) {
  const ta = $('.canvas');
  const b = current();
  let t = String(text).trim();
  if (!ta || !b || !t) return;
  const pos = ta.selectionStart ?? ta.value.length;
  const before = ta.value.slice(0, pos);
  const after = ta.value.slice(pos);
  if (!before.trim() || /[.!?…]\s*$/.test(before) || /\n\s*$/.test(before)) {
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }
  const glue = before && !/\s$/.test(before) ? ' ' : '';
  ta.value = before + glue + t + after;
  const caret = (before + glue + t).length;
  ta.setSelectionRange(caret, caret);
  if (state.tab === 'notes') b.notes = ta.value;
  else b.review = ta.value;
  touch(b);
  autosize(ta);
  updateWords(ta.value);
  keepCaretComfortable(ta);
}

function setupRec() {
  rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) insertDictation(r[0].transcript);
      else interim += r[0].transcript;
    }
    $('#dict-live').textContent = interim;
  };
  // el navegador corta el reconocimiento en las pausas: mientras se dicte, se reanuda solo
  rec.onend = () => {
    $('#dict-live').textContent = '';
    if (!dictating) return;
    try {
      rec.start();
    } catch {
      setTimeout(() => {
        if (dictating) {
          try { rec.start(); } catch {}
        }
      }, 400);
    }
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      stopDictation();
      showStatus('permite el micrófono para poder dictar');
    }
  };
}

function startDictation() {
  if (!DICT_OK || dictating) return;
  if (!rec) setupRec();
  rec.lang = dictLang;
  dictating = true;
  $('#dictation').classList.add('on');
  $('#dict-toggle').textContent = '● parar';
  try { rec.start(); } catch {}
}

function stopDictation() {
  if (!dictating) return;
  dictating = false;
  $('#dictation').classList.remove('on');
  $('#dict-toggle').textContent = '◌ dictar';
  $('#dict-live').textContent = '';
  try { rec && rec.stop(); } catch {}
}

if (DICT_OK) {
  $('#dict-toggle').addEventListener('click', () => (dictating ? stopDictation() : startDictation()));
  $('#dict-lang').addEventListener('click', () => {
    dictLang = dictLang === 'ca-ES' ? 'es-ES' : 'ca-ES';
    localStorage.setItem('dict-lang', dictLang);
    $('#dict-lang').textContent = dictLang === 'ca-ES' ? 'cat' : 'esp';
    if (rec) rec.lang = dictLang;
    if (dictating) {
      try { rec.stop(); } catch {} // onend lo reanuda ya con el idioma nuevo
    }
  });
  $('#dict-lang').textContent = dictLang === 'ca-ES' ? 'cat' : 'esp';
}

// guardar también al cambiar de app o esconder la pestaña
window.addEventListener('blur', flushSave);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushSave();
});

window.addEventListener('pagehide', () => {
  if (!pendingSave) return;
  if (IS_SERVER) {
    const payload = JSON.stringify({ books: state.data.books, deleted: [...deletedIds] });
    navigator.sendBeacon('/api/books', new Blob([payload], { type: 'application/json' }));
  } else {
    cacheLocal(); // el guardado pendiente se refusiona al volver a abrir
  }
});

(async function init() {
  try {
    if (IS_SERVER) {
      const res = await fetch('/api/books');
      if (!res.ok) throw new Error(res.status);
      state.data = await res.json();
    } else {
      state.data = await loadRemote();
      const cache = canEdit() ? readCache() : null;
      if (cache) {
        // trabajo de este dispositivo que no llegó a subirse: refusiona y súbelo
        const merged = mergeBooks(state.data, cache.books, cache.deleted || []);
        if (JSON.stringify(merged) !== JSON.stringify(state.data)) {
          state.data = merged;
          githubSave(state.data.books, cache.deleted || []).then(cacheLocal).catch(() => {});
        }
      }
    }
  } catch {
    const cache = readCache();
    if (cache) {
      state.data = { books: cache.books };
      showStatus('sin conexión — copia local');
    } else {
      $('#main').innerHTML = IS_SERVER
        ? '<div class="empty">No se pudo cargar la biblioteca — arranca el servidor con «node server.js».</div>'
        : '<div class="empty">No se pudo cargar la biblioteca — revisa la conexión.</div>';
      return;
    }
  }
  if (!Array.isArray(state.data.books)) state.data = { books: [] };
  const last = [...state.data.books].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  if (last) state.currentId = last.id;
  render();
  if (!IS_SERVER) {
    $('#add-book').classList.toggle('hidden', !canEdit());
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'edit-toggle';
    toggle.textContent = canEdit() ? 'cambiar clave' : 'activar edición';
    toggle.addEventListener('click', enableEditPrompt);
    $('#sidebar').appendChild(toggle);
    startPoll();
  }
})();
