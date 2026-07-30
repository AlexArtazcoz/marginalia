# meditaciones (repo: marginalia)

Cuaderno de lectura personal de Alex. Blanco y negro, extremadamente simple. La app se
llama «meditaciones» (título tomado de las *Meditaciones* de Marco Aurelio); el repo de
GitHub conserva el nombre `marginalia`.

## Qué es

- Biblioteca organizada por años en la barra lateral.
- Cada libro tiene dos lienzos: **Apuntes** (reflexiones durante la lectura) y **Reseña**
  (al terminar), más estado ○ leyendo / ● terminado.
- Modo lienzo («⤢ lienzo», arriba a la derecha): oculta biblioteca, cabecera y pies, y
  pide pantalla completa al navegador — solo queda el papel. Esc o «× salir» para volver.
- Dictado por voz («◌ dictar», abajo al centro, Web Speech API del navegador): escribe
  lo dictado en el lienzo con mayúsculas y espacios bien puestos, y se autoguarda igual
  que el teclado. El botón pequeño de al lado alterna cat/esp (persistido en
  localStorage). Se reanuda solo cuando el navegador corta por pausas.
- La pestaña del navegador muestra el título del libro abierto.

## Cómo se ejecuta

- **Web (principal desde jul-2026)**: https://alexartazcoz.github.io/marginalia/ —
  GitHub Pages sobre este mismo repo (público). Cualquiera puede LEER la biblioteca;
  para ESCRIBIR hace falta la clave de GitHub de Alex (botón «activar edición» al pie
  de la biblioteca; token fine-grained con permiso Contents sobre este repo, se guarda
  una vez por dispositivo). Despliega `.github/workflows/pages.yml` en cada push que
  toque el código; los commits de datos NO redespliegan.
- **Local (emergencias / trabajo de sesión)**: `node server.js` → http://localhost:7777.
  Sin dependencias, sin build.
- `storage.js` es la capa de almacenamiento del modo web: lectura pública via
  raw.githubusercontent (sin clave) o via API (con clave, al instante), escritura via
  Contents API con la misma fusión por libro que el servidor, caché local anti-pérdidas
  y sondeo cada minuto. En localhost no interviene (manda el servidor).

## Datos

- `data/books.json` — fuente de verdad: todos los libros, apuntes y reseñas. **Desde
  jul-2026 la copia canónica es la de GitHub (rama `main`)**: la versión web guarda
  haciendo commits via API («meditaciones: actualiza la biblioteca»). En sesiones de
  Claude: `git pull` SIEMPRE antes de leer o tocar `data/books.json`; y si se escribe
  en local con el servidor, commit y push al acabar para que la web lo vea.
- El repo es **público** desde el 30-jul-2026 (decisión de Alex): apuntes y reseñas son
  legibles por cualquiera con el enlace.
- `books/` — PDF/EPUB de los libros que Alex está leyendo. **Ignorado por git: nunca
  subir estos archivos a GitHub** (copyright) — con el repo público, más importante aún.

## Flujo con Claude

1. Alex adjunta el epub/pdf desde la propia app («+ adjuntar epub/pdf» en la ficha del
   libro; queda en `books/<bookId>.<ext>`) o lo deja a mano en `books/`.
2. Claude lo lee para tener contexto del libro y de los apuntes de Alex en
   `data/books.json`.
3. Con ese contexto, ayuda a conversar sobre las reflexiones y a redactar la reseña final.

## El imprescindible (síntesis para regalar)

Cuando Alex termina un libro, Claude genera su «imprescindible»:

- **Una sola página** (PDF, A4), blanco y negro, tipografía serif — la misma estética
  que la app.
- Materia prima: el epub/pdf de `books/`, los **Apuntes** y la **Reseña** del libro.
- Objetivo: explicarle el libro a alguien que nunca lo ha leído para que pueda
  disfrutarlo. No es un resumen académico: debe tener la voz y el toque personal de
  Alex — sus reflexiones son el corazón del documento.
- Guardarlo como `essentials/<bookId>.pdf` y registrarlo en el libro vía API (nunca
  editando `data/books.json` a mano con el servidor en marcha):
  `PUT /api/books` con `{"books": [<libro con "essential": {"path": "essentials/<bookId>.pdf", "name": "Imprescindible — <Título>.pdf"}>]}`
  (el servidor fusiona por libro). La app mostrará «imprescindible ↓» en la ficha.
- `essentials/` SÍ se commitea (es obra propia de Alex); `books/` NUNCA (copyright).
  Tras registrar un imprescindible en local: commit y push, para que la web lo sirva.

## API del servidor

- `GET /api/books` — biblioteca completa.
- `PUT /api/books` — guarda con fusión por libro (`{books: [...], deleted: [ids]}`);
  una pestaña desactualizada no puede borrar libros que no conoce, y los campos
  `file`/`essential` sobreviven aunque el cliente no los envíe.
- `POST /api/upload?book=<id>&kind=book|essential&name=<archivo>` — binario en el body;
  guarda en `books/` o `essentials/` y actualiza el libro.

## Plan futuro

La web compartible ya existe (ver «Cómo se ejecuta»): cualquiera con el enlace puede
leer la biblioteca y bajarse los imprescindibles. Los epubs siguen fuera (copyright);
si algún día se comparten, solo ediciones de dominio público.

## Estilo

- Solo blanco, negro y grises; tipografía serif; interfaz en castellano.
- Sin líneas separadoras: la separación se hace solo con espacio en blanco.
- Vanilla HTML/CSS/JS, cero dependencias. Mantenerlo mínimo: cualquier función nueva
  debe justificar su presencia.
