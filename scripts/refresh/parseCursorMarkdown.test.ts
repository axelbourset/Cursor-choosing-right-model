import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import {
  CursorMarkdownError,
  parseCursorMarkdown,
  type CursorCatalogueRow,
} from './parseCursorMarkdown'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures')

async function loadFixture(name: string): Promise<string> {
  return readFile(path.join(fixturesDir, name), 'utf-8')
}

function findByName(rows: readonly CursorCatalogueRow[], name: string): CursorCatalogueRow {
  const row = rows.find((r) => r.name === name)
  if (!row) {
    throw new Error(`row not found: ${name}`)
  }
  return row
}

function expectCursorMarkdownError(fn: () => unknown, pattern: RegExp) {
  expect(() => fn()).toThrow(CursorMarkdownError)
  expect(() => fn()).toThrow(pattern)
}

describe('parseCursorMarkdown', () => {
  test('1 — the small fixture with expectedRows: 5 yields 5 rows', async () => {
    const markdown = await loadFixture('cursor-models-small.fixture.md')

    const rows = parseCursorMarkdown(markdown, 5)

    expect(rows.length).toBe(5)
  })

  test('2 — the decoy Plans table contributes 0 rows', async () => {
    const markdown = await loadFixture('cursor-models-small.fixture.md')

    const rows = parseCursorMarkdown(markdown, 5)

    expect(rows.some((row) => row.name === 'Pro' || row.name === 'Ultra')).toBe(false)
    expect(rows.every((row) => !row.name.includes('Pro'))).toBe(true)
  })

  test('3 — [Claude Opus 5](https://...) in the Model cell yields name Claude Opus 5', async () => {
    const markdown = await loadFixture('cursor-models-small.fixture.md')

    const rows = parseCursorMarkdown(markdown, 5)
    const row = findByName(rows, 'Claude Opus 5')

    expect(row.name).toBe('Claude Opus 5')
  })

  test('4 — a row whose Notes contains Hidden by default has hidden === true', async () => {
    const markdown = await loadFixture('cursor-models-small.fixture.md')

    const rows = parseCursorMarkdown(markdown, 5)
    const row = findByName(rows, 'Hidden Model')

    expect(row.hidden).toBe(true)
  })

  test('5 — a row whose Notes does not contain Hidden by default has hidden === false', async () => {
    const markdown = await loadFixture('cursor-models-small.fixture.md')

    const rows = parseCursorMarkdown(markdown, 5)
    const row = findByName(rows, 'Claude Opus 5')

    expect(row.hidden).toBe(false)
  })

  test('6 — a Cache write cell of - yields cacheWrite === null', async () => {
    const markdown = await loadFixture('cursor-models-small.fixture.md')

    const rows = parseCursorMarkdown(markdown, 5)
    const row = findByName(rows, 'Cache Dash')

    expect(row.cacheWrite).toBeNull()
  })

  test('7 — an Input cell of $0.5 yields input === 0.5', async () => {
    const markdown = await loadFixture('cursor-models-small.fixture.md')

    const rows = parseCursorMarkdown(markdown, 5)
    const row = findByName(rows, 'Duplicate Name')

    expect(row.input).toBe(0.5)
  })

  test('8 — the duplicate name appears exactly once', async () => {
    const markdown = await loadFixture('cursor-models-small.fixture.md')

    const rows = parseCursorMarkdown(markdown, 5)
    const matches = rows.filter((row) => row.name === 'Duplicate Name')

    expect(matches.length).toBe(1)
  })

  test('9 — markdown with no models table throws matching /header not found/', () => {
    const markdown = `# Docs

| Plan | Price | Usage |
| ---- | ----- | ----- |
| Pro | $20/mo | $20 |
`

    expectCursorMarkdownError(() => parseCursorMarkdown(markdown), /header not found/)
  })

  test('10 — a row count below the truncation floor throws, naming the floor and the count', async () => {
    const markdown = await loadFixture('cursor-models-small.fixture.md')

    expectCursorMarkdownError(() => parseCursorMarkdown(markdown, 99), /below floor 99/)
    expectCursorMarkdownError(() => parseCursorMarkdown(markdown, 99), /5/)
  })

  test('10b — a catalogue larger than expected is NOT an error', async () => {
    const markdown = await loadFixture('cursor-models.fixture.md')

    // The whole point: models appearing upstream is normal, and `resolve.ts` absorbs it.
    expect(() => parseCursorMarkdown(markdown, 20)).not.toThrow()
  })

  test('10c — a header whose seven columns are reordered is not a model table', () => {
    const markdown = [
      '| Provider | Model | Input | Cache write | Cache read | Output | Notes |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      '| Anthropic | Claude Opus 5 | $5 | $6.25 | $0.5 | $25 | - |',
    ].join('\n')

    expectCursorMarkdownError(() => parseCursorMarkdown(markdown, 1), /header not found/)
  })

  test('13 — the real fixture yields the union of both seven-column tables, deduplicated', async () => {
    const markdown = await loadFixture('cursor-models.fixture.md')

    const rows = parseCursorMarkdown(markdown)

    // The "Cursor Models" pool table and the "Model pricing" table both match the header.
    expect(findByName(rows, 'Grok 4.6').provider).toBe('Cursor')
    expect(findByName(rows, 'Claude Opus 5').provider).toBe('Anthropic')
    expect(new Set(rows.map((row) => row.name)).size).toBe(rows.length)
    // Asserted as a floor, never an equality: the catalogue is expected to grow.
    expect(rows.length).toBeGreaterThanOrEqual(20)
  })

  test('13b — an unreadable price cell becomes null, never NaN', async () => {
    // NaN typed as `number` defeats the `no price source` guard and then fails snapshot
    // validation naming an array index rather than the model.
    const markdown = [
      '| Model | Provider | Input | Cache write | Cache read | Output | Notes |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      '| Odd Model | OpenAI | Free | - | $1 | $30 | - |',
    ].join('\n')

    const rows = parseCursorMarkdown(markdown, 1)

    expect(rows[0]!.input).toBeNull()
    expect(rows[0]!.cacheRead).toBe(1)
    expect(rows[0]!.output).toBe(30)
  })

  test('13c — a bare $ is null, never 0, and numeric literals are not accepted', async () => {
    const cell = (value: string) => {
      const markdown = [
        '| Model | Provider | Input | Cache write | Cache read | Output | Notes |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        `| M | P | ${value} | - | $1 | $30 | - |`,
      ].join('\n')
      return parseCursorMarkdown(markdown, 1)[0]!.input
    }

    // A zero substituted for missing data is the one thing this codebase must never do.
    expect(cell('$')).toBeNull()
    expect(cell('  $  ')).toBeNull()
    expect(cell('0x10')).toBeNull()
    expect(cell('1e3')).toBeNull()
    expect(cell('$1,250')).toBeNull()
    expect(cell('$2.5')).toBe(2.5)
    expect(cell('0')).toBe(0)
  })

  test('13d — a format change in one price column is caught, not absorbed', async () => {
    const markdown = await loadFixture('cursor-models.fixture.md')
    const broken = markdown
      .split('\n')
      .map((line) => {
        const cells = line.split('|')
        if (cells.length !== 9 || line.includes('| Model ') || /^\|\s*-/.test(line)) {
          return line
        }
        cells[6] = cells[6]!.replace(/\$([\d.]+)/, '$$$1/M')
        return cells.join('|')
      })
      .join('\n')

    expectCursorMarkdownError(() => parseCursorMarkdown(broken), /readable output price/)
  })

  test('14 — the Plans table on the same page contributes 0 rows', async () => {
    const markdown = await loadFixture('cursor-models.fixture.md')

    const rows = parseCursorMarkdown(markdown)

    expect(rows.find((row) => row.name === 'Pro')).toBeUndefined()
    expect(rows.every((row) => row.provider !== 'Price')).toBe(true)
  })

  test('11 — empty string throws matching /header not found/', () => {
    expectCursorMarkdownError(() => parseCursorMarkdown(''), /header not found/)
  })

  test('12 — a row with 4 cells instead of 7 is skipped without throwing', async () => {
    const markdown = await loadFixture('cursor-models-small.fixture.md')

    expect(() => parseCursorMarkdown(markdown, 5)).not.toThrow()
  })
})
