import { describe, expect, it } from 'vitest'
import { factsOf, openTasksOf, tagsOf } from './analyze'
import { taskDoc, textDoc } from '../store/store'

describe('factsOf', () => {
  it('cuenta pendientes, hechos, viñetas y renglones sueltos', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Compras del día' }] },
        {
          type: 'taskList',
          content: [
            { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pan' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Leche' }] }] },
          ],
        },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Idea' }] }] }],
        },
      ],
    }
    const f = factsOf(doc)
    expect(f.tasks).toBe(2)
    expect(f.done).toBe(1)
    expect(f.bullets).toBe(1)
    expect(f.plainLines).toBe(1)
    expect(f.lines).toEqual(['Compras del día', 'Pan', 'Leche', 'Idea'])
  })

  it('reconoce los íconos metidos en el texto y no se cae con un posit vacío', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Llamar ' }, { type: 'inlineIcon', attrs: { icon: 'fuego' } }] }] }
    expect(factsOf(doc).icons).toEqual(['fuego'])
    expect(factsOf(null)).toMatchObject({ text: '', tasks: 0, lines: [] })
  })

  it('lee los documentos que arma la propia app', () => {
    expect(factsOf(taskDoc('Título', [['a', true], ['b', false]]))).toMatchObject({ tasks: 2, done: 1 })
    expect(factsOf(textDoc('uno', '', 'dos')).lines).toEqual(['uno', 'dos'])
  })
})

describe('tagsOf', () => {
  it('entiende urgencias sin importar tildes ni mayúsculas', () => {
    expect(tagsOf('Esto es URGENTE')).toContain('urgent')
    expect(tagsOf('vence el último día')).toContain('urgent')
    expect(tagsOf('cuanto antes por favor')).toContain('urgent')
  })

  it('distingue hoy, mañana y «esta mañana»', () => {
    expect(tagsOf('Entregar hoy')).toContain('today')
    expect(tagsOf('Llamar mañana')).toContain('tomorrow')
    expect(tagsOf('Llamar mañana')).not.toContain('today')
    const esta = tagsOf('Firmar esta mañana')
    expect(esta).toContain('today')
    expect(esta).not.toContain('tomorrow')
    expect(tagsOf('pasado mañana')).toContain('tomorrow')
  })

  it('reconoce días, horas, montos y trámites del trabajo de compras', () => {
    expect(tagsOf('El viernes')).toContain('week')
    expect(tagsOf('Reunión a las 3pm')).toEqual(expect.arrayContaining(['meeting', 'time']))
    expect(tagsOf('Reunión 10:30')).toContain('time')
    expect(tagsOf('Pagar S/ 12,500 de la factura')).toContain('money')
    expect(tagsOf('Orden de compra 0453')).toContain('money')
    expect(tagsOf('Revisar el expediente y los TDR')).toContain('docs')
    expect(tagsOf('Licitación pública')).toContain('docs')
    expect(tagsOf('Confirmar insumos médicos para el hospital')).toContain('health')
    expect(tagsOf('Llamar al proveedor')).toContain('call')
    expect(tagsOf('Enviar correo con el adjunto')).toContain('mail')
  })

  it('detecta cansancio, preguntas y gritos', () => {
    expect(tagsOf('no llego a todo, estoy agotado')).toContain('stress')
    expect(tagsOf('¿Quién firma esto?')).toContain('question')
    expect(tagsOf('NECESITO ESTO YA')).toContain('shout')
    expect(tagsOf('Necesito esto ya')).not.toContain('shout')
    expect(tagsOf('OK')).not.toContain('shout')
  })

  it('las palabras sueltas no confunden: «hoyo» no es hoy, «costoso» no es costo', () => {
    expect(tagsOf('Tapar el hoyo')).not.toContain('today')
    expect(tagsOf('Un texto cualquiera sin nada especial')).toEqual([])
  })

  it('ordena de la más a la menos importante', () => {
    const tags = tagsOf('URGENTE: llamar hoy al proveedor, no llego')
    expect(tags.indexOf('stress')).toBeLessThan(tags.indexOf('urgent'))
    expect(tags.indexOf('urgent')).toBeLessThan(tags.indexOf('today'))
    expect(tags.indexOf('today')).toBeLessThan(tags.indexOf('call'))
  })
})

describe('openTasksOf', () => {
  it('cuenta los pendientes sin marcar y los que suenan urgentes', () => {
    const doc = taskDoc('Lista', [
      ['Llamar urgente al proveedor', false],
      ['Entregar hoy el informe', false],
      ['Archivar', false],
      ['Enviar oficio urgente', true],
    ])
    expect(openTasksOf(doc)).toEqual({ open: 3, urgent: 2 })
    expect(openTasksOf(null)).toEqual({ open: 0, urgent: 0 })
  })
})
