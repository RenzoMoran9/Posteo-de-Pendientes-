import { Node, mergeAttributes } from '@tiptap/core'
import { getIcon } from '../icons/catalog'
import { iconMarkup } from '../icons/markup'

/**
 * Un ícono dentro del texto (junto a un pendiente, en un título…). Mide lo que la letra
 * y se comporta como un solo carácter: se borra con la tecla de retroceso.
 */
export const InlineIcon = Node.create({
  name: 'inlineIcon',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      icon: {
        default: 'estrella',
        parseHTML: (el) => el.getAttribute('data-inline-icon') || 'estrella',
        renderHTML: (attrs) => ({ 'data-inline-icon': attrs.icon }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-inline-icon]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'inline-icon' }, HTMLAttributes)]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span')
      dom.className = 'inline-icon'
      dom.contentEditable = 'false'
      dom.setAttribute('role', 'img')
      const paint = (icon: string) => {
        dom.setAttribute('data-inline-icon', icon)
        dom.setAttribute('aria-label', `Ícono: ${getIcon(icon)?.name ?? 'sin nombre'}`)
        dom.innerHTML = iconMarkup(icon)
      }
      paint(node.attrs.icon as string)
      return {
        dom,
        update: (updated) => {
          if (updated.type.name !== 'inlineIcon') return false
          paint(updated.attrs.icon as string)
          return true
        },
      }
    }
  },
})
