# Posits — tablero de posits virtuales

Un tablero web de notas con posits realistas y aspecto de **cuaderno cuadriculado dibujado a mano**.
Se abre con un enlace en el navegador de la PC y del celular (no hay que instalar nada) y las notas
se ven igual en ambos. La visión completa del proyecto está en [`CLAUDE.md`](./CLAUDE.md).

## Estado

| Etapa | Qué incluye | Estado |
| --- | --- | --- |
| 1 | Tablero, posits arrastrables/redimensionables, color, texto, guardado automático | ✅ hecha |
| 2 | Viñetas, pendientes con casillas y tachado tipo lápiz | ✅ hecha |
| 3 | Íconos dibujados a mano (en el tablero, en el posit y dentro del texto) y letras manuscritas (negrita, cursiva, subrayado) | ✅ hecha |
| 4 | Varios tableros | ⏳ |
| 5 | Sincronización en la nube + inicio de sesión (Supabase) y, con eso, el «cerebro» de Chispa con un modelo de lenguaje | ⏳ |

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

### Qué suma la Etapa 3

- **123 íconos dibujados a mano** (propios: contorno de marcador con el relleno de color algo corrido, como
  cuando el marcador se pasa de la raya), pensados para el trabajo de compras de un hospital:
  **Urgente** (sirena, fuego, rayo, reloj sonando, bandera roja, semáforos de prioridad…), **Hoy** (sol,
  calendario con el día marcado, cronómetro, meta…), **Compras** (cotización, orden de compra, factura,
  sello, firma, expediente, camión, soles…), **Salud**, **Contacto**, **Estado** y **Divertidos**.
- **Panel de íconos** (botón de la hojita del estuche, o la tecla `I`): buscador que ignora tildes
  («camion» encuentra «Camión de entrega»), categorías y **recientes**.
- **Se pegan de tres maneras**:
  1. *Sueltos en la hoja*: un toque y cae en un hueco libre; se arrastra donde se quiera, sin imán.
  2. *Sobre un posit*: con un posit seleccionado el ícono se pega en su esquina (los siguientes, en fila).
     Si arrastras uno suelto y lo **sueltas encima de un posit, se le pega** y desde entonces se mueve,
     se duplica y se borra con él; si lo sacas del posit, queda suelto otra vez.
  3. *Dentro del texto*: con el posit en escritura, el botón «Ícono» lo mete junto a lo que escribes
     (por ejemplo, un 🔥 al lado de un pendiente urgente); se borra con Retroceso como una letra.
- Un ícono seleccionado muestra su marco, un **tirador para cambiar el tamaño** (esquina) y una **perilla para
  girarlo** (arriba, unida por un hilo). La barra inferior trae Duplicar, más pequeño, más grande, girar ↺ ↻ y
  Borrar (con «Deshacer»).
- **Girar íconos**: arrastra la perilla (con el dedo o el ratón) y el ícono gira sobre su centro siguiéndote;
  muestra los grados y se pega a 0°, 45°, 90°… (con `Mayús`, de 15° en 15°; con `Alt`, libre). Los botones ↺ ↻ (o las
  teclas `[` y `]`) lo giran al siguiente ángulo de 15°, así un ícono chueco se endereza en un toque. Al agrandar
  un ícono girado, el tirador sigue bajo el dedo (crece desde su centro).
- **Letras manuscritas a elegir por posit** (botón «Letra»): Pluma (Kalam, la de siempre), Rápida, Cuaderno,
  Plano, Redonda, Marcador fino, Alta y angosta y Marcador grueso, ajustadas para verse del mismo tamaño.
- **Negrita, cursiva y subrayado** mientras se escribe (botones o `Ctrl+B` / `Ctrl+I` / `Ctrl+U`).

### Extra: Chispa, la mascota

Una mascota propia (dibujada con el mismo generador de trazo a mano de los íconos; no es el logo ni la mascota de
nadie) que vive sobre el estuche y hace de asistente. Todo ocurre **en tu aparato**: no envía nada a ninguna parte.

- **Aspecto 3D de juguete**: el cuerpo, la chispa de la cabeza y la cara flotan a distinta profundidad dentro de un
  escenario con perspectiva, con degradados de luz, ojos brillantes y sombra en el suelo. Gira hacia lo que mira
  y se ve el paralaje.
- **Te ve**: sus pupilas siguen al cursor (o al dedo); si dejas el ratón quieto, siguen el cursor de escritura o el
  posit seleccionado; cada tanto mira por ahí y **parpadea** (a veces doble). Se **duerme** (con «zzz») tras 90 s sin
  tocar nada y se despierta al moverte.
