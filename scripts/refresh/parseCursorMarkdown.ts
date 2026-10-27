export type CursorCatalogueRow = {
  readonly name: string
  readonly provider: string
  readonly hidden: boolean
  readonly input: number | null
  readonly cacheWrite: number | null
  readonly cacheRead: number | null
  readonly output: number | null
}
export class CursorMarkdownError extends Error {
  override name = 'CursorMarkdownError'
}

const HEADER_COLUMNS = [
  'Model',
  'Provider',
  'Input',
  'Cache write',
  'Cache read',
  'Output',
  'Notes',
] as const

/** Where each of `HEADER_COLUMNS` sits in a table's header, and how many cells a row of that
 *  table has. Upstream inserts columns between ours (`US data residency` arrived between
 *  `Output` and `Notes`), so positions are read from the header rather than assumed. */
type ModelTableLayout = {
  readonly width: number
  readonly positions: readonly number[]
}

function splitCells(line: string): string[] {
  const parts = line.split('|')
  return parts.slice(1, -1).map((cell) => cell.trim())
}

/** The seven columns must appear in order; extra columns around them are tolerated. This —
 *  not a row count — is what keeps a foreign table out of the parse: the Plans table on the
 *  same page is `Plan | Price | Included usage | Third-party models` and cannot match. */
function readModelTableLayout(line: string): ModelTableLayout | null {
  if (!line.startsWith('|')) {
    return null
  }

  const cells = splitCells(line)
  const positions: number[] = []
  let searchFrom = 0
  for (const column of HEADER_COLUMNS) {
    const position = cells.indexOf(column, searchFrom)
    if (position === -1) {
      return null
    }
    positions.push(position)
    searchFrom = position + 1
  }

  return { width: cells.length, positions }
}

function isSeparatorRow(line: string): boolean {
  const cells = splitCells(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function stripModelLink(cell: string): string {
  const match = /^\[([^\]]+)\]\([^)]*\)$/.exec(cell)
  return match?.[1] ?? cell
}

/** `Number()` accepts far more than a price: it returns NaN for prose, 0 for the empty
 *  string left behind by a bare `$`, and happily parses `0x10` as 16 and `1e3` as 1000.
 *  A NaN typed as `number` defeats the `no price source` guard and then fails snapshot
 *  validation; a 0 is worse still, because zero is exactly what this codebase must never
 *  substitute for missing data.
 *
 *  So the shape is validated before conversion. An unreadable cell becomes null — "not
 *  measured", the value the schema already models — which degrades that one price rather
 *  than the run. A wholesale format change is still loud: every price for a model turns
 *  null and `resolvePrices` throws naming it. */
const PRICE_PATTERN = /^\d+(?:\.\d+)?$/

/** The per-column ratio check below needs a real catalogue to be meaningful; a hand-built
 *  unit fixture of one or two rows says nothing about upstream's format. */
const COLUMN_SAMPLE_FLOOR = 20

function parsePrice(cell: string): number | null {
  const trimmed = cell.trim()
  const withoutDollar = trimmed.startsWith('$') ? trimmed.slice(1).trim() : trimmed
  if (!PRICE_PATTERN.test(withoutDollar)) {
    return null
  }

  const value = Number(withoutDollar)
  return Number.isFinite(value) ? value : null
}

function parseDataRow(line: string, layout: ModelTableLayout): CursorCatalogueRow | null {
  const cells = splitCells(line)
  if (cells.length !== layout.width || isSeparatorRow(line)) {
    return null
  }

  const [model, provider, input, cacheWrite, cacheRead, output, notes] = layout.positions.map(
    (position) => cells[position],
  )
  if (!model || !provider || notes === undefined) {
    return null
  }

  return {
    name: stripModelLink(model),
    provider,
    hidden: notes.includes('Hidden by default'),
    input: parsePrice(input ?? ''),
    cacheWrite: parsePrice(cacheWrite ?? ''),
    cacheRead: parsePrice(cacheRead ?? ''),
    output: parsePrice(output ?? ''),
  }
}

/** PURE. No network, no fs.
 *
 *  Cursor publishes its catalogue across two tables (the "Cursor Models" pool and "Model
 *  pricing"); both are parsed and the union is deduplicated by name.
 *
 *  There is deliberately NO expected-row-count check. Models appearing and disappearing is
 *  normal upstream behaviour, absorbed downstream by `resolve.ts`. `minRows` is a truncation
 *  floor only — the same idiom the other three sources use. */
export function parseCursorMarkdown(markdown: string, minRows = 20): readonly CursorCatalogueRow[] {
  const lines = markdown.split(/\r?\n/)
  const rows: CursorCatalogueRow[] = []
  let foundHeader = false

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const layout = line ? readModelTableLayout(line) : null
    if (!layout) {
      continue
    }

    foundHeader = true
    let rowIndex = index + 1

    if (rowIndex < lines.length) {
      const separatorLine = lines[rowIndex]
      if (separatorLine && isSeparatorRow(separatorLine)) {
        rowIndex += 1
      }
    }

    while (rowIndex < lines.length) {
      const rowLine = lines[rowIndex]
      if (!rowLine?.startsWith('|')) {
        break
      }

      const row = parseDataRow(rowLine, layout)
      if (row) {
        rows.push(row)
      }
      rowIndex += 1
    }
  }

  if (!foundHeader) {
    throw new CursorMarkdownError('models table header not found')
  }

  const seen = new Set<string>()
  const deduped: CursorCatalogueRow[] = []
  for (const row of rows) {
    if (seen.has(row.name)) {
      continue
    }
    seen.add(row.name)
    deduped.push(row)
  }

  // A per-column floor. The whole-row case is caught downstream by `resolvePrices`, but a
  // format change in ONE column (say `$15/M` in Output) leaves every other column parsing,
  // so nothing throws and the affected cost axis silently goes blank across the catalogue.
  if (deduped.length >= COLUMN_SAMPLE_FLOOR) {
    for (const column of ['input', 'output'] as const) {
      const present = deduped.filter((row) => row[column] !== null).length
      if (present * 2 < deduped.length) {
        throw new CursorMarkdownError(
          `only ${String(present)} of ${String(deduped.length)} rows have a readable ${column} price — the column format looks changed`,
        )
      }
    }
  }

  if (deduped.length < minRows) {
    throw new CursorMarkdownError(
      `model row count ${deduped.length} below floor ${minRows} — the page looks truncated`,
    )
  }

  return deduped
}
