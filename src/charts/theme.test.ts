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

/** Read the dark `:root` block of tokens.css (before the light `@media` override). */
function darkRootBlock(): string {
  const mediaIndex = tokensText.indexOf('@media')
  return mediaIndex === -1 ? tokensText : tokensText.slice(0, mediaIndex)
}

/** Extract a `--token: #hex;` value from a CSS block. */
function tokenValue(block: string, name: string): string | undefined {
  const re = new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{3,6})`)
  const match = block.match(re)
  return match?.[1]
}

describe('CHART_THEME — tokens.css agreement', () => {
  const root = darkRootBlock()

  test('1 — every series hex in CHART_THEME matches the dark --series-N token', () => {
    for (let i = 0; i < CHART_THEME.series.length; i += 1) {
      const token = tokenValue(root, `series-${i + 1}`)
      expect(token, `--series-${i + 1} should be defined in tokens.css`).toBeDefined()
      expect(CHART_THEME.series[i]).toBe(token)
    }
  })

  test('2 — ink and border tokens agree with tokens.css', () => {
    expect(CHART_THEME.textPrimary).toBe(tokenValue(root, 'text-primary'))
    expect(CHART_THEME.textSecondary).toBe(tokenValue(root, 'text-secondary'))
    expect(CHART_THEME.textMuted).toBe(tokenValue(root, 'text-muted'))
    expect(CHART_THEME.border).toBe(tokenValue(root, 'border'))
  })

  test('3 — CHART_THEME has exactly 8 series slots', () => {
    expect(CHART_THEME.series).toHaveLength(8)
  })
})
