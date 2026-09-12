import { prefersReducedMotion } from './lib/clipboard'
import type { Spark } from './capture'

const PAPER = '#f3e6cd'
const INK = '#2a1c14'
const RIBBON = '#d45a3c'
const SPARK = '#f2c14b'
const SOOT = '#8a7b66'
const HOLE = '#1c1610'

function sizeCanvas(canvas: HTMLCanvasElement): { w: number; h: number } {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  const pw = Math.max(1, Math.round(w * dpr))
  const ph = Math.max(1, Math.round(h * dpr))
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw
    canvas.height = ph
  }
  return { w: pw, h: ph }
}

function hashHue(id: number): string {
  const t = (id * 47) % 360
  return `hsl(${t} 42% 42%)`
}

export function paintTape(
  canvas: HTMLCanvasElement,
  sparks: readonly Spark[],
  now: number,
  capturing: boolean,
): void {
  const { w, h } = sizeCanvas(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, w, h)

  const holeR = Math.max(2.2, h * 0.045)
  const inset = h * 0.16
  ctx.fillStyle = HOLE
  const pitch = holeR * 3.4
  for (let x = pitch * 0.7; x < w; x += pitch) {
    ctx.beginPath()
    ctx.arc(x, inset, holeR, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, h - inset, holeR, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.strokeStyle = '#d8c4a0'
  ctx.lineWidth = Math.max(1, h * 0.012)
  ctx.beginPath()
  ctx.moveTo(0, inset + holeR * 1.8)
  ctx.lineTo(w, inset + holeR * 1.8)
  ctx.moveTo(0, h - inset - holeR * 1.8)
  ctx.lineTo(w, h - inset - holeR * 1.8)
  ctx.stroke()

  const windowMs = 2400
  const mid = h * 0.5
  const band = h * 0.28
  const reduce = prefersReducedMotion()
  const scroll = capturing && !reduce ? (now % 2400) / 2400 : 0

  if (sparks.length === 0) {
    ctx.fillStyle = SOOT
    ctx.globalAlpha = 0.45
    ctx.font = `${Math.round(h * 0.16)}px "IBM Plex Mono", "Courier New", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(capturing ? 'waiting for a tick' : 'cadence tape', w / 2, mid)
    ctx.globalAlpha = 1
    return
  }

  const lastAt = sparks[sparks.length - 1]!.at
  const origin = lastAt - windowMs * 0.82

  for (let i = 0; i < sparks.length; i++) {
    const s = sparks[i]!
    const t = (s.at - origin) / windowMs - (capturing ? scroll * 0.04 : 0)
    if (t < -0.05 || t > 1.08) continue
    const x = t * w
    const age = now - s.at
    const pulse = capturing && age < 180 ? 1 + (1 - age / 180) * 0.55 : 1
    const r = Math.max(3, h * 0.07) * pulse

    if (i > 0) {
      const prev = sparks[i - 1]!
      const pt = (prev.at - origin) / windowMs
      const px = pt * w
      const gap = s.at - prev.at
      ctx.strokeStyle = gap < 140 ? RIBBON : '#c4a27a'
      ctx.globalAlpha = 0.55
      ctx.lineWidth = Math.max(1.2, h * 0.018)
      ctx.beginPath()
      ctx.moveTo(px, mid)
      ctx.lineTo(x, mid)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    ctx.fillStyle = age < 220 && capturing ? SPARK : hashHue(s.id)
    ctx.beginPath()
    ctx.arc(x, mid, r, 0, Math.PI * 2)
    ctx.fill()

    if (age < 280 && capturing && !reduce) {
      ctx.strokeStyle = SPARK
      ctx.globalAlpha = 1 - age / 280
      ctx.lineWidth = Math.max(1, h * 0.02)
      ctx.beginPath()
      ctx.arc(x, mid, r + band * (age / 280), 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    ctx.fillStyle = INK
    ctx.globalAlpha = 0.7
    ctx.beginPath()
    ctx.arc(x, mid, Math.max(1.2, r * 0.28), 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}
