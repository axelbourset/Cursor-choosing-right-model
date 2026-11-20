import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import {
  isTokenRateEligible,
  parseCursorTokenRate,
  thirdPartyWithoutCacheRead,
} from './cursorTokenRate'
import { CursorMarkdownError } from './parseCursorMarkdown'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures')

async function loadFixture(name: string): Promise<string> {
  return readFile(path.join(fixturesDir, name), 'utf-8')
}

function expectCursorMarkdownError(fn: () => unknown, pattern: RegExp) {
  expect(() => fn()).toThrow(CursorMarkdownError)
  expect(() => fn()).toThrow(pattern)
}

// The next section repeats the exemption sentence with another amount, so a parser that reads
// past the end of the Token Rate section would pick it up.
function section(body: string): string {
  return `# Models\n\n## Teams\n\nText.\n\n## Cursor Token Rate\n\n${body}\n\n## Auto modes\n\nA decoy: the Cursor Token Rate does not apply to third-party models whose cache-read price is strictly below $9 per million tokens.\n`
}

const RATE_SENTENCE =
  'On Teams and Enterprise plans, eligible third-party model requests include a Cursor Token Rate of $0.25 per million tokens.'
const EXEMPTION_SENTENCE =
  'The Cursor Token Rate also does not apply to third-party models whose cache-read price is strictly below $0.10 per million tokens across every pricing tier.'

describe('parseCursorTokenRate', () => {
  test('1 — the fixture page yields the rate and the cache-read exemption threshold', async () => {
    const markdown = await loadFixture('cursor-models.fixture.md')

    expect(parseCursorTokenRate(markdown)).toEqual({
      usdPerMillionTokens: 0.25,
      exemptCacheReadBelowUsdPerMillionTokens: 0.1,
    })
  })

  test('2 — a missing section throws', () => {
    expectCursorMarkdownError(
      () => parseCursorTokenRate('# Models\n\n## Auto modes\n'),
      /Cursor Token Rate" section not found/,
    )
  })

  test('3 — a section without a readable amount throws', () => {
    const markdown = section(`Cursor charges a token rate on some models.\n\n${EXEMPTION_SENTENCE}`)

    expectCursorMarkdownError(() => parseCursorTokenRate(markdown), /amount not found/)
  })

  test('4 — a section without the exemption sentence throws, and the next section is not read', () => {
    const markdown = section(RATE_SENTENCE)

    expectCursorMarkdownError(
      () => parseCursorTokenRate(markdown),
      /cache-read exemption not found/,
    )
  })

  test('5 — an "at or below" boundary throws rather than reading the same number', () => {
    const markdown = section(
      `${RATE_SENTENCE}\n\nThe Cursor Token Rate also does not apply to third-party models whose cache-read price is at or below $0.10 per million tokens.`,
    )

    expectCursorMarkdownError(
      () => parseCursorTokenRate(markdown),
      /cache-read exemption not found/,
    )
  })

  test('6 — a sentence with the opposite polarity throws rather than inverting every flag', () => {
    // Differs from the live sentence only by the missing "not", so it fails only if the
    // pattern requires the negation itself.
    const markdown = section(
      `${RATE_SENTENCE}\n\nThe Cursor Token Rate also does apply to third-party models whose cache-read price is strictly below $0.10 per million tokens.`,
    )

    expectCursorMarkdownError(
      () => parseCursorTokenRate(markdown),
      /cache-read exemption not found/,
    )
  })

  test('7 — an exemption sentence re-wrapped across lines still reads', () => {
    const markdown = section(
      `${RATE_SENTENCE}\n\nThe rate also does not apply to third-party models whose cache-read\nprice is strictly below $0.2 per\nmillion tokens.`,
    )

    expect(parseCursorTokenRate(markdown).exemptCacheReadBelowUsdPerMillionTokens).toBe(0.2)
  })

  test('8 — a rate sentence re-wrapped across lines still reads', () => {
    const markdown = section(
      `Requests include a Cursor Token Rate of $0.3 per\nmillion tokens.\n\n${EXEMPTION_SENTENCE}`,
    )

    expect(parseCursorTokenRate(markdown).usdPerMillionTokens).toBe(0.3)
  })
})

describe('eligibility', () => {
  const rate = { exemptCacheReadBelowUsdPerMillionTokens: 0.1 }

  test('9 — a third-party model above the threshold pays the rate', () => {
    expect(isTokenRateEligible({ provider: 'Anthropic', priceCacheRead: 0.3 }, rate)).toBe(true)
  })

  test('10 — a third-party model exactly at the threshold pays it, the exemption is strict', () => {
    expect(isTokenRateEligible({ provider: 'Anthropic', priceCacheRead: 0.1 }, rate)).toBe(true)
  })

  test('11 — a third-party model below the threshold is exempt', () => {
    expect(isTokenRateEligible({ provider: 'Google', priceCacheRead: 0.075 }, rate)).toBe(false)
    expect(isTokenRateEligible({ provider: 'DeepSeek', priceCacheRead: 0.006 }, rate)).toBe(false)
  })

  test('12 — Cursor first-party models never pay it, whatever their cache-read price', () => {
    expect(isTokenRateEligible({ provider: 'Cursor', priceCacheRead: 1 }, rate)).toBe(false)
    expect(isTokenRateEligible({ provider: 'Cursor', priceCacheRead: null }, rate)).toBe(false)
  })

  test('13 — a third-party model with no cache-read price pays it, the exemption is unproven', () => {
    expect(isTokenRateEligible({ provider: 'OpenAI', priceCacheRead: null }, rate)).toBe(true)
  })

  test('14 — third-party models with no cache-read price are named for a warning, Cursor ones are not', () => {
    expect(
      thirdPartyWithoutCacheRead([
        { cursorName: 'Odd Model', provider: 'OpenAI', priceCacheRead: null },
        { cursorName: 'Priced', provider: 'OpenAI', priceCacheRead: 0.3 },
        { cursorName: 'Grok 4.6', provider: 'Cursor', priceCacheRead: null },
      ]),
    ).toEqual(['Odd Model'])
  })
})
