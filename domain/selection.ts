import type { ModelRow, MetricKey } from '@schema/snapshot'
import { computePareto } from './pareto'

export type Filters = {
  readonly provider: string | null
  readonly paretoOnly: boolean
}

export const DEFAULT_FILTERS: Filters = {
  provider: null,
  paretoOnly: false,
}

export type Selection = {
  /** Rows with the metric present. This is `n`. Render these. */
  readonly visible: readonly ModelRow[]
  /** Rows that passed filters but lack the metric. Show as "no data". */
  readonly excludedForMissingMetric: readonly ModelRow[]
  /** `n` — visible.length */
  readonly shown: number
  /** `m` — filtered rows before metric-null exclusion; unchanged by Pareto filtering */
  readonly total: number
}

export function applyFilters(rows: readonly ModelRow[], filters: Filters): readonly ModelRow[] {
  const result: ModelRow[] = []

  for (const row of rows) {
    if (filters.provider !== null && row.provider !== filters.provider) {
      continue
    }
    result.push(row)
  }

  return result
}

export type PlottableSelection = {
  readonly filtered: readonly ModelRow[]
  /** Rows with the active metric and a positive input price — eligible for the scatter. */
  readonly plottable: readonly ModelRow[]
  readonly pareto: ReturnType<typeof computePareto>
  /** Rows actually drawn on the scatter (frontier only when `paretoOnly`). */
  readonly chartRows: readonly ModelRow[]
  readonly shown: number
  readonly total: number
}

export function selectPlottable(
  rows: readonly ModelRow[],
  metric: MetricKey,
  filters: Filters,
): PlottableSelection {
  const filtered = applyFilters(rows, filters)
  const plottable = filtered.filter(
    (row) => row[metric] !== null && row.priceInput !== null && row.priceInput > 0,
  )
  const pareto = computePareto(plottable, metric)
  const chartRows = filters.paretoOnly ? pareto.frontier : plottable

  return {
    filtered,
    plottable,
    pareto,
    chartRows,
    shown: chartRows.length,
    total: filtered.length,
  }
}

export function selectForMetric(
  rows: readonly ModelRow[],
  metric: MetricKey,
  filters: Filters,
): Selection {
  const filtered = applyFilters(rows, filters)
  const total = filtered.length

  const withMetric: ModelRow[] = []
  const excludedForMissingMetric: ModelRow[] = []

  for (const row of filtered) {
    if (row[metric] !== null) {
      withMetric.push(row)
    } else {
      excludedForMissingMetric.push(row)
    }
  }

  const plottable = withMetric.filter((row) => row.priceInput !== null && row.priceInput > 0)
  const visible = filters.paretoOnly ? computePareto(plottable, metric).frontier : withMetric

  return {
    visible,
    excludedForMissingMetric,
    shown: visible.length,
    total,
  }
}
