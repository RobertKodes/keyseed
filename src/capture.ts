import {
  MAX_MS,
  MIN_MS,
  MIN_STROKES,
  isCadenceCode,
  strokeFromHit,
  type Stroke,
} from './lib/cadence'

export type Spark = {
  at: number
  code: string
  id: number
}

export class CadenceCapture {
  strokes: Stroke[] = []
  sparks: Spark[] = []
  holding = false
  startedAt = 0
  private lastDown = 0
  private pending = new Map<string, { index: number; downAt: number }>()
  private timer = 0
  private onCeiling: (() => void) | null = null

  get elapsedSec(): number {
    if (!this.holding) return 0
    return (performance.now() - this.startedAt) / 1000
  }

  get count(): number {
    return this.strokes.length
  }

  start(onCeiling: () => void): void {
    this.strokes = []
    this.sparks = []
    this.pending.clear()
    this.holding = true
    this.startedAt = performance.now()
    this.lastDown = 0
    this.onCeiling = onCeiling
    window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => {
      if (this.holding) this.onCeiling?.()
    }, MAX_MS)
  }

  down(code: string, at = performance.now()): Stroke | null {
    if (!this.holding || !isCadenceCode(code)) return null
    if (this.pending.has(code)) return null
    const delta = this.lastDown === 0 ? 0 : at - this.lastDown
    this.lastDown = at
    const hit = strokeFromHit(code, delta, 0)
    if (!hit) return null
    this.strokes.push(hit)
    this.pending.set(code, { index: this.strokes.length - 1, downAt: at })
    this.sparks.push({ at, code, id: hit.id })
    if (this.sparks.length > 64) this.sparks.shift()
    return hit
  }

  up(code: string, at = performance.now()): void {
    const pending = this.pending.get(code)
    if (!pending) return
    this.pending.delete(code)
    const dwell = Math.max(0, at - pending.downAt)
    const stroke = this.strokes[pending.index]
    if (stroke) stroke.dwellMs = Math.min(65535, Math.round(dwell))
  }

  stop(): Stroke[] | null {
    window.clearTimeout(this.timer)
    this.timer = 0
    this.holding = false
    this.onCeiling = null
    const leftover = [...this.pending.keys()]
    const now = performance.now()
    for (const code of leftover) this.up(code, now)
    this.pending.clear()
    const elapsed = now - this.startedAt
    if (this.strokes.length < MIN_STROKES || elapsed < MIN_MS) return null
    return this.strokes.slice()
  }
}
