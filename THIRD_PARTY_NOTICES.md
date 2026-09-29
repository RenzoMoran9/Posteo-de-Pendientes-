# Créditos y licencias de terceros

Todo el arte de esta app (logo, ícono, **los instrumentos de escritura del estuche**, cinta, papel, esquina doblada, los
**123 íconos dibujados a mano** del panel y **la mascota**) es **propio**: se dibuja con CSS/SVG y con los generadores
de `scripts/icons/` (no se copió ningún dibujo de otras librerías). No se usa ninguna imagen ni ícono de la herramienta de
pizarra que sirvió de inspiración visual ni de la foto de referencia de la mascota (`referencias/` y las imágenes
de referencia no se suben al repositorio).

**Sobre la mascota.** Es una versión propia, hecha desde cero con CSS 3D (bloques con sus caras, sin usar ningún archivo
ni modelo de nadie), del personaje de la mascota de Claude / Claude Code, que es una marca de **Anthropic**. La app es
un proyecto personal, **no está afiliada ni respaldada por Anthropic**. Si la publicas más allá de tu uso personal,
revisa las pautas de marca de Anthropic. El comportamiento de una mascota que mira al cursor, parpadea, se duerme y habla
en una nube es una idea común a muchos proyectos abiertos (ClippyJS, OpenPets y otros) y aquí está escrito desde cero:
no se usa código ni arte de ellos.

## Se incluyen en la app

| Pieza | Licencia | Para qué |
| --- | --- | --- |
| [React](https://react.dev) 19 | MIT | Interfaz |
| [Zustand](https://github.com/pmndrs/zustand) | MIT | Estado de la app |
| [TipTap](https://tiptap.dev) / [ProseMirror](https://prosemirror.net) | MIT | Editor de texto dentro del posit |
| [Lucide](https://lucide.dev) (`lucide-react`) | ISC | Íconos de la interfaz (con un filtro SVG de trazo tembloroso) |
| [Anthropic SDK para TypeScript](https://github.com/anthropics/anthropic-sdk-typescript) (`@anthropic-ai/sdk`) | MIT | Conversación con Claude usando tu propia clave (se carga solo al primer mensaje) |
| Fuente **Kalam** — © 2014 Indian Type Foundry (vía `@fontsource/kalam`) | SIL OFL 1.1 | Letra manuscrita de los posits y de la interfaz |
| Fuente **Permanent Marker** — © 2010 Font Diner, Inc. (vía `@fontsource/permanent-marker`) | Apache 2.0 | Rótulo de rotulador: título «POSITS», encabezados y letra «Marcador grueso» |
| Fuente **Caveat** — © 2014 The Caveat Project Authors (vía `@fontsource/caveat`) | SIL OFL 1.1 | Letra «Bolígrafo» de los posits |
| Fuente **Patrick Hand** — © 2010-2012 Patrick Wagesreiter (vía `@fontsource/patrick-hand`) | SIL OFL 1.1 | Letra «Lápiz» de los posits |
| Fuente **Architects Daughter** — © 2010 Kimberly Geswein (vía `@fontsource/architects-daughter`) | SIL OFL 1.1 | Letra «Punta fina» de los posits |
| Fuente **Gochi Hand** — © 2011 HT Fonts (vía `@fontsource/gochi-hand`) | SIL OFL 1.1 | Letra «Pincel» de los posits |
| Fuente **Covered By Your Grace** — © 2010 Kimberly Geswein (vía `@fontsource/covered-by-your-grace`) | SIL OFL 1.1 | Letra «Marcador» de los posits |
| Fuente **Just Another Hand** — © 2010 Brian J. Bonislawsky DBA Astigmatic (AOETI) (vía `@fontsource/just-another-hand`) | Apache 2.0 | Letra «Portaminas» de los posits |

Las fuentes se distribuyen dentro de la propia app (no se piden a Google en cada visita), así que el
texto se ve idéntico en la PC y en el celular, y sigue funcionando sin conexión.

## Solo para desarrollar y probar (no van en la app)

Vite (MIT), Vitest (MIT), TypeScript (Apache-2.0), Playwright (Apache-2.0).

> Los modelos de Claude no son parte de la app: la conversación los usa a través de tu cuenta de Claude o de tu propia clave de
> Anthropic, con sus condiciones de uso y su tarifa.
>
> Las etapas siguientes añadirán aquí lo que se use (por ejemplo `@supabase/supabase-js` en la Etapa 5)
> con su licencia y su atribución.
