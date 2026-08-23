import { describe, expect, test } from 'vitest'
import type { ModelRow } from '@schema/snapshot'
import { computeCoverage, countWithCost, countWithMetric } from './coverage'

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

describe('computeCoverage', () => {
  test('1 — 3 rows: all metrics present', () => {
    const rows = [makeRow(), makeRow({ cursorSlug: 'b' }), makeRow({ cursorSlug: 'c' })]
    const coverage = computeCoverage(rows)
    expect(coverage.intelligence).toBe(3)
    expect(coverage.coding).toBe(3)
    expect(coverage.agentic).toBe(3)
    expect(coverage.totalRows).toBe(rows.length)
  })

  test('2 — 3 rows: 1 with coding: null', () => {
    const rows = [
      makeRow(),
      makeRow({ cursorSlug: 'b', coding: null }),
      makeRow({ cursorSlug: 'c' }),
    ]
    const coverage = computeCoverage(rows)
    expect(coverage.intelligence).toBe(3)
    expect(coverage.coding).toBe(2)
    expect(coverage.agentic).toBe(3)
    expect(coverage.totalRows).toBe(rows.length)
  })

  test('3 — 3 rows: 1 with aaSlug: null and all metrics null', () => {
    const rows = [
      makeRow(),
      makeRow({ cursorSlug: 'b' }),
      makeRow({
        cursorSlug: 'c',
        aaSlug: null,
        aaName: null,
        aaVariantNote: null,
        intelligence: null,
        coding: null,
        agentic: null,
        aaCostPerTask: null,
      }),
    ]
    const coverage = computeCoverage(rows)
    expect(coverage.resolved).toBe(2)
    expect(coverage.totalRows).toBe(3)
    expect(coverage.totalRows).toBe(rows.length)
  })

  test('4 — 3 rows: 1 with aaCostPerTask: null', () => {
    const rows = [
      makeRow(),
      makeRow({ cursorSlug: 'b', aaCostPerTask: null }),
      makeRow({ cursorSlug: 'c' }),
    ]
    const coverage = computeCoverage(rows)
    expect(coverage.aaCostPerTask).toBe(2)
    expect(coverage.totalRows).toBe(rows.length)
  })

  test('5 — empty rows', () => {
    const coverage = computeCoverage([])
    expect(coverage.totalRows).toBe(0)
    expect(coverage.resolved).toBe(0)
    expect(coverage.intelligence).toBe(0)
    expect(coverage.coding).toBe(0)
    expect(coverage.agentic).toBe(0)
    expect(coverage.aaCostPerTask).toBe(0)
  })

  test('6 — row with coding: 0 (real zero score)', () => {
    const rows = [makeRow({ coding: 0 })]
    expect(countWithMetric(rows, 'coding')).toBe(1)
    expect(computeCoverage(rows).coding).toBe(1)
    expect(computeCoverage(rows).totalRows).toBe(rows.length)
  })

  test('7 — totalRows always equals rows.length', () => {
    const cases: readonly (readonly ModelRow[])[] = [
      [makeRow(), makeRow({ cursorSlug: 'b' }), makeRow({ cursorSlug: 'c' })],
      [makeRow(), makeRow({ cursorSlug: 'b', coding: null }), makeRow({ cursorSlug: 'c' })],
      [
        makeRow(),
        makeRow({ cursorSlug: 'b' }),
        makeRow({
          cursorSlug: 'c',
          aaSlug: null,
          intelligence: null,
          coding: null,
          agentic: null,
        }),
      ],
      [],
      [makeRow({ coding: 0 })],
    ]
    for (const rows of cases) {
      expect(computeCoverage(rows).totalRows).toBe(rows.length)
    }
  })
})

describe('countWithMetric', () => {
  test('uses !== null, not truthiness', () => {
    const rows = [makeRow({ coding: 0 })]
    expect(countWithMetric(rows, 'coding')).toBe(1)
  })
})

describe('countWithCost', () => {
  test('counts non-null aaCostPerTask', () => {
    const rows = [
      makeRow(),
      makeRow({ cursorSlug: 'b', aaCostPerTask: null }),
      makeRow({ cursorSlug: 'c', aaCostPerTask: 0 }),
    ]
    expect(countWithCost(rows)).toBe(2)
  })
})
