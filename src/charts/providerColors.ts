import type { ChartTheme } from './theme'

/**
 * Provider keys normalised for palette lookup (opencode-aligned).
 *
 * Re-stepped from the original set, which measured worst all-pairs CVD ΔE 0.4
 * and normal-vision ΔE 2.3 (validate_palette.js, dark, --pairs all) — several
 * slots also read as grey (chroma below floor) or sat outside the dark
 * lightness band. At 17 categorical slots on an all-pairs form (this scatter),
 * no hue ordering clears the CVD/normal-vision separation floors — that is a
 * mathematical limit of carrying 17 identities in hue alone, not a fixable
 * palette-choice problem. Every hex below clears chroma floor, the dark
 * lightness band and contrast vs `--surface-1`; CVD and normal-vision
 * separation are expected to still fail at this count. `PROVIDER_SYMBOLS`
 * below is the secondary encoding that makes that legal: shape carries
 * identity where colour alone cannot (see
 * docs/forge/model-picker/plan-redesign.md D4).
 */
const PROVIDER_COLORS: Readonly<Record<string, string>> = {
  anthropic: '#d7397b',
  openai: '#de3a48',
  google: '#db4600',
  deepseek: '#ce5a00',
  zai: '#b67000',
  moonshot: '#938300',
  minimax: '#5f9300',
  alibaba: '#009e2d',
  xai: '#00a36c',
  nvidia: '#00a19c',
  xiaomi: '#009ac4',
  tencent: '#008ee2',
  meta: '#007ef3',
  mistral: '#636df4',
  cursor: '#8f5de7',
  stealth: '#af4fcc',
  unknown: '#c742a7',
}

/**
 * ECharts symbol per provider — distinct shape as secondary identity.
 *
 * Only 9 of ECharts' built-in symbol names are used, not the full built-in
 * vocabulary: rendered and inspected pixel-by-pixel at actual legend/marker
 * size (Chrome, this app's ECharts version), `pin` and `arrow` both collapse
 * to a plain circle — `pin`'s point and `arrow`'s head are too fine to survive
 * at 12–16px, so a provider assigned `pin` becomes visually indistinguishable
 * from a genuine `circle` provider, silently defeating the whole point of a
 * shape encoding. `circle`, `triangle`, `diamond`, `rect` and `roundRect` were
 * each confirmed distinct at this size (`roundRect`'s corner radius reads
 * clearly next to `rect`'s sharp one); their hollow `empty*` counterparts
 * share the same path geometry so are trusted by construction.
 *
 * 9 shapes for 17 providers means 8 of them are reused once each (one shape —
 * `circle`, anthropic's — is left unique). Which key reuses which shape was
 * picked by exhaustive search over every valid pairing (never two providers
 * that can appear together in the bundled dataset, i.e. anthropic/cursor/
 * google/moonshot/openai/zai never share a shape with each other), maximising
 * the worst-case colour separation of every resulting pair: the search found
 * an assignment where every reused shape's pair clears the *target* CVD ΔE of
 * 8 (worst is 15.8, deepseek↔nvidia's shared `rect`) and the normal-vision
 * floor of 15 (worst is 26.6) — comfortably apart even before shape is
 * considered. Cursor and Google in particular are both shape-distinct
 * (emptyDiamond vs diamond — hollow vs filled) and colour-distant (ΔE 30.3
 * CVD / 30.7 normal) — they no longer read as "the same blue".
 */
const PROVIDER_SYMBOLS: Readonly<Record<string, string>> = {
  anthropic: 'circle',
  openai: 'triangle',
  google: 'diamond',
  deepseek: 'rect',
  zai: 'roundRect',
  moonshot: 'emptyCircle',
  minimax: 'emptyTriangle',
  alibaba: 'emptyDiamond',
  xai: 'emptyRect',
  nvidia: 'rect',
  xiaomi: 'triangle',
  tencent: 'diamond',
  meta: 'roundRect',
  mistral: 'emptyCircle',
  cursor: 'emptyDiamond',
  stealth: 'emptyRect',
  unknown: 'emptyTriangle',
}

/** The trusted shape vocabulary, for the hash fallback below (unmapped providers). */
const SYMBOLS: readonly string[] = [
  'circle',
  'triangle',
  'diamond',
  'rect',
  'roundRect',
  'emptyCircle',
  'emptyTriangle',
  'emptyDiamond',
  'emptyRect',
]

/** Hollow symbols carry colour only in their stroke — no fill to key off. */
export function isHollowSymbol(symbol: string): boolean {
  return symbol.startsWith('empty')
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

function hashColor(seed: string, theme: ChartTheme): string {
  const slot = hashIndex(seed, theme.series.length)
  return theme.series[slot] ?? theme.series[0]!
}

function hashSymbol(seed: string): string {
  return SYMBOLS[hashIndex(seed, SYMBOLS.length)]!
}

/** Deterministic provider colour for charts and the data table. */
export function colorForProvider(provider: string, theme: ChartTheme): string {
  const key = normaliseProviderKey(provider)
  return PROVIDER_COLORS[key] ?? hashColor(key, theme)
}

/** Deterministic provider ECharts symbol — shape half of the identity encoding. */
export function symbolForProvider(provider: string): string {
  const key = normaliseProviderKey(provider)
  return PROVIDER_SYMBOLS[key] ?? hashSymbol(key)
}
