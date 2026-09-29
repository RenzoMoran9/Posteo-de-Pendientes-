# Créditos y licencias de terceros

Todo el arte de esta app (logo, ícono, marcadores, cinta, papel, esquina doblada) es **propio**,
dibujado con CSS/SVG. No se usa ninguna imagen ni ícono de la herramienta de pizarra que sirvió
de inspiración visual (`referencias/` no se sube al repositorio).

## Se incluyen en la app

| Pieza | Licencia | Para qué |
| --- | --- | --- |
| [React](https://react.dev) 19 | MIT | Interfaz |
| [Zustand](https://github.com/pmndrs/zustand) | MIT | Estado de la app |
| [TipTap](https://tiptap.dev) / [ProseMirror](https://prosemirror.net) | MIT | Editor de texto dentro del posit |
| [Lucide](https://lucide.dev) (`lucide-react`) | ISC | Íconos de la interfaz (con un filtro SVG de trazo tembloroso) |
| Fuente **Kalam** — © 2014 Indian Type Foundry (vía `@fontsource/kalam`) | SIL OFL 1.1 | Letra manuscrita de los posits y de la interfaz |
| Fuente **Permanent Marker** — © 2010 Font Diner, Inc. (vía `@fontsource/permanent-marker`) | Apache 2.0 | Rótulo de rotulador: título «POSITS» y encabezados |

Las fuentes se distribuyen dentro de la propia app (no se piden a Google en cada visita), así que el
texto se ve idéntico en la PC y en el celular, y sigue funcionando sin conexión.

## Solo para desarrollar y probar (no van en la app)

Vite (MIT), Vitest (MIT), TypeScript (Apache-2.0), Playwright (Apache-2.0).

> Las etapas siguientes añadirán aquí lo que se use (por ejemplo, el set de íconos dibujados a mano
> de la Etapa 3 y `@supabase/supabase-js` en la Etapa 5) con su licencia y su atribución.
