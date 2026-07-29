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

- Todo se guarda solo mientras escribes, en `data/books.json`, y la página baja sola
  para que el cursor nunca quede pegado al fondo.
- Cada libro puede llevar adjunto su epub/pdf («+ adjuntar epub/pdf» en su ficha);
  queda en `books/` (ignorado por git, no se sube a GitHub).
- Al terminar un libro, Claude genera su **imprescindible**: una sola página que
  explica el libro a quien nunca lo ha leído, con las reflexiones y la voz de Alex.
  Queda en `essentials/` y se descarga desde la ficha del libro.
- Pensado para usarse junto a Claude Code: con el libro y los apuntes tiene todo el
  contexto para conversar sobre las reflexiones y ayudar con la reseña final.
