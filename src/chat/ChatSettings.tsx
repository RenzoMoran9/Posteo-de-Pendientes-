import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, KeyRound, Loader } from 'lucide-react'
import { setMode } from '../mascot/watch'
import { store, useStore } from '../store/store'
import { chat, useChat } from './chatStore'
import { PROVIDERS, PROVIDER_IDS, baseLooksValid, keyProblem, type ProviderId } from './providers'
import { MODELS, modelFor } from './settings'

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="chat-switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="chat-switch-track" aria-hidden="true" />
      <span className="chat-switch-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  )
}

/** Una línea de texto que se guarda al salir del campo o con Enter (así no se guarda a medio escribir). */
function CommitField({ label, value, onCommit, placeholder, help, invalid }: { label: string; value: string; onCommit: (v: string) => void; placeholder?: string; help?: string; invalid?: string | null }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <label className="chat-field">
      <span>{label}</span>
      <input
        type="text"
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() !== value && onCommit(text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onCommit(text)
          }
        }}
      />
      {invalid && <span className="chat-warn">{invalid}</span>}
      {help && <span className="chat-help">{help}</span>}
    </label>
  )
}

/** Cómo conseguir la clave (pasos con el enlace), dónde pegarla y guardarla; o «Clave guardada» con el botón de olvidarla. */
function KeyBox({ id }: { id: ProviderId }) {
  const info = PROVIDERS[id]
  const saved = useChat((s) => s.keys[id])
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const trimmed = key.trim()
  const problem = keyProblem(id, trimmed)

  if (saved) {
    return (
      <div className="chat-key-row">
        <span className="chat-key-mask">
          <KeyRound aria-hidden="true" /> Clave guardada
        </span>
        <button type="button" className="chat-btn" onClick={() => chat.getState().forgetProviderKey(id)}>
          Olvidar clave
        </button>
      </div>
    )
  }

  return (
    <form
      className="chat-key-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!trimmed) return
        chat.getState().saveProviderKey(id, trimmed)
        setKey('')
      }}
    >
      {info.steps.length > 0 && (
        <div className="chat-steps-box">
          <p className="chat-steps-title">Cómo conseguir la clave{info.free ? ' (gratis)' : ''}</p>
          <ol className="chat-steps">
            {info.steps.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          {info.keyUrl && (
            <a className="chat-btn chat-btn-link" href={info.keyUrl} target="_blank" rel="noopener noreferrer">
              Abrir {info.keyHost}
            </a>
          )}
        </div>
      )}
      <label className="chat-field">
        <span>{id === 'claude' ? 'Tu clave de Anthropic' : id === 'custom' ? 'La clave de ese servicio' : `Tu clave de ${info.short}`}</span>
        <span className="chat-field-row">
          <input
            type={show ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={info.keyPlaceholder}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby="chat-key-help"
          />
          <button type="button" className="chat-btn chat-btn-small" onClick={() => setShow((v) => !v)} aria-pressed={show}>
            {show ? 'Ocultar' : 'Ver'}
          </button>
        </span>
      </label>
      {problem && <p className="chat-warn">{problem}</p>}
      <button type="submit" className="chat-btn chat-btn-accent" disabled={!trimmed}>
        Guardar clave
      </button>
      <p className="chat-help" id="chat-key-help">
        {id === 'claude' ? (
          <>
            La consigues en <b>{info.keyHost}</b>. Crea una solo para esto y ponle un límite de gasto mensual. Cada mensaje cuesta unos centavos de dólar. Nunca la compartas.
          </>
        ) : (
          <>Se guarda solo en este aparato y va únicamente a {info.short === 'Otra IA' ? 'ese servicio' : info.short} cuando conversas. No la compartas.</>
        )}
      </p>
    </form>
  )
}

