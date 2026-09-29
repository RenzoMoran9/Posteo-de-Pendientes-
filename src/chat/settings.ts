import { isProviderId, providerById, type ProviderId } from './providers'

/**
 * Lo que se recuerda en ESTE dispositivo sobre la conversación con la IA: quién contesta (Claude, Gemini, Groq u otra) y con
 * qué modelo, si puede leer los posits, si lee las respuestas en voz alta y, si la persona lo permite, sus claves. Nada de
 * esto sale del navegador salvo cada clave, que va solo al servicio al que pertenece cuando se conversa.
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
  /** El modelo de Claude (cuenta del enlace de prueba o clave de Anthropic). */
  model: ModelId
  /** Quién contesta cuando no se usa la cuenta de Claude del enlace de prueba. `null` = aún no eligió (se usa la que ya tenga clave, y si no, Gemini). */
  provider: ProviderId | null
  /** El modelo elegido para cada servicio (sin valor = el que recomienda la app). */
  models: Partial<Record<ProviderId, string>>
  /** Dirección de la «otra IA» compatible con OpenAI. */
  customBase: string
  /** ¿Puede la IA leer el texto de los posits del tablero activo? */
  shareNotes: boolean
  /** ¿Ya se le explicó a la persona qué se envía? `null` = aún no contestó. */
  consented: boolean | null
  /** Leer las respuestas en voz alta. */
  speak: boolean
  /** Recordar la clave en este dispositivo (si no, solo mientras la pestaña esté abierta). */
  remember: boolean
}

export const DEFAULT_SETTINGS: ClaudeSettings = { model: DEFAULT_MODEL, provider: null, models: {}, customBase: '', shareNotes: true, consented: null, speak: false, remember: true }

const SETTINGS_KEY = 'posits:claude'
/** Dónde se guarda la clave de cada servicio (la de Claude conserva el nombre de siempre). */
const KEY_KEYS: Record<ProviderId, string> = {
  claude: 'posits:claude:key',
  gemini: 'posits:key:gemini',
  groq: 'posits:key:groq',
  custom: 'posits:key:custom',
}

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
    const models: Partial<Record<ProviderId, string>> = {}
    if (o.models && typeof o.models === 'object') {
      for (const [id, m] of Object.entries(o.models)) if (isProviderId(id) && typeof m === 'string' && m.trim()) models[id] = m.trim().slice(0, 120)
    }
    return {
      model: MODELS.some((m) => m.id === o.model) ? (o.model as ModelId) : DEFAULT_MODEL,
      provider: isProviderId(o.provider) ? o.provider : null,
      models,
      customBase: typeof o.customBase === 'string' ? o.customBase.trim().slice(0, 300) : '',
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

/** La clave de un servicio (por defecto la de Anthropic), si la guardó (en este dispositivo o solo en esta pestaña). */
export const loadKey = (p: ProviderId = 'claude'): string | null => read(local(), KEY_KEYS[p]) ?? read(session(), KEY_KEYS[p])

export function saveKey(key: string, remember: boolean, p: ProviderId = 'claude'): void {
  write(local(), KEY_KEYS[p], remember ? key : null)
  write(session(), KEY_KEYS[p], remember ? null : key)
}

export function clearKey(p: ProviderId = 'claude'): void {
  write(local(), KEY_KEYS[p], null)
  write(session(), KEY_KEYS[p], null)
}

/** ¿Tiene pinta de clave de Anthropic? (solo para avisar; la que decide es la API). */
export const looksLikeKey = (k: string): boolean => /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k.trim())

/** Qué claves hay guardadas, servicio por servicio. */
export const loadAllKeys = (): Record<ProviderId, boolean> => ({
  claude: !!loadKey('claude'),
  gemini: !!loadKey('gemini'),
  groq: !!loadKey('groq'),
  custom: !!loadKey('custom'),
})

/** El modelo con el que se contesta para un servicio que no es Claude: el que eligió la persona o el que recomienda la app. */
export const modelFor = (s: Pick<ClaudeSettings, 'models'>, p: ProviderId): string => s.models[p] || providerById(p).defaultModel

/**
 * Quién contesta: lo que eligió la persona; si aún no eligió, el servicio que ya tenga clave (Claude, si venía usando su
 * clave de antes), y si ninguno, Gemini (la opción gratuita).
 */
export function effectiveProvider(s: Pick<ClaudeSettings, 'provider'>, keys: Record<ProviderId, boolean>): ProviderId {
  if (s.provider) return s.provider
  return (['claude', 'gemini', 'groq', 'custom'] as const).find((p) => keys[p]) ?? 'gemini'
}

