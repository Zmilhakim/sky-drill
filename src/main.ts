import { FIELD_H, FIELD_W } from './core/field'
import { CHANNEL } from './core/leaderboard'
import { Sfx } from './ui/audio'
import { Game } from './ui/game'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const sfx = new Sfx()
const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null

const game = new Game({
  store: window.localStorage,
  sound: (s) => sfx.play(s),
  saved: (entry) => channel?.postMessage({ type: 'saved', entry }),
  now: () => Date.now(),
})

// Lets automated play-tests in development read the game state.
if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game

/** How the virtual field is placed on the real screen (letterboxed, centred). */
let view = { scale: 1, dx: 0, dy: 0, dpr: 1 }

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  const scale = Math.min(w / FIELD_W, h / FIELD_H)
  view = { scale, dx: (w - FIELD_W * scale) / 2, dy: (h - FIELD_H * scale) / 2, dpr }
}

function toField(e: PointerEvent): [number, number] {
  return [(e.clientX - view.dx) / view.scale, (e.clientY - view.dy) / view.scale]
}

canvas.addEventListener('pointermove', (e) => game.pointerMove(...toField(e)))
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault()
  sfx.unlock()
  game.pointerDown(...toField(e))
})
window.addEventListener('contextmenu', (e) => e.preventDefault())
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  // Booth operator keys. They are ignored while a player is typing a tag.
  if (game.screen !== 'tag') {
    if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen().catch(() => {})
      return
    }
    if (e.key === 'm' || e.key === 'M') {
      sfx.muted = !sfx.muted
      return
    }
  }
  if (e.key === ' ' || e.key === 'Backspace') e.preventDefault()
  sfx.unlock()
  game.key(e.key)
})
window.addEventListener('resize', resize)
resize()

let last = performance.now()
function frame(now: number): void {
  // Cap the step so a stalled tab does not skip a whole drill.
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  game.update(dt)

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#03090f'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.setTransform(view.scale * view.dpr, 0, 0, view.scale * view.dpr, view.dx * view.dpr, view.dy * view.dpr)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, FIELD_W, FIELD_H)
  ctx.clip()
  game.draw(ctx)
  ctx.restore()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
