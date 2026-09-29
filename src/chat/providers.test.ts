import { describe, expect, it } from 'vitest'
import { PROVIDERS, PROVIDER_IDS, baseLooksValid, isProviderId, keyProblem, normalizeBase, providerById } from './providers'

describe('el catálogo de servicios', () => {
  it('todos los servicios de la lista existen, y Gemini (gratis) va primero', () => {
    expect(PROVIDER_IDS[0]).toBe('gemini')
    for (const id of PROVIDER_IDS) expect(PROVIDERS[id].id).toBe(id)
  })

  it('los gratuitos traen pasos para sacar la clave, un modelo recomendado que está en su lista y un aviso de privacidad', () => {
    for (const id of ['gemini', 'groq'] as const) {
      const p = PROVIDERS[id]
      expect(p.free).toBe(true)
      expect(p.steps.length).toBeGreaterThanOrEqual(3)
      expect(p.keyUrl).toMatch(/^https:\/\//)
      expect(p.models.some((m) => m.id === p.defaultModel)).toBe(true)
      expect(p.privacy.length).toBeGreaterThan(30)
    }
  })

  it('Gemini avisa con claridad que en el plan gratuito Google puede usar y revisar lo que se envía', () => {
    const t = PROVIDERS.gemini.privacy
    expect(t).toMatch(/mejorar sus productos/)
    expect(t).toMatch(/personas de Google pueden revisarlo/)
    expect(t).toMatch(/datos sensibles/)
  })

  it('Groq apunta a la dirección compatible con OpenAI', () => {
    expect(PROVIDERS.groq.baseURL).toBe('https://api.groq.com/openai/v1')
  })

  it('providerById cae en Gemini con un valor desconocido, e isProviderId valida', () => {
    expect(providerById('groq').id).toBe('groq')
    expect(providerById('nada').id).toBe('gemini')
    expect(providerById(null).id).toBe('gemini')
    expect(isProviderId('claude')).toBe(true)
    expect(isProviderId('openai')).toBe(false)
    expect(isProviderId(3)).toBe(false)
  })
})

describe('direcciones', () => {
  it('normalizeBase agrega https, quita la barra final y el /chat/completions que se pega de más', () => {
    expect(normalizeBase(' openrouter.ai/api/v1/ ')).toBe('https://openrouter.ai/api/v1')
    expect(normalizeBase('https://api.groq.com/openai/v1/chat/completions')).toBe('https://api.groq.com/openai/v1')
    expect(normalizeBase('http://localhost:1234/v1')).toBe('http://localhost:1234/v1')
    expect(normalizeBase('   ')).toBe('')
  })

  it('baseLooksValid pide https (y deja http solo para el propio aparato)', () => {
    expect(baseLooksValid('https://openrouter.ai/api/v1')).toBe(true)
    expect(baseLooksValid('openrouter.ai/api/v1')).toBe(true)
    expect(baseLooksValid('http://localhost:1234/v1')).toBe(true)
    expect(baseLooksValid('http://ejemplo.com/v1')).toBe(false)
    expect(baseLooksValid('')).toBe(false)
    expect(baseLooksValid('no es una dirección')).toBe(false)
  })
})

describe('keyProblem', () => {
  it('no molesta con un campo vacío ni con una clave que se ve bien', () => {
    expect(keyProblem('gemini', '')).toBeNull()
    expect(keyProblem('gemini', 'AIzaSyD-0123456789abcdefghijklmnopqrstu')).toBeNull()
    expect(keyProblem('groq', 'gsk_0123456789abcdefghijklmnopqrstuvwx')).toBeNull()
    expect(keyProblem('claude', 'sk-ant-api03-0123456789abcdefghijk')).toBeNull()
    expect(keyProblem('custom', 'lo-que-sea')).toBeNull()
  })

  it('avisa si lleva espacios, si es de otro servicio o si parece incompleta', () => {
    expect(keyProblem('gemini', 'AIza 123')).toMatch(/espacios/)
    expect(keyProblem('gemini', 'sk-ant-api03-0123456789abcdefghijk')).toMatch(/otro servicio/)
    expect(keyProblem('gemini', 'gsk_0123456789abcdefghijklmnopqrstuvwx')).toMatch(/otro servicio/)
    expect(keyProblem('gemini', 'AIza123')).toMatch(/incompleta/)
    expect(keyProblem('groq', 'AIzaSyD-0123456789')).toMatch(/gsk_/)
    expect(keyProblem('claude', 'AIzaSyD-0123456789')).toMatch(/sk-ant-/)
  })
})
