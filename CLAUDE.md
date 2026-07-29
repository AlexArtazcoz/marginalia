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
- La pestaña del navegador muestra el título del libro abierto.

## Cómo se ejecuta

- `node server.js` → http://localhost:7777. Sin dependencias, sin build.

## Datos

- `data/books.json` — fuente de verdad: todos los libros, apuntes y reseñas. El servidor
  lo reescribe con cada autoguardado. Son reflexiones personales: tratarlas con cuidado.
- `books/` — PDF/EPUB de los libros que Alex está leyendo. **Ignorado por git: nunca
  subir estos archivos a GitHub** (copyright).

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

## API del servidor

- `GET /api/books` — biblioteca completa.
- `PUT /api/books` — guarda con fusión por libro (`{books: [...], deleted: [ids]}`);
  una pestaña desactualizada no puede borrar libros que no conoce, y los campos
  `file`/`essential` sobreviven aunque el cliente no los envíe.
- `POST /api/upload?book=<id>&kind=book|essential&name=<archivo>` — binario en el body;
  guarda en `books/` o `essentials/` y actualiza el libro.

## Plan futuro

Cuando la biblioteca crezca, Alex quiere poder enviar esta web a cualquier persona para
que se descargue los epubs y los imprescindibles. Pendiente de diseñar (hosting o export
estático). Ojo con el copyright de los epubs al publicar: preferir ediciones de dominio
público, o publicar solo los imprescindibles.

## Estilo

- Solo blanco, negro y grises; tipografía serif; interfaz en castellano.
- Vanilla HTML/CSS/JS, cero dependencias. Mantenerlo mínimo: cualquier función nueva
  debe justificar su presencia.
