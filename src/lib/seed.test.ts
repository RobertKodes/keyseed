import { describe, expect, it } from 'vitest'
import { identityFromCode, stroke } from './cadence'
import { chipsFromAddress, formatCallsign, seedFromCadence } from './seed'

function tap(code: string, deltaMs: number, dwellMs = 40) {
  return stroke({ id: identityFromCode(code), deltaMs, dwellMs })
}

describe('seedFromCadence', () => {
  it('hashes the same trail to the same callsign', async () => {
    const trail = [tap('KeyA', 0), tap('KeyS', 160), tap('Space', 90)]
    const once = await seedFromCadence(trail)
    const twice = await seedFromCadence(trail)
    expect(once.address).toBe(twice.address)
    expect(once.hashHex).toBe(twice.hashHex)
    expect(once.address.length).toBeGreaterThanOrEqual(32)
    expect(once.address.length).toBeLessThanOrEqual(44)
    expect(once.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/)
    expect(once.chips).toEqual(chipsFromAddress(once.address))
    expect(once.samples).toBe(3)
  })

  it('changes when the rhythm changes', async () => {
    const a = await seedFromCadence([tap('KeyA', 0), tap('KeyS', 100), tap('KeyD', 100)])
    const b = await seedFromCadence([tap('KeyA', 0), tap('KeyS', 100), tap('KeyD', 280)])
    expect(a.address).not.toBe(b.address)
  })

  it('changes when the keys change', async () => {
    const a = await seedFromCadence([tap('KeyA', 0), tap('KeyS', 120), tap('KeyD', 80)])
    const b = await seedFromCadence([tap('KeyA', 0), tap('KeyF', 120), tap('KeyD', 80)])
    expect(a.address).not.toBe(b.address)
  })

  it('marks an even metronome', async () => {
    const seed = await seedFromCadence([
      tap('KeyA', 0),
      tap('KeyS', 200),
      tap('KeyD', 200),
      tap('KeyF', 200),
    ])
    expect(seed.even).toBe(true)
    expect(seed.spread).toBe(0)
  })

  it('groups the callsign for the plate', async () => {
    const seed = await seedFromCadence([tap('KeyA', 0)])
    expect(formatCallsign(seed.address).includes(' ')).toBe(true)
  })

  it('locks a known three-tap vector', async () => {
    const seed = await seedFromCadence([tap('KeyA', 0, 40), tap('KeyS', 160, 35), tap('Space', 90, 50)])
    expect(seed.hashHex).toBe(
      'fe958902762b79a796043b14122188e7f40be5fa4b99534e78575abd70949456',
    )
  })
})
