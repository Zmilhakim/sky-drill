import { clamp, type Drill, type Fx, PLAY } from './field'
import { between, type Rng } from './rng'

export interface FlickTarget {
  x: number
  y: number
  r: number
  bornAt: number
}

/** Drill 1: one target at a time, far from the last one. Click it as fast as you can. */
export class FlickDrill implements Drill {
  readonly id = 'flick' as const
  readonly duration: number
  time = 0
  score = 0
  hits = 0
  misses = 0
  timeouts = 0
  combo = 0
  bestCombo = 0
  reactionSumMs = 0
  target: FlickTarget
  private fx: Fx[] = []

  static readonly LIFETIME = 1.6
  static readonly MIN_JUMP = 320

  constructor(private rng: Rng, duration = 20) {
    this.duration = duration
    this.target = this.spawn(null)
  }

  get done(): boolean {
    return this.time >= this.duration
  }

  get avgReactionMs(): number {
    return this.hits ? this.reactionSumMs / this.hits : 0
  }

  private radius(): number {
    // Targets shrink from 46 to 30 as the drill goes on.
    return 46 - 16 * clamp(this.time / this.duration, 0, 1)
  }

  private spawn(prev: FlickTarget | null): FlickTarget {
    let x = 0
    let y = 0
    for (let i = 0; i < 30; i++) {
      x = between(this.rng, PLAY.left, PLAY.right)
      y = between(this.rng, PLAY.top, PLAY.bottom)
      if (!prev || Math.hypot(x - prev.x, y - prev.y) >= FlickDrill.MIN_JUMP) break
    }
    return { x, y, r: this.radius(), bornAt: this.time }
  }

  update(dt: number): void {
    if (this.done) return
    this.time += dt
    if (this.time - this.target.bornAt > FlickDrill.LIFETIME) {
      this.timeouts++
      this.combo = 0
      this.fx.push({ kind: 'escape', x: this.target.x, y: this.target.y, text: 'too slow' })
      this.target = this.spawn(this.target)
    }
  }

  pointerMove(): void {}

  pointerDown(x: number, y: number): void {
    if (this.done) return
    const t = this.target
    const d = Math.hypot(x - t.x, y - t.y)
    if (d <= t.r) {
      const reactionMs = (this.time - t.bornAt) * 1000
      this.hits++
      this.combo++
      this.bestCombo = Math.max(this.bestCombo, this.combo)
      this.reactionSumMs += reactionMs
      const points = flickPoints(reactionMs, d / t.r, this.combo)
      this.score += points
      this.fx.push({ kind: 'hit', x: t.x, y: t.y, text: `+${points}` })
      this.target = this.spawn(t)
    } else {
      this.misses++
      this.combo = 0
      this.score = Math.max(0, this.score - 40)
      this.fx.push({ kind: 'miss', x, y, text: '-40' })
    }
  }

  drainFx(): Fx[] {
    const out = this.fx
    this.fx = []
    return out
  }
}

/**
 * Points for one flick hit: a base, a speed bonus that fades out by one second,
 * a bonus for hitting near the centre, and a small bonus for a hit streak.
 */
export function flickPoints(reactionMs: number, offsetRatio: number, combo: number): number {
  const speed = 200 * clamp(1 - reactionMs / 1000, 0, 1)
  const centre = 50 * clamp(1 - offsetRatio, 0, 1)
  const streak = Math.min(100, 10 * Math.max(0, combo - 1))
  return Math.round(100 + speed + centre + streak)
}
