import { describe, it, expect } from 'vitest'
import { mulberry32, between } from '../core/rng'

describe('rng', () => {
  it('same seed gives the same sequence', () => {
    const rng1 = mulberry32(42)
    const rng2 = mulberry32(42)
    for (let i = 0; i < 20; i++) {
      expect(rng1()).toBe(rng2())
    }
  })

  it('different seeds give different sequences', () => {
    const rng1 = mulberry32(42)
    const rng2 = mulberry32(43)
    let different = false
    for (let i = 0; i < 100; i++) {
      if (rng1() !== rng2()) {
        different = true
        break
      }
    }
    expect(different).toBe(true)
  })

  it('values stay in [0, 1)', () => {
    const rng = mulberry32(12345)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('between returns values in [min, max)', () => {
    const rng = mulberry32(99)
    for (let i = 0; i < 100; i++) {
      const v = between(rng, 10, 20)
      expect(v).toBeGreaterThanOrEqual(10)
      expect(v).toBeLessThan(20)
    }
  })

  it('between with equal min and max returns that value', () => {
    const rng = mulberry32(1)
    expect(between(rng, 5, 5)).toBe(5)
  })
})
