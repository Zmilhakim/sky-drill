/** The game is drawn in a fixed virtual field and scaled to fit any screen. */
export const FIELD_W = 1600
export const FIELD_H = 900

/** Area where targets may appear (keeps them clear of the HUD at the top). */
export const PLAY = { left: 130, right: FIELD_W - 130, top: 210, bottom: FIELD_H - 110 }

export type FxKind = 'hit' | 'miss' | 'bad' | 'escape'

/** Something that happened in a drill, for the screen and the speakers to react to. */
export interface Fx {
  kind: FxKind
  x: number
  y: number
  text: string
}

export interface Drill {
  readonly id: 'flick' | 'hold' | 'track'
  readonly duration: number
  time: number
  score: number
  readonly done: boolean
  /** Advance the drill by dt seconds. */
  update(dt: number): void
  pointerMove(x: number, y: number): void
  pointerDown(x: number, y: number): void
  /** Returns and clears the events since the last call. */
  drainFx(): Fx[]
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
