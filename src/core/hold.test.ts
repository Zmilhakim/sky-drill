import { describe, it, expect } from 'vitest'
import { mulberry32 } from '../core/rng'
import { HoldDrill, holdPoints, slotPos, HOLD_RADIUS } from '../core/hold'

describe('holdPoints', () => {
  it('rewards faster hits', () => {
    const fast = holdPoints(0)
    const slow = holdPoints(700)
    expect(fast).toBeGreaterThan(slow)
  })

  it('max score at instant hit', () => {
    // 150 + 150 * clamp(1 - 0/800, 0, 1) = 150 + 150 = 300
    expect(holdPoints(0)).toBe(300)
  })

  it('min score at very slow hit', () => {
    // 150 + 150 * clamp(1 - 2000/800, 0, 1) = 150 + 0 = 150
    expect(holdPoints(2000)).toBe(150)
  })
})

describe('HoldDrill', () => {
  // These tests place a peek by hand instead of waiting for the random spawner,
  // so each one always exercises the branch it is named after.
  const quiet = () => new HoldDrill(() => 0.99, 20)

  it('clicking a rival scores points', () => {
    const drill = quiet()
    drill.peeks = [{ slot: 2, kind: 'rival', bornAt: 0, life: 1 }]
    drill.time = 0.2
    const pos = slotPos(2)
    drill.pointerDown(pos.x, pos.y)
    expect(drill.rivalsHit).toBe(1)
    expect(drill.score).toBe(holdPoints(200))
    expect(drill.peeks).toHaveLength(0)
  })

  it('a click just inside HOLD_RADIUS hits, just outside misses', () => {
    const drill = quiet()
    const pos = slotPos(0)
    drill.peeks = [{ slot: 0, kind: 'rival', bornAt: 0, life: 1 }]
    drill.pointerDown(pos.x + HOLD_RADIUS + 1, pos.y)
    expect(drill.misses).toBe(1)
    expect(drill.rivalsHit).toBe(0)
    drill.pointerDown(pos.x + HOLD_RADIUS - 1, pos.y)
    expect(drill.rivalsHit).toBe(1)
  })

  it('clicking a teammate costs 300 and counts in matesHit', () => {
    const drill = quiet()
    drill.score = 500
    drill.peeks = [{ slot: 1, kind: 'mate', bornAt: 0, life: 1 }]
    const pos = slotPos(1)
    drill.pointerDown(pos.x, pos.y)
    expect(drill.matesHit).toBe(1)
    expect(drill.score).toBe(200)
    expect(drill.drainFx().map((f) => f.kind)).toEqual(['bad'])
  })

  it('a rival that expires costs 50, a teammate that expires costs nothing', () => {
    const drill = quiet()
    drill.score = 200
    drill.peeks = [
      { slot: 0, kind: 'rival', bornAt: 0, life: 0.3 },
      { slot: 1, kind: 'mate', bornAt: 0, life: 0.3 },
    ]
    drill.update(0.4)
    expect(drill.rivalsEscaped).toBe(1)
    expect(drill.matesSpared).toBe(1)
    expect(drill.score).toBe(150)
  })

  it('score never goes below 0', () => {
    const drill = new HoldDrill(mulberry32(42), 20)
    // Miss many times (each costs 25)
    for (let i = 0; i < 20; i++) {
      drill.pointerDown(0, 0)
    }
    expect(drill.score).toBeGreaterThanOrEqual(0)
  })

  it('done returns true after duration', () => {
    const drill = new HoldDrill(mulberry32(42), 10)
    expect(drill.done).toBe(false)
    drill.update(10)
    expect(drill.done).toBe(true)
  })

  it('pointerDown does nothing when done', () => {
    const drill = new HoldDrill(mulberry32(42), 5)
    drill.update(5)
    const scoreBefore = drill.score
    drill.pointerDown(0, 0)
    expect(drill.score).toBe(scoreBefore)
  })

  it('avgReactionMs is 0 when no rivals hit', () => {
    const drill = new HoldDrill(mulberry32(42))
    expect(drill.avgReactionMs).toBe(0)
  })

  it('drainFx returns and clears effects', () => {
    const drill = new HoldDrill(mulberry32(42))
    drill.pointerDown(0, 0) // miss creates an fx
    const fx1 = drill.drainFx()
    expect(fx1.length).toBeGreaterThan(0)
    const fx2 = drill.drainFx()
    expect(fx2).toEqual([])
  })

  it('slotPos returns positions across the field', () => {
    const pos0 = slotPos(0)
    const pos4 = slotPos(4)
    expect(pos0.x).toBeLessThan(pos4.x)
    expect(pos0.y).toBe(pos4.y) // same y
  })
})
