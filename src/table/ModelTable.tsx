import { useMemo, useState } from 'react'
import type { ModelRow } from '@schema/snapshot'
import { colorForProvider } from '../charts/providerColors'
import { CHART_THEME } from '../charts/theme'
import { COLUMNS } from './columns'
import { useSortedRows } from './useSortedRows'

type ModelTableProps = {
  readonly rows: readonly ModelRow[]
}

function matchesSearch(row: ModelRow, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return true
  }
  return (
    row.cursorName.toLowerCase().includes(needle) ||
    row.provider.toLowerCase().includes(needle) ||
    row.cursorSlug.toLowerCase().includes(needle)
  )
}

export function ModelTable({ rows }: ModelTableProps) {
  const [search, setSearch] = useState('')
  const { sorted, toggle } = useSortedRows(rows)
  const visible = useMemo(
    () => sorted.filter((row) => matchesSearch(row, search)),
    [sorted, search],
  )

  return (
    <div className="table-section">
      <div className="model-table-toolbar">
        <label className="model-table-search">
          <span className="model-table-search__label">Search</span>
          <input
            type="search"
            className="model-table-search__input"
            placeholder="Filter by model, provider, or slug…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search models"
          />
        </label>
        {search.trim() ? (
          <p className="model-table-toolbar__count">
            {visible.length} of {sorted.length} models
          </p>
        ) : null}
      </div>
      <div className="table-wrapper">
        <table className="model-table" aria-label="Cursor models">
          <caption className="model-table__caption">Cursor models</caption>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={
                    column.numeric ? 'model-table__th model-table__th--num' : 'model-table__th'
                  }
                >
                  <button
                    type="button"
                    className="model-table__sort"
                    onClick={() => toggle(column.key)}
                  >
                    {column.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.cursorSlug}>
                {COLUMNS.map((column) => {
                  const value = column.format(row)
                  const classes = ['model-table__td']
                  if (column.numeric) classes.push('model-table__td--num')
                  if (value === '—') classes.push('model-table__td--empty')

                  if (column.key === 'provider') {
                    return (
                      <td key={column.key} className={classes.join(' ')}>
                        <span className="provider-chip">
                          <span
                            className="provider-chip__dot"
                            style={{ background: colorForProvider(row.provider, CHART_THEME) }}
                            aria-hidden="true"
                          />
                          {value}
                        </span>
                      </td>
                    )
                  }

                  return (
                    <td key={column.key} className={classes.join(' ')}>
                      {value}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
