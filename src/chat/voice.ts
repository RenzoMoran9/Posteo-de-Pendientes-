/**
 * Hablar y escuchar con la voz del aparato (sin servicios aparte): leer las respuestas en voz alta y dictar lo que
 * se quiere decir. Depende de lo que el navegador ofrezca: en Chrome, Edge y Safari suele haber dictado; si no hay,
 * el botón del micrófono simplemente no aparece.
 */

// ───────────── leer en voz alta ─────────────

export const canSpeak = (): boolean => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'

/** Idioma para la voz y el dictado: el del aparato si es español; si no, español de Perú (el de quien lo usa). */
export function voiceLang(): string {
  const l = typeof navigator !== 'undefined' ? navigator.language : ''
  return /^es\b/i.test(l) ? l : 'es-PE'
}

/** Quita lo que suena raro al leerlo: viñetas, comillas angulares, números de lista. */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/^\s*(\d+)[.)]\s+/gm, '$1. ')
    .replace(/[«»"]/g, '')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\.\s*\./g, '.')
    .trim()
}

let utterance: SpeechSynthesisUtterance | null = null

export function stopSpeaking(): void {
  if (!canSpeak()) return
  utterance = null
  speechSynthesis.cancel()
}

/** Lee `text` en voz alta; `onEnd` se llama al terminar (o si se corta). */
export function speak(text: string, onEnd?: () => void): boolean {
  if (!canSpeak()) return false
  const clean = cleanForSpeech(text)
  if (!clean) return false
  stopSpeaking()
  const u = new SpeechSynthesisUtterance(clean)
  u.lang = voiceLang()
  u.rate = 1.03
  u.onend = () => {
    if (utterance === u) utterance = null
    onEnd?.()
  }
  u.onerror = () => {
    if (utterance === u) utterance = null
    onEnd?.()
  }
  utterance = u
  speechSynthesis.speak(u)
  return true
}

// ───────────── dictar ─────────────

interface RecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}

interface RecognitionEventLike {
  results: ArrayLike<RecognitionResultLike>
}

interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error?: string }) => void) | null
  start(): void
  stop(): void
  abort(): void
}

type RecognitionCtor = new () => RecognitionLike

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const canListen = (): boolean => !!recognitionCtor()

export interface Listening {
  stop(): void
}

export interface ListenHandlers {
  /** Lo que se lleva dicho (todo el dictado hasta ahora); `final` cuando ya no cambiará. */
  onText(text: string, final: boolean): void
  /** Terminó (la persona calló, se pulsó otra vez o hubo un error). `error` dice por qué, si falló. */
  onEnd(error?: string): void
}

/** Empieza a escuchar (pide permiso del micrófono la primera vez). Devuelve `null` si el aparato no puede. */
export function listen(h: ListenHandlers): Listening | null {
  const Ctor = recognitionCtor()
  if (!Ctor) return null
  const rec = new Ctor()
  rec.lang = voiceLang()
  rec.continuous = false
  rec.interimResults = true
  let error: string | undefined
  let last = ''
  rec.onresult = (e) => {
    let text = ''
    let final = true
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript
      if (!e.results[i].isFinal) final = false
    }
    last = text
    h.onText(text, final)
  }
  rec.onerror = (e) => {
    error = e.error ?? 'error'
  }
  rec.onend = () => h.onEnd(error && error !== 'no-speech' && error !== 'aborted' ? error : last ? undefined : error)
  try {
    rec.start()
  } catch {
    return null
  }
  return {
    stop() {
      try {
        rec.stop()
      } catch {
        /* ya terminó */
      }
    },
  }
}
