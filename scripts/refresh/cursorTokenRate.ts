import type { CursorTokenRate, ModelRow } from '@schema/snapshot'
import { CursorMarkdownError } from './parseCursorMarkdown'

/** Cursor's own models never pay the rate ("Cursor models, including Grok and Composer").
 *  The catalogue lists all of them under this provider. */
export const CURSOR_FIRST_PARTY_PROVIDER = 'Cursor'

const SECTION_HEADING = '## Cursor Token Rate'
// Whitespace-tolerant, so a paragraph re-wrapped across lines still matches.
const RATE_PATTERN = /Cursor\s+Token\s+Rate\s+of\s+\$(\d+(?:\.\d+)?)\s+per\s+million\s+tokens/
// "does not apply" and "strictly below" are both required word for word: a sentence that
// flips either one would parse to the same number with the opposite meaning, so it must throw.
const EXEMPTION_PATTERN =
  /does\s+not\s+apply\s+to\s+third-party\s+models\s+whose\s+cache-read\s+price\s+is\s+strictly\s+below\s+\$(\d+(?:\.\d+)?)\s+per\s+million\s+tokens/

/** The lines between the section heading and the next level-2 heading. */
function readSection(markdown: string): readonly string[] {
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === SECTION_HEADING)
  if (start === -1) {
    throw new CursorMarkdownError(`"${SECTION_HEADING}" section not found`)
  }
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith('## '))
  return end === -1 ? rest : rest.slice(0, end)
}

/** PURE. No network, no fs. Reads the rate and its cache-read exemption threshold from the
 *  same `models-and-pricing.md` document `parseCursorMarkdown` reads the catalogue from.
 *
 *  Every miss throws. There is deliberately no default threshold: a reworded sentence would
 *  then exempt nothing or everything, silently adding the rate to prices Cursor does not
 *  surcharge or dropping it from prices it does. */
export function parseCursorTokenRate(markdown: string): CursorTokenRate {
  const section = readSection(markdown).join('\n')

  const amount = RATE_PATTERN.exec(section)?.[1]
  if (amount === undefined) {
    throw new CursorMarkdownError(
      'Cursor Token Rate amount not found — the section wording looks changed',
    )
  }

  const threshold = EXEMPTION_PATTERN.exec(section)?.[1]
  if (threshold === undefined) {
    throw new CursorMarkdownError(
      'Cursor Token Rate cache-read exemption not found — the section wording looks changed',
    )
  }

  return {
    usdPerMillionTokens: Number(amount),
    exemptCacheReadBelowUsdPerMillionTokens: Number(threshold),
  }
}

/** PURE. Whether Cursor adds its Token Rate to this model's list prices. Cursor's own models
 *  never pay it. A third-party model is exempt only when its cache-read price is strictly
 *  below the threshold; the listed price stands in for every pricing tier. A missing price
 *  cannot prove the exemption, so the model pays, and `thirdPartyWithoutCacheRead` names it
 *  for a warning. */
export function isTokenRateEligible(
  model: Pick<ModelRow, 'provider' | 'priceCacheRead'>,
  rate: Pick<CursorTokenRate, 'exemptCacheReadBelowUsdPerMillionTokens'>,
): boolean {
  if (model.provider === CURSOR_FIRST_PARTY_PROVIDER) {
    return false
  }
  return (
    model.priceCacheRead === null ||
    model.priceCacheRead >= rate.exemptCacheReadBelowUsdPerMillionTokens
  )
}

/** PURE. Third-party models with no cache-read price. `isTokenRateEligible` counts them as
 *  paying the rate, which may overstate their price, so the refresh warns about each. */
export function thirdPartyWithoutCacheRead(
  models: readonly Pick<ModelRow, 'cursorName' | 'provider' | 'priceCacheRead'>[],
): readonly string[] {
  return models
    .filter((row) => row.provider !== CURSOR_FIRST_PARTY_PROVIDER && row.priceCacheRead === null)
    .map((row) => row.cursorName)
}