/** El modelo que contesta: los recomendados para elegir con un toque y, aparte, un campo para escribir otro nombre. */
function ModelBox({ id }: { id: ProviderId }) {
  const info = PROVIDERS[id]
  const settings = useChat((s) => s.settings)
  const current = modelFor(settings, id)

  if (id === 'custom') {
    return (
      <>
        <CommitField
          label="Dirección del servicio"
          value={settings.customBase}
          placeholder="https://openrouter.ai/api/v1"
          help="La que termina en /v1, donde está «chat/completions»."
          invalid={settings.customBase.trim() && !baseLooksValid(settings.customBase) ? 'Tiene que ser una dirección con https://' : null}
          onCommit={(v) => chat.getState().setCustomBase(v)}
        />
        <CommitField label="Nombre del modelo" value={settings.models.custom ?? ''} placeholder="openrouter/free" help="Tal como lo escribe ese servicio." onCommit={(v) => chat.getState().setModel('custom', v)} />
      </>
    )
  }

  const listed = info.models.some((m) => m.id === current)
  return (
    <>
      <div className="chat-models" role="radiogroup" aria-label={`Modelo de ${info.short}`}>
        {info.models.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={current === m.id} className="chat-model" onClick={() => chat.getState().setModel(id, m.id === info.defaultModel ? '' : m.id)}>
            <span className="chat-model-name">{m.name}</span>
            <small>{m.blurb}</small>
          </button>
        ))}
      </div>
      <details className="chat-more" open={!listed}>
        <summary>Usar otro modelo (avanzado)</summary>
        <CommitField
          label="Nombre del modelo"
          value={listed ? '' : current}
          placeholder={info.defaultModel}
          help="Los nombres cambian con el tiempo: si uno deja de existir, la app te avisa. Déjalo vacío para usar el recomendado."
          onCommit={(v) => chat.getState().setModel(id, v)}
        />
      </details>
    </>
  )
}

/** «Probar conexión»: manda un mensajito de prueba y cuenta qué pasó. */
function TestBox() {
  const test = useChat((s) => s.test)
  const via = useChat((s) => s.via)
  return (
    <div className="chat-test">
      <button type="button" className="chat-btn" disabled={test.status === 'running' || via === 'local' || via === 'sample'} onClick={() => void chat.getState().testConnection()}>
        {test.status === 'running' ? 'Probando…' : 'Probar conexión'}
      </button>
      <p className="chat-test-result" data-status={test.status} role="status" aria-live="polite">
        {test.status === 'running' && (
          <>
            <Loader aria-hidden="true" className="chat-test-spin" /> Esperando respuesta…
          </>
        )}
        {test.status === 'ok' && (
          <>
            <CircleCheck aria-hidden="true" /> {test.message}
          </>
        )}
        {test.status === 'error' && (
          <>
            <CircleAlert aria-hidden="true" /> {test.message}
          </>
        )}
      </p>
    </div>
  )
}

/** Quién contesta: se elige el servicio (gratuito o de pago) y debajo aparece cómo conectarlo. */
function Providers() {
  const provider = useChat((s) => s.provider)
  const keys = useChat((s) => s.keys)
  const via = useChat((s) => s.via)
  const settings = useChat((s) => s.settings)
  const remember = settings.remember
  const info = PROVIDERS[provider]
  const active = via !== 'local'

  return (
    <section className="chat-set">
      <h3>¿Quién contesta?</h3>
      <div className="chat-providers" role="radiogroup" aria-label="Quién contesta">
        {PROVIDER_IDS.map((id) => (
          <button key={id} type="button" role="radio" aria-checked={provider === id} className="chat-provider" onClick={() => chat.getState().setProvider(id)}>
            <span className="chat-provider-name">{PROVIDERS[id].short}</span>
            <small data-free={PROVIDERS[id].free || undefined}>{keys[id] ? 'conectada' : PROVIDERS[id].tag}</small>
          </button>
        ))}
      </div>

      <p className="chat-set-p">{info.blurb}</p>
      {via === 'local' && (
        <p className="chat-set-p">
          Ahora estoy <b>sin conexión a una IA</b>: solo entiendo órdenes sencillas (resumen, «qué hago primero», ordenar por urgencia, numerar).
          {!keys[provider] && <> Conecta {provider === 'custom' ? 'la otra IA' : info.short} aquí abajo para conversar de verdad.</>}
        </p>
      )}
      {active && (
        <p className="chat-set-p chat-set-active">
          Estás usando <b>{provider === 'claude' ? 'tu clave de Anthropic' : info.name}</b>
          {provider !== 'claude' && <> con el modelo <b>{modelFor(settings, provider)}</b></>}. La conversación va directo de este aparato al servicio; la clave no pasa por ningún otro sitio.
        </p>
      )}

      <KeyBox key={provider} id={provider} />
      {provider !== 'claude' && <ModelBox id={provider} />}
      {keys[provider] && <TestBox />}
      <p className="chat-privacy" role="note">
        <b>Qué pasa con lo que envías:</b> {info.privacy}
      </p>
      <Switch checked={remember} onChange={(v) => chat.getState().patchSettings({ remember: v })} label="Recordar las claves en este aparato" hint="Si lo apagas, se olvidan al cerrar la pestaña." />
    </section>
  )
}

