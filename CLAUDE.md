# Panel de posits virtuales

## Qué quiero
Un tablero web de notas con posits virtuales. Me gusta ser muy ordenado y quiero que el panel me motive: que sea bonito de usar, con aspecto de cuaderno y trazo dibujado a mano.

Se usa desde la computadora y desde el celular (desde el celular sobre todo para revisar). Las notas deben verse iguales en ambos.

## Referencia visual
En `referencias/` hay dos hojas con fotogramas de un video de una herramienta de pizarra con estilo dibujado a mano. Me gusta el estilo, no la función (esa es para flujogramas). Rescatar el aspecto, no copiar sus imágenes ni íconos: los íconos y recursos gráficos deben ser propios o de una librería libre.

Lo que tomo del estilo:
- Fondo de cuaderno cuadriculado, tono crema.
- Posit realista: papel de color, esquina doblada, sombra suave, cinta adhesiva arriba. Se escribe directo sobre él.
- Paleta de colores tipo marcadores para cambiar el color del posit en un toque.
- Letras con aspecto manuscrito (varias fuentes a elegir), con negrita, cursiva y subrayado.
- Panel de íconos dibujados a mano con buscador y categorías, para pegar en el tablero o en el posit.
- Barra inferior con aire de estuche de marcadores.

## Funciones imprescindibles
1. Crear, mover (arrastrar), redimensionar y borrar posits libremente en el tablero.
2. Elegir el color de cada posit (paleta amplia).
3. Elegir un ícono bonito por posit (o pegar íconos sueltos en el tablero).
4. Dentro del posit: texto libre, viñetas y lista de pendientes con casillas.
5. Al marcar un pendiente, la fila completa se tacha como con lápiz (trazo animado que recorre la línea) y baja un poco de opacidad.
6. Poder tener varios tableros (por ejemplo, uno por tema).
7. Guardado automático y sincronización entre computadora y celular, con inicio de sesión para que cada quien vea sus notas.

## Lo que NO va
Flechas, conectores, formas (rectángulos, rombos), plantillas de flujograma, botones de compartir o presentar.

## Cómo quiero que trabajes
- Antes de programar, léeme un plan corto con el stack que propones y por qué. Debe ser una web app que abra con un enlace en el navegador de la PC y del celular, sin instalar nada. Para la sincronización, evalúa Supabase (ya lo he usado).
- Construye por etapas y muéstrame cada una funcionando:
  1. Tablero + posits arrastrables + color + texto.
  2. Viñetas, pendientes con casillas y tachado tipo lápiz.
  3. Íconos y fuentes manuscritas.
  4. Varios tableros.
  5. Sincronización en la nube + login.
- Prioridad al celular: tocar, arrastrar y escribir tienen que sentirse bien en pantalla pequeña.
- Textos de la interfaz en español.
- Al terminar cada etapa, dime cómo probarla y qué sigue.

## Extras (solo si sobra tiempo)
Fechas límite, filtro por color, modo oscuro.
