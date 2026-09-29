import { cornerSlot } from '../board/actions'
import { getEditor } from '../board/editors'
import { stickersOfNote, store, type Store } from '../store/store'
import type { MascotMode } from '../store/types'
import { factsOf, openTasksOf, tagsOf, type NoteFacts, type Tag } from './analyze'
import { Brain, type Comment, type Suggest, type Topic } from './brain'
import { mascotStore, type Chip, type Mood } from './mascotStore'

/**
 * El pegamento entre la app y Chispa: mira lo que pasa (escribes, marcas un pendiente, dejas de tocar la
 * pantalla…), se lo cuenta al «cerebro» y muestra lo que este decida decir. Todo ocurre en este aparato.
 */
export const brain = new Brain()

const SLEEP_AFTER_MS = 90_000
const TYPE_PAUSE_MS = 2200
const EMPTY_NOTE_MS = 14_000
const NUDGE_AFTER_MS = 25 * 60_000
const LONG_SLEEP_MS = 5 * 60_000

const mode = (): MascotMode => store.getState().settings.mascot
const ui = () => mascotStore.getState()

/** Solo habla en modo «habla», con la pestaña a la vista y despierta. */
const chatty = (): boolean => mode() === 'on' && !document.hidden && !ui().asleep

// ───────────── lo que sabe del tablero ─────────────

export function boardTasks(s: Store = store.getState()): { open: number; urgent: number; total: number } {
  let open = 0
  let urgent = 0
  let total = 0
  for (const n of Object.values(s.notes)) {
    if (n.boardId !== s.activeBoardId) continue
    const t = openTasksOf(n.doc)
    open += t.open
    urgent += t.urgent
    total += factsOf(n.doc).tasks
  }
  return { open, urgent, total }
}

/** Qué temas se repiten en los posits del tablero (por sus palabras). */
export function boardTopics(s: Store = store.getState()): Topic[] {
  const count = new Map<Tag, number>()
  for (const n of Object.values(s.notes)) {
    if (n.boardId !== s.activeBoardId) continue
    for (const tag of new Set(tagsOf(factsOf(n.doc).text))) count.set(tag, (count.get(tag) ?? 0) + 1)
  }
  return [...count].map(([tag, n]) => ({ tag, n }))
}

const dayKey = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ───────────── mostrar un comentario ─────────────

function applySuggest(noteId: string, sg: Suggest): void {
  const s = store.getState()
  const note = s.notes[noteId]
  if (!note) return
  if (sg.kind === 'paint' && sg.hex) {
    s.patchNote(noteId, { color: sg.hex })
  } else if (sg.kind === 'icon' && sg.icon) {
    const { x, y } = cornerSlot(note.w, stickersOfNote(s, noteId).length)
    // sin quitarle la selección (ni el teclado) a quien está escribiendo
    s.addSticker({ icon: sg.icon, noteId, x, y, select: false })
  }
  ui().hush()
  ui().feel('happy', 1400)
}

function chipsFor(c: Comment, noteId: string | null): Chip[] {
  if (!c.suggest || !noteId) return []
  const sg = c.suggest
  return [{ label: sg.label, tone: 'accent', run: () => applySuggest(noteId, sg) }]
}

function deliver(c: Comment | null, noteId: string | null = null): void {
  if (!c) return
  ui().say(c.text, { mood: c.mood, chips: chipsFor(c, noteId) })
}

// ───────────── ajustes desde la propia nube ─────────────

export function setMode(next: MascotMode): void {
  store.getState().setMascotMode(next)
  if (next === 'off') {
    ui().hush()
    return
  }
  ui().feel('happy', 1400)
  if (next === 'on') ui().say('¡Aquí estoy! Te aviso cuando vea algo útil.', { mood: 'happy' })
  else ui().hush()
}

function settingsChips(): Chip[] {
  const chips: Chip[] =
    mode() === 'on'
      ? [
          { label: 'Que calle', run: () => setMode('quiet') },
          { label: 'Ocultar', run: () => setMode('off') },
        ]
      : [
          { label: 'Que hable', run: () => setMode('on') },
          { label: 'Ocultar', run: () => setMode('off') },
        ]
  // si la arrastraron a otro sitio, se ofrece devolverla a su lugar
  if (store.getState().settings.mascotPos) {
    chips.push({
      label: 'A su sitio',
      run: () => {
        store.getState().setMascotPos(null)
        ui().hush()
      },
    })
  }
  return chips
}

/** Le tocaron a Chispa: siempre contesta (aunque esté callada) y ofrece los ajustes. */
export function poke(): void {
  activity()
  const c = brain.onPoke({ ...boardTasks(), topics: boardTopics() })
  ui().say(c.text, { mood: c.mood, chips: settingsChips() })
}

// ───────────── actividad y sueño ─────────────

let lastActivity = Date.now()
let sleptAt = 0
const sessionStart = Date.now()

function activity(): void {
  lastActivity = Date.now()
  if (ui().asleep) {
    const long = Date.now() - sleptAt > LONG_SLEEP_MS
    ui().sleep(false)
    ui().feel('surprised', 1200)
    if (long && chatty()) deliver(brain.onWake())
  }
}

