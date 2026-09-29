import { createStore, useStore as useZustand } from 'zustand'

/** Cómo se siente Chispa. Cada estado cambia ojos, boca y adornos (ver MascotArt y mascot.css). */
export type Mood = 'idle' | 'happy' | 'think' | 'surprised' | 'sleep'

/** Un botoncito dentro de la nube (una sugerencia o un ajuste). */
export interface Chip {
  label: string
  run: () => void
  /** `accent` = una sugerencia (naranja); `plain` = un ajuste (gris). */
  tone?: 'accent' | 'plain'
}

export interface Bubble {
  id: number
  text: string
  chips: Chip[]
  /** Milisegundos que se queda a la vista. */
  ms: number
}

interface MascotUI {
  /** Estado de ánimo del momento; vuelve solo a «idle» (o «sleep» si está dormida). */
  mood: Mood
  asleep: boolean
  bubble: Bubble | null
  /** Mientras la nube «escribe» su texto, Chispa mueve la boca. */
  talking: boolean
  /** Sube cada vez que Chispa da un saltito (para reiniciar la animación). */
  hops: number
  say(text: string, opts?: { mood?: Mood; chips?: Chip[]; ms?: number }): void
  hush(): void
  setTalking(on: boolean): void
  feel(mood: Mood, ms?: number): void
  sleep(on: boolean): void
}

let bubbleSeq = 0
let moodTimer: ReturnType<typeof setTimeout> | undefined

/** Cuánto se queda una nube según lo que dice: lo justo para leerla con calma. */
export const bubbleDuration = (text: string): number => Math.min(9500, Math.max(3800, 2400 + text.length * 62))

export const mascotStore = createStore<MascotUI>()((set, get) => ({
  mood: 'idle',
  asleep: false,
  bubble: null,
  talking: false,
  hops: 0,

  say(text, opts = {}) {
    const bubble: Bubble = { id: ++bubbleSeq, text, chips: opts.chips ?? [], ms: opts.ms ?? bubbleDuration(text) }
    set({ bubble })
    if (opts.mood) get().feel(opts.mood, Math.min(bubble.ms, 3200))
  },

  hush() {
    if (get().bubble) set({ bubble: null, talking: false })
  },

  setTalking(on) {
    if (get().talking !== on) set({ talking: on })
  },

  feel(mood, ms = 1800) {
    if (moodTimer) clearTimeout(moodTimer)
    set((s) => ({ mood, hops: mood === 'happy' || mood === 'surprised' ? s.hops + 1 : s.hops }))
    if (mood !== 'idle') moodTimer = setTimeout(() => set({ mood: 'idle' }), ms)
  },

  sleep(on) {
    if (get().asleep === on) return
    if (on && moodTimer) clearTimeout(moodTimer)
    set(on ? { asleep: true, mood: 'idle', bubble: null, talking: false } : { asleep: false })
  },
}))

export function useMascot<T>(selector: (s: MascotUI) => T): T {
  return useZustand(mascotStore, selector)
}
