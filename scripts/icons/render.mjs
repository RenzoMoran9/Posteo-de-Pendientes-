// Dibuja un ícono como texto SVG con las MISMAS reglas que la app (src/icons/IconArt.tsx + icons.css).
// Solo lo usan las hojas de revisión; si cambias algo aquí, cámbialo también allá.

export const STYLE = { stroke: 2.5, fillDx: 1.5, fillDy: 1.2 }

export function iconSvg(icon, colors, { size = 128, ink = '#232a31', stroke = STYLE.stroke, extra = '' } = {}) {
  const fill = (k) => (k === 'ink' ? ink : colors[k])
  const line = (s) => {
    if (s === 'i') return `stroke="${ink}" stroke-width="${stroke}"`
    if (s === 't') return `stroke="${ink}" stroke-width="${(stroke * 0.62).toFixed(2)}"`
    if (s === 'k') return `stroke="${ink}" stroke-width="${(stroke * 1.5).toFixed(2)}"`
    if (s === 'w') return `stroke="#fff" stroke-opacity=".8" stroke-width="${stroke}"`
    if (s === 'W') return `stroke="#fff" stroke-width="${(stroke * 1.6).toFixed(2)}"`
    return `stroke="${colors[s]}" stroke-width="${stroke}"`
  }
  let body = ''
  for (const [d, f, s, o] of icon.shapes) {
    if (f) body += `<path d="${d}" fill="${fill(f)}"${o ? ` transform="translate(${STYLE.fillDx} ${STYLE.fillDy})"` : ''}/>`
    if (s !== 'n') body += `<path d="${d}" fill="none" ${line(s)} stroke-linecap="round" stroke-linejoin="round"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" style="overflow:visible" ${extra}>${body}</svg>`
}
