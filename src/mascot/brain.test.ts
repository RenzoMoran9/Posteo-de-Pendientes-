import { describe, expect, it } from 'vitest'
import { factsOf } from './analyze'
import { ASK, Brain, LIMITS, MANY_OPEN, RED_PAPER, type TypedInput } from './brain'
import { rngFrom } from './cloud'
import { PHRASES } from './phrases'

function make(seed = 1, constant?: number) {
  let t = 1_000_000
  const clock = { now: () => t, advance: (ms: number) => void (t += ms) }
  const brain = new Brain({ now: clock.now, rng: constant === undefined ? rngFrom(seed) : () => constant })
  return { brain, clock }
}

const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
const typed = (over: Partial<TypedInput> = {}): TypedInput => {
  const line = over.lastLine ?? 'Llamar urgente al proveedor'
  return { noteId: 'n1', lastLine: line, facts: factsOf(doc(line)), color: '#FFD95E', stickerIcons: [], ...over }
}

describe('Brain.onTyped', () => {
  it('opina sobre lo que se escribe, con una frase de ese tema', () => {
    const { brain } = make()
    const c = brain.onTyped(typed())
    expect(c).not.toBeNull()
    expect(c?.key).toBe('urgent')
    expect(PHRASES.urgent.lines).toContain(c?.text)
    expect(c?.mood).toBe('surprised')
  })

  it('no dice nada de un texto sin temas ni de un posit vacío', () => {
    const { brain } = make()
    expect(brain.onTyped(typed({ lastLine: 'Un texto cualquiera sin nada', facts: factsOf(doc('Un texto cualquiera sin nada')) }))).toBeNull()
    expect(brain.onTyped(typed({ lastLine: '', facts: factsOf(null) }))).toBeNull()
  })

  it('no es pesada: espera 20 s entre comentarios', () => {
    const { brain, clock } = make()
    expect(brain.onTyped(typed())).not.toBeNull()
    clock.advance(LIMITS.chatGapMs - 1000)
    expect(brain.onTyped(typed({ noteId: 'n2', lastLine: 'Pagar la factura', facts: factsOf(doc('Pagar la factura')) }))).toBeNull()
    clock.advance(1500)
    expect(brain.onTyped(typed({ noteId: 'n2', lastLine: 'Pagar la factura', facts: factsOf(doc('Pagar la factura')) }))?.key).toBe('money')
  })

  it('un tema no se repite en 3 minutos, y en el mismo posit, en 10', () => {
    const { brain, clock } = make()
    const urgent = (noteId: string) => typed({ noteId, lastLine: 'Es urgente', facts: factsOf(doc('Es urgente')) })
    brain.onTyped(urgent('n1'))
    clock.advance(LIMITS.chatGapMs + 1000)
    expect(brain.onTyped(urgent('otro'))).toBeNull() // mismo tema, otro posit, muy pronto
    clock.advance(LIMITS.tagGapMs)
    expect(brain.onTyped(urgent('otro'))?.key).toBe('urgent') // otro posit, ya pasaron los 3 min
    clock.advance(LIMITS.tagGapMs + 1000)
    expect(brain.onTyped(urgent('otro'))).toBeNull() // mismo posit: faltan minutos
    clock.advance(LIMITS.noteTagGapMs)
    expect(brain.onTyped(urgent('otro'))?.key).toBe('urgent')
  })

  it('si el tema principal ya se comentó, pasa al siguiente que también aparezca en el renglón', () => {
    const { brain, clock } = make()
    expect(brain.onTyped(typed())?.key).toBe('urgent') // «Llamar urgente al proveedor»: urgente, trámite y llamada
    clock.advance(LIMITS.chatGapMs + 1000)
    expect(brain.onTyped(typed())?.key).toBe('docs')
    clock.advance(LIMITS.chatGapMs + 1000)
    expect(brain.onTyped(typed())?.key).toBe('call')
    clock.advance(LIMITS.chatGapMs + 1000)
    expect(brain.onTyped(typed())).toBeNull()
  })

  it('comenta como mucho 8 veces cada 10 minutos', () => {
    const { brain, clock } = make()
    const lines = ['urgente', 'para hoy', 'mañana', 'el viernes', 'a las 3pm', 'la factura', 'el expediente', 'los insumos', 'llamar', 'enviar correo']
    let spoke = 0
    for (const [i, line] of lines.entries()) {
      clock.advance(LIMITS.chatGapMs + 500)
      if (brain.onTyped(typed({ noteId: `n${i}`, lastLine: line, facts: factsOf(doc(line)) }))) spoke += 1
    }
    expect(spoke).toBe(LIMITS.maxPerWindow)
    clock.advance(LIMITS.windowMs)
    expect(brain.onTyped(typed({ noteId: 'nuevo', lastLine: 'la reunión', facts: factsOf(doc('la reunión')) }))?.key).toBe('meeting')
  })

  it('si el renglón no dice nada, mira todo el posit; y avisa si está largo o sin casillas', () => {
    const { brain } = make()
    const facts = factsOf(doc('Pagar la factura de agosto'))
    expect(brain.onTyped(typed({ lastLine: 'ok', facts }))?.key).toBe('money')

    const long = factsOf({ type: 'doc', content: Array.from({ length: 10 }, (_, i) => ({ type: 'paragraph', content: [{ type: 'text', text: `renglón número ${i}` }] })) })
    const b2 = make().brain
    expect(b2.onTyped(typed({ noteId: 'l', lastLine: 'x', facts: long }))?.key).toBe('long')

    const lines = factsOf({ type: 'doc', content: ['uno', 'dos', 'tres', 'cuatro'].map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })) })
    const b3 = make().brain
    expect(b3.onTyped(typed({ noteId: 'p', lastLine: 'cuatro', facts: lines }))?.key).toBe('lines')
  })
})

