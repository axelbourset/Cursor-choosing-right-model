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

  test('10 — the small fixture with expectedRows: 99 throws matching /expected 99/ and reporting 5', async () => {
    const markdown = await loadFixture('cursor-models-small.fixture.md')

    expect(() => parseCursorMarkdown(markdown, 99)).toThrow(CursorMarkdownError)
    expect(() => parseCursorMarkdown(markdown, 99)).toThrow(/expected 99/)
    expect(() => parseCursorMarkdown(markdown, 99)).toThrow(/5/)
  })

  test('13 — fixtures/cursor-models.fixture.md with expectedRows: 47 yields 47 rows', async () => {
    const markdown = await loadFixture('cursor-models.fixture.md')

    const rows = parseCursorMarkdown(markdown, 47)

    expect(rows.length).toBe(47)
  })

  test('11 — empty string throws matching /header not found/', () => {
    expectCursorMarkdownError(() => parseCursorMarkdown(''), /header not found/)
  })

  test('12 — a row with 4 cells instead of 7 is skipped without throwing', async () => {
    const markdown = await loadFixture('cursor-models-small.fixture.md')

    expect(() => parseCursorMarkdown(markdown, 5)).not.toThrow()
  })
})
