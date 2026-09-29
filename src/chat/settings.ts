/**
 * Lo que se recuerda en ESTE dispositivo sobre la conversación con Claude: qué modelo usar, si Claude puede leer los
 * posits, si lee las respuestas en voz alta y, si la persona lo permite, su clave de Anthropic. Nada de esto sale
 * del navegador salvo la clave, que va solo a api.anthropic.com cuando se conversa.
 */

export type ModelId = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-4-5'

export interface ModelInfo {
  id: ModelId
  name: string
  blurb: string
  /** Costo aproximado de un mensaje con el tablero, con tarifa de API (dólares). */
  cost: string
  /** Nivel que se pide en el enlace de prueba (cuenta de Claude): rápido, normal o el más capaz. */
  tier: 'quick' | 'default' | 'complex'
}

export const MODELS: readonly ModelInfo[] = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', blurb: 'La más inteligente. Piensa antes de contestar (tarda algo más).', cost: '≈ 2 centavos', tier: 'complex' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', blurb: 'Muy buena y más económica. Un buen término medio.', cost: '≈ 1 centavo', tier: 'default' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', blurb: 'La más rápida y barata. Para dudas sencillas.', cost: '≈ 0,3 centavos', tier: 'quick' },
]

export const DEFAULT_MODEL: ModelId = 'claude-opus-5-5'

export const modelById = (id: string): ModelInfo => MODELS.find((m) => m.id === id) ?? MODELS[0]

export interface ClaudeSettings {
  model: ModelId
  /** ¿Puede Claude leer el texto de los posits del tablero activo? */
  shareNotes: boolean
  /** ¿Ya se le explicó a la persona qué se envía? `null` = aún no contestó. */
  consented: boolean | null
  /** Leer las respuestas en voz alta. */
  speak: boolean
  /** Recordar la clave en este dispositivo (si no, solo mientras la pestaña esté abierta). */
  remember: boolean
}

export const DEFAULT_SETTINGS: ClaudeSettings = { model: DEFAULT_MODEL, shareNotes: true, consented: null, speak: false, remember: true }

const SETTINGS_KEY = 'posits:claude'
const KEY_KEY = 'posits:claude:key'

function read(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(store: Storage | undefined, key: string, value: string | null): void {
  try {
    if (value === null) store?.removeItem(key)
    else store?.setItem(key, value)
  } catch {
    /* sin almacenamiento (ventana privada o bloqueado): se usa mientras la página esté abierta */
  }
}

const local = (): Storage | undefined => (typeof localStorage === 'undefined' ? undefined : localStorage)
const session = (): Storage | undefined => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage)

export function parseSettings(raw: string | null): ClaudeSettings {
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    const o = JSON.parse(raw) as Partial<ClaudeSettings>
    return {
      model: MODELS.some((m) => m.id === o.model) ? (o.model as ModelId) : DEFAULT_MODEL,
      shareNotes: o.shareNotes !== false,
      consented: typeof o.consented === 'boolean' ? o.consented : null,
      speak: o.speak === true,
      remember: o.remember !== false,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export const loadSettings = (): ClaudeSettings => parseSettings(read(local(), SETTINGS_KEY))
export const saveSettings = (s: ClaudeSettings): void => write(local(), SETTINGS_KEY, JSON.stringify(s))

/** La clave de Anthropic de esta persona, si la guardó (en este dispositivo o solo en esta pestaña). */
export const loadKey = (): string | null => read(local(), KEY_KEY) ?? read(session(), KEY_KEY)

export function saveKey(key: string, remember: boolean): void {
  write(local(), KEY_KEY, remember ? key : null)
  write(session(), KEY_KEY, remember ? null : key)
}

export function clearKey(): void {
  write(local(), KEY_KEY, null)
  write(session(), KEY_KEY, null)
}

/** ¿Tiene pinta de clave de Anthropic? (solo para avisar; la que decide es la API). */
export const looksLikeKey = (k: string): boolean => /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k.trim())
