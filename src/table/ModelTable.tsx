import type { ModelRow } from '@schema/snapshot'
import { COLUMNS } from './columns'
import { useSortedRows } from './useSortedRows'

type ModelTableProps = {
  readonly rows: readonly ModelRow[]
}

export function ModelTable({ rows }: ModelTableProps) {
  const { sorted, toggle } = useSortedRows(rows)

  return (
    <table aria-label="Cursor models">
      <caption>Cursor models</caption>
      <thead>
        <tr>
          {COLUMNS.map((column) => (
            <th key={column.key} scope="col">
              <button type="button" onClick={() => toggle(column.key)}>
                {column.label}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={row.cursorSlug}>
            {COLUMNS.map((column) => (
              <td key={column.key}>{column.format(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
