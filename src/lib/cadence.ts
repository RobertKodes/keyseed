/** One hit on the trail: which key, gap since the last, how long it was held. */
export type Stroke = {
  id: number
  deltaMs: number
  dwellMs: number
}

/** Soft home-row pad — same codes as a hardware keyboard, so A-on-pad == KeyA. */
export const PAD_KEYS = [
  { code: 'KeyA', label: 'A', wide: false },
  { code: 'KeyS', label: 'S', wide: false },
  { code: 'KeyD', label: 'D', wide: false },
  { code: 'KeyF', label: 'F', wide: false },
  { code: 'KeyJ', label: 'J', wide: false },
  { code: 'KeyK', label: 'K', wide: false },
  { code: 'KeyL', label: 'L', wide: false },
  { code: 'Semicolon', label: ';', wide: false },
  { code: 'Space', label: 'space', wide: true },
] as const

export type PadCode = (typeof PAD_KEYS)[number]['code']

/** Domain separator mixed into the digest. */
export const CADENCE_DOMAIN = 'keyseed\n'

export const MIN_STROKES = 3
export const MIN_MS = 80
export const MAX_MS = 6000

const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'Fn',
  'FnLock',
  'Hyper',
  'Super',
  'Symbol',
  'SymbolLock',
])

const IGNORE_CODES = new Set([
  'Tab',
  'Escape',
  'ContextMenu',
  'PrintScreen',
  'Pause',
  'Insert',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Help',
  'WakeUp',
  'MediaPlayPause',
  'MediaTrackNext',
  'MediaTrackPrevious',
  'AudioVolumeUp',
  'AudioVolumeDown',
  'AudioVolumeMute',
])

export function isModifierCode(code: string): boolean {
  return MODIFIER_CODES.has(code)
}

export function isCadenceCode(code: string): boolean {
  if (!code) return false
  if (isModifierCode(code)) return false
  if (/^F\d{1,2}$/.test(code)) return false
  if (IGNORE_CODES.has(code)) return false
  return true
}

/** Stable 16-bit identity from a KeyboardEvent.code or pad code. */
export function identityFromCode(code: string): number {
  let h = 5381
  for (let i = 0; i < code.length; i++) {
    h = ((h << 5) + h + code.charCodeAt(i)) | 0
  }
  return ((h >>> 0) % 60000) + 1
}

export function quantizeMs(ms: number): number {
  if (!Number.isFinite(ms)) return 0
  return Math.min(65535, Math.max(0, Math.round(ms)))
}

export function strokeFromHit(
  code: string,
  deltaMs: number,
  dwellMs: number,
): Stroke | null {
  if (!isCadenceCode(code)) return null
  return {
    id: identityFromCode(code),
    deltaMs: quantizeMs(deltaMs),
    dwellMs: quantizeMs(dwellMs),
  }
}

/** Drop modifier-only noise so a Shift-only take does not count as a trail. */
export function usableStrokes(strokes: readonly Stroke[]): Stroke[] {
  return strokes.filter((s) => s.id > 0)
}

/** Little-endian triples: id, Δms, dwell ms. */
export function packCadence(strokes: readonly Stroke[]): Uint8Array {
  const bytes = new Uint8Array(strokes.length * 6)
  const view = new DataView(bytes.buffer)
  let o = 0
  for (const s of strokes) {
    view.setUint16(o, s.id & 0xffff, true)
    o += 2
    view.setUint16(o, quantizeMs(s.deltaMs), true)
    o += 2
    view.setUint16(o, quantizeMs(s.dwellMs), true)
    o += 2
  }
  return bytes
}

export function normalizeCadence(strokes: readonly Stroke[]): Uint8Array {
  const usable = usableStrokes(strokes)
  if (usable.length === 0) {
    throw new Error('empty cadence')
  }
  const packed = packCadence(usable)
  const domain = new TextEncoder().encode(CADENCE_DOMAIN)
  const out = new Uint8Array(domain.length + packed.length)
  out.set(domain, 0)
  out.set(packed, domain.length)
  return out
}

/** How uneven the gaps are — a dead-even metronome reads near zero. */
export function cadenceSpread(strokes: readonly Stroke[]): number {
  const gaps = strokes.slice(1).map((s) => s.deltaMs)
  if (gaps.length < 2) return 0
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
  let acc = 0
  for (const g of gaps) acc += (g - mean) ** 2
  return Math.sqrt(acc / gaps.length)
}

export function stroke(partial: Partial<Stroke> & Pick<Stroke, 'id'>): Stroke {
  return {
    id: partial.id,
    deltaMs: partial.deltaMs ?? 0,
    dwellMs: partial.dwellMs ?? 40,
  }
}
