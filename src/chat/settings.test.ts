import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SETTINGS,
  clearKey,
  effectiveProvider,
  loadAllKeys,
  loadKey,
  loadSettings,
  modelFor,
  parseSettings,
  saveKey,
  saveSettings,
} from './settings'

/** Un `localStorage` y un `sessionStorage` de mentira. */
function memory(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memory())
  vi.stubGlobal('sessionStorage', memory())
})
afterEach(() => vi.unstubAllGlobals())

describe('parseSettings', () => {
  it('sin nada guardado, los de siempre (sin servicio elegido, con el modelo de Claude por defecto)', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS.provider).toBeNull()
    expect(DEFAULT_SETTINGS.models).toEqual({})
  })

  it('lo guardado antes de que hubiera más servicios (solo Claude) se sigue abriendo', () => {
    const s = parseSettings('{"model":"claude-sonnet-5-5","shareNotes":false,"consented":true,"speak":true,"remember":false}')
    expect(s).toMatchObject({ model: 'claude-sonnet-5-5', provider: null, models: {}, customBase: '', shareNotes: false, consented: true, speak: true, remember: false })
  })

  it('recuerda el servicio, los modelos y la dirección elegidos', () => {
    const s = parseSettings(JSON.stringify({ provider: 'groq', models: { groq: ' openai/gpt-oss-120b ', gemini: 'gemini-2.5-flash' }, customBase: ' https://openrouter.ai/api/v1 ' }))
    expect(s.provider).toBe('groq')
    expect(s.models).toEqual({ groq: 'openai/gpt-oss-120b', gemini: 'gemini-2.5-flash' })
    expect(s.customBase).toBe('https://openrouter.ai/api/v1')
  })

  it('descarta servicios que no existen, modelos que no son texto y basura', () => {
    const s = parseSettings(JSON.stringify({ provider: 'skynet', models: { skynet: 'x', groq: 7, gemini: '   ', custom: 'modelo' }, customBase: 42 }))
    expect(s.provider).toBeNull()
    expect(s.models).toEqual({ custom: 'modelo' })
    expect(s.customBase).toBe('')
    expect(parseSettings('{no es json')).toEqual(DEFAULT_SETTINGS)
  })
})

describe('las claves, servicio por servicio', () => {
  it('cada servicio guarda la suya sin pisar las demás, y la de Claude conserva su lugar de siempre', () => {
    saveKey('sk-ant-a', true)
    saveKey('AIzaGem', true, 'gemini')
    saveKey('gsk_x', true, 'groq')
    expect(loadKey()).toBe('sk-ant-a')
    expect(loadKey('claude')).toBe('sk-ant-a')
    expect(loadKey('gemini')).toBe('AIzaGem')
    expect(loadKey('groq')).toBe('gsk_x')
    expect(loadKey('custom')).toBeNull()
    expect(localStorage.getItem('posits:claude:key')).toBe('sk-ant-a')
  })

  it('sin «recordar», la clave vive solo en la pestaña (sessionStorage) y no en el aparato', () => {
    saveKey('AIzaGem', false, 'gemini')
    expect(localStorage.getItem('posits:key:gemini')).toBeNull()
    expect(sessionStorage.getItem('posits:key:gemini')).toBe('AIzaGem')
    expect(loadKey('gemini')).toBe('AIzaGem')
    saveKey('AIzaGem', true, 'gemini')
    expect(sessionStorage.getItem('posits:key:gemini')).toBeNull()
    expect(localStorage.getItem('posits:key:gemini')).toBe('AIzaGem')
  })

  it('clearKey borra la de ese servicio y solo esa', () => {
    saveKey('a', true, 'gemini')
    saveKey('b', true, 'groq')
    clearKey('gemini')
    expect(loadKey('gemini')).toBeNull()
    expect(loadKey('groq')).toBe('b')
  })

  it('loadAllKeys dice qué servicios tienen clave', () => {
    saveKey('a', true, 'gemini')
    saveKey('b', false, 'custom')
    expect(loadAllKeys()).toEqual({ claude: false, gemini: true, groq: false, custom: true })
  })

  it('los ajustes se guardan y se leen', () => {
    saveSettings({ ...DEFAULT_SETTINGS, provider: 'gemini', models: { gemini: 'gemini-2.5-flash' } })
    expect(loadSettings()).toMatchObject({ provider: 'gemini', models: { gemini: 'gemini-2.5-flash' } })
  })
})

describe('quién contesta y con qué modelo', () => {
  const none = { claude: false, gemini: false, groq: false, custom: false }

  it('lo que la persona eligió manda', () => {
    expect(effectiveProvider({ provider: 'groq' }, none)).toBe('groq')
    expect(effectiveProvider({ provider: 'claude' }, { ...none, gemini: true })).toBe('claude')
  })

  it('sin elegir, el servicio que ya tiene clave (Claude primero, para quien venía usando su clave), y si ninguno, Gemini', () => {
    expect(effectiveProvider({ provider: null }, none)).toBe('gemini')
    expect(effectiveProvider({ provider: null }, { ...none, claude: true, gemini: true })).toBe('claude')
    expect(effectiveProvider({ provider: null }, { ...none, groq: true })).toBe('groq')
  })

  it('modelFor: el elegido o el que recomienda la app', () => {
    expect(modelFor({ models: {} }, 'gemini')).toBe('gemini-3.8-flash')
    expect(modelFor({ models: {} }, 'groq')).toBe('llama-3.3-70b-versatile')
    expect(modelFor({ models: { gemini: 'gemini-2.5-flash' } }, 'gemini')).toBe('gemini-2.5-flash')
    expect(modelFor({ models: {} }, 'custom')).toBe('')
  })
})
