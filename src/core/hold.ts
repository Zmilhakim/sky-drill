import { clamp, type Drill, type Fx, FIELD_W } from './field'
import type { Rng } from './rng'

export type PeekKind = 'rival' | 'mate'

export interface Peek {
  slot: number
  kind: PeekKind
  bornAt: number
  life: number
}

export const HOLD_SLOTS = 5
export const HOLD_RADIUS = 78

/** Screen position of a peek slot (five pieces of cover in a row). */
export function slotPos(slot: number): { x: number; y: number } {
  const gap = FIELD_W / (HOLD_SLOTS + 1)
  return { x: gap * (slot + 1), y: 520 }
}

/**
 * Drill 2: shapes peek out from cover. Click rivals, never click teammates.
 * It measures reaction time together with trigger discipline.
 */
export class HoldDrill implements Drill {
  readonly id = 'hold' as const
  readonly duration: number
  time = 0
  score = 0
  rivalsHit = 0
  rivalsEscaped = 0
  matesHit = 0
  matesSpared = 0
  misses = 0
  reactionSumMs = 0
  peeks: Peek[] = []
  private nextSpawnAt = 0.5
  private fx: Fx[] = []

  constructor(private rng: Rng, duration = 20) {
    this.duration = duration
  }

  get done(): boolean {
    return this.time >= this.duration
  }

  get avgReactionMs(): number {
    return this.rivalsHit ? this.reactionSumMs / this.rivalsHit : 0
  }

  private progress(): number {
    return clamp(this.time / this.duration, 0, 1)
  }

  update(dt: number): void {
    if (this.done) return
    this.time += dt
    const p = this.progress()

    for (const peek of this.peeks.filter((k) => this.time - k.bornAt > k.life)) {
      const pos = slotPos(peek.slot)
      if (peek.kind === 'rival') {
        this.rivalsEscaped++
        this.score = Math.max(0, this.score - 50)
        this.fx.push({ kind: 'escape', x: pos.x, y: pos.y, text: 'escaped -50' })
      } else {
        this.matesSpared++
      }
    }
    this.peeks = this.peeks.filter((k) => this.time - k.bornAt <= k.life)

    if (this.time >= this.nextSpawnAt && this.time < this.duration - 0.6) {
      const free = [...Array(HOLD_SLOTS).keys()].filter((s) => !this.peeks.some((k) => k.slot === s))
      if (free.length) {
        const slot = free[Math.floor(this.rng() * free.length)]
        const kind: PeekKind = this.rng() < 0.7 ? 'rival' : 'mate'
        this.peeks.push({ slot, kind, bornAt: this.time, life: 1.35 - 0.45 * p })
      }
      this.nextSpawnAt = this.time + (0.95 - 0.45 * p) * (0.75 + 0.5 * this.rng())
    }
  }

  pointerMove(): void {}

  pointerDown(x: number, y: number): void {
    if (this.done) return
    const peek = this.peeks.find((k) => {
      const pos = slotPos(k.slot)
      return Math.hypot(x - pos.x, y - pos.y) <= HOLD_RADIUS
    })
    if (!peek) {
      this.misses++
      this.score = Math.max(0, this.score - 25)
      this.fx.push({ kind: 'miss', x, y, text: '-25' })
      return
    }
    const pos = slotPos(peek.slot)
    this.peeks = this.peeks.filter((k) => k !== peek)
    if (peek.kind === 'rival') {
      const reactionMs = (this.time - peek.bornAt) * 1000
      const points = holdPoints(reactionMs)
      this.rivalsHit++
      this.reactionSumMs += reactionMs
      this.score += points
      this.fx.push({ kind: 'hit', x: pos.x, y: pos.y, text: `+${points}` })
    } else {
      this.matesHit++
      this.score = Math.max(0, this.score - 300)
      this.fx.push({ kind: 'bad', x: pos.x, y: pos.y, text: 'teammate! -300' })
    }
  }

  drainFx(): Fx[] {
    const out = this.fx
    this.fx = []
    return out
  }
}

/** Points for one rival hit: a base plus a speed bonus that fades out by 800 ms. */
export function holdPoints(reactionMs: number): number {
  return Math.round(150 + 150 * clamp(1 - reactionMs / 800, 0, 1))
}
