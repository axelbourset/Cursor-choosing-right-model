import type { ChartTheme } from './theme'

/** Provider keys normalised for palette lookup (opencode-aligned). */
const PROVIDER_COLORS: Readonly<Record<string, string>> = {
  anthropic: '#e07a5f',
  openai: '#10a37f',
  google: '#4285f4',
  deepseek: '#38bdf8',
  zai: '#a855f7',
  moonshot: '#f43f5e',
  minimax: '#eab308',
  alibaba: '#ff8c1a',
  xai: '#e5e7eb',
  nvidia: '#76b900',
  xiaomi: '#84cc16',
  tencent: '#2dd4bf',
  meta: '#94a3b8',
  mistral: '#fb7185',
  cursor: '#3987e5',
  stealth: '#64748b',
  unknown: '#6e7681',
}

function normaliseProviderKey(provider: string): string {
  const key = provider.toLowerCase().replace(/[^a-z]/g, '')
  if (key === 'moonshotai') return 'moonshot'
  if (key === 'spacexai') return 'xai'
  if (key === 'zhipu') return 'zai'
  if (key === 'qwen') return 'alibaba'
  return key
}

function hashColor(seed: string, theme: ChartTheme): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  const slot = hash % theme.series.length
  return theme.series[slot] ?? theme.series[0]!
}

/** Deterministic provider colour for charts and the data table. */
export function colorForProvider(provider: string, theme: ChartTheme): string {
  const key = normaliseProviderKey(provider)
  return PROVIDER_COLORS[key] ?? hashColor(key, theme)
}
