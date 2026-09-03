import type { CostAxisKey, ModelRow, MetricKey } from '@schema/snapshot'
import { toPricedRow, type PricedRow } from './price'

export type ParetoResult = {
  /** Rows on the frontier, ascending by active cost axis. */
  readonly frontier: readonly ModelRow[]
  /** Frontier membership by `cursorSlug`, so `isOnFrontier` is O(1) and survives a row
   *  being cloned or re-parsed — object identity would silently stop matching. */
  readonly frontierSlugs: ReadonlySet<string>
  /** Rows considered but dominated. */
  readonly dominated: readonly ModelRow[]
  /** Rows excluded because score or cost was null/zero. */
  readonly excluded: readonly ModelRow[]
}

function dominates(a: PricedRow, b: PricedRow): boolean {
  const scoreAtLeast = a.score >= b.score
  const costAtMost = a.cost <= b.cost
  const strictlyBetter = a.score > b.score || a.cost < b.cost

  return scoreAtLeast && costAtMost && strictlyBetter
}

/** Maximises `metric`, minimises the active cost axis (USD per 1M tokens). */
export function computePareto(
  rows: readonly ModelRow[],
  metric: MetricKey,
  costAxis: CostAxisKey = 'input',
): ParetoResult {
  const excluded: ModelRow[] = []
  const eligible: PricedRow[] = []

  for (const row of rows) {
    const priced = toPricedRow(row, metric, costAxis)
    if (priced === null) {
      excluded.push(row)
    } else {
      eligible.push(priced)
    }
  }

  const frontier: PricedRow[] = []
  const dominated: ModelRow[] = []

  for (const priced of eligible) {
    const isDominated = eligible.some((other) => other !== priced && dominates(other, priced))
    if (isDominated) {
      dominated.push(priced.row)
    } else {
      frontier.push(priced)
    }
  }

  frontier.sort((a, b) => a.cost - b.cost)

  return {
    frontier: frontier.map((priced) => priced.row),
    frontierSlugs: new Set(frontier.map((priced) => priced.row.cursorSlug)),
    dominated,
    excluded,
  }
}

/** Builds a result from parts, keeping `frontier` and `frontierSet` in step.
 *
 *  Callers that assemble a result by hand — the chart's paretoOnly view, and tests — must
 *  go through this so the two representations cannot disagree. */
export function makeParetoResult(parts: {
  readonly frontier: readonly ModelRow[]
  readonly dominated: readonly ModelRow[]
  readonly excluded: readonly ModelRow[]
}): ParetoResult {
  return {
    frontier: parts.frontier,
    frontierSlugs: new Set(parts.frontier.map((row) => row.cursorSlug)),
    dominated: parts.dominated,
    excluded: parts.excluded,
  }
}

/** Convenience membership test. O(1) — the chart calls it once per row. */
export function isOnFrontier(row: ModelRow, result: ParetoResult): boolean {
  return result.frontierSlugs.has(row.cursorSlug)
}