describe('sugerencias', () => {
  it('urgente: ofrece pintar de rojo o poner la sirena, según lo que ya tenga', () => {
    const paint = make(1, 0.05).brain.onTyped(typed())
    expect(paint?.suggest).toMatchObject({ kind: 'paint', hex: RED_PAPER })
    const already = make(1, 0.05).brain.onTyped(typed({ color: RED_PAPER }))
    expect(already?.suggest).toMatchObject({ kind: 'icon', icon: 'sirena' })
    const has = make(1, 0.05).brain.onTyped(typed({ color: RED_PAPER, stickerIcons: ['sirena'] }))
    expect(has?.suggest).toBeUndefined()
    const hasFire = make(1, 0.05).brain.onTyped(typed({ color: RED_PAPER, stickerIcons: ['fuego'] }))
    expect(hasFire?.suggest).toBeUndefined()
  })

  it('no sugiere un ícono que ya está metido en el texto', () => {
    const line = 'Llamar a Juan'
    const facts = factsOf({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: line }, { type: 'inlineIcon', attrs: { icon: 'telefono' } }] }] })
    expect(make(1, 0.05).brain.onTyped(typed({ lastLine: line, facts }))?.suggest).toBeUndefined()
    expect(make(1, 0.05).brain.onTyped(typed({ lastLine: line, facts: factsOf(doc(line)) }))?.suggest).toMatchObject({ icon: 'telefono' })
  })

  it('ante el cansancio o un posit larguísimo, ofrece pedirle ayuda al asistente', () => {
    const tired = make(1, 0.05).brain.onTyped(typed({ lastLine: 'Ya no puedo más, mucho trabajo', facts: factsOf(doc('Ya no puedo más, mucho trabajo')) }))
    expect(tired?.key).toBe('stress')
    expect(tired?.suggest).toEqual({ kind: 'ask', label: 'Pedirle ayuda al asistente', prompt: ASK.stress })
    const long = factsOf(doc('x'.repeat(400)))
    const c = make(1, 0.05).brain.onTyped(typed({ noteId: 'l', lastLine: 'x', facts: long }))
    expect(c?.key).toBe('long')
    expect(c?.suggest).toEqual({ kind: 'ask', label: 'Ordenar con el asistente', prompt: ASK.order })
  })

  it('con una lista larga de pendientes abiertos y sin otra sugerencia, ofrece ordenarla con el asistente', () => {
    const items = Array.from({ length: MANY_OPEN }, (_, i) => `Pendiente número ${i + 1}`)
    const many = factsOf({ type: 'doc', content: [{ type: 'taskList', content: items.map((t) => ({ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] })) }] })
    const c = make(1, 0.05).brain.onTyped(typed({ lastLine: '¿Cuándo llega el pedido?', facts: many }))
    expect(c?.key).toBe('question')
    expect(c?.suggest).toMatchObject({ kind: 'ask', prompt: ASK.order })
    // si ya hay otra cosa útil que ofrecer, esa va primero
    const call = make(1, 0.05).brain.onTyped(typed({ lastLine: 'Llamar a Juan', facts: many }))
    expect(call?.suggest).toMatchObject({ kind: 'icon', icon: 'telefono' })
    // con pocos abiertos no
    const few = factsOf({ type: 'doc', content: [{ type: 'taskList', content: items.slice(0, 3).map((t) => ({ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] })) }] })
    expect(make(1, 0.05).brain.onTyped(typed({ lastLine: '¿Cuándo llega el pedido?', facts: few }))?.suggest).toBeUndefined()
  })

  it('a veces no ofrece nada (no insiste) y los temas sin ícono nunca ofrecen', () => {
    expect(make(1, 0.9).brain.onTyped(typed())?.suggest).toBeUndefined()
    expect(make(1, 0.05).brain.onTyped(typed({ lastLine: '¿Cuándo llega?', facts: factsOf(doc('¿Cuándo llega?')) }))?.suggest).toBeUndefined()
  })
})