- **Comenta lo que escribes**, en una nube dibujada a mano que se va escribiendo letra por letra (y ella mueve la
  boca). Espera a que hagas una pausa, nunca te interrumpe mientras tecleas, y no es pesada: como mucho un comentario
  cada 20 s y ocho cada 10 min, sin repetir tema. Entiende urgencias, hoy/mañana/días, horas, montos, trámites de
  compras (expediente, TDR, factura, orden de compra…), insumos médicos, llamadas, correos, reuniones, preguntas,
  cansancio y posits muy largos o con líneas que parecen pendientes.
- **Ofrece ayuda con un botón**: «Pintar de rojo» un posit urgente, «Poner sirena», «Poner teléfono»… se aceptan
  con un toque y no te sacan del posit ni cierran el teclado.
- **Celebra**: al marcar un pendiente festeja (ojos contentos, brazos arriba) y, a veces, dice «Van 3 de 5»; al
  terminar un posit o todo el tablero, más. Al abrir la app saluda según la hora y resume tus pendientes.
- **Tócala** para que te diga un consejo o cuántos pendientes te quedan, y para elegir **«Que calle»** (sigue mirando
  pero no comenta) u **«Ocultar»** (solo asoma su chispa; tócala para que vuelva). Se recuerda en cada dispositivo.
- En el celular se apoya sobre el estuche (sube cuando aparece la barra de acciones) y se hace más chica con el
  teclado abierto.

Es un asistente de **reglas** (`src/mascot/`): lee las palabras del posit y decide qué decir. Para que sea más
«inteligente» (entender frases libres, resumir, redactar) habría que conectarla a un modelo de lenguaje; el plan y sus
requisitos están en la Etapa 5.

Atajos de teclado (PC): `N` nuevo · `I` íconos · `Enter` escribir · `Esc` salir · `Supr` borrar · `Ctrl+D` duplicar ·
flechas mueven el posit o el ícono · `+` `-` `0` zoom (con un ícono seleccionado, su tamaño) · `[` `]` girar el ícono ·
`F` ver todo · `Ctrl+Mayús+8` viñetas · `Ctrl+Mayús+9` pendientes · `Ctrl+B` `Ctrl+I` `Ctrl+U` estilo del texto.

## Cómo probarla

```bash
npm install
npm run dev          # http://localhost:5173  (y la dirección de "Network" para abrirla desde el celular en la misma wifi)
```

```bash
npm run build        # compila a dist/
npm run preview      # sirve dist/ en http://localhost:4173
npm test             # pruebas unitarias (lógica de datos, geometría, guardado)
npm run e2e          # pruebas en un navegador real (Etapas 1 a 3, giro de íconos y mascota), tamaño PC y celular con toques reales (necesita `npm run build`)
npm run icons        # vuelve a generar los íconos (src/icons/data.generated.ts) y a Chispa (src/mascot/art.generated.ts)
npm run icons:sheet -- --cat urgente   # hoja de revisión de los íconos (PNG en scripts/icons/out/)
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
- **Íconos generados** (`scripts/icons/`): cada ícono se describe con unas pocas formas (círculos, polígonos,
  curvas) en un lienzo de 64 × 64 y un generador las convierte en trazos Bézier con un temblor controlado y
  determinista (el mismo ícono sale siempre igual). El resultado (`src/icons/data.generated.ts`, unos 130 KB)
  son datos estáticos: en la app no se calcula nada, y la tinta y el grosor se ajustan con CSS según dónde
  se pegue el ícono (papel oscuro → tinta clara).
- **Datos locales primero** (`src/store/`): Zustand + guardado automático en el dispositivo. Los identificadores son
  UUID y cada posit lleva `updatedAt`, pensando ya en la sincronización de la Etapa 5.
- Las medidas de los posits están en **unidades del tablero** y las letras van incluidas en la app:
  por eso se ven iguales en cualquier pantalla.

```
src/
  board/     tablero: vista (zoom/pan), gestos, posit, ícono pegado, editor
  icons/     catálogo, buscador y dibujo de los íconos (los datos vienen de scripts/icons)
  mascot/    Chispa: dibujo en capas 3D, mirada y parpadeo, nube de comentarios, cerebro de reglas
  store/     datos: almacén, guardado automático
  ui/        barra superior, estuche de marcadores, panel de íconos, letra y estilo, acciones, avisos
  lib/       geometría, paleta y contraste, letras, utilidades
  styles/    tokens, tablero, posit, íconos, interfaz
scripts/icons/  dibujos de los íconos y generador de trazo a mano
e2e/         pruebas con navegador real e ícono de la app
```

## Licencias

Ver [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
