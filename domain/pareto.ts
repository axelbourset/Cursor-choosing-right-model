import type { ModelRow, MetricKey } from '@schema/snapshot'

export type ParetoResult = {
  /** Rows on the frontier, ascending by input price. */
  readonly frontier: readonly ModelRow[]
  /** Rows considered but dominated. */
  readonly dominated: readonly ModelRow[]
  /** Rows excluded because score or input price was null/zero. */
  readonly excluded: readonly ModelRow[]
}

function hasBothAxes(row: ModelRow, metric: MetricKey): boolean {
  return row[metric] !== null && row.priceInput !== null && row.priceInput > 0
}

function dominates(a: ModelRow, b: ModelRow, metric: MetricKey): boolean {
  const aScore = a[metric] as number
  const bScore = b[metric] as number
  const aCost = a.priceInput as number
  const bCost = b.priceInput as number

  const scoreAtLeast = aScore >= bScore
  const costAtMost = aCost <= bCost
  const strictlyBetter = aScore > bScore || aCost < bCost

  return scoreAtLeast && costAtMost && strictlyBetter
}

/** Maximises `metric`, minimises `priceInput` (USD per 1M tokens). */
export function computePareto(rows: readonly ModelRow[], metric: MetricKey): ParetoResult {
  const excluded: ModelRow[] = []
  const eligible: ModelRow[] = []

  for (const row of rows) {
    if (hasBothAxes(row, metric)) {
      eligible.push(row)
    } else {
      excluded.push(row)
    }
  }

  const frontier: ModelRow[] = []
  const dominated: ModelRow[] = []

  for (const row of eligible) {
    const isDominated = eligible.some((other) => other !== row && dominates(other, row, metric))
    if (isDominated) {
      dominated.push(row)
    } else {
      frontier.push(row)
    }
  }

  frontier.sort((a, b) => (a.priceInput as number) - (b.priceInput as number))

  return { frontier, dominated, excluded }
}

/** Convenience membership test. */
export function isOnFrontier(row: ModelRow, result: ParetoResult): boolean {
  return result.frontier.some((r) => r === row)
}
