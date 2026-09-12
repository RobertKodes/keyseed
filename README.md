# keyseed

Type or tap a rhythm. Hash the cadence. Get a Solana-ish address out.

Live: **https://robertkodes.github.io/keyseed/**

Sibling to [tiltseed](https://github.com/RobertKodes/tiltseed) (tilt), [micseed](https://github.com/RobertKodes/micseed) (hearing), [camseed](https://github.com/RobertKodes/camseed) (light), and [drawseed](https://github.com/RobertKodes/drawseed) (ink). Cadence is the input. Not a wallet, not an explorer, not a fee/slot costume.

## Design thesis

The desk is dark so the paper tape can glow.
A typewriter ribbon — coral — marks the live key.
Ticks land as sparks on a sprocketed strip, not a dashboard chart.
The address arrives like a callsign, stamped in mono on a desk plate.
No Inter, no purple, no cards, no hero: hold, type (or tap), take a seed.

Type: **Fraunces** (desk face) + **IBM Plex Mono** (callsign). Fallbacks are Palatino / Courier New.

| token | hex | job |
| --- | --- | --- |
| `desk` | `#16130f` | dark field |
| `blotter` | `#221c16` | panel / well |
| `paper` | `#f3e6cd` | cadence tape |
| `ivory` | `#f0e4d0` | warm ink |
| `ribbon` | `#d45a3c` | the one accent |
| `spark` | `#f2c14b` | metronome flash |
| `soot` | `#8a7b66` | mute labels |

## How it works

1. **Hold** the key (pointer or touch), or just start typing. A click latches the take so two hands can work. A six-second ceiling cuts it.
2. **Desktop:** real `keydown` / `keyup`. Each hit stores the key code, the gap since the last hit (ms), and dwell. Pure modifier-only noise is ignored so Shift-alone cannot empty a take. Space, letters, numbers, and punctuation still count.
3. **Phone / no keyboard:** tap the soft home-row pad (`A S D F` / `J K L ;` / space). Same codes as the hardware keys, so the same rhythm hashes the same.
4. The trail is quantized to whole milliseconds, prefixed with a `keyseed` domain, then **SHA-256** (Web Crypto). The rhythm *is* the hash — tempo is not resampled away.
5. The 32-byte digest is **base58**-encoded (Solana alphabet). That string is 32–44 chars — a PDA-*looking* preview, not `findProgramAddress` with a program id.
6. Copy the callsign. **Again** clears the plate.

No wallet, no signing, no RPC. This is a *preview* seed from the typing. It is not a real program-derived PDA. Do not send funds to a rhythm.

## Local

```bash
npm i
npm run dev
```

The app is built at `/keyseed/` (GitHub Pages project path). Production check:

```bash
npm run build && npm run preview
```

Tests (hash + base58 + cadence stability):

```bash
npm test
```

## Pages

`vite.config.ts` sets `base: '/keyseed/'`. Push to `main` runs `.github/workflows/pages.yml`, which builds and force-pushes `dist/` (plus `.nojekyll`) to the `gh-pages` branch via `peaceiris/actions-gh-pages`.

Manual republish:

```bash
npm run pages
```

If https://robertkodes.github.io/keyseed/ 404s, flip **Settings → Pages → Deploy from a branch → `gh-pages` / `/` (root)** once. Same source as tiltseed, micseed, camseed, and drawseed.
