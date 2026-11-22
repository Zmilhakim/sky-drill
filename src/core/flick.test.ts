import { describe, it, expect } from 'vitest'
import { mulberry32 } from '../core/rng'
import { FlickDrill, flickPoints } from '../core/flick'

describe('flickPoints', () => {
  it('rewards faster hits', () => {
    // Instant hit (0ms) should score more than a slow hit (900ms)
    const fast = flickPoints(0, 0.5, 1)
    const slow = flickPoints(900, 0.5, 1)
    expect(fast).toBeGreaterThan(slow)
  })

  it('rewards more central hits', () => {
    // offsetRatio 0 = dead center, 1 = edge
    const center = flickPoints(500, 0, 1)
    const edge = flickPoints(500, 1, 1)
    expect(center).toBeGreaterThan(edge)
  })

  it('caps the streak bonus at 100', () => {
    // combo 11 gives 10*(11-1) = 100, combo 20 also gives min(100, 190) = 100
    const s11 = flickPoints(500, 0.5, 11)
    const s20 = flickPoints(500, 0.5, 20)
    // The streak portion is capped, so the difference between combo 11 and 20
    // should be 0 (same streak bonus)
    const base11 = 100 + 200 * Math.max(0, 1 - 500 / 1000) + 50 * Math.max(0, 1 - 0.5) + Math.min(100, 10 * 10)
    const base20 = 100 + 200 * Math.max(0, 1 - 500 / 1000) + 50 * Math.max(0, 1 - 0.5) + Math.min(100, 10 * 19)
    expect(s11).toBe(Math.round(base11))
    expect(s20).toBe(Math.round(base20))
    // Both should have the same streak contribution (100)
    expect(s11 - 100 - 100 - 25).toBe(s20 - 100 - 100 - 25)
  })

  it('returns at least 100 (base score)', () => {
    const min = flickPoints(2000, 2, 0)
    expect(min).toBeGreaterThanOrEqual(100)
  })
})

describe('FlickDrill', () => {
  it('a hit on the target adds score and spawns a new target at least MIN_JUMP away', () => {
    const drill = new FlickDrill(mulberry32(42))
    const oldTarget = { ...drill.target }
    drill.pointerDown(oldTarget.x, oldTarget.y)
    expect(drill.score).toBeGreaterThan(0)
    expect(drill.hits).toBe(1)
    // New target should be at least MIN_JUMP away from the old one
    const newTarget = drill.target
    const dist = Math.hypot(newTarget.x - oldTarget.x, newTarget.y - oldTarget.y)
    expect(dist).toBeGreaterThanOrEqual(FlickDrill.MIN_JUMP)
  })

  it('a miss costs 40 and resets the combo', () => {
    const drill = new FlickDrill(mulberry32(42))
    // First hit to build combo
    drill.pointerDown(drill.target.x, drill.target.y)
    expect(drill.combo).toBe(1)
    const scoreAfterHit = drill.score
    // Miss far from target
    drill.pointerDown(0, 0)
    expect(drill.misses).toBe(1)
    expect(drill.combo).toBe(0)
    expect(drill.score).toBe(scoreAfterHit - 40)
  })

  it('score does not go below 0 on misses', () => {
    const drill = new FlickDrill(mulberry32(42))
    // Miss many times
    for (let i = 0; i < 10; i++) {
      drill.pointerDown(0, 0)
    }
    expect(drill.score).toBeGreaterThanOrEqual(0)
  })

  it('an unhit target times out after LIFETIME', () => {
    const drill = new FlickDrill(mulberry32(42))
    const bornAt = drill.target.bornAt
    // Advance time past LIFETIME
    drill.update(FlickDrill.LIFETIME + 0.1)
    expect(drill.timeouts).toBe(1)
    expect(drill.combo).toBe(0)
    // Target should have been replaced
    expect(drill.target.bornAt).toBeGreaterThan(bornAt)
  })

  it('done returns true after duration elapses', () => {
    const drill = new FlickDrill(mulberry32(42), 10)
    expect(drill.done).toBe(false)
    drill.update(10)
    expect(drill.done).toBe(true)
  })

  it('update does nothing when done', () => {
    const drill = new FlickDrill(mulberry32(42), 5)
    drill.update(5)
    expect(drill.done).toBe(true)
    const timeBefore = drill.time
    drill.update(100)
    expect(drill.time).toBe(timeBefore)
  })

  it('pointerDown does nothing when done', () => {
    const drill = new FlickDrill(mulberry32(42), 5)
    drill.update(5)
    const scoreBefore = drill.score
    drill.pointerDown(0, 0)
    expect(drill.score).toBe(scoreBefore)
  })

  it('avgReactionMs is 0 when no hits', () => {
    const drill = new FlickDrill(mulberry32(42))
    expect(drill.avgReactionMs).toBe(0)
  })

  it('bestCombo tracks the highest combo', () => {
    const drill = new FlickDrill(mulberry32(42))
    // Hit, hit, miss, hit
    drill.pointerDown(drill.target.x, drill.target.y)
    drill.pointerDown(drill.target.x, drill.target.y)
    expect(drill.bestCombo).toBe(2)
    drill.pointerDown(0, 0) // miss
    drill.pointerDown(drill.target.x, drill.target.y)
    expect(drill.bestCombo).toBe(2)
  })

  it('drainFx returns and clears effects', () => {
    const drill = new FlickDrill(mulberry32(42))
    drill.pointerDown(drill.target.x, drill.target.y)
    const fx1 = drill.drainFx()
    expect(fx1.length).toBeGreaterThan(0)
    const fx2 = drill.drainFx()
    expect(fx2).toEqual([])
  })
})
