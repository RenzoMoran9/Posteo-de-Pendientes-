import { useCallback, useRef } from 'react'
import { Board } from './board/Board'
import { kbdProxy } from './board/kbd'
import { useChromeInsets } from './hooks/useChromeInsets'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useVisualViewport } from './hooks/useVisualViewport'
import { ContextBar } from './ui/ContextBar'
import { MarkerCase } from './ui/MarkerCase'
import { SvgDefs } from './ui/SvgDefs'
import { Toast } from './ui/Toast'
import { TopBar } from './ui/TopBar'

export default function App() {
  useVisualViewport()
  useKeyboardShortcuts()

  const topRef = useRef<HTMLElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  useChromeInsets(topRef, dockRef)

  const proxyRef = useCallback((el: HTMLInputElement | null) => {
    kbdProxy.el = el
  }, [])

  return (
    <div className="app">
      <SvgDefs />
      <Board />
      <TopBar ref={topRef} />
      <div className="dock" ref={dockRef}>
        <Toast />
        <ContextBar />
        <MarkerCase />
      </div>
      <input ref={proxyRef} className="kbd-proxy" aria-hidden="true" tabIndex={-1} autoComplete="off" />
    </div>
  )
}
