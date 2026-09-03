import type { SortKey } from '@domain/sort'
import type { ModelRow } from '@schema/snapshot'

/** A rendered cell. Tagged rather than a bare string so "missing" does not have to be
 *  re-detected by comparing against the em dash: the renderer branched on `value === '—'`
 *  to apply its empty styling, which coupled two files through a display character. */
export type Cell = { readonly kind: 'value'; readonly text: string } | { readonly kind: 'missing' }

/** What a `missing` cell renders as. The renderer branches on `Cell.kind`, not on this. */
export const MISSING_TEXT = '—'

/** One table column: its sort key, header label, alignment and cell formatter. */
export type Column = {
  readonly key: SortKey
  readonly label: string
  readonly numeric: boolean
  readonly format: (row: ModelRow) => Cell
}

function formatNullableNumber(value: number | null): Cell {
  return value === null ? { kind: 'missing' } : { kind: 'value', text: String(value) }
}

function formatString(value: string): Cell {
  return { kind: 'value', text: value }
}

/** The table's columns, in display order. */
export const COLUMNS: readonly Column[] = [
  {
    key: 'cursorName',
    label: 'Model',
    numeric: false,
    format: (row) => formatString(row.cursorName),
  },
  {
    key: 'provider',
    label: 'Provider',
    numeric: false,
    format: (row) => formatString(row.provider),
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    numeric: true,
    format: (row) => formatNullableNumber(row.intelligence),
  },
  {
    key: 'coding',
    label: 'Coding',
    numeric: true,
    format: (row) => formatNullableNumber(row.coding),
  },
  {
    key: 'agentic',
    label: 'Agentic',
    numeric: true,
    format: (row) => formatNullableNumber(row.agentic),
  },
  {
    key: 'aaCostPerTask',
    label: '$/task',
    numeric: true,
    format: (row) => formatNullableNumber(row.aaCostPerTask),
  },
  {
    key: 'priceInput',
    label: 'In $',
    numeric: true,
    format: (row) => formatNullableNumber(row.priceInput),
  },
  {
    key: 'priceOutput',
    label: 'Out $',
    numeric: true,
    format: (row) => formatNullableNumber(row.priceOutput),
  },
  {
    key: 'priceCacheRead',
    label: 'Cache R $',
    numeric: true,
    format: (row) => formatNullableNumber(row.priceCacheRead),
  },
]
