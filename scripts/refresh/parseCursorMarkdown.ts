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

function splitCells(line: string): string[] {
  const parts = line.split('|')
  return parts.slice(1, -1).map((cell) => cell.trim())
}

/** The seven columns must appear in order, one per cell. This — not a row count — is what
 *  keeps a foreign table out of the parse: the Plans table on the same page is
 *  `Plan | Price | Cursor Models | Other Models` and cannot match. */
function isModelTableHeader(line: string): boolean {
  if (!line.startsWith('|')) {
    return false
  }

  const cells = splitCells(line)
  return (
    cells.length === HEADER_COLUMNS.length &&
    HEADER_COLUMNS.every((column, index) => cells[index] === column)
  )
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

function parsePrice(cell: string): number | null {
  const trimmed = cell.trim()
  const withoutDollar = trimmed.startsWith('$') ? trimmed.slice(1).trim() : trimmed
  if (!PRICE_PATTERN.test(withoutDollar)) {
    return null
  }

  const value = Number(withoutDollar)
  return Number.isFinite(value) ? value : null
}

function parseDataRow(line: string): CursorCatalogueRow | null {
  const cells = splitCells(line)
  if (cells.length !== 7 || isSeparatorRow(line)) {
    return null
  }

  const [model, provider, input, cacheWrite, cacheRead, output, notes] = cells
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
 *  Cursor publishes its catalogue across two seven-column tables (the "Cursor Models" pool
 *  and "Model pricing"); both are parsed and the union is deduplicated by name.
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
    if (!line || !isModelTableHeader(line)) {
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

      const row = parseDataRow(rowLine)
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

  if (deduped.length < minRows) {
    throw new CursorMarkdownError(
      `model row count ${deduped.length} below floor ${minRows} — the page looks truncated`,
    )
  }

  return deduped
}
