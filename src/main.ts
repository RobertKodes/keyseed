import './style.css'
import { CadenceCapture } from './capture'
import { MAX_MS, MIN_STROKES, PAD_KEYS, isCadenceCode, type Stroke } from './lib/cadence'
import { copyText } from './lib/clipboard'
import { formatCallsign, seedFromCadence, type Seed } from './lib/seed'
import { paintTape } from './viz'

const desk = document.querySelector<HTMLElement>('#desk')!
const statusEl = document.querySelector<HTMLElement>('#status')!
const lampEl = document.querySelector<HTMLElement>('#lamp')!
const plunger = document.querySelector<HTMLButtonElement>('#plunger')!
const holdWord = document.querySelector<HTMLElement>('#hold-word')!
const holdMeter = document.querySelector<HTMLElement>('#hold-meter')!
const tape = document.querySelector<HTMLCanvasElement>('#tape')!
const pad = document.querySelector<HTMLElement>('#pad')!
const plate = document.querySelector<HTMLElement>('#plate')!
const addressEl = document.querySelector<HTMLElement>('#address')!
const chipsEl = document.querySelector<HTMLElement>('#chips')!
const crumb = document.querySelector<HTMLElement>('#crumb')!
const copyBtn = document.querySelector<HTMLButtonElement>('#copy')!
const againBtn = document.querySelector<HTMLButtonElement>('#again')!

const capture = new CadenceCapture()
let seed: Seed | null = null
let developing = false
let latched = false
let holdOrigin = false
let copyReset = 0
let sawKey = false
let sawPad = false

const padButtons = new Map<string, HTMLButtonElement>()

function setStatus(text: string): void {
  statusEl.textContent = text
}

function setWord(text: string): void {
  holdWord.textContent = text
}

function setState(state: 'ready' | 'capturing' | 'seeded'): void {
  desk.dataset.state = state
  lampEl.textContent = state
}

function sourceLabel(): 'keys' | 'pad' | 'mix' {
  if (sawKey && sawPad) return 'mix'
  if (sawPad) return 'pad'
  return 'keys'
}

function showPlate(next: Seed): void {
  seed = next
  plate.hidden = false
  addressEl.textContent = formatCallsign(next.address)
  chipsEl.replaceChildren(
    ...next.chips.map((chip) => {
      const el = document.createElement('span')
      el.className = 'chip'
      el.textContent = chip
      return el
    }),
  )
  const how = sourceLabel()
  crumb.textContent = next.even
    ? `even cadence · ${how} · ${next.hashHex.slice(0, 8)}`
    : `${next.samples} ticks · ${how} · ${next.hashHex.slice(0, 8)}`
  setStatus(next.even ? 'callsign from an even cadence' : 'callsign on the plate')
  setWord('again')
  holdMeter.textContent = ''
  setState('seeded')
  copyBtn.textContent = 'copy address'
}

function clearPlate(): void {
  seed = null
  plate.hidden = true
  addressEl.textContent = ''
  chipsEl.replaceChildren()
  crumb.textContent = ''
}

async function develop(strokes: Stroke[]): Promise<void> {
  developing = true
  setWord('developing')
  setStatus('hashing the cadence')
  holdMeter.textContent = ''
  try {
    showPlate(await seedFromCadence(strokes))
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'could not hash that cadence')
    setWord('hold to seed')
    setState('ready')
  } finally {
    developing = false
  }
}

function beginCapture(): void {
  if (developing || capture.holding) return
  clearPlate()
  sawKey = false
  sawPad = false
  capture.start(() => endCapture())
  latched = true
  plunger.setAttribute('aria-pressed', 'true')
  setWord('capturing')
  setStatus('type or tap — release or click to hash')
  setState('capturing')
}

function endCapture(): void {
  if (!capture.holding) return
  latched = false
  holdOrigin = false
  plunger.setAttribute('aria-pressed', 'false')
  const strokes = capture.stop()
  if (!strokes) {
    setWord('hold to seed')
    setStatus(
      capture.count === 0
        ? 'no ticks — type or tap the pad'
        : `need ${MIN_STROKES} ticks — try a longer take`,
    )
    setState('ready')
    return
  }
  void develop(strokes)
}

