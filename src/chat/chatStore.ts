import { createStore, useStore as useZustand, type StoreApi } from 'zustand'
import { mascotStore } from '../mascot/mascotStore'
import { store as boardStore, type Store } from '../store/store'
import { uid } from '../lib/uid'
import { applyPlan, planActions, type Applied, type PlanIO, type PlanItem } from './actions'
import { buildSnapshot, type SnapNotes } from './context'
import { ChatError, explain } from './errors'
import { storeIO } from './io'
import { localReply } from './local'
import { buildSystem, buildTurns, type HistoryMsg, type ProposalState } from './prompt'
import { parseBlocks, splitReply, visibleWhileStreaming } from './protocol'
import { DEFAULT_SETTINGS, clearKey, loadKey, loadSettings, saveKey, saveSettings, type ClaudeSettings } from './settings'
import { makeApiTransport } from './transports/api'
import { findSample, insideClaudeHost, sampleTransport } from './transports/sample'
import type { Transport } from './transports/types'
import { speak, stopSpeaking } from './voice'

/**
 * La conversación con Claude: los mensajes, el envío (por la cuenta de Claude del enlace de prueba, con la clave propia
 * o, si no hay ninguna, con las respuestas sencillas de local.ts), la respuesta que va llegando y las propuestas de
 * cambios con «Aplicar» y «Deshacer». La conversación se guarda en este dispositivo.
 */

export type Via = 'sample' | 'api' | 'local'

export interface ProposalData {
  /** Las acciones tal como llegaron (se vuelven a revisar contra el tablero al aplicarlas). */
  raw: unknown[]
  /** Qué posit era cada alias cuando se hizo la propuesta. */
  notes: SnapNotes['notes']
  items: PlanItem[]
  problems: string[]
  state: ProposalState
  /** Se puede deshacer (solo mientras la página siga abierta desde que se aplicó). */
  canUndo: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  at: number
  via?: Via
  streaming?: boolean
  /** Un aviso bajo el mensaje. */
  note?: { tone: 'error' | 'info'; text: string }
  proposal?: ProposalData
}

export type ChatStatus = 'idle' | 'waiting' | 'streaming'

export interface ChatState {
  open: boolean
  view: 'chat' | 'settings'
  messages: ChatMessage[]
  status: ChatStatus
  settings: ClaudeSettings
  hasKey: boolean
  /** ¿Se puede usar la cuenta de Claude del enlace de prueba? `null` = aún se averigua. */
  sampleOk: boolean | null
  /** La página corre dentro de un visor de Claude (enlace de prueba): la clave propia no puede funcionar ahí. */
  host: boolean
  /** Con cuál conexión se contestaría ahora. */
  via: Via
  /** Lo que se está escribiendo en el campo (se conserva si se cierra el panel). */
  draft: string

  setOpen(open: boolean): void
  toggle(): void
  showSettings(on: boolean): void
  setDraft(text: string): void
  /** Abre la conversación con una pregunta: la envía, o la deja escrita si aún falta aceptar el aviso de privacidad. */
  ask(prompt: string): void
  send(text: string): Promise<void>
  stop(): void
  clear(): void
  apply(id: string): void
  dismiss(id: string): void
  undo(id: string): void
  patchSettings(p: Partial<ClaudeSettings>): void
  saveApiKey(key: string): void
  forgetApiKey(): void
  /** Vuelve a averiguar si hay cuenta de Claude disponible. */
  detect(): Promise<void>
}

const CHAT_KEY = 'posits:chat:v1'
const KEEP = 60

export interface ChatDeps {
  board: StoreApi<Store>
  io: PlanIO
  sample: Transport
  api: Transport
  detectSample: () => Promise<boolean>
  insideHost: () => boolean
  /** Guardar y leer en este dispositivo (se apaga en las pruebas). */
  persist: boolean
}

const viaOf = (sampleOk: boolean | null, hasKey: boolean): Via => (sampleOk ? 'sample' : hasKey ? 'api' : 'local')

