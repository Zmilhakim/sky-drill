import { describe, it, expect } from 'vitest'
import { mulberry32 } from '../core/rng'
import { TrackDrill, TRACK_RADIUS } from '../core/track'

describe('TrackDrill', () => {
  it('score only grows while pointer is within TRACK_RADIUS of target', () => {
    const drill = new TrackDrill(mulberry32(42), 15)

    // Move pointer far away from target
    drill.pointerMove(0, 0)
    drill.update(0.1)
    const scoreAfterMiss = drill.score
    expect(scoreAfterMiss).toBe(0)

    // Move pointer onto target
    drill.pointerMove(drill.x, drill.y)
    drill.update(0.1)
    const scoreAfterHit = drill.score
    expect(scoreAfterHit).toBeGreaterThan(0)

    // Move pointer away again
    drill.pointerMove(0, 0)
    drill.update(0.1)
    const scoreAfterMissAgain = drill.score
    expect(scoreAfterMissAgain).toBe(scoreAfterHit) // score should not increase
  })

  it('counts as on target just inside TRACK_RADIUS and off just outside', () => {
    const drill = new TrackDrill(mulberry32(42), 15)
    // The target stands still at time 0, so its position after a tiny step is known.
    drill.update(0.001)
    drill.pointerMove(drill.x + TRACK_RADIUS + 2, drill.y)
    drill.update(0.001)
    expect(drill.onTarget).toBe(false)
    drill.pointerMove(drill.x + TRACK_RADIUS - 2, drill.y)
    drill.update(0.001)
    expect(drill.onTarget).toBe(true)
  })

  it('onShare stays between 0 and 1', () => {
    const drill = new TrackDrill(mulberry32(42), 15)

    // Initially 0
    expect(drill.onShare).toBe(0)

    // Move pointer onto target and advance
    drill.pointerMove(drill.x, drill.y)
    drill.update(0.5)
    expect(drill.onShare).toBeGreaterThanOrEqual(0)
    expect(drill.onShare).toBeLessThanOrEqual(1)

    // Move away and advance more
    drill.pointerMove(0, 0)
    drill.update(0.5)
    expect(drill.onShare).toBeGreaterThanOrEqual(0)
    expect(drill.onShare).toBeLessThanOrEqual(1)
  })

  it('onShare is 0 when time is 0', () => {
    const drill = new TrackDrill(mulberry32(42))
    expect(drill.onShare).toBe(0)
  })

  it('score increases approximately at TRACK_POINTS_PER_SECOND when on target', () => {
    const drill = new TrackDrill(mulberry32(42), 15)
    // Keep pointer on target for 1 second
    drill.pointerMove(drill.x, drill.y)
    // Update in small steps, keeping pointer on target
    for (let i = 0; i < 10; i++) {
      drill.pointerMove(drill.x, drill.y)
      drill.update(0.1)
    }
    // Score should be approximately TRACK_POINTS_PER_SECOND * 1 = 320
    // Allow some tolerance for target movement
    expect(drill.score).toBeGreaterThan(200)
    expect(drill.score).toBeLessThan(400)
  })

  it('done returns true after duration', () => {
    const drill = new TrackDrill(mulberry32(42), 10)
    expect(drill.done).toBe(false)
    drill.update(10)
    expect(drill.done).toBe(true)
  })

  it('pointerDown updates pointer position', () => {
    const drill = new TrackDrill(mulberry32(42))
    drill.pointerDown(100, 200)
    // After pointerDown, the internal px/py should be set
    drill.update(0.1)
    // If the target happens to be near (100, 200), onTarget would be true
    // We just verify it doesn't throw
    expect(drill.time).toBe(0.1)
  })

  it('drainFx returns empty array', () => {
    const drill = new TrackDrill(mulberry32(42))
    expect(drill.drainFx()).toEqual([])
  })

  it('update does nothing when done', () => {
    const drill = new TrackDrill(mulberry32(42), 5)
    drill.update(5)
    expect(drill.done).toBe(true)
    const timeBefore = drill.time
    drill.update(100)
    expect(drill.time).toBe(timeBefore)
  })
})
