# Posits — tablero de posits virtuales

Un tablero web de notas con posits realistas y aspecto de **cuaderno cuadriculado dibujado a mano**.
Se abre con un enlace en el navegador de la PC y del celular (no hay que instalar nada) y las notas
se ven igual en ambos. La visión completa del proyecto está en [`CLAUDE.md`](./CLAUDE.md).

## Estado

| Etapa | Qué incluye | Estado |
| --- | --- | --- |
| 1 | Tablero, posits arrastrables/redimensionables, color, texto, guardado automático | ✅ hecha |
| 2 | Viñetas, pendientes con casillas y tachado tipo lápiz | ⏳ |
| 3 | Íconos dibujados a mano y fuentes manuscritas (negrita, cursiva, subrayado) | ⏳ |
| 4 | Varios tableros | ⏳ |
| 5 | Sincronización en la nube + inicio de sesión (Supabase) | ⏳ |

### Qué hace la Etapa 1

- **Tablero** de cuaderno cuadriculado (crema) que se desplaza y hace zoom: un dedo (o el ratón) mueve,
  dos dedos pellizcan, `Ctrl` + rueda acerca, «Ver todo» encuadra todos los posits.
- **Posit realista**: papel de color, esquina doblada, cinta adhesiva y sombra suave. Se escribe directo sobre él.
- **Crear** con «＋ Nuevo» (o `N`, o doble clic en el fondo); el posit nace en un hueco libre, sin tapar a otros.
- **Mover** arrastrando desde la cinta (o desde cualquier parte si no estás escribiendo);
  **redimensionar** con el tirador de la esquina; **borrar** con «Borrar» (o `Supr`) y **Deshacer** al instante.
- **Color**: estuche de marcadores para cambiarlo en un toque + paleta completa de 24 colores.
  La tinta se vuelve clara sola sobre papeles oscuros.
- **Un toque selecciona; otro toque escribe** (así el teclado del celular no salta al mover o mirar).
- **Imán a la cuadrícula** (activable): los posits se alinean a los cuadros del cuaderno.
- **Guardado automático** en el dispositivo (indicador «Guardado»).
- Pensado para el **celular**: zonas táctiles grandes, el teclado no tapa lo que escribes, la barra inferior
  queda al alcance del pulgar.

Atajos de teclado (PC): `N` nuevo · `Enter` escribir · `Esc` salir · `Supr` borrar · `Ctrl+D` duplicar ·
flechas mueven el posit · `+` `-` `0` zoom · `F` ver todo.

## Cómo probarla

```bash
npm install
npm run dev          # http://localhost:5173  (y la dirección de "Network" para abrirla desde el celular en la misma wifi)
```

```bash
npm run build        # compila a dist/
npm run preview      # sirve dist/ en http://localhost:4173
npm test             # pruebas unitarias (lógica de datos, geometría, guardado)
npm run e2e          # pruebas en un navegador real, tamaño PC y celular con toques reales (necesita `npm run build`)
```

`npm run e2e` deja capturas en `e2e/out/`.

## Cómo está hecha

- **React + TypeScript + Vite** — app estática que se publica como archivos.
- **Tablero en HTML/CSS** (no `<canvas>`) con zoom y desplazamiento propios (`src/board/`): cada posit es
  texto real editable, y el gesto de tocar/arrastrar/pellizcar se comporta igual en PC y celular.
  El movimiento se escribe directo en el DOM para mantener 60 fps.
- **TipTap (ProseMirror)** dentro del posit; el documento se guarda como JSON, listo para las listas
  y los pendientes de la Etapa 2.
- **Datos locales primero** (`src/store/`): Zustand + guardado automático en el dispositivo. Los identificadores son
  UUID y cada posit lleva `updatedAt`, pensando ya en la sincronización de la Etapa 5.
- Las medidas de los posits están en **unidades del tablero** y las letras van incluidas en la app:
  por eso se ven iguales en cualquier pantalla.

```
src/
  board/     tablero: vista (zoom/pan), gestos, posit, editor
  store/     datos: almacén, guardado automático
  ui/        barra superior, estuche de marcadores, acciones, avisos
  lib/       geometría, paleta y contraste, utilidades
  styles/    tokens, tablero, posit, interfaz
e2e/         pruebas con navegador real y generador de íconos
```

## Licencias

Ver [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
