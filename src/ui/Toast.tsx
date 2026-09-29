import { useEffect } from 'react'
import { store, useStore } from '../store/store'

/** Aviso breve con "Deshacer" (por ejemplo, tras borrar un posit). */
export function Toast() {
  const toast = useStore((s) => s.toast)
  const id = toast?.id
  const duration = toast?.duration ?? 6500

  useEffect(() => {
    if (id === undefined) return
    const t = setTimeout(() => store.getState().dismissToast(), duration)
    return () => clearTimeout(t)
  }, [id, duration])

  if (!toast) return null
  return (
    <div className="toast hand-box" role="status" aria-live="polite" key={toast.id}>
      <span>{toast.message}</span>
      {toast.onAction && (
        <button type="button" className="toast-action" onClick={toast.onAction}>
          {toast.actionLabel ?? 'Deshacer'}
        </button>
      )}
    </div>
  )
}
