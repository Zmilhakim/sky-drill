/** Local high-score table. Lives in the browser's storage, so it needs no network. */

export interface Entry {
  tag: string
  score: number
  rank: string
  reactionMs: number
  /** Unix time in milliseconds. */
  at: number
}

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const STORE_KEY = 'skydrill.scores.v1'
export const CHANNEL = 'skydrill.scores'
export const MAX_ENTRIES = 500
export const TAG_LENGTH = 3

const BLOCKED = new Set(['ASS', 'FUK', 'FUC', 'FAG', 'KKK', 'NIG', 'SEX', 'CUM', 'TIT', 'DIK', 'DIC', 'COK', 'KYS'])

/** Keeps letters and digits only, upper case, three characters. Returns '' if not usable. */
export function cleanTag(raw: string): string {
  const tag = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, TAG_LENGTH)
  if (tag.length !== TAG_LENGTH || BLOCKED.has(tag)) return ''
  return tag
}

function isEntry(v: unknown): v is Entry {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return (
    typeof e.tag === 'string' &&
    typeof e.score === 'number' &&
    Number.isFinite(e.score) &&
    typeof e.rank === 'string' &&
    typeof e.reactionMs === 'number' &&
    typeof e.at === 'number'
  )
}

/** Reads the table. Broken or missing data gives an empty table instead of an error. */
export function loadEntries(store: KeyValueStore): Entry[] {
  try {
    const parsed: unknown = JSON.parse(store.getItem(STORE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

/** Highest score first; on a tie the earlier run stays ahead. */
export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => b.score - a.score || a.at - b.at)
}

export function addEntry(store: KeyValueStore, entry: Entry): Entry[] {
  const all = sortEntries([...loadEntries(store), entry]).slice(0, MAX_ENTRIES)
  store.setItem(STORE_KEY, JSON.stringify(all))
  return all
}

export function clearEntries(store: KeyValueStore): void {
  store.setItem(STORE_KEY, '[]')
}

function sameLocalDay(a: number, b: number): boolean {
  const x = new Date(a)
  const y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

/** Runs played on the same calendar day as `now`, best first. */
export function todays(entries: Entry[], now: number): Entry[] {
  return sortEntries(entries.filter((e) => sameLocalDay(e.at, now)))
}

/** 1-based place a score would take among the given entries. */
export function placeOf(entries: Entry[], score: number): number {
  return entries.filter((e) => e.score > score).length + 1
}
