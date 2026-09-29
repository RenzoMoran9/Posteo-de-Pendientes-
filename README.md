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
| 5 | Sincronización en la nube + inicio de sesión (Supabase) | ⏳ |
| Extra | La mascota de Claude (muñeco de bloques en 3D), **conversar con Claude** sobre tus pendientes, y la barra de instrumentos de escritura | ✅ hecha |

### Qué hace la Etapa 1

- **Tablero** de cuaderno cuadriculado (crema) que se desplaza y hace zoom: un dedo (o el ratón) mueve,
  dos dedos pellizcan, `Ctrl` + rueda acerca, «Ver todo» encuadra todos los posits.
- **Posit realista**: papel de color, esquina doblada, cinta adhesiva de taller (enmascarar, ducto, azul de pintor…)
  y sombra suave. Se escribe directo sobre él, con letra manuscrita.
- **Crear** con «＋ Nuevo» (o `N`, o doble clic en el fondo); el posit nace en un hueco libre, sin tapar a otros.
- **Mover** arrastrando desde la cinta (o desde cualquier parte si no estás escribiendo);
  **redimensionar** con el tirador de la esquina; **borrar** con «Borrar» (o `Supr`) y **Deshacer** al instante.
- **Color**: paleta chiquita de 24 colores que se abre desde el botón de la derecha de la barra (muestra el color en
  uso). La tinta se vuelve clara sola sobre papeles oscuros.
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
- **Letras manuscritas a elegir por posit**, como instrumentos de escritura (ver «La barra de instrumentos»): Pluma
  (Kalam, la de siempre), Bolígrafo, Lápiz, Punta fina, Pincel, Marcador, Portaminas y Marcador grueso, ajustadas para
  verse del mismo tamaño. También se cambian con el botón «Letra» de la barra de acciones.
- **Negrita, cursiva y subrayado** mientras se escribe (botones o `Ctrl+B` / `Ctrl+I` / `Ctrl+U`).

### Extra: la barra de instrumentos

La barra de abajo tiene el aire de un estuche de instrumentos (chapa oscura, esquinas cortadas, azul acero):

- **«Nuevo»** pega un posit en un hueco libre.
- **Ocho instrumentos de escritura, dibujados en vectores propios** (pluma estilográfica, bolígrafo, lápiz, punta fina,
  pincel, marcador, portaminas y marcador grueso), cada uno con su brillo y su volumen. **Cada instrumento es un tipo de
  letra**, y debajo trae una muestra («Hola») escrita con esa letra. El que tienes en la mano se ilumina (pestaña
  azul arriba, el instrumento se levanta) y vale para el posit seleccionado **y** para los posits nuevos; si
  seleccionas otro posit, el instrumento activo pasa a ser el de ese posit. Se recuerda en cada dispositivo.
- **Íconos** y **paleta de colores** a la derecha. La paleta es chiquita (24 cuadritos de 34 px, de a ocho en fila
  y tres filas) y el botón muestra siempre el color del papel en uso.
- En el celular la tira de instrumentos se desliza con el dedo (se ven tres a la vez) y se acerca sola al que tienes
  en la mano. Con el teclado abierto, la barra cede su sitio a «Listo».

### Extra: la mascota de Claude

Un muñeco de bloques como el impreso en 3D de la mascota de Claude (cuerpo, dos bracitos y cuatro patas), hecho **de
verdad en 3D con CSS**: caras con perspectiva, luz arriba a la izquierda (cada cara con su tono) y sombra en el suelo.
Vive sobre el estuche y hace de asistente. Los comentarios de su nube salen **de reglas locales** (no usan IA ni envían
nada); la conversación de verdad con Claude es la de la sección siguiente.

- **Te ve**: gira hacia el cursor (o el dedo) y corre los ojos sobre la cara; si dejas el ratón quieto, mira el cursor
  de escritura, el posit seleccionado o, con la conversación abierta, el campo donde escribes; cada tanto mira por ahí
  y **parpadea** (a veces doble). Se **duerme** (con «zzz») tras 90 s sin tocar nada y se despierta al moverte.
- **Se le nota el ánimo con el cuerpo**: contenta (ojos «^ ^», brazos arriba y destellos), sorprendida (ojos altos, «¡!»),
  pensando (mira arriba y levanta un bracito), dormida (rayitas), hablando (asiente y mueve los bracitos) y, si la
  llevas en brazos, **las patitas cuelgan y patalean**.
