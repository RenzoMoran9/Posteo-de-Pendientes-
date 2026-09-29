import { useEffect } from 'react'
import { addNoteAtCenter, fitAll, resetZoom, rotateSticker, zoomBy } from '../board/actions'
import { beginEditing, endEditing } from '../board/editors'
import { GRID } from '../lib/geometry'
import { STICKER_LIMITS, store } from '../store/store'

/** Atajos de teclado para la PC (en el celular no estorban). */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = store.getState()
      const t = e.target as HTMLElement | null
      const typing = !!t?.closest('input, textarea, select, [contenteditable="true"]')

      if (e.key === 'Escape') {
        if (s.editingId) endEditing()
        else s.select(null)
        return
      }
      if (typing || e.altKey) return

      const mod = e.ctrlKey || e.metaKey
      const sel = s.selectedId
      const stk = s.selectedStickerId

      if (sel && (e.key === 'Delete' || e.key === 'Backspace')) {
        s.deleteNote(sel)
      } else if (stk && (e.key === 'Delete' || e.key === 'Backspace')) {
        s.deleteSticker(stk)
      } else if (sel && e.key === 'Enter') {
        beginEditing(sel)
      } else if (sel && mod && (e.key === 'd' || e.key === 'D')) {
        s.duplicateNote(sel)
      } else if (stk && mod && (e.key === 'd' || e.key === 'D')) {
        s.duplicateSticker(stk)
      } else if (sel && e.key.startsWith('Arrow')) {
        const n = s.notes[sel]
        if (!n) return
        const step = (e.shiftKey ? 5 : 1) * (s.settings.magnet ? GRID : 8)
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        s.patchNote(sel, { x: n.x + dx, y: n.y + dy })
      } else if (stk && e.key.startsWith('Arrow')) {
        const st = s.stickers[stk]
        if (!st) return
        const step = e.shiftKey ? 40 : 8
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        s.patchSticker(stk, { x: st.x + dx, y: st.y + dy })
      } else if (stk && !mod && (e.key === '+' || e.key === '=')) {
        const st = s.stickers[stk]
        if (st) s.patchSticker(stk, { size: Math.min(STICKER_LIMITS.max, st.size * 1.15) })
      } else if (stk && !mod && (e.key === '-' || e.key === '_')) {
        const st = s.stickers[stk]
        if (st) s.patchSticker(stk, { size: Math.max(STICKER_LIMITS.min, st.size / 1.15) })
      } else if (stk && !mod && e.key === '[') {
        rotateSticker(stk, -1)
      } else if (stk && !mod && e.key === ']') {
        rotateSticker(stk, 1)
      } else if (!mod && (e.key === 'i' || e.key === 'I')) {
        if (s.iconPanel) s.closeIcons()
        else s.openIcons({ mode: 'board' })
      } else if (!mod && (e.key === 'n' || e.key === 'N')) {
        addNoteAtCenter()
      } else if (!mod && (e.key === '+' || e.key === '=')) {
        zoomBy(1.25)
      } else if (!mod && (e.key === '-' || e.key === '_')) {
        zoomBy(1 / 1.25)
      } else if (!mod && e.key === '0') {
        resetZoom()
      } else if (!mod && (e.key === 'f' || e.key === 'F')) {
        fitAll()
      } else {
        return
      }
      e.preventDefault()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
