import { describe, it, expect } from 'vitest'
import {
  cleanTag,
  addEntry,
  loadEntries,
  sortEntries,
  todays,
  placeOf,
  clearEntries,
  MAX_ENTRIES,
  type Entry,
  type KeyValueStore,
} from '../core/leaderboard'

function makeMemoryStore(): KeyValueStore {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  }
}

describe('cleanTag', () => {
  it('returns 3 uppercase alphanumeric characters', () => {
    expect(cleanTag('ab')).toBe('') // too short
    expect(cleanTag('abc')).toBe('ABC')
    expect(cleanTag('abcd')).toBe('ABC') // truncated to 3
    expect(cleanTag('a1b')).toBe('A1B')
  })

  it('removes non-alphanumeric characters', () => {
    expect(cleanTag('a@b!c#')).toBe('ABC')
    expect(cleanTag('hello')).toBe('HEL')
  })

  it('returns empty string for blocked tags', () => {
    expect(cleanTag('ASS')).toBe('')
    expect(cleanTag('kkk')).toBe('')
    expect(cleanTag('fuk')).toBe('')
  })

  it('returns empty string if fewer than 3 valid chars', () => {
    expect(cleanTag('a@b')).toBe('') // only 2 alphanumeric chars
    expect(cleanTag('!!')).toBe('')
    expect(cleanTag('')).toBe('')
  })

  it('handles lowercase input', () => {
    expect(cleanTag('xyz')).toBe('XYZ')
  })

  it('handles mixed input with numbers', () => {
    expect(cleanTag('a1b2c3')).toBe('A1B')
  })
})

describe('addEntry and loadEntries', () => {
  it('round trip with in-memory store', () => {
    const store = makeMemoryStore()
    const entry: Entry = { tag: 'ABC', score: 1000, rank: 'WARM-UP', reactionMs: 300, at: Date.now() }
    const all = addEntry(store, entry)
    expect(all.length).toBe(1)
    expect(all[0].tag).toBe('ABC')

    const loaded = loadEntries(store)
    expect(loaded.length).toBe(1)
    expect(loaded[0].tag).toBe('ABC')
  })

  it('loadEntries returns empty array when store is empty', () => {
    const store = makeMemoryStore()
    expect(loadEntries(store)).toEqual([])
  })

  it('broken JSON gives an empty list', () => {
    const store: KeyValueStore = {
      getItem: () => '{ broken json }}}}',
      setItem: () => {},
    }
    expect(loadEntries(store)).toEqual([])
  })

  it('non-array JSON gives an empty list', () => {
    const store: KeyValueStore = {
      getItem: () => '{"score": 100}',
      setItem: () => {},
    }
    expect(loadEntries(store)).toEqual([])
  })

  it('clearEntries empties the store', () => {
    const store = makeMemoryStore()
    addEntry(store, { tag: 'ABC', score: 100, rank: 'WARM-UP', reactionMs: 200, at: Date.now() })
    clearEntries(store)
    expect(loadEntries(store)).toEqual([])
  })
})

describe('sortEntries', () => {
  const now = Date.now()

  it('sorts by score descending', () => {
    const entries: Entry[] = [
      { tag: 'AAA', score: 100, rank: 'WARM-UP', reactionMs: 200, at: now },
      { tag: 'BBB', score: 500, rank: 'WARM-UP', reactionMs: 300, at: now + 1000 },
      { tag: 'CCC', score: 300, rank: 'WARM-UP', reactionMs: 250, at: now + 2000 },
    ]
    const sorted = sortEntries(entries)
    expect(sorted[0].score).toBe(500)
    expect(sorted[1].score).toBe(300)
    expect(sorted[2].score).toBe(100)
  })

  it('on ties, earlier run stays ahead', () => {
    const entries: Entry[] = [
      { tag: 'AAA', score: 500, rank: 'WARM-UP', reactionMs: 200, at: now + 5000 },
      { tag: 'BBB', score: 500, rank: 'WARM-UP', reactionMs: 300, at: now },
    ]
    const sorted = sortEntries(entries)
    expect(sorted[0].tag).toBe('BBB') // earlier at
    expect(sorted[1].tag).toBe('AAA')
  })

  it('does not mutate the original array', () => {
    const entries: Entry[] = [
      { tag: 'AAA', score: 100, rank: 'WARM-UP', reactionMs: 200, at: now },
      { tag: 'BBB', score: 500, rank: 'WARM-UP', reactionMs: 300, at: now + 1000 },
    ]
    const original = [...entries]
    sortEntries(entries)
    expect(entries).toEqual(original)
  })
})

