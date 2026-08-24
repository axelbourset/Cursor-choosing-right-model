import { describe, expect, test } from 'vitest'
import { CHART_THEME } from './theme'

// The app tsconfig has no node types, so the node imports are suppressed. Vitest
// runs in node and `resolve('src/tokens.css')` resolves from `process.cwd()`
// (the repo root), which is stable for this repo's test invocation.
// @ts-expect-error -- node types not included in app tsconfig; vitest runs in node
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node types not included in app tsconfig; vitest runs in node
import { resolve } from 'node:path'

const tokensText = readFileSync(resolve('src/tokens.css'), 'utf-8')

/** Extract a `--token: #hex;` value from tokens.css. */
function tokenValue(name: string): string | undefined {
  const re = new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{3,6})`)
  const match = tokensText.match(re)
  return match?.[1]
}

describe('CHART_THEME — tokens.css agreement', () => {
  test('1 — canvas, ink, hairline and hazard colours agree with tokens.css', () => {
    expect(CHART_THEME.canvas).toBe(tokenValue('canvas'))
    expect(CHART_THEME.textPrimary).toBe(tokenValue('ink'))
    expect(CHART_THEME.textSecondary).toBe(tokenValue('ink-soft'))
    expect(CHART_THEME.textMuted).toBe(tokenValue('ink-meta'))
    expect(CHART_THEME.border).toBe(tokenValue('frame'))
    expect(CHART_THEME.mint).toBe(tokenValue('mint'))
    expect(CHART_THEME.ultraviolet).toBe(tokenValue('ultraviolet'))
  })

  test('2 — the theme owns no series palette: provider colours live in providerColors', () => {
    expect('series' in CHART_THEME).toBe(false)
  })
})
