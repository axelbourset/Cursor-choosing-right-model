import type { CostAxisKey, ModelRow } from '@schema/snapshot'

/** The single definition of "which price does this cost axis mean".
 *
 *  Previously copied verbatim into `pareto.ts`, `selection.ts` and the chart option builder,
 *  where one copy had drifted to declaring a non-null return. The `never` default makes a
 *  new `CostAxisKey` a compile error that names the missing variant. */
export function priceForAxis(row: ModelRow, costAxis: CostAxisKey): number | null {
  switch (costAxis) {
    case 'input':
      return row.priceInput
    case 'output':
      return row.priceOutput
    case 'cacheRead':
      return row.priceCacheRead
    default: {
      // Throws rather than returning the unhandled value: returning it would let a bad
      // axis flow into the frontier maths as if it were a price.
      const exhaustive: never = costAxis
      throw new Error(`unhandled cost axis: ${String(exhaustive)}`)
    }
  }
}

/** A score and a cost the caller has already proven present and positive.
 *
 *  Carrying them alongside the row is what removes the `as number` assertions from the
 *  frontier maths: the invariant becomes structural instead of asserted. */
export type PricedRow = {
  readonly row: ModelRow
  readonly score: number
  readonly cost: number
}

/** Returns null when either axis is missing, or the cost is not positive. */
export function toPricedRow(
  row: ModelRow,
  metric: keyof Pick<ModelRow, 'intelligence' | 'coding' | 'agentic'>,
  costAxis: CostAxisKey,
): PricedRow | null {
  const score = row[metric]
  const cost = priceForAxis(row, costAxis)
  if (score === null || cost === null || cost <= 0) {
    return null
  }
  return { row, score, cost }
}
