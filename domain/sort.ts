import type { ModelRow } from '@schema/snapshot'

export type SortDirection = 'asc' | 'desc'
export type SortKey = keyof Pick<
  ModelRow,
  | 'cursorName'
  | 'provider'
  | 'intelligence'
  | 'coding'
  | 'agentic'
  | 'aaCostPerTask'
  | 'priceInput'
  | 'priceOutput'
  | 'priceCacheRead'
  | 'priceCacheWrite'
>

/** Returns <0, 0, or >0. Nulls always sort AFTER non-nulls in both directions. */
export function compareRows(a: ModelRow, b: ModelRow, key: SortKey, dir: SortDirection): number {
  const aVal = a[key]
  const bVal = b[key]

  const aNull = aVal === null
  const bNull = bVal === null

  if (aNull && bNull) return 0
  if (aNull) return 1
  if (bNull) return -1

  if (typeof aVal === 'string' && typeof bVal === 'string') {
    const cmp = aVal.localeCompare(bVal)
    return dir === 'asc' ? cmp : -cmp
  }

  if (typeof aVal === 'number' && typeof bVal === 'number') {
    const cmp = aVal - bVal
    return dir === 'asc' ? cmp : -cmp
  }

  // SortKey admits only string and number fields, and both null cases returned above.
  return 0
}

/** Stable sort. Does not mutate the input array. */
export function sortRows(rows: readonly ModelRow[], key: SortKey, dir: SortDirection): ModelRow[] {
  return [...rows].sort((a, b) => compareRows(a, b, key, dir))
}

/** asc -> desc -> asc. Used by the table header click handler. */
export function nextDirection(dir: SortDirection): SortDirection {
  return dir === 'asc' ? 'desc' : 'asc'
}
