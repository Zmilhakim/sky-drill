import { describe, it, expect } from 'vitest'
import { rankFor, toNextRank, RANKS } from '../core/scoring'

describe('rankFor', () => {
  it('returns WARM-UP for 0', () => {
    expect(rankFor(0).name).toBe('WARM-UP')
  })

  it('returns WARM-UP for just below SCRIM READY', () => {
    expect(rankFor(4999).name).toBe('WARM-UP')
  })

  it('returns SCRIM READY at 5000', () => {
    expect(rankFor(5000).name).toBe('SCRIM READY')
  })

  it('returns STARTER at 8000', () => {
    expect(rankFor(8000).name).toBe('STARTER')
  })

  it('returns PLAYMAKER at 11000', () => {
    expect(rankFor(11000).name).toBe('PLAYMAKER')
  })

  it('returns CLUTCH at 14000', () => {
    expect(rankFor(14000).name).toBe('CLUTCH')
  })

  it('returns SKY HIGH at 17000', () => {
    expect(rankFor(17000).name).toBe('SKY HIGH')
  })

  it('returns SKY HIGH for scores above top rank', () => {
    expect(rankFor(50000).name).toBe('SKY HIGH')
  })

  it('returns correct min value', () => {
    const rank = rankFor(10000)
    expect(rank.name).toBe('STARTER')
    expect(rank.min).toBe(8000)
  })
})

describe('toNextRank', () => {
  it('returns null at the top rank', () => {
    expect(toNextRank(17000)).toBeNull()
  })

  it('returns null above the top rank', () => {
    expect(toNextRank(50000)).toBeNull()
  })

  it('returns next rank and points needed from 0', () => {
    const result = toNextRank(0)
    expect(result).not.toBeNull()
    expect(result!.rank.name).toBe('SCRIM READY')
    expect(result!.points).toBe(5000)
  })

  it('returns next rank and points needed from 6000', () => {
    const result = toNextRank(6000)
    expect(result).not.toBeNull()
    expect(result!.rank.name).toBe('STARTER')
    expect(result!.points).toBe(2000)
  })

  it('returns next rank and points needed just below a threshold', () => {
    const result = toNextRank(13999)
    expect(result).not.toBeNull()
    expect(result!.rank.name).toBe('CLUTCH')
    expect(result!.points).toBe(1)
  })

  it('returns null exactly at top rank', () => {
    const result = toNextRank(17000)
    expect(result).toBeNull()
  })
})

describe('RANKS', () => {
  it('has 6 ranks', () => {
    expect(RANKS.length).toBe(6)
  })

  it('is sorted by min ascending', () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].min).toBeGreaterThan(RANKS[i - 1].min)
    }
  })

  it('starts at 0', () => {
    expect(RANKS[0].min).toBe(0)
  })
})
