import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Mic, Settings, SendHorizontal, Square, X } from 'lucide-react'
import { useCoarsePointer } from '../hooks/useCoarsePointer'
import { ClawdPeek } from '../mascot/ClawdArt'
import { chat, useChat, type ChatMessage } from './chatStore'
import { ChatSettings } from './ChatSettings'
import { Proposal } from './Proposal'
import { modelById } from './settings'
import { canListen, listen, type Listening } from './voice'

const SUGGESTIONS = ['¿Qué debería hacer primero?', 'Ordena mis pendientes', 'Resume mi tablero', 'Arma un plan para hoy']

/** Lo que se estaba escribiendo al cerrar el panel (para no perderlo si se abre otra vez). */
let lastDraft = ''

function Message({ m }: { m: ChatMessage }) {
  const bot = m.role === 'assistant'
  return (
    <div className={bot ? 'msg msg-bot' : 'msg msg-user'} data-role={m.role}>
      {bot ? (
        <div className="msg-bubble">
          {m.streaming && !m.text ? (
            <span className="msg-dots" role="status" aria-label="Claude está pensando">
              <i />
              <i />
              <i />
            </span>
          ) : (
            <p className="msg-text">
              {m.text}
              {m.streaming && <span className="msg-caret" aria-hidden="true" />}
            </p>
          )}
          {m.via === 'local' && !m.streaming && <span className="msg-tag">respuesta sencilla, sin Claude</span>}
        </div>
      ) : (
        <div className="msg-bubble">
          <p className="msg-text">{m.text}</p>
        </div>
      )}
      {m.note && (
        <p className="msg-note" data-tone={m.note.tone} role={m.note.tone === 'error' ? 'alert' : 'status'}>
          {m.note.text}
        </p>
      )}
      {m.proposal && <Proposal msgId={m.id} p={m.proposal} />}
    </div>
  )
}

