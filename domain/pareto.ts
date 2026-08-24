import type { CostAxisKey, ModelRow, MetricKey } from '@schema/snapshot'

export type ParetoResult = {
  /** Rows on the frontier, ascending by active cost axis. */
  readonly frontier: readonly ModelRow[]
  /** Rows considered but dominated. */
  readonly dominated: readonly ModelRow[]
  /** Rows excluded because score or cost was null/zero. */
  readonly excluded: readonly ModelRow[]
}

function priceForAxis(row: ModelRow, costAxis: CostAxisKey): number | null {
  switch (costAxis) {
    case 'input':
      return row.priceInput
    case 'output':
      return row.priceOutput
    case 'cacheRead':
      return row.priceCacheRead
  }
}

function hasBothAxes(row: ModelRow, metric: MetricKey, costAxis: CostAxisKey): boolean {
  const price = priceForAxis(row, costAxis)
  return row[metric] !== null && price !== null && price > 0
}

function dominates(a: ModelRow, b: ModelRow, metric: MetricKey, costAxis: CostAxisKey): boolean {
  const aScore = a[metric] as number
  const bScore = b[metric] as number
  const aCost = priceForAxis(a, costAxis) as number
  const bCost = priceForAxis(b, costAxis) as number

  const scoreAtLeast = aScore >= bScore
  const costAtMost = aCost <= bCost
  const strictlyBetter = aScore > bScore || aCost < bCost

  return scoreAtLeast && costAtMost && strictlyBetter
}

/** Maximises `metric`, minimises the active cost axis (USD per 1M tokens). */
export function computePareto(
  rows: readonly ModelRow[],
  metric: MetricKey,
  costAxis: CostAxisKey = 'input',
): ParetoResult {
  const excluded: ModelRow[] = []
  const eligible: ModelRow[] = []

  for (const row of rows) {
    if (hasBothAxes(row, metric, costAxis)) {
      eligible.push(row)
    } else {
      excluded.push(row)
    }
  }

  const frontier: ModelRow[] = []
  const dominated: ModelRow[] = []

  for (const row of eligible) {
    const isDominated = eligible.some(
      (other) => other !== row && dominates(other, row, metric, costAxis),
    )
    if (isDominated) {
      dominated.push(row)
    } else {
      frontier.push(row)
    }
  }

  frontier.sort(
    (a, b) => (priceForAxis(a, costAxis) as number) - (priceForAxis(b, costAxis) as number),
  )

  return { frontier, dominated, excluded }
}

/** Convenience membership test. */
export function isOnFrontier(row: ModelRow, result: ParetoResult): boolean {
  return result.frontier.some((r) => r === row)
}
