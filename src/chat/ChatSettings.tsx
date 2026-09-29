import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { setMode } from '../mascot/watch'
import { store, useStore } from '../store/store'
import { chat, useChat } from './chatStore'
import { MODELS, looksLikeKey } from './settings'

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

/** La conexión con Claude: la cuenta del enlace de prueba (sin clave) o la clave propia de quien lo usa. */
function Connection() {
  const via = useChat((s) => s.via)
  const sampleOk = useChat((s) => s.sampleOk)
  const host = useChat((s) => s.host)
  const hasKey = useChat((s) => s.hasKey)
  const remember = useChat((s) => s.settings.remember)
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const trimmed = key.trim()

  return (
    <section className="chat-set">
      <h3>Conexión con Claude</h3>
      {sampleOk && via === 'sample' && (
        <p className="chat-set-p">
          Estás usando <b>tu cuenta de Claude</b> desde este enlace: no necesitas clave. Lo que se gasta sale de tu plan.
        </p>
      )}
      {via === 'api' && (
        <p className="chat-set-p">
          Estás usando <b>tu clave de Anthropic</b>. La conversación va directo de este aparato a Anthropic; la clave no pasa por ningún otro sitio.
        </p>
      )}
      {via === 'local' && !host && (
        <p className="chat-set-p">
          Ahora estoy <b>sin conexión a Claude</b>: solo entiendo órdenes sencillas (resumen, «qué hago primero», ordenar por urgencia, numerar).
          Para conversar de verdad, pega tu clave de Anthropic aquí abajo.
        </p>
      )}
      {via === 'local' && host && (
        <p className="chat-set-p">
          Ahora estoy <b>sin conexión a Claude</b>: este enlace de prueba no tiene permiso para usar tu cuenta (o no lo autorizaste), y desde aquí no se
          puede usar una clave. Autoriza el uso cuando te lo pida, o abre la página pública para conectar tu clave.
        </p>
      )}

      {sampleOk !== true && !host && (
        <>
          {hasKey ? (
            <div className="chat-key-row">
              <span className="chat-key-mask">
                <KeyRound aria-hidden="true" /> Clave guardada
              </span>
              <button type="button" className="chat-btn" onClick={() => chat.getState().forgetApiKey()}>
                Olvidar clave
              </button>
            </div>
          ) : (
            <form
              className="chat-key-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (!trimmed) return
                chat.getState().saveApiKey(trimmed)
                setKey('')
              }}
            >
              <label className="chat-field">
                <span>Tu clave de Anthropic</span>
                <span className="chat-field-row">
                  <input
                    type={show ? 'text' : 'password'}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="sk-ant-…"
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
              {trimmed && !looksLikeKey(trimmed) && <p className="chat-warn">Esa clave no tiene el formato de las de Anthropic (empiezan con «sk-ant-»). Revísala.</p>}
              <button type="submit" className="chat-btn chat-btn-accent" disabled={!trimmed}>
                Guardar clave
              </button>
              <p className="chat-help" id="chat-key-help">
                La consigues en <b>console.anthropic.com → API keys</b>. Crea una solo para esto y ponle un límite de gasto mensual. Cada mensaje cuesta
                unos centavos de dólar. Nunca la compartas.
              </p>
            </form>
          )}
          <Switch checked={remember} onChange={(v) => chat.getState().patchSettings({ remember: v })} label="Recordar la clave en este aparato" hint="Si lo apagas, se olvida al cerrar la pestaña." />
        </>
      )}
    </section>
  )
}

/** Ajustes de la conversación: conexión, modelo, privacidad, voz, mascota y borrar todo. */
export function ChatSettings() {
  const settings = useChat((s) => s.settings)
  const sampleOk = useChat((s) => s.sampleOk)
  const host = useChat((s) => s.host)
  const count = useChat((s) => s.messages.length)
  const mode = useStore((s) => s.settings.mascot)
  const moved = useStore((s) => s.settings.mascotPos !== null)

  return (
    <div className="chat-settings">
      <Connection />

      <section className="chat-set">
        <h3>Qué modelo contesta</h3>
        <div className="chat-models" role="radiogroup" aria-label="Modelo de Claude">
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={settings.model === m.id}
              className="chat-model"
              onClick={() => chat.getState().patchSettings({ model: m.id })}
            >
              <span className="chat-model-name">{m.name}</span>
              <small>{m.blurb}</small>
              {sampleOk !== true && !host && <small className="chat-model-cost">{m.cost} por mensaje</small>}
            </button>
          ))}
        </div>
        {sampleOk === true && <p className="chat-help">En este enlace, tu plan decide qué nivel se usa realmente.</p>}
      </section>

      <section className="chat-set">
        <h3>Privacidad</h3>
        <Switch
          checked={settings.shareNotes}
          onChange={(v) => chat.getState().patchSettings({ shareNotes: v, consented: true })}
          label="Dejar que Claude lea mis posits"
          hint="Con cada mensaje se envía el texto de los posits del tablero activo (no los otros tableros). Si lo apagas, solo sabrá cuántos hay."
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
