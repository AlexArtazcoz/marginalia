# meditaciones

Cuaderno de lectura en blanco y negro (el título viene de las *Meditaciones* de Marco
Aurelio). Una biblioteca organizada por años y, para cada libro, un lienzo en blanco:
**Apuntes** para las reflexiones que van surgiendo durante la lectura y **Reseña** para
cuando lo terminas. El botón «⤢ lienzo» esconde la biblioteca y pone el navegador a
pantalla completa: solo queda el papel (Esc para volver).

## Ejecutar

```bash
node server.js
```

Abre <http://localhost:7777>. Sin dependencias ni build: solo Node.js.

## Cómo funciona

- Todo se guarda solo mientras escribes, en `data/books.json`.
- `books/` es para dejar los PDF/EPUB de los libros que estás leyendo (ignorado por git,
  no se sube a GitHub).
- Pensado para usarse junto a Claude Code: al compartir el libro y los apuntes en una
  sesión, tiene todo el contexto para conversar sobre las reflexiones y ayudar con la
  reseña final.
