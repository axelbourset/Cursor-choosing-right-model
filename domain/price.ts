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

/** Six decimal places: finer than any published price, coarse enough to absorb float noise.
 *  Without it `0.032 + 0.25` would surface as `0.28200000000000003` in the table, and two
 *  equal prices could differ in the last bit and break a tie in the frontier maths. */
const PRICE_PRECISION = 1e6

function addRate(price: number | null, usdPerMillionTokens: number): number | null {
  return price === null
    ? null
    : Math.round((price + usdPerMillionTokens) * PRICE_PRECISION) / PRICE_PRECISION
}

/** Rows priced as a Teams or Enterprise plan pays: Cursor's flat Token Rate added to every
 *  list price of every eligible model. The docs apply it to "input tokens, output tokens, and
 *  cached tokens", so cache writes are included.
 *
 *  Applied once, before selection: the frontier, the chart and the table sort all read
 *  prices off the rows, so none of them needs to know the rate exists. Exempt rows are
 *  returned as the same object; missing prices stay missing. */
export function withCursorTokenRate(
  rows: readonly ModelRow[],
  usdPerMillionTokens: number,
): readonly ModelRow[] {
  return rows.map((row) =>
    row.cursorTokenRateEligible
      ? {
          ...row,
          priceInput: addRate(row.priceInput, usdPerMillionTokens),
          priceOutput: addRate(row.priceOutput, usdPerMillionTokens),
          priceCacheRead: addRate(row.priceCacheRead, usdPerMillionTokens),
          priceCacheWrite: addRate(row.priceCacheWrite, usdPerMillionTokens),
        }
      : row,
  )
}