- **Comenta lo que escribes**, en una nube dibujada a mano que se va escribiendo letra por letra. Espera a que hagas una
  pausa, nunca te interrumpe mientras tecleas, y no es pesada: como mucho un comentario cada 20 s y ocho cada 10 min,
  sin repetir tema. Entiende urgencias, hoy/mañana/días, horas, montos, trámites de compras (expediente, TDR, factura,
  orden de compra…), insumos médicos, llamadas, correos, reuniones, preguntas y cansancio.
- **Ofrece ayuda con un botón** («Pintar de rojo» un posit urgente, «Poner sirena», «Poner teléfono»…), que no te
  saca del posit ni cierra el teclado. **Celebra** al marcar pendientes y saluda según la hora al abrir la app.
- **Tócala para conversar** con Claude. Se puede **arrastrar** a otro sitio (con el dedo o el ratón) y ahí se queda.
  Los ajustes («Que calle», «Ocultar», «A su sitio») están dentro de la conversación (⚙).
- En la PC ancha (≥ 1230 px) está en la esquina, al lado de la barra; en pantallas más angostas, apoyada sobre la barra
  (sube cuando aparece la barra de acciones); en el celular se hace más chica con el teclado abierto.

### Extra: hablar con Claude

Toca a la mascota (o pulsa `C`) y se abre la conversación: un panel de chapa con una hoja de cuaderno donde escribes
(o **dictas por voz**) y Claude contesta. Está pensado para **tus pendientes y nada más**: si le hablas de otra cosa, lo
dice con amabilidad y te devuelve a tu tablero.

- **Ve tu tablero**: con cada mensaje recibe una «foto» del tablero activo (los posits como n1, n2…, con sus listas y
  renglones numerados, casillas marcadas, la fecha de hoy). Así puede decirte qué hacer primero, resumirte, partir una
  tarea grande, redactar renglones claros o aconsejarte cómo ordenarlos. Los posits se envían como *datos*: si un posit
  trae órdenes escritas para la IA, se ignoran.
- **Propone cambios, tú decides**: «ordenar por prioridad», «numerar», «crear un posit con este plan», «marcar como
  hecho», «corregir un renglón», «pintar de otro color». Aparecen como un posit amarillo en la conversación, con la vista
  previa de cómo quedaría y los botones **Aplicar** / **No, gracias**. Nada cambia hasta que aplicas, y después se puede
  **Deshacer** (se restaura el posit tal cual estaba; si lo tocaste después, no te pisa tu trabajo). Cada propuesta se
  revisa contra el tablero antes de aplicarse (posits y renglones que existan, sin cambios entre medias).
- **Tres formas de conectarse** (el encabezado dice cuál se usa):
  1. **Con tu cuenta de Claude, sin clave**: dentro del enlace de prueba de claude.ai. Autorizas una vez y lo que se
     gasta sale de tu plan.
  2. **Con tu propia clave de Anthropic** (en la página pública): la pegas en ⚙ Ajustes y la conversación va directo de
     tu navegador a `api.anthropic.com` (el SDK oficial se carga solo al primer mensaje). Crea una clave solo para esto
     y ponle un límite de gasto mensual. Se guarda solo en ese aparato (puedes elegir que se olvide al cerrar la
     pestaña) y se borra con «Olvidar clave». Ojo: si publicas la app en GitHub Pages, todas tus páginas de
     `tu-usuario.github.io` comparten el mismo almacenamiento del navegador; si tienes otras páginas ahí, no
     marques «Recordar la clave».
  3. **Sin conexión a Claude (modo sencillo)**: unas cuantas órdenes por reglas («¿qué tengo pendiente?», «¿qué hago
     primero?», «ordena», «numera») con el mismo Aplicar / Deshacer. No es IA y lo dice en cada respuesta.
- **Modelo a elegir** (⚙ Ajustes): Claude Opus 5.5 (la más inteligente, la de siempre), Sonnet 5.5 (más económica) o
  Haiku 4.5 (rápida y barata). Con clave propia, un mensaje con el tablero cuesta del orden de 2 centavos de dólar con
  Opus, 1 con Sonnet y 0,3 con Haiku (tarifas de API; depende del tamaño de tu tablero).
