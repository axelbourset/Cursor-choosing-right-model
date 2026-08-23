import { describe, expect, test } from 'vitest'
import type { ModelRow } from '@schema/snapshot'
import { compareRows, nextDirection, sortRows } from './sort'

function makeRow(overrides: Partial<ModelRow> = {}): ModelRow {
  return {
    cursorName: 'Test Model',
    cursorSlug: 'test-model',
    provider: 'Test Provider',
    hidden: false,
    aaSlug: 'test-aa-slug',
    aaName: 'Test AA Name',
    aaVariantNote: 'explicit variant',
    intelligence: 50,
    coding: 40,
    agentic: 30,
    aaCostPerTask: 1.0,
    priceInput: 0.01,
    priceOutput: 0.02,
    priceCacheRead: 0.003,
    priceCacheWrite: 0.004,
    ...overrides,
  }
}

describe('compareRows', () => {
  test('1 — intelligence 63.1 vs 55.3, asc', () => {
    const a = makeRow({ intelligence: 63.1 })
    const b = makeRow({ intelligence: 55.3 })
    expect(compareRows(a, b, 'intelligence', 'asc')).toBeGreaterThan(0)
  })

  test('2 — intelligence 63.1 vs 55.3, desc', () => {
    const a = makeRow({ intelligence: 63.1 })
    const b = makeRow({ intelligence: 55.3 })
    expect(compareRows(a, b, 'intelligence', 'desc')).toBeLessThan(0)
  })

  test('3 — intelligence null vs 55.3, asc (a after b)', () => {
    const a = makeRow({ intelligence: null })
    const b = makeRow({ intelligence: 55.3 })
    expect(compareRows(a, b, 'intelligence', 'asc')).toBeGreaterThan(0)
  })

  test('4 — intelligence null vs 55.3, desc (a STILL after b)', () => {
    const a = makeRow({ intelligence: null })
    const b = makeRow({ intelligence: 55.3 })
    expect(compareRows(a, b, 'intelligence', 'desc')).toBeGreaterThan(0)
  })

  test('5 — intelligence 55.3 vs null, asc', () => {
    const a = makeRow({ intelligence: 55.3 })
    const b = makeRow({ intelligence: null })
    expect(compareRows(a, b, 'intelligence', 'asc')).toBeLessThan(0)
  })

  test('6 — intelligence 55.3 vs null, desc', () => {
    const a = makeRow({ intelligence: 55.3 })
    const b = makeRow({ intelligence: null })
    expect(compareRows(a, b, 'intelligence', 'desc')).toBeLessThan(0)
  })

  test('7 — intelligence null vs null, asc', () => {
    const a = makeRow({ intelligence: null })
    const b = makeRow({ intelligence: null })
    expect(compareRows(a, b, 'intelligence', 'asc')).toBe(0)
  })

  test("8 — cursorName 'Alpha' vs 'Beta', asc", () => {
    const a = makeRow({ cursorName: 'Alpha' })
    const b = makeRow({ cursorName: 'Beta' })
    expect(compareRows(a, b, 'cursorName', 'asc')).toBeLessThan(0)
  })

  test("9 — cursorName 'Beta' vs 'Alpha', desc", () => {
    const a = makeRow({ cursorName: 'Beta' })
    const b = makeRow({ cursorName: 'Alpha' })
    expect(compareRows(a, b, 'cursorName', 'desc')).toBeLessThan(0)
  })
})

describe('sortRows', () => {
  test('10 — 5 rows, 2 with null intelligence, sorted asc', () => {
    const rows = [
      makeRow({ cursorName: 'A', intelligence: 70 }),
      makeRow({ cursorName: 'B', intelligence: null }),
      makeRow({ cursorName: 'C', intelligence: 50 }),
      makeRow({ cursorName: 'D', intelligence: null }),
      makeRow({ cursorName: 'E', intelligence: 60 }),
    ]
    const sorted = sortRows(rows, 'intelligence', 'asc')
    expect(sorted[3]!.intelligence).toBeNull()
    expect(sorted[4]!.intelligence).toBeNull()
    expect(sorted.slice(0, 3).every((r) => r.intelligence !== null)).toBe(true)
  })

  test('11 — same, sorted desc (nulls STILL last)', () => {
    const rows = [
      makeRow({ cursorName: 'A', intelligence: 70 }),
      makeRow({ cursorName: 'B', intelligence: null }),
      makeRow({ cursorName: 'C', intelligence: 50 }),
      makeRow({ cursorName: 'D', intelligence: null }),
      makeRow({ cursorName: 'E', intelligence: 60 }),
    ]
    const sorted = sortRows(rows, 'intelligence', 'desc')
    expect(sorted[3]!.intelligence).toBeNull()
    expect(sorted[4]!.intelligence).toBeNull()
    expect(sorted.slice(0, 3).every((r) => r.intelligence !== null)).toBe(true)
  })

  test('12 — all null intelligence, asc (stable, order unchanged)', () => {
    const rows = [
      makeRow({ cursorName: 'First' }),
      makeRow({ cursorName: 'Second' }),
      makeRow({ cursorName: 'Third' }),
    ].map((r) => ({ ...r, intelligence: null }))
    const sorted = sortRows(rows, 'intelligence', 'asc')
    expect(sorted.map((r) => r.cursorName)).toEqual(['First', 'Second', 'Third'])
  })

  test('13 — equal intelligence, different names (stable)', () => {
    const rows = [
      makeRow({ cursorName: 'Zebra', intelligence: 50 }),
      makeRow({ cursorName: 'Alpha', intelligence: 50 }),
    ]
    const sorted = sortRows(rows, 'intelligence', 'asc')
    expect(sorted.map((r) => r.cursorName)).toEqual(['Zebra', 'Alpha'])
  })

  test('14 — frozen input array is unchanged', () => {
    const rows = Object.freeze([
      makeRow({ cursorName: 'A', intelligence: 70 }),
      makeRow({ cursorName: 'B', intelligence: 50 }),
    ])
    const snapshot = rows.map((r) => ({ ...r }))
    expect(() => sortRows(rows, 'intelligence', 'asc')).not.toThrow()
    expect(rows).toEqual(snapshot)
  })
})

describe('nextDirection', () => {
  test('asc → desc', () => {
    expect(nextDirection('asc')).toBe('desc')
  })

  test('desc → asc', () => {
    expect(nextDirection('desc')).toBe('asc')
  })
})
