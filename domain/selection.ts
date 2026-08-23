import type { ModelRow, MetricKey } from '@schema/snapshot'
import { computePareto } from './pareto'

export type Filters = {
  readonly provider: string | null
  readonly includeHidden: boolean
  readonly paretoOnly: boolean
}

export const DEFAULT_FILTERS: Filters = {
  provider: null,
  includeHidden: true,
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
    if (!filters.includeHidden && row.hidden) {
      continue
    }
    if (filters.provider !== null && row.provider !== filters.provider) {
      continue
    }
    result.push(row)
  }

  return result
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

  const visible = filters.paretoOnly ? computePareto(withMetric, metric).frontier : withMetric

  return {
    visible,
    excludedForMissingMetric,
    shown: visible.length,
    total,
  }
}