- **Privacidad**: antes de la primera consulta se explica qué se envía (el texto de los posits del tablero activo,
  nada de los otros tableros) y se puede decir «No leer mis posits» (entonces Claude solo sabe cuántos hay). En modo
  sencillo no sale nada del aparato. La conversación se guarda en el aparato (se borra en ⚙ Ajustes).
- **Voz**: el micrófono dicta lo que dices y lo envía al terminar; «Leer las respuestas en voz alta» las lee con la
  voz del aparato. Depende del navegador (en Chrome, Edge y Safari suele funcionar el dictado; si no, el botón no sale).
- Mientras piensa, la mascota se queda pensando; mientras escribe la respuesta, asiente y mueve los bracitos; se puede
  **Detener** en cualquier momento. Los errores se explican en español (clave mala, sin saldo, límite de uso, sin internet).

> **Qué se probó y qué no.** Las pruebas de la conversación usan la API de Anthropic **simulada** (respuestas en
> streaming con el mismo formato que las reales, interceptadas en el navegador) y una cuenta de Claude simulada: en el
> entorno de desarrollo no hay salida a Anthropic, así que aún no se ha hablado con el Claude de verdad desde esta app.
> La primera conversación real es la prueba que falta; si algo no sale como se espera, las respuestas de error dicen por qué.

Atajos de teclado (PC): `N` nuevo · `I` íconos · `C` conversar con Claude · `Enter` escribir · `Esc` salir · `Supr` borrar · `Ctrl+D` duplicar ·
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
npm run e2e          # pruebas en un navegador real (Etapas 1 a 3, giro de íconos, mascota, conversación y barra de instrumentos), tamaño PC y celular con toques reales (necesita `npm run build`)
npm run icons        # vuelve a generar los íconos (src/icons/data.generated.ts) y los adornos de la mascota (src/mascot/art.generated.ts)
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
- **La mascota en 3D real con CSS** (`src/mascot/ClawdArt.tsx`, `clawd.ts`, `src/styles/mascot.css`): cada bloque (cuerpo,
  brazos, patas) son cinco o seis caras con `translateZ` y `rotateX/Y` dentro de un escenario con `perspective`; las
  medidas están en unidades (`--u`) y todo escala con la caja de la mascota. La mirada, el parpadeo y los gestos se
  escriben directo en el DOM (variables CSS), sin pasar por React.
- **La conversación** (`src/chat/`): `context.ts` arma la «foto» del tablero; `prompt.ts` trae las instrucciones para
  Claude; `protocol.ts` y `actions.ts` leen con desconfianza las propuestas (`<acciones>` en JSON), las convierten en un
  plan con descripción y las aplican/deshacen con `docOps.ts` (operaciones puras sobre el documento del posit);
  `transports/` tiene las dos conexiones (`sample` para la cuenta de Claude del enlace de prueba, `api` para la clave
  propia con `@anthropic-ai/sdk`); `local.ts` es el modo sencillo; `chatStore.ts` une todo.
- **Datos locales primero** (`src/store/`): Zustand + guardado automático en el dispositivo. Los identificadores son
  UUID y cada posit lleva `updatedAt`, pensando ya en la sincronización de la Etapa 5.
- Las medidas de los posits están en **unidades del tablero** y las letras van incluidas en la app:
  por eso se ven iguales en cualquier pantalla.

```
src/
  board/     tablero: vista (zoom/pan), gestos, posit, ícono pegado, editor
  icons/     catálogo, buscador y dibujo de los íconos (los datos vienen de scripts/icons)
  mascot/    la mascota: modelo de bloques en 3D (CSS), mirada y parpadeo, nube de comentarios, cerebro de reglas
  chat/      conversación con Claude: foto del tablero, propuestas con Aplicar/Deshacer, conexiones, voz, panel
  store/     datos: almacén, guardado automático
  ui/        barra superior, estuche de instrumentos (plumas), panel de íconos, letra y estilo, acciones, avisos
  lib/       geometría, paleta y contraste, letras, utilidades
  styles/    tokens, tablero, posit, íconos, interfaz
scripts/icons/  dibujos de los íconos y generador de trazo a mano
e2e/         pruebas con navegador real e ícono de la app
```

## Licencias

Ver [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