describe('Brain.onDone', () => {
  it('celebra el primero, el posit completo y el tablero limpio', () => {
    const { brain, clock } = make(1, 0.1)
    expect(brain.onDone({ done: 1, total: 5, boardOpen: 8, boardTotal: 9 })?.key).toBe('done_first')
    clock.advance(5000)
    expect(brain.onDone({ done: 5, total: 5, boardOpen: 3, boardTotal: 9 })?.key).toBe('done_note')
    clock.advance(5000)
    expect(brain.onDone({ done: 5, total: 5, boardOpen: 0, boardTotal: 9 })?.key).toBe('done_board')
  })

  it('en el camino dice «van 3 de 5» solo a veces, con los números puestos', () => {
    const c = make(1, 0.1).brain.onDone({ done: 3, total: 5, boardOpen: 2, boardTotal: 5 })
    expect(c?.key).toBe('done_some')
    expect(c?.text).toMatch(/3/)
    expect(c?.text).toMatch(/5/)
    expect(c?.text).not.toContain('{')
    expect(make(1, 0.9).brain.onDone({ done: 3, total: 5, boardOpen: 2, boardTotal: 5 })).toBeNull()
  })

  it('festeja los hitos del día: 3, 5, 8, 12… tachados hoy', () => {
    const { brain, clock } = make(1, 0.9)
    const c = brain.onDone({ done: 2, total: 5, boardOpen: 3, boardTotal: 9, doneToday: 5 })
    expect(c?.key).toBe('done_day')
    expect(c?.text).toContain('5')
    expect(c?.text).not.toContain('{')
    clock.advance(5000)
    // fuera de hito, y con el azar en contra, no dice nada
    expect(brain.onDone({ done: 2, total: 5, boardOpen: 3, boardTotal: 9, doneToday: 6 })).toBeNull()
    clock.advance(5000)
    // el posit completo tiene prioridad sobre el hito del día
    expect(brain.onDone({ done: 5, total: 5, boardOpen: 3, boardTotal: 9, doneToday: 8 })?.key).toBe('done_note')
  })

  it('no celebra dos veces en 4 segundos', () => {
    const { brain, clock } = make(1, 0.1)
    expect(brain.onDone({ done: 1, total: 5, boardOpen: 4, boardTotal: 5 })).not.toBeNull()
    clock.advance(1500)
    expect(brain.onDone({ done: 2, total: 5, boardOpen: 3, boardTotal: 5 })).toBeNull()
  })
})

