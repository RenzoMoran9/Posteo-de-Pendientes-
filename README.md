# Posits — tablero de posits virtuales

Un tablero web de notas con posits realistas y aspecto de **cuaderno cuadriculado dibujado a mano**.
Se abre con un enlace en el navegador de la PC y del celular (no hay que instalar nada) y las notas
se ven igual en ambos. La visión completa del proyecto está en [`CLAUDE.md`](./CLAUDE.md).

## Estado

| Etapa | Qué incluye | Estado |
| --- | --- | --- |
| 1 | Tablero, posits arrastrables/redimensionables, color, texto, guardado automático | ✅ hecha |
| 2 | Viñetas, pendientes con casillas y tachado tipo lápiz | ✅ hecha |
| 3 | Íconos dibujados a mano y fuentes manuscritas (negrita, cursiva, subrayado) | ⏳ |
| 4 | Varios tableros | ⏳ |
| 5 | Sincronización en la nube + inicio de sesión (Supabase) | ⏳ |

### Qué hace la Etapa 1

- **Tablero** de cuaderno cuadriculado (crema) que se desplaza y hace zoom: un dedo (o el ratón) mueve,
  dos dedos pellizcan, `Ctrl` + rueda acerca, «Ver todo» encuadra todos los posits.
- **Posit realista**: papel de color, esquina doblada, cinta adhesiva de taller (enmascarar, ducto, azul de pintor…)
  y sombra suave. Se escribe directo sobre él, con letra manuscrita.
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

### Qué suma la Etapa 2

- **Viñetas y pendientes con casilla** dentro del posit. Al escribir, la barra inferior cambia a
  «Listo · Viñetas · Pendientes · Borrar» (en el celular, solo íconos). También funcionan los atajos de
  escritura: `- ` + espacio arma una viñeta y `[ ] ` + espacio un pendiente. `Enter` sigue la lista y
  `Enter` en un renglón vacío sale de ella.
- **Pasar de pendientes a viñetas (o al revés) convierte toda la lista**, con el cursor donde estaba.
- **Marcar una casilla no necesita abrir el posit**: con un toque basta (zona táctil de ~44 px), sin teclado.
  Pensado para revisar y palomear desde el celular.
- **Tachado de lápiz**: al marcar, un trazo de grafito recorre cada renglón (medido sobre el texto real,
  así que sigue los saltos de línea) y la fila baja a ~55 % de opacidad; la palomita se dibuja de un solo trazo.
  No se reanima al cargar un pendiente que ya estaba marcado, sigue al texto si lo editas o cambias el
  tamaño del posit, y respeta «reducir movimiento» del sistema.

Atajos de teclado (PC): `N` nuevo · `Enter` escribir · `Esc` salir · `Supr` borrar · `Ctrl+D` duplicar ·
flechas mueven el posit · `+` `-` `0` zoom · `F` ver todo ·
`Ctrl+Mayús+8` viñetas · `Ctrl+Mayús+9` pendientes.

## Cómo probarla

```bash
npm install
npm run dev          # http://localhost:5173  (y la dirección de "Network" para abrirla desde el celular en la misma wifi)
```

```bash
npm run build        # compila a dist/
npm run preview      # sirve dist/ en http://localhost:4173
npm test             # pruebas unitarias (lógica de datos, geometría, guardado)
npm run e2e          # pruebas en un navegador real (Etapas 1 y 2), tamaño PC y celular con toques reales (necesita `npm run build`)
```

`npm run e2e` deja capturas en `e2e/out/`.

## Cómo está hecha

- **React + TypeScript + Vite** — app estática que se publica como archivos.
- **Tablero en HTML/CSS** (no `<canvas>`) con zoom y desplazamiento propios (`src/board/`): cada posit es
  texto real editable, y el gesto de tocar/arrastrar/pellizcar se comporta igual en PC y celular.
  El movimiento se escribe directo en el DOM para mantener 60 fps.
- **Aspecto**: el fondo es una hoja de cuaderno cuadriculada crema; la interfaz es de "taller" (chapa de grafito,
  azul acero y naranja de seguridad, esquinas casi rectas, trazo grueso con sombra dura y un temblor SVG de dibujo a mano).
  Todo son *tokens* en `src/styles/tokens.css`, así que cambiar colores o letras es tocar un solo archivo.
- **TipTap (ProseMirror)** dentro del posit; el documento se guarda como JSON. La casilla con su tachado
  (`src/board/taskItem.ts`) es una vista propia del pendiente: se puede marcar con el posit cerrado y dibuja
  el lápiz con SVG sobre los renglones reales.
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
