import { CHANNEL, clearEntries, type Entry, loadEntries, sortEntries, STORE_KEY, todays } from './core/leaderboard'

/**
 * Leaderboard screen for a second monitor. It reads the same local storage as the game,
 * so it works with no network, and it refreshes the moment a score is saved.
 */
const ROWS = 10
const $ = (id: string): HTMLElement => document.getElementById(id)!
let lastSeenAt = 0

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

function render(): void {
  const all = loadEntries(window.localStorage)
  const now = Date.now()
  const today = todays(all, now)
  const newest = all.reduce<Entry | null>((a, e) => (!a || e.at > a.at ? e : a), null)

  const list = $('list')
  list.replaceChildren()
  if (!today.length) {
    const p = document.createElement('p')
    p.className = 'empty'
    p.textContent = 'No scores yet today. Step up and set the first one.'
    list.append(p)
  }
  today.slice(0, ROWS).forEach((e, i) => {
    const li = document.createElement('li')
    if (newest && e.at === newest.at && now - e.at < 60_000) li.className = 'new'
    const cells: [string, string][] = [
      ['n', `${i + 1}`],
      ['tag', e.tag],
      ['rank', e.rank],
      ['score', fmt(e.score)],
    ]
    for (const [cls, value] of cells) {
      const span = document.createElement('span')
      span.className = cls
      span.textContent = value
      li.append(span)
    }
    list.append(li)
  })

  $('meta').textContent = `${today.length} ${today.length === 1 ? 'run' : 'runs'} today`
  $('latest').textContent = newest ? `${newest.tag}  ${fmt(newest.score)}` : '-'
  $('latestInfo').textContent = newest ? newest.rank : ''
  const quick = today.filter((e) => e.reactionMs > 0).sort((a, b) => a.reactionMs - b.reactionMs)[0]
  $('fastest').textContent = quick ? `${quick.reactionMs} ms` : '-'
  $('fastestInfo').textContent = quick ? quick.tag : ''
  const best = sortEntries(all)[0]
  $('best').textContent = best ? `${best.tag}  ${fmt(best.score)}` : '-'
  $('bestInfo').textContent = best ? new Date(best.at).toLocaleDateString() : ''
  lastSeenAt = newest?.at ?? 0
}

window.addEventListener('storage', (e) => {
  if (e.key === null || e.key === STORE_KEY) render()
})
if ('BroadcastChannel' in window) new BroadcastChannel(CHANNEL).addEventListener('message', render)
// Safety net in case an event is missed, and to roll over at midnight.
setInterval(() => {
  const all = loadEntries(window.localStorage)
  const newestAt = all.reduce((a, e) => Math.max(a, e.at), 0)
  if (newestAt !== lastSeenAt || new Date().getSeconds() === 0) render()
}, 1000)

// Booth operator: Ctrl+Shift+X clears every score after a confirmation.
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x' && window.confirm('Clear ALL saved scores?')) {
    clearEntries(window.localStorage)
    render()
  }
})

render()
