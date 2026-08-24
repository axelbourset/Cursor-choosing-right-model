import type { ModelRow } from '@schema/snapshot'
import { COLUMNS } from './columns'
import { useSortedRows } from './useSortedRows'

type ModelTableProps = {
  readonly rows: readonly ModelRow[]
}

export function ModelTable({ rows }: ModelTableProps) {
  const { sorted, toggle } = useSortedRows(rows)

  return (
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
        {sorted.map((row) => (
          <tr key={row.cursorSlug}>
            {COLUMNS.map((column) => {
              const value = column.format(row)
              const classes = ['model-table__td']
              if (column.numeric) classes.push('model-table__td--num')
              if (value === '—') classes.push('model-table__td--empty')
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
  )
}
