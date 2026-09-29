import { createStore, useStore as useZustand, type StoreApi } from 'zustand'
import { mascotStore } from '../mascot/mascotStore'
import { store as boardStore, type Store } from '../store/store'
import { uid } from '../lib/uid'
import { applyPlan, planActions, type Applied, type PlanIO, type PlanItem } from './actions'
import { buildSnapshot, type SnapNotes } from './context'
import { ChatError } from './errors'
import { storeIO } from './io'
import { localReply } from './local'
import { buildSystem, buildTurns, type HistoryMsg, type Persona, type ProposalState } from './prompt'
import { parseBlocks, splitReply, visibleWhileStreaming } from './protocol'
import { PROVIDERS, baseLooksValid, normalizeBase, providerById, type ProviderId } from './providers'
import { DEFAULT_SETTINGS, clearKey, effectiveProvider, loadAllKeys, loadKey, loadSettings, modelById, modelFor, saveKey, saveSettings, type ClaudeSettings } from './settings'
import { makeApiTransport } from './transports/api'
import { makeGeminiTransport } from './transports/gemini'
import { makeOpenAITransport } from './transports/openai'
import { findSample, insideClaudeHost, sampleTransport } from './transports/sample'
import type { Transport } from './transports/types'
import { speak, stopSpeaking } from './voice'

/**
 * La conversación con la IA: los mensajes, el envío (por la cuenta de Claude del enlace de prueba, con la clave de Claude,
 * de Gemini, de Groq o de otro servicio, o, si no hay ninguna, con las respuestas sencillas de local.ts), la respuesta que
 * va llegando y las propuestas de cambios con «Aplicar» y «Deshacer». La conversación se guarda en este dispositivo.
 */

/** Con qué conexión se contesta: la cuenta de Claude del enlace de prueba, la clave de Claude, Gemini, un servicio compatible con OpenAI (Groq…) o las respuestas sencillas. */
export type Via = 'sample' | 'api' | 'gemini' | 'openai' | 'local'

export interface ConnectionTest {
  status: 'idle' | 'running' | 'ok' | 'error'
  message: string
}

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
  /** ¿Hay clave guardada de Claude (Anthropic)? Es `keys.claude`. */
  hasKey: boolean
  /** Qué claves hay guardadas, servicio por servicio. */
  keys: Record<ProviderId, boolean>
  /** Quién contesta cuando no se usa la cuenta del enlace de prueba (lo elegido, o el que ya tiene clave). */
  provider: ProviderId
  /** El resultado del último «Probar conexión». */
  test: ConnectionTest
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
  /** Elige quién contesta (Gemini, Groq, otra IA o Claude). */
  setProvider(p: ProviderId): void
  /** Elige el modelo de un servicio que no es Claude (para Claude, `patchSettings({ model })`). */
  setModel(p: ProviderId, model: string): void
  setCustomBase(url: string): void
  saveProviderKey(p: ProviderId, key: string): void
  forgetProviderKey(p: ProviderId): void
  /** Manda un mensajito de prueba para saber si la clave, el modelo y la conexión funcionan. */
  testConnection(): Promise<void>
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
  gemini: Transport
  openai: Transport
  detectSample: () => Promise<boolean>
  insideHost: () => boolean
  /** Guardar y leer en este dispositivo (se apaga en las pruebas). */
  persist: boolean
}

/**
 * Con cuál conexión se contesta: la cuenta de Claude del enlace de prueba si se puede; dentro de ese visor no hay otra
 * (el navegador no deja salir a otros sitios); fuera, el servicio elegido si tiene clave; y si no, las respuestas sencillas.
 */
function viaOf(sampleOk: boolean | null, keys: Record<ProviderId, boolean>, settings: ClaudeSettings, host: boolean): Via {
  if (sampleOk) return 'sample'
  if (host) return 'local'
  const p = effectiveProvider(settings, keys)
  if (!keys[p]) return 'local'
  if (p === 'custom') return baseLooksValid(settings.customBase) && !!modelFor(settings, 'custom') ? 'openai' : 'local'
  return p === 'claude' ? 'api' : p === 'gemini' ? 'gemini' : 'openai'
}