describe('saludos y avisos', () => {
  it('saluda según la hora y resume los pendientes', () => {
    const { brain } = make()
    const morning = brain.onGreet({ hour: 8, open: 4, urgent: 2, anyTasks: true })
    expect(morning.text).toBe('Buenos días. Tienes 4 pendientes en este tablero. 2 suenan urgentes.')
    expect(morning.mood).toBe('think')
    expect(brain.onGreet({ hour: 15, open: 1, urgent: 1, anyTasks: true }).text).toBe('Buenas tardes. Te queda 1 pendiente en este tablero. Uno suena urgente.')
    expect(brain.onGreet({ hour: 21, open: 0, urgent: 0, anyTasks: true }).text).toBe('Buenas noches. Todo al día. ¡Bien hecho!')
    expect(brain.onGreet({ hour: 9, open: 0, urgent: 0, anyTasks: false }).text).toBe('Buenos días. ¿Qué anotamos hoy?')
  })

  it('se presenta la primera vez', () => {
    expect(make().brain.onWelcome().text).toContain('Claude')
  })

  it('al tocarla siempre contesta: resumen, consejo o ánimo', () => {
    expect(make(1, 0.1).brain.onPoke({ open: 3, urgent: 1 })).toMatchObject({ key: 'summary' })
    expect(make(1, 0.1).brain.onPoke({ open: 3, urgent: 1 }).text).toBe('Te quedan 3 pendientes en este tablero. Uno suena urgente.')
    expect(make(1, 0.5).brain.onPoke({ open: 3, urgent: 0 }).key).toBe('poke_tip')
    expect(make(1, 0.9).brain.onPoke({ open: 0, urgent: 0 }).key).toBe('poke_cheer')
    expect(make(1, 0.1).brain.onPoke({ open: 0, urgent: 0 }).key).not.toBe('summary')
  })

  it('al tocarla puede comentar el tema que más se repite en el tablero', () => {
    const c = make(1, 0.4).brain.onPoke({ open: 0, urgent: 0, topics: [{ tag: 'money', n: 3 }, { tag: 'call', n: 2 }, { tag: 'question', n: 9 }] })
    expect(c.key).toBe('topics')
    expect(c.text).toContain('3')
    expect(c.text).toContain('pagos y compras')
    // un tema con un solo posit, o sin nombre propio (preguntas), no cuenta
    expect(make(1, 0.4).brain.onPoke({ open: 0, urgent: 0, topics: [{ tag: 'money', n: 1 }, { tag: 'question', n: 9 }] }).key).not.toBe('topics')
  })

  it('no repite la misma frase dos veces seguidas', () => {
    const { brain, clock } = make(7)
    let prev = ''
    for (let i = 0; i < 30; i++) {
      clock.advance(LIMITS.eventGapMs + 100)
      const c = brain.onWake()
      expect(c).not.toBeNull()
      expect(c?.text).not.toBe(prev)
      prev = c?.text ?? ''
    }
  })

  it('el recordatorio de descanso sale cada 25 minutos como mucho', () => {
    const { brain, clock } = make()
    expect(brain.onNudge()).not.toBeNull()
    clock.advance(LIMITS.chatGapMs + 1000)
    expect(brain.onNudge()).toBeNull()
    clock.advance(LIMITS.nudgeGapMs)
    expect(brain.onNudge()).not.toBeNull()
  })

  it('un posit en blanco se comenta una vez cada tanto', () => {
    const { brain, clock } = make()
    expect(brain.onEmptyNote()?.key).toBe('empty')
    clock.advance(LIMITS.chatGapMs + 1000)
    expect(brain.onEmptyNote()).toBeNull()
    clock.advance(LIMITS.tagGapMs)
    expect(brain.onEmptyNote()).not.toBeNull()
  })

  it('reset la deja como nueva', () => {
    const { brain } = make()
    brain.onTyped(typed())
    expect(brain.onTyped(typed({ noteId: 'x' }))).toBeNull()
    brain.reset()
    expect(brain.onTyped(typed({ noteId: 'x' }))).not.toBeNull()
  })
})

describe('frases', () => {
  it('todas tienen texto y ninguna lleva emojis ni llaves sin llenar (salvo las de números)', () => {
    for (const [key, pool] of Object.entries(PHRASES)) {
      expect(pool.lines.length, key).toBeGreaterThan(0)
      for (const line of pool.lines) {
        expect(line.trim().length, `${key}: ${line}`).toBeGreaterThan(3)
        expect(line, key).not.toMatch(/\p{Extended_Pictographic}/u)
        // las que llevan números o el tema tienen llaves que se llenan al decirlas
        if (!['done_some', 'done_day', 'topics'].includes(key)) expect(line, key).not.toContain('{')
        expect(line.length, `${key}: demasiado larga`).toBeLessThanOrEqual(110)
      }
    }
  })
})
