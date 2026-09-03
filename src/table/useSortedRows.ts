import { useCallback, useMemo, useState } from 'react'
import { nextDirection, sortRows, type SortDirection, type SortKey } from '@domain/sort'
import type { ModelRow } from '@schema/snapshot'

/** Sorts rows by the active column, and cycles asc/desc when a header is clicked. */
export function useSortedRows(rows: readonly ModelRow[]): {
  readonly sorted: readonly ModelRow[]
  readonly sortKey: SortKey
  readonly direction: SortDirection
  readonly toggle: (key: SortKey) => void
} {
  const [sortKey, setSortKey] = useState<SortKey>('intelligence')
  const [direction, setDirection] = useState<SortDirection>('desc')

  const toggle = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setDirection((current) => nextDirection(current))
      } else {
        setSortKey(key)
        setDirection('desc')
      }
    },
    [sortKey],
  )

  const sorted = useMemo(() => sortRows(rows, sortKey, direction), [rows, sortKey, direction])

  return { sorted, sortKey, direction, toggle }
}