const toHistory = (list: ChatMessage[]): HistoryMsg[] =>
  list
    .filter((m) => !m.streaming && !(m.role === 'assistant' && m.note?.tone === 'error' && !m.text))
    .map((m) => ({ role: m.role, text: m.text, proposal: m.proposal?.state }))

function loadMessages(): ChatMessage[] {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(CHAT_KEY)
    if (!raw) return []
    const o = JSON.parse(raw) as { v?: number; messages?: ChatMessage[] }
    if (o.v !== 1 || !Array.isArray(o.messages)) return []
    return o.messages
      .filter((m) => m && typeof m.id === 'string' && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
      .map((m) => ({
        ...m,
        // una respuesta que se estaba escribiendo cuando se cerró la página quedó a medias
        streaming: undefined,
        note: m.streaming ? { tone: 'info' as const, text: 'La respuesta se interrumpió al cerrar la página.' } : m.note,
        proposal: m.proposal ? { ...m.proposal, canUndo: false } : undefined,
      }))
      .slice(-KEEP)
  } catch {
    return []
  }
}

function saveMessages(messages: ChatMessage[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(CHAT_KEY, JSON.stringify({ v: 1, messages: messages.filter((m) => !m.streaming).slice(-KEEP) }))
  } catch {
    /* sin espacio o sin almacenamiento: la conversación sigue mientras la página esté abierta */
  }
}

const later = (fn: () => void): void => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn)
  else setTimeout(fn, 16)
}

