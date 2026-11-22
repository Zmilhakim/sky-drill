import { type Drill, FIELD_H, FIELD_W, type Fx } from '../core/field'
import { FlickDrill } from '../core/flick'
import { HOLD_RADIUS, HOLD_SLOTS, HoldDrill, slotPos } from '../core/hold'
import {
  addEntry,
  cleanTag,
  type Entry,
  type KeyValueStore,
  loadEntries,
  placeOf,
  TAG_LENGTH,
  todays,
} from '../core/leaderboard'
import { mulberry32 } from '../core/rng'
import { type RunResult, summarise, toNextRank } from '../core/scoring'
import { TRACK_RADIUS, TrackDrill } from '../core/track'
import type { Sound } from './audio'
import { COLOR, roundRect, text } from './theme'

type Screen = 'attract' | 'intro' | 'play' | 'results' | 'tag' | 'board'

interface Button {
  id: string
  x: number
  y: number
  w: number
  h: number
}

interface Floater {
  x: number
  y: number
  text: string
  color: string
  age: number
}

const DRILL_INFO = [
  { name: 'FLICK', line: 'Click each target as fast as you can.' },
  { name: 'HOLD THE ANGLE', line: 'Click the red rivals. Never click a blue teammate.' },
  { name: 'TRACK', line: 'Follow the circle with your crosshair. Just move, no clicking.' },
] as const

const INTRO_SECONDS = 3.2
/** With no input for this long, a run is abandoned and the game returns to the start screen. */
const IDLE_SECONDS = { play: 12, other: 30 }
const KEY_ROWS = ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ']

export interface GameHooks {
  store: KeyValueStore
  sound(s: Sound): void
  /** Called after a score is saved, so other windows can refresh. */
  saved(entry: Entry): void
  now(): number
}

export class Game {
  screen: Screen = 'attract'
  private clock = 0
  private screenTime = 0
  private idle = 0
  private px = FIELD_W / 2
  private py = FIELD_H / 2
  private buttons: Button[] = []
  private floaters: Floater[] = []
  private shake = 0
  private flash = 0

  private runs = 0
  private drillIndex = 0
  private flick!: FlickDrill
  private hold!: HoldDrill
  private track!: TrackDrill
  private drill: Drill | null = null
  private lastTick = -1
  result: RunResult | null = null
  private tag = ''
  private tagError = ''
  private savedEntry: Entry | null = null
  private today: Entry[] = []

  constructor(private hooks: GameHooks) {
    this.refreshBoard()
  }

  // ---------------------------------------------------------------- flow

  private go(screen: Screen): void {
    this.screen = screen
    this.screenTime = 0
    this.idle = 0
    this.lastTick = -1
  }

  private refreshBoard(): void {
    this.today = todays(loadEntries(this.hooks.store), this.hooks.now())
    // The table is re-read from storage, so find our own entry in it again.
    const mine = this.savedEntry
    if (mine) this.savedEntry = this.today.find((e) => e.at === mine.at && e.tag === mine.tag) ?? mine
  }

  /** Everything a new player needs is created here, so nothing leaks from the last run. */
  private startRun(): void {
    this.runs++
    const seed = (this.hooks.now() ^ (this.runs * 2654435761)) >>> 0
    const rng = mulberry32(seed)
    this.flick = new FlickDrill(rng)
    this.hold = new HoldDrill(rng)
    this.track = new TrackDrill(rng)
    this.drillIndex = 0
    this.drill = null
    this.result = null
    this.tag = ''
    this.tagError = ''
    this.savedEntry = null
    this.floaters = []
    this.go('intro')
  }

  private toAttract(): void {
    this.drill = null
    this.floaters = []
    this.refreshBoard()
    this.go('attract')
  }

  private drills(): Drill[] {
    return [this.flick, this.hold, this.track]
  }

  private runningTotal(): number {
    return this.flick.score + this.hold.score + this.track.score
  }

  private finishRun(): void {
    this.result = summarise(this.flick, this.hold, this.track)
    this.drill = null
    this.refreshBoard()
    this.hooks.sound('end')
    this.go('results')
  }

