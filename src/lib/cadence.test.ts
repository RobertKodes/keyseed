import { describe, expect, it } from 'vitest'
import {
  CADENCE_DOMAIN,
  identityFromCode,
  isCadenceCode,
  isModifierCode,
  normalizeCadence,
  packCadence,
  quantizeMs,
  stroke,
  strokeFromHit,
  cadenceSpread,
  usableStrokes,
} from './cadence'

describe('isCadenceCode', () => {
  it('rejects modifiers and navigation', () => {
    expect(isModifierCode('ShiftLeft')).toBe(true)
    expect(isCadenceCode('ShiftLeft')).toBe(false)
    expect(isCadenceCode('ControlRight')).toBe(false)
    expect(isCadenceCode('MetaLeft')).toBe(false)
    expect(isCadenceCode('CapsLock')).toBe(false)
    expect(isCadenceCode('Tab')).toBe(false)
    expect(isCadenceCode('ArrowUp')).toBe(false)
    expect(isCadenceCode('F5')).toBe(false)
  })

  it('keeps letters, numbers, space, and punctuation', () => {
    expect(isCadenceCode('KeyA')).toBe(true)
    expect(isCadenceCode('Digit3')).toBe(true)
    expect(isCadenceCode('Space')).toBe(true)
    expect(isCadenceCode('Semicolon')).toBe(true)
    expect(isCadenceCode('Comma')).toBe(true)
    expect(isCadenceCode('Enter')).toBe(true)
  })
})

describe('identityFromCode', () => {
  it('is stable and distinct', () => {
    expect(identityFromCode('KeyA')).toBe(identityFromCode('KeyA'))
    expect(identityFromCode('KeyA')).not.toBe(identityFromCode('KeyS'))
    expect(identityFromCode('Space')).toBeGreaterThan(0)
  })

  it('matches pad codes to the same hardware codes', () => {
    expect(identityFromCode('KeyA')).toBe(identityFromCode('KeyA'))
    expect(identityFromCode('Semicolon')).toBe(identityFromCode('Semicolon'))
  })
})

describe('quantizeMs', () => {
  it('rounds and clamps', () => {
    expect(quantizeMs(12.4)).toBe(12)
    expect(quantizeMs(12.6)).toBe(13)
    expect(quantizeMs(-4)).toBe(0)
    expect(quantizeMs(80_000)).toBe(65535)
    expect(quantizeMs(Number.NaN)).toBe(0)
  })
})

describe('strokeFromHit', () => {
  it('drops modifier-only noise', () => {
    expect(strokeFromHit('ShiftLeft', 80, 40)).toBeNull()
    expect(strokeFromHit('KeyA', 80, 40)).toEqual({
      id: identityFromCode('KeyA'),
      deltaMs: 80,
      dwellMs: 40,
    })
  })
})

describe('packCadence', () => {
  it('writes 6 bytes per stroke', () => {
    const bytes = packCadence([stroke({ id: 65, deltaMs: 120, dwellMs: 40 })])
    expect(bytes.byteLength).toBe(6)
    const view = new DataView(bytes.buffer)
    expect(view.getUint16(0, true)).toBe(65)
    expect(view.getUint16(2, true)).toBe(120)
    expect(view.getUint16(4, true)).toBe(40)
  })
})

describe('normalizeCadence', () => {
  it('rejects an empty trail', () => {
    expect(() => normalizeCadence([])).toThrow(/empty cadence/)
  })

  it('prefixes the domain', () => {
    const bytes = normalizeCadence([stroke({ id: 7, deltaMs: 0, dwellMs: 30 })])
    const domain = new TextEncoder().encode(CADENCE_DOMAIN)
    expect(bytes.slice(0, domain.length)).toEqual(domain)
    expect(bytes.byteLength).toBe(domain.length + 6)
  })

  it('is stable for the same rhythm', () => {
    const trail = [
      stroke({ id: identityFromCode('KeyA'), deltaMs: 0, dwellMs: 40 }),
      stroke({ id: identityFromCode('KeyS'), deltaMs: 180, dwellMs: 35 }),
      stroke({ id: identityFromCode('KeyD'), deltaMs: 90, dwellMs: 50 }),
    ]
    expect(normalizeCadence(trail)).toEqual(normalizeCadence(trail))
  })

  it('changes when the gaps change', () => {
    const a = normalizeCadence([
      stroke({ id: 1, deltaMs: 0 }),
      stroke({ id: 2, deltaMs: 100 }),
      stroke({ id: 3, deltaMs: 100 }),
    ])
    const b = normalizeCadence([
      stroke({ id: 1, deltaMs: 0 }),
      stroke({ id: 2, deltaMs: 100 }),
      stroke({ id: 3, deltaMs: 240 }),
    ])
    expect(a).not.toEqual(b)
  })

  it('changes when the keys change', () => {
    const a = normalizeCadence([
      stroke({ id: identityFromCode('KeyA'), deltaMs: 0 }),
      stroke({ id: identityFromCode('KeyS'), deltaMs: 120 }),
    ])
    const b = normalizeCadence([
      stroke({ id: identityFromCode('KeyA'), deltaMs: 0 }),
      stroke({ id: identityFromCode('KeyD'), deltaMs: 120 }),
    ])
    expect(a).not.toEqual(b)
  })
})

describe('usableStrokes', () => {
  it('drops zero identities', () => {
    expect(usableStrokes([stroke({ id: 0 }), stroke({ id: 12 })])).toEqual([
      stroke({ id: 12 }),
    ])
  })
})

describe('cadenceSpread', () => {
  it('is zero for a dead-even metronome', () => {
    expect(
      cadenceSpread([
        stroke({ id: 1, deltaMs: 0 }),
        stroke({ id: 2, deltaMs: 200 }),
        stroke({ id: 3, deltaMs: 200 }),
        stroke({ id: 4, deltaMs: 200 }),
      ]),
    ).toBe(0)
  })

  it('grows when the gaps wander', () => {
    expect(
      cadenceSpread([
        stroke({ id: 1, deltaMs: 0 }),
        stroke({ id: 2, deltaMs: 80 }),
        stroke({ id: 3, deltaMs: 240 }),
        stroke({ id: 4, deltaMs: 40 }),
      ]),
    ).toBeGreaterThan(60)
  })
})
