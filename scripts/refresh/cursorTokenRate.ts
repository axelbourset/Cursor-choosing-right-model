import type { CursorTokenRate } from '@schema/snapshot'
import { CursorMarkdownError, stripModelLink } from './parseCursorMarkdown'
import { deriveCursorSlug } from './slug'

/** Cursor's own models never pay the rate ("Cursor models, including Grok and Composer").
 *  The catalogue lists all of them under this provider. */
export const CURSOR_FIRST_PARTY_PROVIDER = 'Cursor'

const SECTION_HEADING = '## Cursor Token Rate'
// Whitespace-tolerant, so a paragraph re-wrapped across lines still matches.
const RATE_PATTERN = /Cursor\s+Token\s+Rate\s+of\s+\$(\d+(?:\.\d+)?)\s+per\s+million\s+tokens/
const EXCLUSION_INTRO_PATTERN = /excluded from the Cursor Token Rate/i
const BULLET_PATTERN = /^[-*]\s+(.+)$/

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

/** The bullet block after the "excluded from" sentence. Blank lines are skipped, so a loose
 *  list (bullets separated by blank lines) still reads in full; the first prose line ends it.
 *  Stopping at a blank line instead would silently drop every exclusion after the first. */
function readExclusions(section: readonly string[]): readonly string[] {
  const intro = section.findIndex((line) => EXCLUSION_INTRO_PATTERN.test(line))
  if (intro === -1) {
    throw new CursorMarkdownError(
      'Cursor Token Rate exclusion list not found — the section wording looks changed',
    )
  }

  const names: string[] = []
  for (const line of section.slice(intro + 1)) {
    const text = line.trim()
    if (text === '') {
      continue
    }
    const bullet = BULLET_PATTERN.exec(text)?.[1]
    if (bullet === undefined) {
      break
    }
    names.push(stripModelLink(bullet.trim()))
  }
  return names
}

/** PURE. No network, no fs. Reads the rate and its exclusion list from the same
 *  `models-and-pricing.md` document `parseCursorMarkdown` reads the catalogue from.
 *
 *  Every miss throws. There is deliberately no fallback to an empty exclusion list: a
 *  reworded sentence would then mark every third-party model eligible and silently add the
 *  rate to prices Cursor does not surcharge. */
export function parseCursorTokenRate(markdown: string): CursorTokenRate {
  const section = readSection(markdown)

  const amount = RATE_PATTERN.exec(section.join('\n'))?.[1]
  if (amount === undefined) {
    throw new CursorMarkdownError(
      'Cursor Token Rate amount not found — the section wording looks changed',
    )
  }

  const excludedModels = readExclusions(section)
  if (excludedModels.length === 0) {
    throw new CursorMarkdownError(
      'Cursor Token Rate exclusion list is empty — the list format looks changed',
    )
  }

  return { usdPerMillionTokens: Number(amount), excludedModels: [...excludedModels] }
}

/** Exclusion names compared by slug, so case and punctuation drift between the list and the
 *  pricing table still match. */
export function excludedSlugs(rate: CursorTokenRate): ReadonlySet<string> {
  return new Set(rate.excludedModels.map(deriveCursorSlug))
}

/** PURE. Whether Cursor adds its Token Rate to this model's list prices. */
export function isTokenRateEligible(
  model: { readonly provider: string; readonly cursorSlug: string },
  excluded: ReadonlySet<string>,
): boolean {
  return model.provider !== CURSOR_FIRST_PARTY_PROVIDER && !excluded.has(model.cursorSlug)
}

/** PURE. Exclusion names with no catalogue row. Informational: Cursor lists models it no
 *  longer prices, so these are expected — but a name drifting away from the table would
 *  also land here, and its model would then wrongly pay the rate. */
export function unmatchedExclusions(
  rate: CursorTokenRate,
  catalogueSlugs: ReadonlySet<string>,
): readonly string[] {
  return rate.excludedModels.filter((name) => !catalogueSlugs.has(deriveCursorSlug(name)))
}
