import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import {
  excludedSlugs,
  isTokenRateEligible,
  parseCursorTokenRate,
  unmatchedExclusions,
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

function section(body: string): string {
  return `# Models\n\n## Teams\n\nText.\n\n## Cursor Token Rate\n\n${body}\n\n## Auto modes\n\n- Not an exclusion\n`
}

const RATE_SENTENCE =
  'On Teams and Enterprise plans, eligible third-party model requests include a Cursor Token Rate of $0.25 per million tokens.'
const EXCLUSION_INTRO = 'These models are excluded from the Cursor Token Rate:'

describe('parseCursorTokenRate', () => {
  test('1 — the fixture page yields the rate and all 15 exclusions', async () => {
    const markdown = await loadFixture('cursor-models.fixture.md')

    const rate = parseCursorTokenRate(markdown)

    expect(rate.usdPerMillionTokens).toBe(0.25)
    expect(rate.excludedModels).toHaveLength(15)
    expect(rate.excludedModels).toContain('GPT-5.6 Luna')
    expect(rate.excludedModels).toContain('Gemini 3.8 Flash')
  })

  test('2 — a missing section throws', () => {
    expectCursorMarkdownError(
      () => parseCursorTokenRate('# Models\n\n## Auto modes\n'),
      /Cursor Token Rate" section not found/,
    )
  })

  test('3 — a section without a readable amount throws', () => {
    const markdown = section(
      `Cursor charges a token rate on some models.\n\n${EXCLUSION_INTRO}\n\n- GPT-5 Mini`,
    )

    expectCursorMarkdownError(() => parseCursorTokenRate(markdown), /amount not found/)
  })

  test('4 — a section without the exclusion sentence throws rather than excluding nothing', () => {
    const markdown = section(`${RATE_SENTENCE}\n\n- GPT-5 Mini`)

    expectCursorMarkdownError(() => parseCursorTokenRate(markdown), /exclusion list not found/)
  })

  test('5 — an exclusion sentence with no bullets throws', () => {
    const markdown = section(`${RATE_SENTENCE}\n\n${EXCLUSION_INTRO}\n\nNone at the moment.`)

    expectCursorMarkdownError(() => parseCursorTokenRate(markdown), /exclusion list is empty/)
  })

  test('6 — linked names are stripped to their text', () => {
    const markdown = section(
      `${RATE_SENTENCE}\n\n${EXCLUSION_INTRO}\n\n- [GPT-5 Mini](https://openai.com)\n- Gemini 3 Flash`,
    )

    expect(parseCursorTokenRate(markdown).excludedModels).toEqual(['GPT-5 Mini', 'Gemini 3 Flash'])
  })

  test('7 — the list ends at the first non-bullet line, and never runs into the next section', () => {
    const markdown = section(
      `${RATE_SENTENCE}\n\n${EXCLUSION_INTRO}\n\n- GPT-5 Mini\n\nLater prose.\n\n- Not listed`,
    )

    expect(parseCursorTokenRate(markdown).excludedModels).toEqual(['GPT-5 Mini'])
  })

  test('7b — a loose list, with blank lines between bullets, reads in full', () => {
    const markdown = section(
      `${RATE_SENTENCE}\n\n${EXCLUSION_INTRO}\n\n- GPT-5 Mini\n\n- GPT-5.4 Nano\n\n- GPT-5.6 Luna`,
    )

    expect(parseCursorTokenRate(markdown).excludedModels).toEqual([
      'GPT-5 Mini',
      'GPT-5.4 Nano',
      'GPT-5.6 Luna',
    ])
  })

  test('8 — a rate sentence re-wrapped across lines still reads', () => {
    const markdown = section(
      `Requests include a Cursor Token Rate of $0.3 per\nmillion tokens.\n\n${EXCLUSION_INTRO}\n\n- GPT-5 Mini`,
    )

    expect(parseCursorTokenRate(markdown).usdPerMillionTokens).toBe(0.3)
  })
})

describe('eligibility', () => {
  const rate = { usdPerMillionTokens: 0.25, excludedModels: ['GPT-5 Mini', 'GPT-4o Mini'] }
  const excluded = excludedSlugs(rate)

  test('9 — a third-party model not on the list pays the rate', () => {
    expect(
      isTokenRateEligible({ provider: 'Anthropic', cursorSlug: 'claude-sonnet-5' }, excluded),
    ).toBe(true)
  })

  test('10 — Cursor first-party models never pay it', () => {
    expect(isTokenRateEligible({ provider: 'Cursor', cursorSlug: 'grok-4-6' }, excluded)).toBe(
      false,
    )
  })

  test('11 — a listed model is exempt, matched by slug so case and punctuation drift still match', () => {
    expect(isTokenRateEligible({ provider: 'OpenAI', cursorSlug: 'gpt-5-mini' }, excluded)).toBe(
      false,
    )
    expect(excludedSlugs({ usdPerMillionTokens: 0.25, excludedModels: ['gpt 5  MINI'] })).toEqual(
      new Set(['gpt-5-mini']),
    )
  })

  test('12 — exclusions with no catalogue row are reported, matched ones are not', () => {
    expect(unmatchedExclusions(rate, new Set(['gpt-5-mini', 'claude-sonnet-5']))).toEqual([
      'GPT-4o Mini',
    ])
  })
})
