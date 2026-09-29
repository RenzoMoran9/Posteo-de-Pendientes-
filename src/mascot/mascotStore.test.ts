import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bubbleDuration, mascotStore } from './mascotStore'

const S = () => mascotStore.getState()

beforeEach(() => {
  vi.useFakeTimers()
  mascotStore.setState({ mood: 'idle', asleep: false, bubble: null, talking: false, hops: 0 })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('mascotStore', () => {
  it('say muestra la nube con sus botones y hush la quita', () => {
    S().say('Hola', { chips: [{ label: 'Va', run: () => {} }] })
    expect(S().bubble?.text).toBe('Hola')
    expect(S().bubble?.chips).toHaveLength(1)
    S().hush()
    expect(S().bubble).toBeNull()
  })

  it('cada nube tiene su propio número (para reiniciar el efecto de escritura)', () => {
    S().say('uno')
    const a = S().bubble?.id
    S().say('dos')
    expect(S().bubble?.id).not.toBe(a)
  })

  it('feel cambia el ánimo, da un saltito y vuelve solo a «idle»', () => {
    S().feel('happy', 1000)
    expect(S().mood).toBe('happy')
    expect(S().hops).toBe(1)
    vi.advanceTimersByTime(1100)
    expect(S().mood).toBe('idle')
    S().feel('think', 500)
    expect(S().hops).toBe(1) // pensar no da saltitos
  })

  it('un ánimo nuevo reemplaza al anterior sin que el viejo lo apague antes de tiempo', () => {
    S().feel('happy', 1000)
    vi.advanceTimersByTime(600)
    S().feel('surprised', 1000)
    vi.advanceTimersByTime(600)
    expect(S().mood).toBe('surprised')
    vi.advanceTimersByTime(600)
    expect(S().mood).toBe('idle')
  })

  it('dormida no tiene nube ni habla; al despertar todo vuelve', () => {
    S().say('algo')
    S().setTalking(true)
    S().sleep(true)
    expect(S()).toMatchObject({ asleep: true, bubble: null, talking: false, mood: 'idle' })
    S().sleep(false)
    expect(S().asleep).toBe(false)
  })

  it('con la nube dicha en un mood, este se aplica', () => {
    S().say('¡Bien!', { mood: 'happy' })
    expect(S().mood).toBe('happy')
  })
})

describe('bubbleDuration', () => {
  it('da tiempo para leer: entre 3,8 y 9,5 segundos, más cuanto más largo', () => {
    expect(bubbleDuration('Hola')).toBe(3800)
    expect(bubbleDuration('x'.repeat(60))).toBeGreaterThan(bubbleDuration('x'.repeat(30)))
    expect(bubbleDuration('x'.repeat(500))).toBe(9500)
  })
})