describe('todays', () => {
  it('filters by local day', () => {
    const now = Date.now()
    const todayMs = now
    const yesterdayMs = now - 86400000
    const tomorrowMs = now + 86400000

    const entries: Entry[] = [
      { tag: 'TOD', score: 500, rank: 'WARM-UP', reactionMs: 200, at: todayMs },
      { tag: 'YES', score: 300, rank: 'WARM-UP', reactionMs: 250, at: yesterdayMs },
      { tag: 'TOM', score: 700, rank: 'WARM-UP', reactionMs: 150, at: tomorrowMs },
    ]
    const today = todays(entries, now)
    expect(today.length).toBe(1)
    expect(today[0].tag).toBe('TOD')
  })

  it('returns sorted entries for today', () => {
    const now = Date.now()
    const entries: Entry[] = [
      { tag: 'AAA', score: 200, rank: 'WARM-UP', reactionMs: 300, at: now },
      { tag: 'BBB', score: 500, rank: 'WARM-UP', reactionMs: 200, at: now + 1000 },
    ]
    const today = todays(entries, now)
    expect(today.length).toBe(2)
    expect(today[0].score).toBe(500)
    expect(today[1].score).toBe(200)
  })

  it('returns empty when no entries for today', () => {
    const now = Date.now()
    const entries: Entry[] = [
      { tag: 'OLD', score: 500, rank: 'WARM-UP', reactionMs: 200, at: now - 86400000 },
    ]
    expect(todays(entries, now)).toEqual([])
  })
})

describe('placeOf', () => {
  it('returns 1 for the highest score', () => {
    const entries: Entry[] = [
      { tag: 'AAA', score: 100, rank: 'WARM-UP', reactionMs: 200, at: Date.now() },
      { tag: 'BBB', score: 300, rank: 'WARM-UP', reactionMs: 250, at: Date.now() },
    ]
    expect(placeOf(entries, 500)).toBe(1)
  })

  it('returns correct place among existing scores', () => {
    const entries: Entry[] = [
      { tag: 'AAA', score: 100, rank: 'WARM-UP', reactionMs: 200, at: Date.now() },
      { tag: 'BBB', score: 300, rank: 'WARM-UP', reactionMs: 250, at: Date.now() },
      { tag: 'CCC', score: 500, rank: 'WARM-UP', reactionMs: 300, at: Date.now() },
    ]
    expect(placeOf(entries, 250)).toBe(3) // two entries (300, 500) are higher
    expect(placeOf(entries, 50)).toBe(4)  // all entries are higher
    expect(placeOf(entries, 500)).toBe(1) // no entry strictly higher
  })

  it('returns 1 for empty list', () => {
    expect(placeOf([], 100)).toBe(1)
  })
})

describe('MAX_ENTRIES', () => {
  it('caps entries at MAX_ENTRIES', () => {
    const store = makeMemoryStore()
    for (let i = 0; i < MAX_ENTRIES + 10; i++) {
      addEntry(store, { tag: 'ABC', score: i, rank: 'WARM-UP', reactionMs: 200, at: Date.now() + i })
    }
    const all = loadEntries(store)
    expect(all.length).toBe(MAX_ENTRIES)
  })
})
