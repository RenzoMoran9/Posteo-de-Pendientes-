import { Check, Undo2, X } from 'lucide-react'
import { chat, type ProposalData } from './chatStore'

/**
 * Lo que el asistente propone cambiar en el tablero, como un posit amarillo pegado en la conversación: qué haría, cómo
 * quedaría y los botones «Aplicar» / «No, gracias». Ya aplicada, se puede deshacer. Nada cambia hasta pulsar «Aplicar».
 */
export function Proposal({ msgId, p }: { msgId: string; p: ProposalData }) {
  return (
    <div className="proposal" data-state={p.state} role="group" aria-label="Cambios que propone el asistente">
      <p className="proposal-title">{p.state === 'pending' ? 'Propuesta de cambios' : p.state === 'applied' ? 'Cambios aplicados' : p.state === 'undone' ? 'Cambios deshechos' : 'Propuesta descartada'}</p>
      <ul className="proposal-list">
        {p.items.map((it, i) => (
          <li key={i}>
            <span className="proposal-item">{it.text}</span>
            {it.detail.length > 0 && (
              <ul className="proposal-detail">
                {it.detail.map((d, k) => (
                  <li key={k}>{d}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {p.state === 'pending' && (
        <div className="proposal-actions">
          <button type="button" className="chat-btn chat-btn-accent" onClick={() => chat.getState().apply(msgId)}>
            <Check aria-hidden="true" />
            Aplicar
          </button>
          <button type="button" className="chat-btn" onClick={() => chat.getState().dismiss(msgId)}>
            <X aria-hidden="true" />
            No, gracias
          </button>
        </div>
      )}
      {p.state === 'applied' && (
        <div className="proposal-actions">
          <span className="proposal-done">
            <Check aria-hidden="true" />
            Hecho
          </span>
          {p.canUndo && (
            <button type="button" className="chat-btn" onClick={() => chat.getState().undo(msgId)}>
              <Undo2 aria-hidden="true" />
              Deshacer
            </button>
          )}
        </div>
      )}
    </div>
  )
}