  private saveScore(): void {
    const tag = cleanTag(this.tag)
    if (!tag || !this.result) {
      this.tagError = this.tag.length < TAG_LENGTH ? 'Pick three letters' : 'Try another tag'
      this.tag = this.tag.length < TAG_LENGTH ? this.tag : ''
      return
    }
    const entry: Entry = {
      tag,
      score: this.result.total,
      rank: this.result.rank.name,
      reactionMs: this.result.reactionMs,
      at: this.hooks.now(),
    }
    this.savedEntry = entry
    addEntry(this.hooks.store, entry)
    this.hooks.saved(entry)
    this.refreshBoard()
    this.go('board')
  }

  // --------------------------------------------------------------- input

  pointerMove(x: number, y: number): void {
    if (x !== this.px || y !== this.py) this.idle = 0
    this.px = x
    this.py = y
    this.drill?.pointerMove(x, y)
  }

  pointerDown(x: number, y: number): void {
    this.idle = 0
    this.px = x
    this.py = y
    if (this.screen === 'play') {
      this.drill?.pointerDown(x, y)
      return
    }
    const hit = this.buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)
    if (hit) {
      this.press(hit.id)
    } else if (this.screen === 'attract') {
      this.startRun()
    }
  }

  key(key: string): void {
    this.idle = 0
    if (this.screen === 'tag') {
      if (key === 'Enter') this.press('ok')
      else if (key === 'Backspace') this.press('del')
      else if (/^[a-zA-Z0-9]$/.test(key)) this.press(`k:${key.toUpperCase()}`)
    } else if (key === 'Enter' || key === ' ') {
      if (this.screen === 'attract') this.startRun()
      else if (this.screen === 'results') this.press('save')
      else if (this.screen === 'board') this.press('again')
    }
    if (key === 'Escape') this.toAttract()
  }

  private press(id: string): void {
    this.hooks.sound('key')
    if (id === 'start' || id === 'again') this.startRun()
    else if (id === 'save') this.go('tag')
    else if (id === 'skip' || id === 'home') this.toAttract()
    else if (id === 'del') this.tag = this.tag.slice(0, -1)
    else if (id === 'ok') this.saveScore()
    else if (id.startsWith('k:') && this.tag.length < TAG_LENGTH) {
      this.tag += id.slice(2)
      this.tagError = ''
    }
  }

  // -------------------------------------------------------------- update

  update(dt: number): void {
    this.clock += dt
    this.screenTime += dt
    this.idle += dt
    this.shake = Math.max(0, this.shake - dt * 4)
    this.flash = Math.max(0, this.flash - dt * 3)
    for (const f of this.floaters) f.age += dt
    this.floaters = this.floaters.filter((f) => f.age < 0.9)

    if (this.screen !== 'attract') {
      const limit = this.screen === 'play' || this.screen === 'intro' ? IDLE_SECONDS.play : IDLE_SECONDS.other
      if (this.idle > limit) {
        this.toAttract()
        return
      }
    }

    if (this.screen === 'intro') {
      const left = Math.ceil(INTRO_SECONDS - this.screenTime)
      if (left !== this.lastTick && left >= 1 && left <= 3) {
        this.lastTick = left
        this.hooks.sound('tick')
      }
      if (this.screenTime >= INTRO_SECONDS) {
        this.drill = this.drills()[this.drillIndex]
        this.drill.pointerMove(this.px, this.py)
        this.hooks.sound('go')
        this.go('play')
      }
    } else if (this.screen === 'play' && this.drill) {
      this.drill.update(dt)
      for (const fx of this.drill.drainFx()) this.showFx(fx)
      if (this.drill.done) {
        this.drillIndex++
        if (this.drillIndex >= this.drills().length) this.finishRun()
        else {
          this.drill = null
          this.go('intro')
        }
      }
    }
  }

  private showFx(fx: Fx): void {
    const color = fx.kind === 'hit' ? COLOR.gold : fx.kind === 'escape' ? COLOR.dim : COLOR.rival
    this.floaters.push({ x: fx.x, y: fx.y - 40, text: fx.text, color, age: 0 })
    this.hooks.sound(fx.kind)
    if (fx.kind === 'bad') {
      this.shake = 1
      this.flash = 1
    }
  }

  // ---------------------------------------------------------------- draw

  draw(ctx: CanvasRenderingContext2D): void {
    this.buttons = []
    ctx.save()
    if (this.shake > 0) {
      ctx.translate(Math.sin(this.clock * 90) * 10 * this.shake, Math.cos(this.clock * 70) * 8 * this.shake)
    }
    this.drawBackground(ctx)
    switch (this.screen) {
      case 'attract':
        this.drawAttract(ctx)
        break
      case 'intro':
        this.drawHud(ctx)
        this.drawIntro(ctx)
        break
      case 'play':
        this.drawPlay(ctx)
        this.drawHud(ctx)
        break
      case 'results':
        this.drawResults(ctx)
        break
      case 'tag':
        this.drawTag(ctx)
        break
      case 'board':
        this.drawBoard(ctx)
        break
    }
    for (const f of this.floaters) {
      ctx.globalAlpha = 1 - f.age / 0.9
      text(ctx, f.text, f.x, f.y - f.age * 70, 34, f.color)
    }
    ctx.globalAlpha = 1
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 70, 60, ${0.25 * this.flash})`
      ctx.fillRect(0, 0, FIELD_W, FIELD_H)
    }
    ctx.restore()
    this.drawCrosshair(ctx)
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD_H)
    g.addColorStop(0, COLOR.bgTop)
    g.addColorStop(1, COLOR.bgBottom)
    ctx.fillStyle = g
    ctx.fillRect(-20, -20, FIELD_W + 40, FIELD_H + 40)
    // Slow drifting cloud bands.
    for (let i = 0; i < 5; i++) {
      const x = ((this.clock * (12 + i * 5) + i * 420) % (FIELD_W + 700)) - 350
      const y = 150 + i * 160
      ctx.fillStyle = 'rgba(90, 170, 240, 0.045)'
      ctx.beginPath()
      ctx.ellipse(x, y, 330, 60, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(120, 180, 230, 0.05)'
    ctx.lineWidth = 1
    for (let x = 0; x <= FIELD_W; x += 100) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, FIELD_H)
      ctx.stroke()
    }
    for (let y = 0; y <= FIELD_H; y += 100) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(FIELD_W, y)
      ctx.stroke()
    }
  }

  private button(ctx: CanvasRenderingContext2D, id: string, label: string, x: number, y: number, w: number, h: number, primary = true): void {
    this.buttons.push({ id, x, y, w, h })
    const hover = this.px >= x && this.px <= x + w && this.py >= y && this.py <= y + h
    roundRect(ctx, x, y, w, h, 14)
    ctx.fillStyle = primary ? (hover ? '#6ccbff' : COLOR.sky) : hover ? 'rgba(80,150,210,0.35)' : 'rgba(60,120,180,0.2)'
    ctx.fill()
    if (!primary) {
      ctx.strokeStyle = COLOR.line
      ctx.lineWidth = 2
      ctx.stroke()
    }
    text(ctx, label, x + w / 2, y + h / 2 + 2, Math.min(34, h * 0.42, (w * 1.45) / label.length), primary ? '#04121f' : COLOR.white)
  }

  private panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    roundRect(ctx, x, y, w, h, 22)
    ctx.fillStyle = COLOR.panel
    ctx.fill()
    ctx.strokeStyle = COLOR.line
    ctx.lineWidth = 2
    ctx.stroke()
  }

  private drawTopList(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, rows: number, highlight: Entry | null): void {
    text(ctx, "TODAY'S TOP SCORES", x + w / 2, y, 26, COLOR.sky)
    if (!this.today.length) {
      text(ctx, 'No scores yet today.', x + w / 2, y + 70, 24, COLOR.dim, 'center', 500)
      text(ctx, 'Be the first.', x + w / 2, y + 106, 24, COLOR.dim, 'center', 500)
      return
    }
    let list = this.today.slice(0, rows)
    const place = highlight ? this.today.indexOf(highlight) : -1
    if (highlight && place >= rows) list = [...this.today.slice(0, rows - 1), highlight]
    list.forEach((e, i) => {
      const rowY = y + 52 + i * 46
      const n = this.today.indexOf(e) + 1
      const mine = e === highlight
      if (mine) {
        roundRect(ctx, x, rowY - 21, w, 42, 8)
        ctx.fillStyle = 'rgba(255, 210, 74, 0.18)'
        ctx.fill()
      }
      const color = mine ? COLOR.gold : n === 1 ? COLOR.white : COLOR.dim
      text(ctx, `${n}`, x + 44, rowY, 26, color, 'right')
      text(ctx, e.tag, x + 70, rowY, 28, mine ? COLOR.gold : COLOR.white, 'left')
      text(ctx, e.rank, x + 170, rowY, 17, COLOR.dim, 'left', 600)
      text(ctx, e.score.toLocaleString('en-US'), x + w - 16, rowY, 28, color, 'right')
    })
  }

  private drawAttract(ctx: CanvasRenderingContext2D): void {
    text(ctx, 'SKY DRILL', 560, 170, 150, COLOR.white, 'center', 800)
    text(ctx, 'THE 60-SECOND PRO TRYOUT', 560, 268, 34, COLOR.sky)
    text(ctx, 'Three drills. One score. How close are you to the pros?', 560, 322, 26, COLOR.dim, 'center', 500)

    DRILL_INFO.forEach((d, i) => {
      const y = 410 + i * 92
      this.panel(ctx, 110, y - 38, 900, 76)
      text(ctx, `${i + 1}`, 156, y, 40, COLOR.sky)
      text(ctx, d.name, 200, y - 13, 26, COLOR.white, 'left')
      text(ctx, d.line, 200, y + 17, 20, COLOR.dim, 'left', 500)
    })

    const pulse = 1 + 0.03 * Math.sin(this.clock * 4)
    const w = 520 * pulse
    const h = 96 * pulse
    this.button(ctx, 'start', 'CLICK TO START', 560 - w / 2, 748 - h / 2, w, h)
    text(ctx, 'Mouse only. No tutorial needed.', 560, 834, 20, COLOR.dim, 'center', 500)

    this.panel(ctx, 1090, 110, 420, 680)
    this.drawTopList(ctx, 1110, 160, 380, 12, null)
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    const info = DRILL_INFO[this.drillIndex]
    text(ctx, `DRILL ${this.drillIndex + 1}/3`, 60, 50, 22, COLOR.sky, 'left')
    text(ctx, info.name, 60, 86, 34, COLOR.white, 'left')
    text(ctx, 'SCORE', FIELD_W - 60, 50, 22, COLOR.sky, 'right')
    text(ctx, this.runningTotal().toLocaleString('en-US'), FIELD_W - 60, 88, 44, COLOR.white, 'right')

    const d = this.drill
    const share = d ? 1 - d.time / d.duration : 1
    const barW = 620
    const x = (FIELD_W - barW) / 2
    roundRect(ctx, x, 56, barW, 18, 9)
    ctx.fillStyle = 'rgba(120,180,230,0.15)'
    ctx.fill()
    if (share > 0) {
      roundRect(ctx, x, 56, Math.max(18, barW * share), 18, 9)
      ctx.fillStyle = share < 0.25 ? COLOR.rival : COLOR.sky
      ctx.fill()
    }
    if (d) text(ctx, `${Math.max(0, d.duration - d.time).toFixed(1)}s`, FIELD_W / 2, 100, 22, COLOR.dim, 'center', 600)
  }

  private drawIntro(ctx: CanvasRenderingContext2D): void {
    const info = DRILL_INFO[this.drillIndex]
    this.panel(ctx, 300, 250, 1000, 420)
    text(ctx, `DRILL ${this.drillIndex + 1} OF 3`, FIELD_W / 2, 310, 28, COLOR.sky)
    text(ctx, info.name, FIELD_W / 2, 390, 84, COLOR.white, 'center', 800)
    text(ctx, info.line, FIELD_W / 2, 468, 30, COLOR.white, 'center', 500)
    if (this.drillIndex === 1) {
      this.drawRival(ctx, 640, 560, 34)
      text(ctx, 'CLICK', 690, 560, 24, COLOR.rival, 'left')
      this.drawMate(ctx, 890, 560, 34)
      text(ctx, 'HOLD FIRE', 940, 560, 24, COLOR.sky, 'left')
    }
    const left = Math.max(1, Math.ceil(INTRO_SECONDS - this.screenTime))
    text(ctx, left > 3 ? 'GET READY' : `${left}`, FIELD_W / 2, 626, left > 3 ? 34 : 64, COLOR.gold)
  }

  private drawPlay(ctx: CanvasRenderingContext2D): void {
    if (this.drill === this.flick) this.drawFlick(ctx)
    else if (this.drill === this.hold) this.drawHold(ctx)
    else if (this.drill === this.track) this.drawTrack(ctx)
  }

  private drawFlick(ctx: CanvasRenderingContext2D): void {
    const t = this.flick.target
    const lifeLeft = 1 - (this.flick.time - t.bornAt) / FlickDrill.LIFETIME
    ctx.strokeStyle = 'rgba(53, 182, 255, 0.5)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(t.x, t.y, t.r + 6 + 26 * Math.max(0, lifeLeft), 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = COLOR.sky
    ctx.beginPath()
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = COLOR.white
    ctx.beginPath()
    ctx.arc(t.x, t.y, t.r * 0.55, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = COLOR.rival
    ctx.beginPath()
    ctx.arc(t.x, t.y, t.r * 0.22, 0, Math.PI * 2)
    ctx.fill()
    if (this.flick.combo >= 3) text(ctx, `STREAK x${this.flick.combo}`, FIELD_W / 2, 150, 28, COLOR.gold)
  }

  private drawRival(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.fillStyle = COLOR.rival
    ctx.beginPath()
    ctx.moveTo(x, y - r)
    ctx.lineTo(x + r, y)
    ctx.lineTo(x, y + r)
    ctx.lineTo(x - r, y)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#3a0c08'
    ctx.lineWidth = r * 0.16
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x - r * 0.42, y - r * 0.18)
    ctx.lineTo(x - r * 0.12, y)
    ctx.moveTo(x + r * 0.42, y - r * 0.18)
    ctx.lineTo(x + r * 0.12, y)
    ctx.stroke()
  }

  private drawMate(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.fillStyle = COLOR.sky
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = COLOR.white
    ctx.lineWidth = r * 0.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(x - r * 0.45, y)
    ctx.lineTo(x - r * 0.1, y + r * 0.35)
    ctx.lineTo(x + r * 0.5, y - r * 0.35)
    ctx.stroke()
  }

  private drawHold(ctx: CanvasRenderingContext2D): void {
    // Peeks are drawn first so the cover hides their lower part.
    for (const k of this.hold.peeks) {
      const pos = slotPos(k.slot)
      const age = this.hold.time - k.bornAt
      const rise = Math.min(1, age / 0.09)
      const y = pos.y + 90 * (1 - rise)
      if (k.kind === 'rival') this.drawRival(ctx, pos.x, y, HOLD_RADIUS * 0.82)
      else this.drawMate(ctx, pos.x, y, HOLD_RADIUS * 0.74)
    }
    for (let s = 0; s < HOLD_SLOTS; s++) {
      const pos = slotPos(s)
      roundRect(ctx, pos.x - 110, pos.y + 62, 220, 150, 16)
      ctx.fillStyle = '#12314d'
      ctx.fill()
      ctx.strokeStyle = COLOR.skyDim
      ctx.lineWidth = 3
      ctx.stroke()
    }
    this.drawRival(ctx, 560, 800, 22)
    text(ctx, 'RIVAL: CLICK', 596, 801, 22, COLOR.rival, 'left')
    this.drawMate(ctx, 850, 800, 22)
    text(ctx, 'TEAMMATE: HOLD FIRE', 886, 801, 22, COLOR.sky, 'left')
  }

  private drawTrack(ctx: CanvasRenderingContext2D): void {
    const t = this.track
    const on = t.onTarget
    const pulse = on ? 0 : 8 * (0.5 + 0.5 * Math.sin(this.clock * 9))
    if (!on) {
      // Off target: a dashed line shows exactly where the crosshair has to go.
      ctx.strokeStyle = 'rgba(244, 249, 255, 0.55)'
      ctx.lineWidth = 3
      ctx.setLineDash([14, 12])
      ctx.beginPath()
      ctx.moveTo(this.px, this.py)
      ctx.lineTo(t.x, t.y)
      ctx.stroke()
      ctx.setLineDash([])
    }
    ctx.fillStyle = on ? 'rgba(255, 210, 74, 0.28)' : 'rgba(53, 182, 255, 0.15)'
    ctx.beginPath()
    ctx.arc(t.x, t.y, TRACK_RADIUS + pulse, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = on ? COLOR.gold : COLOR.sky
    ctx.lineWidth = 6
    ctx.stroke()
    ctx.fillStyle = on ? COLOR.gold : COLOR.sky
    ctx.beginPath()
    ctx.arc(t.x, t.y, 9, 0, Math.PI * 2)
    ctx.fill()
    const labelY = t.y - TRACK_RADIUS - 30 > 190 ? t.y - TRACK_RADIUS - 30 : t.y + TRACK_RADIUS + 34
    text(ctx, on ? 'SCORING! STAY ON IT' : 'MOVE YOUR CROSSHAIR HERE', t.x, labelY, 24, on ? COLOR.gold : COLOR.white)
    text(ctx, `ON TARGET ${Math.round(t.onShare * 100)}%`, FIELD_W / 2, 150, 28, on ? COLOR.gold : COLOR.dim)
  }

  private drawResults(ctx: CanvasRenderingContext2D): void {
    const r = this.result
    if (!r) return
    const grow = Math.min(1, this.screenTime / 1.1)
    const shown = Math.round(r.total * (1 - Math.pow(1 - grow, 3)))
    this.panel(ctx, 90, 70, 920, 760)
    text(ctx, 'YOUR TRYOUT', 550, 122, 28, COLOR.sky)
    text(ctx, shown.toLocaleString('en-US'), 550, 220, 140, COLOR.white, 'center', 800)
    text(ctx, r.rank.name, 550, 322, 52, COLOR.gold, 'center', 800)
    const next = toNextRank(r.total)
    text(
      ctx,
      next ? `${next.points.toLocaleString('en-US')} more for ${next.rank.name}` : 'Top rank. The pros should be worried.',
      550,
      372,
      22,
      COLOR.dim,
      'center',
      500,
    )

    const stats: [string, string][] = [
      ['REACTION', r.reactionMs ? `${r.reactionMs} ms` : 'no hits'],
      ['ACCURACY', `${Math.round(r.accuracy * 100)}%`],
      ['TEAMMATES HIT', `${r.teamHits}`],
      ['TRACKING', `${Math.round(r.tracking * 100)}%`],
    ]
    stats.forEach(([label, value], i) => {
      const x = 140 + i * 210
      roundRect(ctx, x, 420, 190, 110, 14)
      ctx.fillStyle = 'rgba(60,120,180,0.18)'
      ctx.fill()
      text(ctx, label, x + 95, 448, 17, COLOR.dim, 'center', 600)
      const bad = label === 'TEAMMATES HIT' && r.teamHits > 0
      text(ctx, value, x + 95, 492, 36, bad ? COLOR.rival : COLOR.white)
    })

    const parts: [string, number][] = [
      ['FLICK', r.flickScore],
      ['HOLD THE ANGLE', r.holdScore],
      ['TRACK', r.trackScore],
    ]
    const max = Math.max(1, ...parts.map((p) => p[1]))
    parts.forEach(([label, value], i) => {
      const y = 580 + i * 40
      text(ctx, label, 330, y, 20, COLOR.dim, 'right', 600)
      roundRect(ctx, 350, y - 9, 440, 18, 9)
      ctx.fillStyle = 'rgba(120,180,230,0.12)'
      ctx.fill()
      roundRect(ctx, 350, y - 9, Math.max(18, 440 * (value / max) * grow), 18, 9)
      ctx.fillStyle = COLOR.sky
      ctx.fill()
      text(ctx, value.toLocaleString('en-US'), 810, y, 22, COLOR.white, 'left')
    })

    const place = placeOf(this.today, r.total)
    text(ctx, `That is #${place} today.`, 550, 712, 26, place === 1 ? COLOR.gold : COLOR.white)
    this.button(ctx, 'save', 'SAVE MY SCORE', 240, 744, 360, 66)
    this.button(ctx, 'skip', 'SKIP', 620, 744, 240, 66, false)

    this.panel(ctx, 1090, 110, 420, 680)
    this.drawTopList(ctx, 1110, 160, 380, 12, null)
  }

  private drawTag(ctx: CanvasRenderingContext2D): void {
    const r = this.result
    this.panel(ctx, 250, 80, 1100, 740)
    text(ctx, 'ENTER YOUR TAG', FIELD_W / 2, 140, 40, COLOR.white, 'center', 800)
    if (r) text(ctx, `${r.total.toLocaleString('en-US')}  ·  ${r.rank.name}`, FIELD_W / 2, 190, 26, COLOR.gold)
    for (let i = 0; i < TAG_LENGTH; i++) {
      const x = FIELD_W / 2 - 170 + i * 120
      roundRect(ctx, x, 230, 100, 110, 14)
      ctx.fillStyle = 'rgba(60,120,180,0.22)'
      ctx.fill()
      ctx.strokeStyle = i === this.tag.length ? COLOR.sky : COLOR.line
      ctx.lineWidth = 3
      ctx.stroke()
      text(ctx, this.tag[i] ?? '', x + 50, 288, 72, COLOR.white, 'center', 800)
    }
    if (this.tagError) text(ctx, this.tagError, FIELD_W / 2, 366, 22, COLOR.rival)
    else text(ctx, 'Three letters, like an arcade machine. Click or type.', FIELD_W / 2, 366, 22, COLOR.dim, 'center', 500)

    const size = 92
    const gap = 12
    KEY_ROWS.forEach((row, ri) => {
      const rowW = row.length * size + (row.length - 1) * gap
      const x0 = (FIELD_W - rowW) / 2
      ;[...row].forEach((ch, ci) => {
        this.button(ctx, `k:${ch}`, ch, x0 + ci * (size + gap), 400 + ri * (size + gap), size, size, false)
      })
    })
    this.button(ctx, 'del', 'DELETE', 420, 724, 220, 70, false)
    this.button(ctx, 'ok', 'SAVE', 660, 724, 300, 70)
    this.button(ctx, 'skip', 'SKIP', 980, 724, 200, 70, false)
  }

  private drawBoard(ctx: CanvasRenderingContext2D): void {
    const e = this.savedEntry
    const place = e ? this.today.indexOf(e) + 1 : 0
    this.panel(ctx, 110, 150, 660, 560)
    text(ctx, 'SAVED', 440, 220, 28, COLOR.sky)
    text(ctx, e ? e.tag : '', 440, 320, 130, COLOR.white, 'center', 800)
    text(ctx, e ? e.score.toLocaleString('en-US') : '', 440, 420, 60, COLOR.gold, 'center', 800)
    text(ctx, place === 1 ? 'You lead the booth today!' : `You are #${place} today.`, 440, 492, 30, COLOR.white)
    this.button(ctx, 'again', 'PLAY AGAIN', 180, 570, 300, 80)
    this.button(ctx, 'home', 'NEXT PLAYER', 500, 570, 220, 80, false)
    const left = Math.max(0, Math.ceil(IDLE_SECONDS.other - this.idle))
    text(ctx, `Back to start in ${left}s`, 440, 680, 18, COLOR.dim, 'center', 500)

    this.panel(ctx, 850, 110, 640, 680)
    this.drawTopList(ctx, 880, 160, 580, 12, e)
  }

  private drawCrosshair(ctx: CanvasRenderingContext2D): void {
    const x = this.px
    const y = this.py
    ctx.strokeStyle = '#04121f'
    ctx.lineWidth = 7
    this.crossLines(ctx, x, y)
    ctx.strokeStyle = COLOR.white
    ctx.lineWidth = 3
    this.crossLines(ctx, x, y)
    ctx.fillStyle = COLOR.gold
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  private crossLines(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x - 22, y)
    ctx.lineTo(x - 8, y)
    ctx.moveTo(x + 8, y)
    ctx.lineTo(x + 22, y)
    ctx.moveTo(x, y - 22)
    ctx.lineTo(x, y - 8)
    ctx.moveTo(x, y + 8)
    ctx.lineTo(x, y + 22)
    ctx.stroke()
  }
}
