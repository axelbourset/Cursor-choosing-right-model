export type CursorCatalogueRow = {
  readonly name: string
  readonly provider: string
  readonly hidden: boolean
  readonly input: number | null
  readonly cacheWrite: number | null
  readonly cacheRead: number | null
  readonly output: number | null
}
export class CursorMarkdownError extends Error {}

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

function isModelTableHeader(line: string): boolean {
  if (!line.startsWith('|')) {
    return false
  }

  return HEADER_COLUMNS.every((column) => line.includes(column))
}

function isSeparatorRow(line: string): boolean {
  const cells = splitCells(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function stripModelLink(cell: string): string {
  const match = cell.match(/^\[([^\]]+)\]\([^)]*\)$/)
  return match?.[1] ?? cell
}

function parsePrice(cell: string): number | null {
  const trimmed = cell.trim()
  if (trimmed === '' || trimmed === '-') {
    return null
  }

  const withoutDollar = trimmed.startsWith('$') ? trimmed.slice(1) : trimmed
  return Number(withoutDollar)
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

/** PURE. No network, no fs. */
export function parseCursorMarkdown(
  markdown: string,
  expectedRows = 47,
): readonly CursorCatalogueRow[] {
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

  if (deduped.length !== expectedRows) {
    throw new CursorMarkdownError(`expected ${expectedRows} model rows but found ${deduped.length}`)
  }

  return deduped
}
