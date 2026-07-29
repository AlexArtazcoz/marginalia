# marginalia

Cuaderno de lectura personal de Alex. Blanco y negro, extremadamente simple.

## Qué es

- Biblioteca organizada por años en la barra lateral.
- Cada libro tiene dos lienzos: **Apuntes** (reflexiones durante la lectura) y **Reseña**
  (al terminar), más estado ○ leyendo / ● terminado.

## Cómo se ejecuta

- `node server.js` → http://localhost:7777. Sin dependencias, sin build.

## Datos

- `data/books.json` — fuente de verdad: todos los libros, apuntes y reseñas. El servidor
  lo reescribe con cada autoguardado. Son reflexiones personales: tratarlas con cuidado.
- `books/` — PDF/EPUB de los libros que Alex está leyendo. **Ignorado por git: nunca
  subir estos archivos a GitHub** (copyright).

## Flujo con Claude

1. Alex deja el PDF/EPUB del libro en `books/` y lo comparte en una sesión.
2. Claude lo lee para tener contexto del libro y de los apuntes de Alex en
   `data/books.json`.
3. Con ese contexto, ayuda a conversar sobre las reflexiones y a redactar la reseña final.

## Estilo

- Solo blanco, negro y grises; tipografía serif; interfaz en castellano.
- Vanilla HTML/CSS/JS, cero dependencias. Mantenerlo mínimo: cualquier función nueva
  debe justificar su presencia.
