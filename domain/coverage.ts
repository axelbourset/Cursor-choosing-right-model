import type { ModelRow, MetricKey, Coverage } from '@schema/snapshot'

/** How many of `rows` have a non-null value for `metric`. */
export function countWithMetric(rows: readonly ModelRow[], metric: MetricKey): number {
  let count = 0
  for (const row of rows) {
    if (row[metric] !== null) {
      count++
    }
  }
  return count
}

/** How many of `rows` have a non-null aaCostPerTask. */
export function countWithCost(rows: readonly ModelRow[]): number {
  let count = 0
  for (const row of rows) {
    if (row.aaCostPerTask !== null) {
      count++
    }
  }
  return count
}

/** Dataset-level counts for the snapshot's coverage block. */
export function computeCoverage(rows: readonly ModelRow[]): Coverage {
  let resolved = 0
  for (const row of rows) {
    if (row.aaSlug !== null) {
      resolved++
    }
  }

  return {
    totalRows: rows.length,
    resolved,
    intelligence: countWithMetric(rows, 'intelligence'),
    coding: countWithMetric(rows, 'coding'),
    agentic: countWithMetric(rows, 'agentic'),
    aaCostPerTask: countWithCost(rows),
  }
}