function Welcome({ onPick }: { onPick: (t: string) => void }) {
  const via = useChat((s) => s.via)
  return (
    <div className="chat-welcome">
      <p className="chat-welcome-title">Hola, soy Claude.</p>
      <p>Puedo ayudarte con tus pendientes: decidir qué hacer primero, ordenarlos, numerarlos o armar un plan. También puedes hablarme por voz.</p>
      {via === 'local' && (
        <p className="chat-callout">
          Ahora estoy <b>sin conexión a Claude</b>, así que solo entiendo órdenes sencillas. Para conversar de verdad, conecta tu clave en{' '}
          <button type="button" className="chat-link" onClick={() => chat.getState().showSettings(true)}>
            ⚙ Ajustes
          </button>
          .
        </p>
      )}
      <div className="chat-suggest" role="group" aria-label="Ideas para empezar">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chat-chip" onClick={() => onPick(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Antes de la primera conversación: qué se envía y a quién. Solo cuando de verdad sale algo del aparato. */
function Consent() {
  return (
    <div className="chat-consent" role="group" aria-label="Antes de empezar">
      <p>
        <b>Antes de empezar:</b> para ayudarte, Claude lee el texto de los posits de este tablero. Se envía a Anthropic solo para preparar cada respuesta.
        Puedes cambiarlo cuando quieras en ⚙ Ajustes.
      </p>
      <div className="chat-btn-row">
        <button type="button" className="chat-btn chat-btn-accent" onClick={() => chat.getState().patchSettings({ consented: true, shareNotes: true })}>
          Entendido, seguir
        </button>
        <button type="button" className="chat-btn" onClick={() => chat.getState().patchSettings({ consented: true, shareNotes: false })}>
          No leer mis posits
        </button>
      </div>
    </div>
  )
}

export function ChatPanel() {
  const open = useChat((s) => s.open)
  return open ? <ChatPanelBody /> : null
}

function ChatPanelBody() {
  const view = useChat((s) => s.view)
  const messages = useChat((s) => s.messages)
  const status = useChat((s) => s.status)
  const via = useChat((s) => s.via)
  const model = useChat((s) => s.settings.model)
  const consented = useChat((s) => s.settings.consented)
  const coarse = useCoarsePointer()

  const [draft, setDraftState] = useState(lastDraft)
  const [listening, setListening] = useState<Listening | null>(null)
  const [micError, setMicError] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const dictated = useRef('')

  const busy = status !== 'idle'
  const needsConsent = consented === null && via !== 'local'
  const setDraft = (t: string) => {
    lastDraft = t
    setDraftState(t)
  }

  // Esc: sale de los ajustes o cierra el panel (sin quitarle la selección al posit)
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      const s = chat.getState()
      if (s.view === 'settings') s.showSettings(false)
      else s.setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => {
    if (!coarse && view === 'chat') inputRef.current?.focus()
  }, [coarse, view])

  // al cerrarse el panel, deja de escuchar
  useEffect(
    () => () => {
      listening?.stop()
    },
    [listening],
  )

  // el campo crece con lo que se escribe (hasta unas cuatro líneas)
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 124)}px`
  }, [draft, view])

  // al llegar mensajes, baja al final (salvo que se esté leyendo más arriba)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages, status, view])

  const submit = (text = draft) => {
    const t = text.trim()
    if (!t || busy || needsConsent) return
    setDraft('')
    stick.current = true
    void chat.getState().send(t)
    if (!coarse) inputRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // en la PC, Enter envía y Mayús+Enter baja de renglón; en el celular Enter siempre baja de renglón
    if (e.key === 'Enter' && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const toggleMic = () => {
    setMicError('')
    if (listening) {
      listening.stop()
      return
    }
    dictated.current = ''
    const l = listen({
      onText: (t) => {
        dictated.current = t
        setDraft(t)
      },
      onEnd: (error) => {
        setListening(null)
        if (error) {
          setMicError(
            error === 'not-allowed' || error === 'service-not-allowed'
              ? 'No hay permiso para usar el micrófono. Actívalo en el navegador.'
              : error === 'network'
                ? 'El dictado necesita internet.'
                : 'No pude escuchar. Inténtalo otra vez.',
          )
          return
        }
        const said = dictated.current.trim()
        if (said) submit(said) // lo dictado se envía solo al terminar de hablar
      },
    })
    if (!l) setMicError('Este navegador no permite dictar por voz.')
    else setListening(l)
  }

  const statusText =
    status === 'waiting' ? 'pensando…' : status === 'streaming' ? 'escribiendo…' : via === 'sample' ? 'con tu cuenta de Claude' : via === 'api' ? `con tu clave · ${modelById(model).name}` : 'modo sencillo (sin Claude)'

  return (
    <section className="chat hand-box" role="dialog" aria-label="Conversación con Claude" data-chat data-via={via}>
      <header className="chat-head">
        <ClawdPeek />
        <div className="chat-title">
          <p className="chat-name">Claude</p>
          <p className="chat-status" role="status" data-busy={busy || undefined}>
            <i className="chat-dot" aria-hidden="true" />
            {statusText}
          </p>
        </div>
        <button type="button" className="chat-icon" aria-label="Ajustes" aria-pressed={view === 'settings'} title="Ajustes" onClick={() => chat.getState().showSettings(view !== 'settings')}>
          <Settings aria-hidden="true" />
        </button>
        <button type="button" className="chat-icon" aria-label="Cerrar la conversación" title="Cerrar" onClick={() => chat.getState().setOpen(false)}>
          <X aria-hidden="true" />
        </button>
      </header>

      {view === 'settings' ? (
        <div className="chat-page chat-page-settings">
          <ChatSettings />
        </div>
      ) : (
        <>
          <div
            className="chat-page chat-scroll"
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-busy={busy}
            aria-label="Mensajes"
            onScroll={(e) => {
              const el = e.currentTarget
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
            }}
          >
            {messages.length === 0 ? <Welcome onPick={(t) => submit(t)} /> : messages.map((m) => <Message key={m.id} m={m} />)}
          </div>

          {needsConsent && <Consent />}

          <form
            className="chat-compose"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            {micError && (
              <p className="chat-mic-error" role="alert">
                {micError}
              </p>
            )}
            <textarea
              ref={inputRef}
              data-chat-input
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={listening ? 'Te escucho…' : 'Escríbeme aquí…'}
              aria-label="Tu mensaje para Claude"
              enterKeyHint="send"
              autoComplete="off"
              autoCapitalize="sentences"
              maxLength={4000}
            />
            {canListen() && (
              <button type="button" className="chat-round" data-on={listening ? '' : undefined} aria-label={listening ? 'Dejar de escuchar' : 'Hablarle por voz'} aria-pressed={!!listening} title="Hablarle por voz" onClick={toggleMic}>
                <Mic aria-hidden="true" />
              </button>
            )}
            {busy ? (
              <button type="button" className="chat-round chat-round-stop" aria-label="Detener" title="Detener" onClick={() => chat.getState().stop()}>
                <Square aria-hidden="true" />
              </button>
            ) : (
              <button type="submit" className="chat-round chat-round-send" aria-label="Enviar" title="Enviar" disabled={!draft.trim() || needsConsent}>
                <SendHorizontal aria-hidden="true" />
              </button>
            )}
          </form>
        </>
      )}
    </section>
  )
}
