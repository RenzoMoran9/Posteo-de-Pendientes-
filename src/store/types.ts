import type { JSONContent } from '@tiptap/core'
import type { View } from '../lib/geometry'

export type { View }

export interface Board {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface Note {
  id: string
  boardId: string
  /** Posición y tamaño en unidades del tablero (no en píxeles de pantalla). */
  x: number
  y: number
  w: number
  /** Alto mínimo: el posit crece solo si el texto no cabe. */
  h: number
  /** Orden de apilamiento: el mayor queda encima. */
  z: number
  color: string
  /** Contenido del posit (documento de TipTap en JSON). */
  doc: JSONContent | null
  createdAt: number
  updatedAt: number
}

/** Preferencias de ESTE dispositivo (no se sincronizarán). */
export interface Settings {
  /** Imán suave a la cuadrícula al mover y redimensionar. */
  magnet: boolean
  /** Color con el que nacen los posits nuevos ("el marcador en la mano"). */
  defaultColor: string
}

export type SaveStatus = 'saved' | 'saving' | 'error'

/** Lo que se guarda en el dispositivo. `v` permite migrar el formato más adelante. */
export interface PersistedState {
  v: 1
  boards: Record<string, Board>
  boardOrder: string[]
  activeBoardId: string
  notes: Record<string, Note>
  nextZ: number
  /** Zoom y posición de cada tablero: dependen del dispositivo, no se sincronizan. */
  views: Record<string, View>
  settings: Settings
}
