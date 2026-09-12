import { encodeBase58 } from './base58'
import { cadenceSpread, normalizeCadence, type Stroke } from './cadence'

export type Seed = {
  address: string
  hashHex: string
  chips: string[]
  samples: number
  spread: number
  even: boolean
}

export async function sha256Bytes(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return new Uint8Array(digest)
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function chipsFromAddress(address: string, count = 4, width = 4): string[] {
  const chips: string[] = []
  for (let i = 0; i < count; i++) {
    const slice = address.slice(i * width, i * width + width)
    if (slice) chips.push(slice)
  }
  return chips
}

export function formatCallsign(address: string): string {
  return address.match(/.{1,4}/g)?.join(' ') ?? address
}

export async function seedFromCadence(strokes: readonly Stroke[]): Promise<Seed> {
  const bytes = normalizeCadence(strokes)
  const hash = await sha256Bytes(bytes)
  const address = encodeBase58(hash)
  const spread = cadenceSpread(strokes)
  return {
    address,
    hashHex: bytesToHex(hash),
    chips: chipsFromAddress(address),
    samples: strokes.length,
    spread,
    even: spread < 12,
  }
}