function bindPlunger(): void {
  const onDown = (event: PointerEvent) => {
    if (plunger.disabled || event.button !== 0 || developing) return
    event.preventDefault()
    plunger.setPointerCapture(event.pointerId)
    if (capture.holding && latched) {
      holdOrigin = false
      return
    }
    holdOrigin = true
    beginCapture()
  }
  const onUp = (event: PointerEvent) => {
    if (!plunger.hasPointerCapture(event.pointerId) && !capture.holding) return
    event.preventDefault()
    if (plunger.hasPointerCapture(event.pointerId)) {
      plunger.releasePointerCapture(event.pointerId)
    }
    if (!capture.holding) return
    const held = capture.elapsedSec
    if (holdOrigin && held >= 0.22) {
      endCapture()
      return
    }
    if (!holdOrigin) {
      endCapture()
    }
  }
  plunger.addEventListener('pointerdown', onDown)
  plunger.addEventListener('pointerup', onUp)
  plunger.addEventListener('pointercancel', onUp)
  plunger.addEventListener('lostpointercapture', () => {
    if (capture.holding && holdOrigin && capture.elapsedSec >= 0.22) endCapture()
  })
  plunger.addEventListener('contextmenu', (event) => event.preventDefault())
  plunger.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'Enter') event.preventDefault()
  })
}

function lightPad(code: string, on: boolean): void {
  const btn = padButtons.get(code)
  if (!btn) return
  btn.classList.toggle('is-down', on)
}

function bindKeyboard(): void {
  window.addEventListener('keydown', (event) => {
    if (event.repeat || !isCadenceCode(event.code)) return
    const typing =
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    if (typing) return
    if (developing) return
    if (!capture.holding) beginCapture()
    event.preventDefault()
    sawKey = true
    capture.down(event.code)
    lightPad(event.code, true)
  })
  window.addEventListener('keyup', (event) => {
    if (!isCadenceCode(event.code)) return
    capture.up(event.code)
    lightPad(event.code, false)
  })
}

function bindPad(): void {
  for (const key of PAD_KEYS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = key.wide ? 'key wide' : 'key'
    btn.dataset.code = key.code
    btn.textContent = key.label
    btn.setAttribute('aria-label', key.code === 'Space' ? 'space' : key.label)
    pad.append(btn)
    padButtons.set(key.code, btn)

    const down = (event: PointerEvent) => {
      if (event.button !== 0 || developing) return
      event.preventDefault()
      btn.setPointerCapture(event.pointerId)
      if (!capture.holding) beginCapture()
      sawPad = true
      capture.down(key.code)
      btn.classList.add('is-down')
    }
    const up = (event: PointerEvent) => {
      if (btn.hasPointerCapture(event.pointerId)) {
        btn.releasePointerCapture(event.pointerId)
      }
      capture.up(key.code)
      btn.classList.remove('is-down')
      btn.blur()
    }
    btn.addEventListener('pointerdown', down)
    btn.addEventListener('pointerup', up)
    btn.addEventListener('pointercancel', up)
    btn.addEventListener('lostpointercapture', () => {
      capture.up(key.code)
      btn.classList.remove('is-down')
    })
    btn.addEventListener('contextmenu', (event) => event.preventDefault())
    btn.addEventListener('keydown', (event) => {
      if (event.code === 'Space' || event.code === 'Enter') event.preventDefault()
    })
  }
}

function bindPlate(): void {
  copyBtn.addEventListener('click', async () => {
    if (!seed) return
    const ok = await copyText(seed.address)
    copyBtn.textContent = ok ? 'copied' : 'copy failed'
    window.clearTimeout(copyReset)
    copyReset = window.setTimeout(() => {
      copyBtn.textContent = 'copy address'
    }, 1400)
  })
  againBtn.addEventListener('click', () => {
    clearPlate()
    setWord('hold to seed')
    setStatus('hold the key — then type or tap')
    setState('ready')
  })
}

function loop(): void {
  paintTape(tape, capture.sparks, performance.now(), capture.holding)
  if (capture.holding) {
    const sec = Math.min(MAX_MS / 1000, capture.elapsedSec)
    holdMeter.textContent = `${sec.toFixed(1)}s · ${capture.count}`
  }
  requestAnimationFrame(loop)
}

function boot(): void {
  bindPlunger()
  bindKeyboard()
  bindPad()
  bindPlate()
  setState('ready')
  requestAnimationFrame(loop)
}

boot()
