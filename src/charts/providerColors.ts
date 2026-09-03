import { relativeLuminance } from './paletteMath'

/**
 * Provider identity colours — one circle per series, colour is the encoding.
 *
 * Seventeen categorical slots cannot clear strict all-pairs separation floors
 * in hue alone; that is a limit of the space, not of any particular wheel. So
 * the palette is built in OkLCh as THREE LIGHTNESS TIERS, hues ≥ 60° apart
 * within a tier and staggered between tiers, chroma maxed per hue (capped at
 * 0.20). Lightness survives colour-vision deficiency where hue collapses, so
 * the tier structure is what keeps neighbours apart.
 *
 * Tier 1 (L 0.76) holds the six providers that actually co-appear in the
 * bundled snapshot — they get the brightest slots and 60° hue spacing between
 * each other. Tier 2 (L 0.63) and tier 3 (L 0.53) cover the remaining keys,
 * which only ever meet in user-dropped snapshots.
 *
 * Enforced by providerColors.test.ts, not eyeballed: 17 distinct hexes, every
 * colour ≥ 3:1 against the #131313 canvas, min pairwise OkLab ΔE ≥ 0.10, and
 * ≥ 0.11 among the tier-1 six. For the record, the previous single-wheel
 * palette measured min pairwise ΔE 0.040 (0.059 among the six) — the
 * "colours look the same" complaint, quantified.
 */
const PROVIDER_COLORS: Readonly<Record<string, string>> = {
  // tier 1 — co-appear in the bundled snapshot
  anthropic: '#fb8d85',
  moonshot: '#dba825',
  openai: '#49d158',
  zai: '#2bc7d6',
  google: '#8db0fa',
  cursor: '#ee7ef6',
  // tier 2
  minimax: '#cb6d1a',
  nvidia: '#87921b',
  alibaba: '#209f85',
  meta: '#1e94ca',
  deepseek: '#9568f3',
  xai: '#df468f',
  // tier 3
  xiaomi: '#b34212',
  mistral: '#6e7113',
  unknown: '#177c71',
  tencent: '#1369cb',
  stealth: '#a530a4',
}

/** Ink that stays legible on a provider colour: black on the bright tiers, white on the deep one. */
export function textOnProvider(color: string): string {
  return relativeLuminance(color) > 0.17 ? '#131313' : '#ffffff'
}

function normaliseProviderKey(provider: string): string {
  const key = provider.toLowerCase().replace(/[^a-z]/g, '')
  if (key === 'moonshotai') return 'moonshot'
  if (key === 'spacexai') return 'xai'
  if (key === 'zhipu') return 'zai'
  if (key === 'qwen') return 'alibaba'
  return key
}

function hashIndex(seed: string, length: number): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return hash % length
}

const PALETTE_VALUES = Object.values(PROVIDER_COLORS)

/** Only reachable if PROVIDER_COLORS were ever emptied; keeps this file free of `!`. */
const FALLBACK_COLOR = '#177c71'

/** Deterministic provider colour for chart marks and table pills. */
export function colorForProvider(provider: string): string {
  const key = normaliseProviderKey(provider)
  return (
    PROVIDER_COLORS[key] ?? PALETTE_VALUES[hashIndex(key, PALETTE_VALUES.length)] ?? FALLBACK_COLOR
  )
}
