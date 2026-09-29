/**
 * Quién puede contestar en la conversación. Además de Claude (cuenta del enlace de prueba o clave de Anthropic, de pago),
 * hay opciones gratuitas: Gemini de Google (la más fácil: una clave que se saca gratis con la cuenta de Google) y Groq, y una
 * opción abierta para cualquier servicio «compatible con OpenAI» (por ejemplo OpenRouter). Todas se llaman directo desde el
 * navegador, con la clave de la persona, y las gratuitas necesitan página pública (dentro del enlace de prueba de claude.ai el
 * navegador no deja salir a otros sitios).
 *
 * Datos verificados en septiembre de 2026 en la documentación de cada servicio: los nombres de modelo y los planes gratuitos
 * cambian con el tiempo, por eso el modelo se puede cambiar a mano en los ajustes y hay un botón «Probar conexión».
 */

export type ProviderId = 'claude' | 'gemini' | 'groq' | 'custom'

export const PROVIDER_IDS: readonly ProviderId[] = ['gemini', 'groq', 'custom', 'claude']

export interface ProviderModel {
  id: string
  name: string
  blurb: string
}

export interface ProviderInfo {
  id: ProviderId
  /** Nombre completo y corto («Gemini de Google» / «Gemini»). */
  name: string
  short: string
  /** La etiqueta que va junto al nombre: «gratis», «de pago», «avanzado». */
  tag: string
  free: boolean
  blurb: string
  /** Qué pasa con lo que se envía (la app lo repite en el aviso de privacidad). */
  privacy: string
  keyPlaceholder: string
  /** Dónde se saca la clave y cómo. */
  keyUrl: string
  keyHost: string
  steps: readonly string[]
  models: readonly ProviderModel[]
  defaultModel: string
  /** Solo los compatibles con OpenAI: dirección del servicio. */
  baseURL?: string
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  gemini: {
    id: 'gemini',
    name: 'Gemini de Google',
    short: 'Gemini',
    tag: 'gratis',
    free: true,
    blurb: 'La más fácil de conectar y muy buena en español. La clave se saca gratis con tu cuenta de Google.',
    privacy:
      'Con la clave gratuita, Google puede usar lo que se envía (tus mensajes y el texto de los posits que la IA lea) para mejorar sus productos, y personas de Google pueden revisarlo. Google pide no enviar datos sensibles, confidenciales ni personales: si en tus posits hay datos de pacientes o información reservada, apaga «Dejar que la IA lea mis posits» o usa otra opción.',
    keyPlaceholder: 'AIza…',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHost: 'aistudio.google.com/apikey',
    steps: [
      'Entra a aistudio.google.com/apikey con tu cuenta de Google.',
      'Toca «Crear clave de API» («Create API key») y elige cualquier proyecto.',
      'Copia la clave (empieza con «AIza») y pégala aquí abajo.',
    ],
    models: [
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', blurb: 'La más nueva de la línea rápida. Recomendada.' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', blurb: 'Más ligera: contesta antes y aguanta más mensajes gratis.' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', blurb: 'La de siempre: buena y estable.' },
    ],
    defaultModel: 'gemini-3.8-flash',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    short: 'Groq',
    tag: 'gratis',
    free: true,
    blurb: 'Contesta rapidísimo con modelos abiertos (Llama, GPT-OSS). El plan gratuito tiene límites bajos: con un tablero muy grande puede decir que hay demasiado texto.',
    privacy: 'Según sus condiciones, Groq no usa lo que envías para entrenar sus modelos ni lo guarda de forma permanente.',
    keyPlaceholder: 'gsk_…',
    keyUrl: 'https://console.groq.com/keys',
    keyHost: 'console.groq.com/keys',
    steps: [
      'Entra a console.groq.com/keys (puedes registrarte con tu cuenta de Google).',
      'Toca «Create API Key», ponle un nombre y créala.',
      'Copia la clave (empieza con «gsk_») y pégala aquí abajo.',
    ],
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', blurb: 'Grande y muy buena en español. Recomendada.' },
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', blurb: 'Abierta de OpenAI: piensa antes de contestar.' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', blurb: 'Chica y veloz, para dudas sencillas.' },
    ],
    defaultModel: 'llama-3.3-70b-versatile',
    baseURL: 'https://api.groq.com/openai/v1',
  },
  custom: {
    id: 'custom',
    name: 'Otra IA (compatible con OpenAI)',
    short: 'Otra IA',
    tag: 'avanzado',
    free: false,
    blurb: 'Para cualquier servicio que hable como OpenAI: OpenRouter (https://openrouter.ai/api/v1 con el modelo openrouter/free), Together, Mistral…',
    privacy: 'Revisa las condiciones de ese servicio: la app le enviará tus mensajes y el texto de tus posits que la IA lea.',
    keyPlaceholder: 'la clave de ese servicio',
    keyUrl: '',
    keyHost: '',
    steps: [],
    models: [],
    defaultModel: '',
  },
  claude: {
    id: 'claude',
    name: 'Claude (de pago)',
    short: 'Claude',
    tag: 'de pago',
    free: false,
    blurb: 'La más inteligente. Dentro del enlace de prueba de claude.ai usa tu cuenta sin clave; en la página pública, con tu clave de Anthropic.',
    privacy: 'Con tu clave de Anthropic, lo que se envía va solo a Anthropic para preparar cada respuesta.',
    keyPlaceholder: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHost: 'console.anthropic.com → API keys',
    steps: [],
    models: [],
    defaultModel: 'claude-opus-5-5',
  },
}

export const providerById = (id: string | null | undefined): ProviderInfo => PROVIDERS[(id as ProviderId) in PROVIDERS ? (id as ProviderId) : 'gemini']

export const isProviderId = (v: unknown): v is ProviderId => typeof v === 'string' && v in PROVIDERS

/** Deja una dirección lista para usar: con «https://», sin barra final y sin el «/chat/completions» que a veces se pega de más. */
export function normalizeBase(url: string): string {
  let u = url.trim().replace(/\/+$/, '')
  if (!u) return ''
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`
  return u.replace(/\/chat\/completions$/i, '').replace(/\/+$/, '')
}

/** ¿Es una dirección que se pueda usar? (con https, salvo el propio aparato) */
export function baseLooksValid(url: string): boolean {
  const u = normalizeBase(url)
  try {
    const parsed = new URL(u)
    return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(parsed.hostname))
  } catch {
    return false
  }
}

/** Un aviso si la clave pegada no parece de ese servicio (solo orienta: quien decide si sirve es el servicio). */
export function keyProblem(id: ProviderId, key: string): string | null {
  const k = key.trim()
  if (!k) return null
  if (/\s/.test(k)) return 'La clave no lleva espacios: cópiala entera, sin nada más.'
  switch (id) {
    case 'claude':
      return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k) ? null : 'Esa clave no tiene el formato de las de Anthropic (empiezan con «sk-ant-»). Revísala.'
    case 'gemini':
      if (/^sk-/.test(k) || /^gsk_/.test(k)) return 'Esa parece una clave de otro servicio. La de Gemini se saca en aistudio.google.com/apikey.'
      return k.length < 20 ? 'Esa clave parece incompleta. Cópiala entera desde Google AI Studio.' : null
    case 'groq':
      return /^gsk_[A-Za-z0-9]{20,}$/.test(k) ? null : 'Las claves de Groq empiezan con «gsk_». Revísala.'
    default:
      return null
  }
}
