/** All sounds are made on the fly with the Web Audio API, so there are no audio files to license. */
export type Sound = 'hit' | 'miss' | 'bad' | 'escape' | 'tick' | 'go' | 'end' | 'key'

export class Sfx {
  private ctx: AudioContext | null = null
  muted = false

  /** Browsers only allow sound after a user gesture, so call this from a click. */
  unlock(): void {
    try {
      this.ctx ??= new AudioContext()
      if (this.ctx.state === 'suspended') void this.ctx.resume()
    } catch {
      this.ctx = null
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number): void {
    const ctx = this.ctx
    if (!ctx || this.muted) return
    const t0 = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
    amp.gain.setValueAtTime(gain, t0)
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(amp).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  play(sound: Sound): void {
    switch (sound) {
      case 'hit':
        this.tone(880, 0.09, 'triangle', 0.25, 0, 1320)
        break
      case 'miss':
        this.tone(190, 0.12, 'sine', 0.2, 0, 120)
        break
      case 'bad':
        this.tone(140, 0.35, 'sawtooth', 0.22, 0, 70)
        break
      case 'escape':
        this.tone(300, 0.15, 'sine', 0.12, 0, 200)
        break
      case 'tick':
        this.tone(660, 0.07, 'square', 0.1)
        break
      case 'go':
        this.tone(990, 0.22, 'square', 0.12)
        break
      case 'key':
        this.tone(520, 0.04, 'triangle', 0.12)
        break
      case 'end':
        ;[523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.2, i * 0.11))
        break
    }
  }
}