function tick(): void {
  const now = Date.now()
  if (mode() !== 'off' && !ui().asleep && now - lastActivity > SLEEP_AFTER_MS) {
    sleptAt = now
    ui().sleep(true)
    return
  }
  if (chatty() && now - sessionStart > NUDGE_AFTER_MS && now - lastActivity < 60_000 && boardTasks().open > 0) {
    deliver(brain.onNudge())
  }
}

// ───────────── qué pasa en el tablero ─────────────

let typedNote: string | null = null
let typedTimer: ReturnType<typeof setTimeout> | undefined
let emptyTimer: ReturnType<typeof setTimeout> | undefined

function analyzeTyped(): void {
  const id = typedNote
  if (!id || !chatty()) return
  const s = store.getState()
  const note = s.notes[id]
  if (!note) return
  const ed = getEditor(id)
  const lastLine = ed && !ed.isDestroyed ? ed.state.selection.$head.parent.textContent : ''
  deliver(
    brain.onTyped({
      noteId: id,
      lastLine,
      facts: factsOf(note.doc),
      color: note.color,
      stickerIcons: stickersOfNote(s, id).map((st) => st.icon),
    }),
    id,
  )
}

function taskDone(facts: NoteFacts): void {
  const doneToday = store.getState().countMascotDone(dayKey())
  ui().feel('happy', 1600)
  if (!chatty()) return
  const { open, total } = boardTasks()
  deliver(brain.onDone({ done: facts.done, total: facts.tasks, boardOpen: open, boardTotal: total, doneToday }))
}

function onStore(s: Store, prev: Store): void {
  if (s.notes === prev.notes) return

  // escribiendo: mientras teclea no molesta; al hacer una pausa, opina
  const id = s.editingId
  if (id && s.notes[id] && prev.notes[id] && s.notes[id].doc !== prev.notes[id].doc) {
    activity()
    ui().hush()
    typedNote = id
    if (typedTimer) clearTimeout(typedTimer)
    typedTimer = setTimeout(analyzeTyped, TYPE_PAUSE_MS)
  }

  // un pendiente marcado (en cualquier posit)
  for (const nid of Object.keys(s.notes)) {
    const n = s.notes[nid]
    const p = prev.notes[nid]
    if (!p || n.doc === p.doc) continue
    const before = factsOf(p.doc)
    const after = factsOf(n.doc)
    if (after.tasks > 0 && after.done > before.done && after.tasks >= before.tasks) {
      taskDone(after)
      break
    }
  }

  // un posit nuevo que se queda en blanco
  if (id && s.notes[id] && !prev.notes[id]) {
    if (emptyTimer) clearTimeout(emptyTimer)
    emptyTimer = setTimeout(() => {
      const n = store.getState().notes[id]
      if (n && factsOf(n.doc).text === '' && chatty()) deliver(brain.onEmptyNote())
    }, EMPTY_NOTE_MS)
  }
}

// ───────────── arranque ─────────────

function greet(): void {
  // si ya hay una nube a la vista (por ejemplo, alguien la tocó), no se la pisa con el saludo
  if (!chatty() || ui().bubble) return
  const s = store.getState()
  if (!s.settings.mascotMet) {
    deliver(brain.onWelcome())
    s.markMascotMet()
    return
  }
  try {
    if (sessionStorage.getItem('posits:greeted')) return
    sessionStorage.setItem('posits:greeted', '1')
  } catch {
    /* sin almacenamiento de sesión: saluda igual */
  }
  const t = boardTasks(s)
  deliver(brain.onGreet({ hour: new Date().getHours(), open: t.open, urgent: t.urgent, anyTasks: t.total > 0 }))
}

/** Pone en marcha a Chispa (una vez). Devuelve la función que la detiene. */
export function startMascotBrain(): () => void {
  const unsub = store.subscribe(onStore)
  let lastMove = 0
  const onDown = () => activity()
  const onMove = () => {
    const now = performance.now()
    if (now - lastMove < 400) return
    lastMove = now
    activity()
  }
  const opts = { passive: true, capture: true } as const
  window.addEventListener('pointerdown', onDown, opts)
  window.addEventListener('pointermove', onMove, opts)
  window.addEventListener('keydown', onDown, opts)
  window.addEventListener('wheel', onDown, opts)
  const timer = setInterval(tick, 5000)
  const greetTimer = setTimeout(greet, 1800)
  return () => {
    unsub()
    window.removeEventListener('pointerdown', onDown, opts)
    window.removeEventListener('pointermove', onMove, opts)
    window.removeEventListener('keydown', onDown, opts)
    window.removeEventListener('wheel', onDown, opts)
    clearInterval(timer)
    clearTimeout(greetTimer)
    if (typedTimer) clearTimeout(typedTimer)
    if (emptyTimer) clearTimeout(emptyTimer)
  }
}

/** Para las pruebas y para revisar a mano (`?debug`). */
export const mascotDebug = {
  brain,
  poke,
  setMode,
  say: (text: string, mood: Mood = 'idle') => ui().say(text, { mood }),
  sleep: (on: boolean) => {
    sleptAt = Date.now()
    ui().sleep(on)
  },
  greet,
  analyzeTyped,
}