/** Dentro del enlace de prueba de claude.ai: se usa la cuenta de Claude sin clave; las demás IA no se pueden llamar desde ahí. */
function HostConnection() {
  const via = useChat((s) => s.via)
  return (
    <section className="chat-set">
      <h3>Conexión</h3>
      {via === 'sample' ? (
        <p className="chat-set-p">
          Estás usando <b>tu cuenta de Claude</b> desde este enlace: no necesitas clave. Lo que se gasta sale de tu plan.
        </p>
      ) : (
        <p className="chat-set-p">
          Ahora estoy <b>sin conexión a una IA</b>: este enlace de prueba no tiene permiso para usar tu cuenta (o no lo autorizaste). Autoriza el uso cuando te lo pida.
        </p>
      )}
      <p className="chat-help">
        Las IA gratuitas (Gemini, Groq…) se conectan desde la <b>página pública</b> de la app: dentro de este enlace de prueba el navegador no deja salir a otros sitios.
      </p>
    </section>
  )
}

/** Ajustes de la conversación: quién contesta, modelo, privacidad, voz, mascota y borrar todo. */
export function ChatSettings() {
  const settings = useChat((s) => s.settings)
  const via = useChat((s) => s.via)
  const provider = useChat((s) => s.provider)
  const host = useChat((s) => s.host)
  const count = useChat((s) => s.messages.length)
  const mode = useStore((s) => s.settings.mascot)
  const moved = useStore((s) => s.settings.mascotPos !== null)
  const claudeModels = via === 'sample' || (!host && provider === 'claude')

  return (
    <div className="chat-settings">
      {host ? <HostConnection /> : <Providers />}

      {claudeModels && (
        <section className="chat-set">
          <h3>Qué modelo de Claude contesta</h3>
          <div className="chat-models" role="radiogroup" aria-label="Modelo de Claude">
            {MODELS.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={settings.model === m.id} className="chat-model" onClick={() => chat.getState().patchSettings({ model: m.id })}>
                <span className="chat-model-name">{m.name}</span>
                <small>{m.blurb}</small>
                {via !== 'sample' && <small className="chat-model-cost">{m.cost} por mensaje</small>}
              </button>
            ))}
          </div>
          {via === 'sample' && <p className="chat-help">En este enlace, tu plan decide qué nivel se usa realmente.</p>}
        </section>
      )}

      <section className="chat-set">
        <h3>Privacidad</h3>
        <Switch
          checked={settings.shareNotes}
          onChange={(v) => chat.getState().patchSettings({ shareNotes: v, consented: true })}
          label="Dejar que la IA lea mis posits"
          hint="Con cada mensaje se envía a la IA el texto de los posits del tablero activo (no los otros tableros). Si lo apagas, solo sabrá cuántos hay."
        />
      </section>

      <section className="chat-set">
        <h3>Voz</h3>
        <Switch checked={settings.speak} onChange={(v) => chat.getState().patchSettings({ speak: v })} label="Leer las respuestas en voz alta" />
      </section>

      <section className="chat-set">
        <h3>La mascota</h3>
        <div className="chat-btn-row">
          <button type="button" className="chat-btn" onClick={() => setMode(mode === 'on' ? 'quiet' : 'on')}>
            {mode === 'on' ? 'Que calle' : 'Que hable'}
          </button>
          <button
            type="button"
            className="chat-btn"
            onClick={() => {
              chat.getState().setOpen(false)
              setMode('off')
            }}
          >
            Ocultar
          </button>
          {moved && (
            <button type="button" className="chat-btn" onClick={() => store.getState().setMascotPos(null)}>
              A su sitio
            </button>
          )}
        </div>
        <p className="chat-help">«Que calle» solo apaga los comentarios que hace sola mientras escribes; siempre puedes hablar con ella.</p>
      </section>

      <section className="chat-set">
        <button type="button" className="chat-btn chat-btn-danger" disabled={count === 0} onClick={() => chat.getState().clear()}>
          Borrar la conversación
        </button>
      </section>
    </div>
  )
}