/** El nombre con el que se le habla a quien contesta en cada conexión (para el encabezado y los avisos). */
export function assistantName(via: Via, provider: ProviderId): string {
  if (via === 'sample' || via === 'api') return 'Claude'
  if (via === 'gemini' || via === 'openai') return providerById(provider).short
  return 'Asistente'
}

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
  // los servicios que se llaman con clave leen lo elegido en cada mensaje: así un cambio en los ajustes vale de inmediato
  let read: () => ChatState = () => {
    throw new Error('el almacén de la conversación aún no está listo')
  }
  const d: ChatDeps = {
    board: boardStore,
    io: storeIO,
    sample: sampleTransport,
    api: makeApiTransport({ getKey: () => loadKey('claude') }),
    gemini: makeGeminiTransport({ getKey: () => loadKey('gemini') }),
    openai: makeOpenAITransport({
      getConfig: () => {
        const st = read()
        const p = st.provider
        const key = loadKey(p)
        const baseURL = p === 'groq' ? (PROVIDERS.groq.baseURL ?? '') : normalizeBase(st.settings.customBase)
        return key && baseURL ? { baseURL, key, model: modelFor(st.settings, p) } : null
      },
    }),
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
    read = get
    const patchMessage = (id: string, fn: (m: ChatMessage) => ChatMessage): void =>
      set((s) => ({ messages: s.messages.map((m) => (m.id === id ? fn(m) : m)) }))

    const patchProposal = (id: string, p: Partial<ProposalData>): void =>
      patchMessage(id, (m) => (m.proposal ? { ...m, proposal: { ...m.proposal, ...p } } : m))

    const host = d.insideHost()
    const idleTest: ConnectionTest = { status: 'idle', message: '' }
    const recomputeVia = (): Via => viaOf(get().sampleOk && !sampleBlocked, get().keys, get().settings, host)

    /** Vuelve a calcular lo que depende de los ajustes y las claves (quién contesta y con qué conexión) y borra el resultado de la última prueba. */
    const sync = (extra: Partial<ChatState> = {}): void => {
      const s = get()
      const keys = extra.keys ?? s.keys
      const settings = extra.settings ?? s.settings
      set({
        ...extra,
        hasKey: keys.claude,
        provider: effectiveProvider(settings, keys),
        via: viaOf(s.sampleOk && !sampleBlocked, keys, settings, host),
        test: idleTest,
      })
    }

    /** La conexión que corresponde a cada vía, el modelo que se le pide y cómo se presenta quien contesta. */
    const plan = (v: Via): { transport: Transport; model: string; persona: Persona } => {
      const st = get()
      const info = providerById(st.provider)
      if (v === 'sample' || v === 'api') return { transport: v === 'sample' ? d.sample : d.api, model: st.settings.model, persona: { kind: 'claude' } }
      const model = modelFor(st.settings, st.provider)
      return { transport: v === 'gemini' ? d.gemini : d.openai, model, persona: { kind: 'other', engine: `${info.short}, modelo ${model}` } }
    }

    /** Termina un mensaje de la IA: quita el «escribiendo», separa el texto de las acciones y arma la propuesta. */
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
          const p = plan(via)
          const turns = buildTurns(history, text, snap.text)
          try {
            done = await p.transport.ask({ system: buildSystem(p.persona), turns, model: p.model, signal: ctl.signal, onText })
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
          note: err.code === 'cancelled' ? { tone: 'info', text: partial ? 'Detenido.' : 'Detenido antes de que empezara a contestar.' } : { tone: 'error', text: err.message },
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
      set({ sampleOk: ok })
      sync()
    }

    const settings = d.persist ? loadSettings() : { ...DEFAULT_SETTINGS }
    const keys = d.persist ? loadAllKeys() : { claude: false, gemini: false, groq: false, custom: false }
    queueMicrotask(() => void detect())

    /** Guarda los ajustes en el aparato y recalcula lo que dependa de ellos. */
    const updateSettings = (next: ClaudeSettings): void => {
      if (d.persist) saveSettings(next)
      sync({ settings: next })
    }

    return {
      open: false,
      view: 'chat',
      messages: d.persist ? loadMessages() : [],
      status: 'idle',
      settings,
      hasKey: keys.claude,
      keys,
      provider: effectiveProvider(settings, keys),
      test: idleTest,
      draft: '',
      sampleOk: null,
      host,
      via: viaOf(null, keys, settings, host),

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
        updateSettings({ ...get().settings, ...p })
        if (p.speak === false) stopSpeaking()
        if (p.remember !== undefined && d.persist) {
          // la clave de cada servicio se guarda en este aparato o solo en esta pestaña, según lo elegido
          for (const id of Object.keys(get().keys) as ProviderId[]) {
            const k = get().keys[id] ? loadKey(id) : null
            if (k) saveKey(k, p.remember, id)
          }
        }
      },

      setProvider(p) {
        sampleBlocked = false
        updateSettings({ ...get().settings, provider: p })
      },

      setModel(p, model) {
        const m = model.trim()
        const models = { ...get().settings.models }
        if (m) models[p] = m
        else delete models[p]
        updateSettings({ ...get().settings, models })
      },

      setCustomBase(url) {
        updateSettings({ ...get().settings, customBase: url.trim() })
      },

      saveProviderKey(p, key) {
        const k = key.trim()
        if (!k) return
        sampleBlocked = false
        if (d.persist) saveKey(k, get().settings.remember, p)
        const next = { ...get().settings, provider: p }
        if (d.persist) saveSettings(next)
        sync({ keys: { ...get().keys, [p]: true }, settings: next })
      },

      forgetProviderKey(p) {
        if (d.persist) clearKey(p)
        sync({ keys: { ...get().keys, [p]: false } })
      },

      async testConnection() {
        const s = get()
        if (s.test.status === 'running') return
        const v = s.via
        if (v === 'local' || v === 'sample') {
          set({ test: { status: 'error', message: 'Primero pega la clave y guárdala.' } })
          return
        }
        const p = plan(v)
        const ctl = new AbortController()
        const timer = setTimeout(() => ctl.abort(), 45_000)
        set({ test: { status: 'running', message: '' } })
        try {
          await p.transport.ask({ system: 'Responde solo con la palabra «ok».', turns: [{ role: 'user', content: 'Hola' }], model: p.model, signal: ctl.signal, onText: () => {} })
          const who = v === 'api' ? modelById(p.model).name : `${providerById(get().provider).short} (${p.model})`
          set({ test: { status: 'ok', message: `¡Funciona! Contestó ${who}.` } })
        } catch (e) {
          const err = e instanceof ChatError ? e : new ChatError('unknown')
          set({ test: { status: 'error', message: err.code === 'cancelled' ? 'Tardó demasiado en contestar. Vuelve a intentarlo.' : err.message } })
        } finally {
          clearTimeout(timer)
        }
      },

      saveApiKey(key) {
        get().saveProviderKey('claude', key)
      },

      forgetApiKey() {
        get().forgetProviderKey('claude')
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
