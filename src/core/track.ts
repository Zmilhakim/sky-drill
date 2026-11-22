import { clamp, type Drill, type Fx, FIELD_H, FIELD_W } from './field'
import { between, type Rng } from './rng'

export const TRACK_RADIUS = 54
export const TRACK_POINTS_PER_SECOND = 320

/** Drill 3: keep the crosshair on a target that drifts and speeds up. */
export class TrackDrill implements Drill {
  readonly id = 'track' as const
  readonly duration: number
  time = 0
  score = 0
  onTime = 0
  onTarget = false
  x = FIELD_W / 2
  y = FIELD_H / 2 + 40
  private exact = 0
  private px = -9999
  private py = -9999
  private phase: number[]
  private angle = 0

  constructor(rng: Rng, duration = 15) {
    this.duration = duration
    this.phase = [0, 1, 2, 3].map(() => between(rng, 0, Math.PI * 2))
  }

  get done(): boolean {
    return this.time >= this.duration
  }

  /** Share of the drill spent on target, 0 to 1. */
  get onShare(): number {
    return this.time > 0 ? clamp(this.onTime / this.time, 0, 1) : 0
  }

  update(dt: number): void {
    if (this.done) return
    this.time += dt
    // The path speeds up over the drill; integrating keeps the motion smooth.
    this.angle += dt * (0.9 + 1.5 * clamp(this.time / this.duration, 0, 1))
    const a = this.angle
    const [p0, p1, p2, p3] = this.phase
    this.x = FIELD_W / 2 + 470 * Math.sin(a + p0) + 150 * Math.sin(2.3 * a + p1)
    this.y = FIELD_H / 2 + 50 + 190 * Math.sin(1.4 * a + p2) + 70 * Math.sin(3.1 * a + p3)

    this.onTarget = Math.hypot(this.px - this.x, this.py - this.y) <= TRACK_RADIUS
    if (this.onTarget) {
      this.onTime += dt
      this.exact += TRACK_POINTS_PER_SECOND * dt
      this.score = Math.round(this.exact)
    }
  }

  pointerMove(x: number, y: number): void {
    this.px = x
    this.py = y
  }

  pointerDown(x: number, y: number): void {
    this.pointerMove(x, y)
  }

  drainFx(): Fx[] {
    return []
  }
}
