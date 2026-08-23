import type { SortKey } from '@domain/sort'
import type { ModelRow } from '@schema/snapshot'

export type Column = {
  readonly key: SortKey
  readonly label: string
  readonly numeric: boolean
  readonly format: (row: ModelRow) => string
}

function formatNullableNumber(value: number | null): string {
  return value === null ? '—' : String(value)
}

function formatString(value: string): string {
  return value
}

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
