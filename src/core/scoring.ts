import type { FlickDrill } from './flick'
import type { HoldDrill } from './hold'
import type { TrackDrill } from './track'

export interface RunStats {
  flickScore: number
  holdScore: number
  trackScore: number
  /** Average time to hit a flick target, in milliseconds (0 if none were hit). */
  reactionMs: number
  /** Share of clicks that hit something they should, 0 to 1. */
  accuracy: number
  /** Teammates clicked by mistake. */
  teamHits: number
  /** Share of the tracking drill spent on target, 0 to 1. */
  tracking: number
}

export interface RunResult extends RunStats {
  total: number
  rank: Rank
}

export interface Rank {
  name: string
  min: number
}

/** Rank ladder, lowest first. Names are our own. */
export const RANKS: Rank[] = [
  { name: 'WARM-UP', min: 0 },
  { name: 'SCRIM READY', min: 5000 },
  { name: 'STARTER', min: 8000 },
  { name: 'PLAYMAKER', min: 11000 },
  { name: 'CLUTCH', min: 14000 },
  { name: 'SKY HIGH', min: 17000 },
]

export function rankFor(total: number): Rank {
  let rank = RANKS[0]
  for (const r of RANKS) if (total >= r.min) rank = r
  return rank
}

/** Points still needed for the next rank, or null at the top rank. */
export function toNextRank(total: number): { rank: Rank; points: number } | null {
  const next = RANKS.find((r) => r.min > total)
  return next ? { rank: next, points: next.min - total } : null
}

export function summarise(flick: FlickDrill, hold: HoldDrill, track: TrackDrill): RunResult {
  const good = flick.hits + hold.rivalsHit
  const clicks = good + flick.misses + hold.misses + hold.matesHit
  const total = flick.score + hold.score + track.score
  return {
    flickScore: flick.score,
    holdScore: hold.score,
    trackScore: track.score,
    reactionMs: Math.round(flick.avgReactionMs),
    accuracy: clicks ? good / clicks : 0,
    teamHits: hold.matesHit,
    tracking: track.onShare,
    total,
    rank: rankFor(total),
  }
}
