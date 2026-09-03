import type { AaModel } from './fetchArtificialAnalysis'

export type AutoResolution =
  | {
      readonly kind: 'resolved'
      readonly aaSlug: string
      readonly aaName: string
      readonly note: string
    }
  | { readonly kind: 'declined'; readonly reason: string }

/** The closed set of effort/variant suffixes AA appends to a family's base slug.
 *  Documented in evidence/data-sources.md. A bare prefix match is NOT permitted: it was
 *  caught mapping `GPT-5` to `gpt-5-6-sol` (60.9) instead of `gpt-5` (35.3), and
 *  `Claude 4 Sonnet` to `claude-sonnet-4-6-adaptive` (48.4) instead of
 *  `claude-4-sonnet-thinking` (29.8). Membership here is exact, per dash-delimited tail. */
const EFFORT_SUFFIXES = [
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'minimal',
  'thinking',
  'reasoning',
  'adaptive',
  'non-reasoning',
  'effort',
  'preview',
] as const

/** Suffixes Cursor appends for its own packaging — a different serving tier or context
 *  window over the SAME underlying model, which AA benchmarks once.
 *
 *  Stripping is deliberately single-level: candidates are derived from the original slug
 *  only, so `foo-fast-1m` yields `foo-fast` but never `foo`. No current model needs more. */
const CURSOR_PACKAGING_SUFFIXES = ['fast-mode', 'fast', '1m'] as const

/** Cursor writes "Claude 4.5 Opus"; Anthropic and AA write "Claude Opus 4.5". The tier word
 *  and the version number swap places. Returns the other word order, or null. */
function swapClaudeTier(slug: string): string | null {
  // Capture groups are `string | undefined` under noUncheckedIndexedAccess. Destructuring
  // and checking keeps a future edit to these patterns from interpolating `undefined` into
  // the join key for the entire mapping.
  const versionFirst = /^claude-([\d-]+?)-(opus|sonnet|haiku)$/.exec(slug)
  if (versionFirst) {
    const [, version, tier] = versionFirst
    return version !== undefined && tier !== undefined ? `claude-${tier}-${version}` : null
  }

  const tierFirst = /^claude-(opus|sonnet|haiku)-([\d-]+)$/.exec(slug)
  if (tierFirst) {
    const [, tier, version] = tierFirst
    return version !== undefined && tier !== undefined ? `claude-${version}-${tier}` : null
  }

  return null
}

/** The base slugs to try, most specific first. Each is matched exactly against the AA
 *  family; none of them is ever used as a prefix. */
export function baseCandidates(cursorSlug: string): readonly string[] {
  const bases = [cursorSlug]

  for (const suffix of CURSOR_PACKAGING_SUFFIXES) {
    if (cursorSlug.endsWith(`-${suffix}`)) {
      bases.push(cursorSlug.slice(0, -(suffix.length + 1)))
    }
  }

  for (const base of [...bases]) {
    const swapped = swapClaudeTier(base)
    if (swapped !== null) {
      bases.push(swapped)
    }
  }

  return [...new Set(bases)]
}

function isFamilyMember(aaSlug: string, base: string): boolean {
  if (aaSlug === base) {
    return true
  }

  if (!aaSlug.startsWith(`${base}-`)) {
    return false
  }

  const tail = aaSlug.slice(base.length + 1)
  return EFFORT_SUFFIXES.some((suffix) => suffix === tail)
}

/** PURE. Applies ADR-9 to a Cursor model that has no hand-written declaration yet:
 *  take the highest-scoring AA record in the family, excluding `(Non-reasoning` rows.
 *
 *  Declines rather than guesses. A decline is not an error — the model still reaches the
 *  snapshot with its prices, and the operator is asked for an alias decision. */
export function autoResolveAaSlug(
  cursorSlug: string,
  aaModels: readonly AaModel[],
): AutoResolution {
  // A base whose family exists but was rejected explains far more than "nothing found", so
  // that reason wins over the generic one when no candidate resolves.
  let rejected: string | null = null

  for (const base of baseCandidates(cursorSlug)) {
    const resolution = resolveFamily(base, aaModels)
    if (resolution.kind === 'resolved') {
      return resolution
    }
    if (resolution.familyFound && rejected === null) {
      rejected = resolution.reason
    }
  }

  return { kind: 'declined', reason: rejected ?? `no AA record in the ${cursorSlug} family` }
}

type FamilyResolution =
  | Extract<AutoResolution, { kind: 'resolved' }>
  | { readonly kind: 'declined'; readonly reason: string; readonly familyFound: boolean }

function resolveFamily(base: string, aaModels: readonly AaModel[]): FamilyResolution {
  const family = aaModels.filter((model) => isFamilyMember(model.slug, base))

  if (family.length === 0) {
    return {
      kind: 'declined',
      reason: `no AA record in the ${base} family`,
      familyFound: false,
    }
  }

  const reasoning = family.filter((model) => !model.name.includes('(Non-reasoning'))

  if (reasoning.length === 0) {
    return {
      kind: 'declined',
      reason: `every AA record in the ${base} family is (Non-reasoning`,
      familyFound: true,
    }
  }

  // Ties break on slug, not on array order: two records at the same intelligence would
  // otherwise resolve by however AA happened to order its response, so a reordering
  // upstream would flip the mapping and report a spurious remap.
  let best: AaModel | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  for (const model of reasoning) {
    const score = model.intelligence
    if (score === null) {
      continue
    }
    if (score > bestScore || (score === bestScore && best !== null && model.slug < best.slug)) {
      best = model
      bestScore = score
    }
  }

  if (best === null) {
    return {
      kind: 'declined',
      reason: `no AA record in the ${base} family has an intelligence score`,
      familyFound: true,
    }
  }

  return {
    kind: 'resolved',
    aaSlug: best.slug,
    aaName: best.name,
    note: `auto: ADR-9 family scan -> ${best.name} — UNREVIEWED`,
  }
}