export function createChatStore(deps: Partial<ChatDeps> = {}) {
  const d: ChatDeps = {
    board: boardStore,
    io: storeIO,
    sample: sampleTransport,
    api: makeApiTransport({ getKey: loadKey }),
    detectSample: async () => !!(await findSample()),
    insideHost: insideClaudeHost,
    persist: true,
    ...deps,
  }
  const applied = new Map<string, Applied>()
  let controller: AbortController | null = null
  let sampleBlocked = false

  const mascot = () => mascotStore.getState()

  return createStore<ChatState>()((set, get) => {
    const patchMessage = (id: string, fn: (m: ChatMessage) => ChatMessage): void =>
      set((s) => ({ messages: s.messages.map((m) => (m.id === id ? fn(m) : m)) }))

    const patchProposal = (id: string, p: Partial<ProposalData>): void =>
      patchMessage(id, (m) => (m.proposal ? { ...m, proposal: { ...m.proposal, ...p } } : m))

    const host = d.insideHost()
    const recomputeVia = (): Via => viaOf(get().sampleOk && !sampleBlocked, get().hasKey && !host)

    /** Termina un mensaje de Claude: quita el «escribiendo», separa el texto de las acciones y arma la propuesta. */
    function finish(id: string, fullText: string, via: Via, opts: { truncated?: boolean; snap: SnapNotes; extra?: unknown[]; info?: string }): string {
      const reply = splitReply(fullText)
      const parsed = parseBlocks(reply.blocks)
      const raw = [...parsed.actions, ...(opts.extra ?? [])]
      const board = d.board.getState()
      const plan = planActions(raw, opts.snap, board)

      let note: ChatMessage['note']
      if (parsed.error) note = { tone: 'error', text: parsed.error }
      else if (reply.cut) note = { tone: 'info', text: 'Mi propuesta se cortó y no se puede aplicar. Pídemela otra vez.' }
      else if (raw.length && !plan.items.length && plan.problems.length) note = { tone: 'info', text: `No pude preparar el cambio: ${plan.problems[0]}` }
      else if (plan.problems.length) note = { tone: 'info', text: `Salté algo de la propuesta: ${plan.problems.slice(0, 2).join(' ')}` }
      else if (opts.truncated) note = { tone: 'info', text: 'La respuesta se cortó por ser muy larga. Pídeme que siga.' }
      else if (opts.info) note = { tone: 'info', text: opts.info }

      const proposal: ProposalData | undefined = plan.items.length
        ? { raw, notes: opts.snap.notes, items: plan.items, problems: plan.problems, state: 'pending', canUndo: false }
        : undefined
      const text = reply.text || (proposal ? 'Te propongo estos cambios:' : '')
      patchMessage(id, (m) => ({ ...m, text, via, streaming: false, note, proposal }))
      return text
    }

    async function send(input: string): Promise<void> {
      const text = input.trim()
      const s0 = get()
      if (!text || s0.status !== 'idle') return

      const now = Date.now()
      const asstId = uid()
      const history = toHistory(s0.messages)
      set({
        messages: [...s0.messages, { id: uid(), role: 'user', text, at: now }, { id: asstId, role: 'assistant', text: '', at: now, streaming: true }],
        status: 'waiting',
        view: 'chat',
        draft: '',
      })
      mascot().sleep(false)
      mascot().hush()
      mascot().feel('think', 240_000)
      stopSpeaking()

      const board = d.board.getState()
      const snap = buildSnapshot(board, { share: s0.settings.shareNotes, selectedId: board.selectedId })
      const system = buildSystem()
      const turns = buildTurns(history, text, snap.text)
      const ctl = new AbortController()
      controller = ctl

      let flush = false
      let latest = ''
      const onText = (t: string) => {
        latest = t
        if (get().status !== 'streaming') {
          const visible = visibleWhileStreaming(t)
          if (!visible.trim()) return // todavía «piensa»: no hay nada que enseñar
          set({ status: 'streaming' })
          mascot().feel('idle')
          mascot().setTalking(true)
        }
        if (flush) return
        flush = true
        later(() => {
          flush = false
          patchMessage(asstId, (m) => (m.streaming ? { ...m, text: visibleWhileStreaming(latest) } : m))
        })
      }

      let via = recomputeVia()
      let fellBack = false
      try {
        let done: { text: string; truncated: boolean } | null = null
        let localActions: unknown[] = []
        while (!done) {
          if (via === 'local') {
            const r = localReply(text, snap, board, board.selectedId)
            done = { text: r.text, truncated: false }
            localActions = r.actions
            break
          }
          try {
            done = await (via === 'sample' ? d.sample : d.api).ask({ system, turns, model: get().settings.model, signal: ctl.signal, onText })
          } catch (e) {
            // sin permiso en esa conexión: se pasa a la siguiente (la clave propia o las respuestas sencillas)
            if (e instanceof ChatError && e.code === 'no_access' && via === 'sample') {
              sampleBlocked = true
              fellBack = true
              via = recomputeVia()
              continue
            }
            throw e
          }
        }
        const finalText = finish(asstId, done.text, via, {
          truncated: done.truncated,
          snap,
          extra: localActions,
          info: fellBack && via === 'local' ? 'No hay permiso para usar Claude desde aquí: contesté en modo sencillo (⚙ Ajustes).' : undefined,
        })
        if (get().settings.speak && finalText) {
          mascot().setTalking(true)
          speak(finalText, () => mascot().setTalking(false))
        } else {
          mascot().setTalking(false)
        }
        mascot().feel(get().messages.find((m) => m.id === asstId)?.proposal ? 'surprised' : 'happy', 900)
      } catch (e) {
        const err = e instanceof ChatError ? e : new ChatError('unknown')
        const partial = visibleWhileStreaming(err.partial ?? latest).trim()
        patchMessage(asstId, (m) => ({
          ...m,
          text: partial,
          via,
          streaming: false,
          note: err.code === 'cancelled' ? { tone: 'info', text: partial ? 'Detenido.' : 'Detenido antes de que empezara a contestar.' } : { tone: 'error', text: explain(err.code) },
        }))
        mascot().setTalking(false)
        mascot().feel('idle')
      } finally {
        controller = null
        mascot().sleep(false)
        set({ status: 'idle', via: recomputeVia() })
      }
    }

    // averigua (una sola vez al crearse) si hay cuenta de Claude disponible en este enlace
    const detect = async (): Promise<void> => {
      let ok = false
      try {
        ok = await d.detectSample()
      } catch {
        ok = false
      }
      set((s) => ({ sampleOk: ok, via: viaOf(ok && !sampleBlocked, s.hasKey && !host) }))
    }

    const settings = d.persist ? loadSettings() : { ...DEFAULT_SETTINGS }
    const hasKey = d.persist ? !!loadKey() : false
    queueMicrotask(() => void detect())

    return {
      open: false,
      view: 'chat',
      messages: d.persist ? loadMessages() : [],
      status: 'idle',
      settings,
      hasKey,
      draft: '',
      sampleOk: null,
      host,
      via: viaOf(null, hasKey && !host),

      setOpen(open) {
        if (get().open === open) return
        set({ open, view: 'chat' })
        if (open) {
          mascot().hush()
        } else {
          stopSpeaking()
        }
      },
      toggle: () => get().setOpen(!get().open),
      showSettings: (on) => set({ view: on ? 'settings' : 'chat' }),
      setDraft: (text) => set({ draft: text }),
      ask(prompt) {
        get().setOpen(true)
        const s = get()
        if (s.status !== 'idle') return
        if (s.settings.consented === null && s.via !== 'local') set({ draft: prompt })
        else void s.send(prompt)
      },
      send,

      stop() {
        controller?.abort()
        stopSpeaking()
        mascot().setTalking(false)
      },

      clear() {
        controller?.abort()
        stopSpeaking()
        applied.clear()
        set({ messages: [], view: 'chat' })
      },

      apply(id) {
        const m = get().messages.find((x) => x.id === id)
        const p = m?.proposal
        if (!m || !p || p.state !== 'pending') return
        const board = d.board.getState()
        const plan = planActions(p.raw, { notes: p.notes }, board)
        if (!plan.steps.length) {
          patchMessage(id, (x) => ({ ...x, note: { tone: 'info', text: plan.problems[0] ?? 'No hay nada que aplicar.' }, proposal: x.proposal && { ...x.proposal, state: 'dismissed' } }))
          return
        }
        const result = applyPlan(plan, d.io)
        applied.set(id, result)
        patchProposal(id, { state: 'applied', canUndo: true, problems: plan.problems })
        patchMessage(id, (x) => ({ ...x, note: plan.problems.length ? { tone: 'info', text: `Salté algo: ${plan.problems.slice(0, 2).join(' ')}` } : undefined }))
        // el primer posit tocado queda seleccionado: así se ve qué cambió
        const first = plan.steps.find((st) => st.kind !== 'create')
        const target = result.created[0] ?? first?.noteId
        if (target && d.board.getState().notes[target]) d.board.getState().select(target)
        mascot().feel('happy', 1600)
      },

      dismiss(id) {
        patchProposal(id, { state: 'dismissed' })
      },

      undo(id) {
        const a = applied.get(id)
        if (!a) return
        const r = a.undo()
        applied.delete(id)
        patchProposal(id, { state: 'undone', canUndo: false })
        if (r.skipped > 0) {
          d.board.getState().showToast({ message: r.restored ? 'Deshice lo que pude: cambiaste algún posit después.' : 'No deshice nada: cambiaste ese posit después.' })
        }
      },

      patchSettings(p) {
        const next = { ...get().settings, ...p }
        set({ settings: next })
        if (d.persist) saveSettings(next)
        if (p.speak === false) stopSpeaking()
        if (p.remember !== undefined && get().hasKey) {
          const k = loadKey()
          if (k) saveKey(k, p.remember)
        }
      },

      saveApiKey(key) {
        const k = key.trim()
        if (!k) return
        sampleBlocked = false
        if (d.persist) saveKey(k, get().settings.remember)
        set({ hasKey: true, via: viaOf(get().sampleOk, !host) })
      },

      forgetApiKey() {
        if (d.persist) clearKey()
        set({ hasKey: false, via: viaOf(get().sampleOk && !sampleBlocked, false) })
      },

      detect,
    }
  })
}

export const chat = createChatStore()

if (typeof window !== 'undefined') {
  let timer: ReturnType<typeof setTimeout> | undefined
  chat.subscribe((s, prev) => {
    if (s.messages === prev.messages) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => saveMessages(chat.getState().messages), 400)
  })
}

export function useChat<T>(selector: (s: ChatState) => T): T {
  return useZustand(chat, selector)
}
