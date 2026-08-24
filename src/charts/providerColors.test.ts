import { describe, expect, test } from 'vitest'
import { colorForProvider, textOnProvider } from './providerColors'
import { contrastRatio, oklabDistance } from './paletteMath'

/** The palette's own contract — measured, not eyeballed. */
const CANVAS = '#131313'
const MIN_PAIRWISE_DE = 0.1
const MIN_TIER1_DE = 0.11
const MIN_CONTRAST = 3

/** The six providers that co-appear in the bundled snapshot — tier 1. */
const CO_APPEARING = ['anthropic', 'moonshot', 'openai', 'zai', 'google', 'cursor'] as const

const KNOWN = [
  'anthropic',
  'moonshot',
  'openai',
  'zai',
  'google',
  'cursor',
  'minimax',
  'nvidia',
  'alibaba',
  'meta',
  'deepseek',
  'xai',
  'xiaomi',
  'mistral',
  'unknown',
  'tencent',
  'stealth',
] as const

const colors = KNOWN.map((key) => colorForProvider(key))

describe('provider palette', () => {
  test('1 — seventeen known providers, all distinct hexes', () => {
    expect(colors).toHaveLength(17)
    expect(new Set(colors).size).toBe(17)
  })

  test(`2 — min pairwise OkLab ΔE ≥ ${MIN_PAIRWISE_DE} (the old single-wheel palette measured 0.040)`, () => {
    let worst = Infinity
    for (let i = 0; i < colors.length; i += 1) {
      for (let j = i + 1; j < colors.length; j += 1) {
        worst = Math.min(worst, oklabDistance(colors[i]!, colors[j]!))
      }
    }
    expect(worst).toBeGreaterThanOrEqual(MIN_PAIRWISE_DE)
  })

  test(`3 — the co-appearing six clear ${MIN_TIER1_DE} pairwise (they are what actually renders together)`, () => {
    const six = CO_APPEARING.map((key) => colorForProvider(key))
    let worst = Infinity
    for (let i = 0; i < six.length; i += 1) {
      for (let j = i + 1; j < six.length; j += 1) {
        worst = Math.min(worst, oklabDistance(six[i]!, six[j]!))
      }
    }
    expect(worst).toBeGreaterThanOrEqual(MIN_TIER1_DE)
  })

  test(`4 — every colour holds ≥ ${MIN_CONTRAST}:1 against the canvas`, () => {
    for (const color of colors) {
      expect(contrastRatio(color, CANVAS)).toBeGreaterThanOrEqual(MIN_CONTRAST)
    }
  })

  test('5 — pill ink follows the tier: black on bright slots, white on deep ones', () => {
    // tier 1 and 2 are bright → black ink; tier 3 is deep → white ink
    expect(textOnProvider(colorForProvider('anthropic'))).toBe('#131313')
    expect(textOnProvider(colorForProvider('deepseek'))).toBe('#131313')
    expect(textOnProvider(colorForProvider('tencent'))).toBe('#ffffff')
    expect(textOnProvider(colorForProvider('stealth'))).toBe('#ffffff')
  })

  test('6 — provider key normalisation resolves the known aliases', () => {
    expect(colorForProvider('Moonshot AI')).toBe(colorForProvider('moonshot'))
    expect(colorForProvider('Zhipu')).toBe(colorForProvider('zai'))
    expect(colorForProvider('Qwen')).toBe(colorForProvider('alibaba'))
    expect(colorForProvider('SpaceX AI')).toBe(colorForProvider('xai'))
    // display-case provider strings resolve like lowercase ones
    expect(colorForProvider('Anthropic')).toBe(colorForProvider('anthropic'))
  })

  test('7 — unmapped providers hash into the palette deterministically', () => {
    expect(colorForProvider('brand-new-lab')).toBe(colorForProvider('brand-new-lab'))
    expect(colors).toContain(colorForProvider('brand-new-lab'))
  })
})
