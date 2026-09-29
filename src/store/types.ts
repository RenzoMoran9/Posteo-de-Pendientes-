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
  /** Letra del posit (id de src/lib/fonts.ts). Sin valor = la de siempre. */
  font?: string
  /** Contenido del posit (documento de TipTap en JSON). */
  doc: JSONContent | null
  createdAt: number
  updatedAt: number
}

/** Un ícono pegado: suelto en la hoja o sobre un posit (donde se mueve, cambia de tamaño y se borra con él). */
export interface Sticker {
  id: string
  boardId: string
  /** Id del dibujo en el catálogo de íconos (src/icons). */
  icon: string
  /** Posit al que está pegado, o null si está suelto en la hoja. */
  noteId: string | null
  /**
   * Esquina superior izquierda: en unidades del tablero si está suelto,
   * o relativa a la esquina del posit si está pegado a uno.
   */
  x: number
  y: number
  /** Lado del cuadro que ocupa el dibujo. */
  size: number
  /** Inclinación en grados (los íconos se pegan un poco chuecos, como de verdad). */
  tilt: number
  /** Orden de apilamiento (entre íconos sueltos y posits, o entre los íconos de un mismo posit). */
  z: number
  createdAt: number
  updatedAt: number
}

/** Chispa, la mascota: `on` habla y mira, `quiet` solo mira (no habla salvo que le toques), `off` está escondida. */
export type MascotMode = 'on' | 'quiet' | 'off'

/** Preferencias de ESTE dispositivo (no se sincronizarán). */
export interface Settings {
  /** Imán suave a la cuadrícula al mover y redimensionar. */
  magnet: boolean
  /** Color con el que nacen los posits nuevos ("el marcador en la mano"). */
  defaultColor: string
  /** Últimos íconos usados (el más reciente primero). */
  recentIcons: string[]
  /** Cómo está la mascota en este dispositivo. */
  mascot: MascotMode
  /** Si ya se presentó (el saludo de la primera vez sale una sola vez). */
  mascotMet: boolean
  /**
   * Dónde la dejó quien la arrastró: fracciones (0 a 1) del espacio libre de la pantalla (entre la barra de arriba y
   * el estuche). `null` = su sitio de siempre, apoyada sobre el estuche.
   */
  mascotPos: { x: number; y: number } | null
  /** Cuántos pendientes se han marcado hoy en este dispositivo (`day` = AAAA-MM-DD): la mascota lo celebra. */
  mascotDone: { day: string; n: number }
}

export type SaveStatus = 'saved' | 'saving' | 'error'

/** Lo que se guarda en el dispositivo. `v` permite migrar el formato más adelante. */
export interface PersistedState {
  v: 1
  boards: Record<string, Board>
  boardOrder: string[]
  activeBoardId: string
  notes: Record<string, Note>
  stickers: Record<string, Sticker>
  nextZ: number
  /** Zoom y posición de cada tablero: dependen del dispositivo, no se sincronizan. */
  views: Record<string, View>
  settings: Settings
}
