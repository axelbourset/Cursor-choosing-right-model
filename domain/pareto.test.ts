import { describe, expect, test } from 'vitest'
import type { ModelRow } from '@schema/snapshot'
import { computePareto, isOnFrontier } from './pareto'

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
    priceInput: 1.0,
    priceOutput: 0.02,
    priceCacheRead: 0.003,
    priceCacheWrite: 0.004,
    ...overrides,
  }
}

function rowNames(rows: readonly ModelRow[]): string[] {
  return rows.map((r) => r.cursorName)
}

function assertPartition(result: ReturnType<typeof computePareto>, total: number): void {
  expect(result.frontier.length + result.dominated.length + result.excluded.length).toBe(total)
}

describe('computePareto', () => {
  test('1 — A(60, 1.0), B(50, 2.0): B worse on both', () => {
    const a = makeRow({ cursorName: 'A', intelligence: 60, priceInput: 1.0 })
    const b = makeRow({ cursorName: 'B', intelligence: 50, priceInput: 2.0 })
    const result = computePareto([a, b], 'intelligence')
    expect(rowNames(result.frontier)).toEqual(['A'])
    expect(rowNames(result.dominated)).toEqual(['B'])
    expect(rowNames(result.excluded)).toEqual([])
    assertPartition(result, 2)
  })

  test('2 — A(60, 2.0), B(50, 1.0): neither dominates', () => {
    const a = makeRow({ cursorName: 'A', intelligence: 60, priceInput: 2.0 })
    const b = makeRow({ cursorName: 'B', intelligence: 50, priceInput: 1.0 })
    const result = computePareto([a, b], 'intelligence')
    expect(rowNames(result.frontier)).toEqual(['B', 'A'])
    expect(rowNames(result.dominated)).toEqual([])
    expect(rowNames(result.excluded)).toEqual([])
    assertPartition(result, 2)
  })

  test('3 — A(60, 1.0), B(60, 2.0): equal score, higher cost dominated', () => {
    const a = makeRow({ cursorName: 'A', intelligence: 60, priceInput: 1.0 })
    const b = makeRow({ cursorName: 'B', intelligence: 60, priceInput: 2.0 })
    const result = computePareto([a, b], 'intelligence')
    expect(rowNames(result.frontier)).toEqual(['A'])
    expect(rowNames(result.dominated)).toEqual(['B'])
    expect(rowNames(result.excluded)).toEqual([])
    assertPartition(result, 2)
  })

  test('4 — A(60, 1.0), B(50, 1.0): equal cost, lower score dominated', () => {
    const a = makeRow({ cursorName: 'A', intelligence: 60, priceInput: 1.0 })
    const b = makeRow({ cursorName: 'B', intelligence: 50, priceInput: 1.0 })
    const result = computePareto([a, b], 'intelligence')
    expect(rowNames(result.frontier)).toEqual(['A'])
    expect(rowNames(result.dominated)).toEqual(['B'])
    expect(rowNames(result.excluded)).toEqual([])
    assertPartition(result, 2)
  })

  test('5 — A(60, 1.0), B(60, 1.0): identical points, both on frontier', () => {
    const a = makeRow({ cursorName: 'A', intelligence: 60, priceInput: 1.0 })
    const b = makeRow({ cursorName: 'B', intelligence: 60, priceInput: 1.0 })
    const result = computePareto([a, b], 'intelligence')
    expect(rowNames(result.frontier).sort()).toEqual(['A', 'B'])
    expect(rowNames(result.dominated)).toEqual([])
    expect(rowNames(result.excluded)).toEqual([])
    assertPartition(result, 2)
  })

  test('6 — A(null, 1.0), B(50, 2.0): null score excluded, not treated as 0', () => {
    const a = makeRow({ cursorName: 'A', intelligence: null, priceInput: 1.0 })
    const b = makeRow({ cursorName: 'B', intelligence: 50, priceInput: 2.0 })
    const result = computePareto([a, b], 'intelligence')
    expect(rowNames(result.frontier)).toEqual(['B'])
    expect(rowNames(result.dominated)).toEqual([])
    expect(rowNames(result.excluded)).toEqual(['A'])
    assertPartition(result, 2)
  })

  test('7 — A(60, null), B(50, 2.0): null cost excluded', () => {
    const a = makeRow({ cursorName: 'A', intelligence: 60, priceInput: null })
    const b = makeRow({ cursorName: 'B', intelligence: 50, priceInput: 2.0 })
    const result = computePareto([a, b], 'intelligence')
    expect(rowNames(result.frontier)).toEqual(['B'])
    expect(rowNames(result.dominated)).toEqual([])
    expect(rowNames(result.excluded)).toEqual(['A'])
    assertPartition(result, 2)
  })

  test('8 — all rows have null cost: frontier empty, all excluded', () => {
    const a = makeRow({ cursorName: 'A', intelligence: 60, priceInput: null })
    const b = makeRow({ cursorName: 'B', intelligence: 50, priceInput: null })
    const result = computePareto([a, b], 'intelligence')
    expect(rowNames(result.frontier)).toEqual([])
    expect(rowNames(result.dominated)).toEqual([])
    expect(rowNames(result.excluded).sort()).toEqual(['A', 'B'])
    assertPartition(result, 2)
  })

  test('9 — empty input', () => {
    const result = computePareto([], 'intelligence')
    expect(rowNames(result.frontier)).toEqual([])
    expect(rowNames(result.dominated)).toEqual([])
    expect(rowNames(result.excluded)).toEqual([])
    assertPartition(result, 0)
  })

  test('10 — single row A(60, 1.0)', () => {
    const a = makeRow({ cursorName: 'A', intelligence: 60, priceInput: 1.0 })
    const result = computePareto([a], 'intelligence')
    expect(rowNames(result.frontier)).toEqual(['A'])
    expect(rowNames(result.dominated)).toEqual([])
    expect(rowNames(result.excluded)).toEqual([])
    assertPartition(result, 1)
  })

  test('11 — A(70,3), B(60,2), C(50,1), D(55,4)', () => {
    const a = makeRow({ cursorName: 'A', intelligence: 70, priceInput: 3 })
    const b = makeRow({ cursorName: 'B', intelligence: 60, priceInput: 2 })
    const c = makeRow({ cursorName: 'C', intelligence: 50, priceInput: 1 })
    const d = makeRow({ cursorName: 'D', intelligence: 55, priceInput: 4 })
    const result = computePareto([a, b, c, d], 'intelligence')
    expect(rowNames(result.frontier)).toEqual(['C', 'B', 'A'])
    expect(rowNames(result.dominated)).toEqual(['D'])
    expect(rowNames(result.excluded)).toEqual([])
    assertPartition(result, 4)
  })

  test('12 — frontier output ordering: ascending by priceInput', () => {
    const a = makeRow({ cursorName: 'A', intelligence: 70, priceInput: 3 })
    const b = makeRow({ cursorName: 'B', intelligence: 60, priceInput: 2 })
    const c = makeRow({ cursorName: 'C', intelligence: 50, priceInput: 1 })
    const result = computePareto([a, b, c], 'intelligence')
    const costs = result.frontier.map((r) => r.priceInput)
    expect(costs).toEqual([1, 2, 3])
    assertPartition(result, 3)
  })
})

describe('computePareto properties', () => {
  test('13 — highest metric among rows with both axes is always on frontier', () => {
    const rows: ModelRow[] = []
    for (let i = 0; i < 20; i++) {
      rows.push(
        makeRow({
          cursorName: `Row${i}`,
          intelligence: (i * 7 + 13) % 100,
          priceInput: ((i * 3 + 5) % 50) / 10 + 0.5,
        }),
      )
    }
    const result = computePareto(rows, 'intelligence')
    const eligible = rows.filter((r) => r.intelligence !== null && r.priceInput !== null)
    const maxScore = Math.max(...eligible.map((r) => r.intelligence as number))
    const maxRow = eligible.find((r) => r.intelligence === maxScore)!
    expect(isOnFrontier(maxRow, result)).toBe(true)
    assertPartition(result, rows.length)
  })

  test('14 — as cost increases along frontier, metric strictly increases', () => {
    const rows = [
      makeRow({ cursorName: 'A', intelligence: 70, priceInput: 3 }),
      makeRow({ cursorName: 'B', intelligence: 60, priceInput: 2 }),
      makeRow({ cursorName: 'C', intelligence: 50, priceInput: 1 }),
      makeRow({ cursorName: 'D', intelligence: 55, priceInput: 4 }),
    ]
    const result = computePareto(rows, 'intelligence')
    for (let i = 1; i < result.frontier.length; i++) {
      const prev = result.frontier[i - 1]!
      const curr = result.frontier[i]!
      expect(curr.priceInput!).toBeGreaterThan(prev.priceInput!)
      expect(curr.intelligence!).toBeGreaterThan(prev.intelligence!)
    }
    assertPartition(result, rows.length)
  })

  test('15 — partition invariant on every case above', () => {
    const cases: ModelRow[][] = [
      [
        makeRow({ cursorName: 'A', intelligence: 60, priceInput: 1.0 }),
        makeRow({ cursorName: 'B', intelligence: 50, priceInput: 2.0 }),
      ],
      [
        makeRow({ cursorName: 'A', intelligence: 60, priceInput: 2.0 }),
        makeRow({ cursorName: 'B', intelligence: 50, priceInput: 1.0 }),
      ],
      [
        makeRow({ cursorName: 'A', intelligence: 60, priceInput: 1.0 }),
        makeRow({ cursorName: 'B', intelligence: 60, priceInput: 2.0 }),
      ],
      [
        makeRow({ cursorName: 'A', intelligence: 60, priceInput: 1.0 }),
        makeRow({ cursorName: 'B', intelligence: 50, priceInput: 1.0 }),
      ],
      [
        makeRow({ cursorName: 'A', intelligence: 60, priceInput: 1.0 }),
        makeRow({ cursorName: 'B', intelligence: 60, priceInput: 1.0 }),
      ],
      [
        makeRow({ cursorName: 'A', intelligence: null, priceInput: 1.0 }),
        makeRow({ cursorName: 'B', intelligence: 50, priceInput: 2.0 }),
      ],
      [
        makeRow({ cursorName: 'A', intelligence: 60, priceInput: null }),
        makeRow({ cursorName: 'B', intelligence: 50, priceInput: 2.0 }),
      ],
      [
        makeRow({ cursorName: 'A', intelligence: 60, priceInput: null }),
        makeRow({ cursorName: 'B', intelligence: 50, priceInput: null }),
      ],
      [],
      [makeRow({ cursorName: 'A', intelligence: 60, priceInput: 1.0 })],
      [
        makeRow({ cursorName: 'A', intelligence: 70, priceInput: 3 }),
        makeRow({ cursorName: 'B', intelligence: 60, priceInput: 2 }),
        makeRow({ cursorName: 'C', intelligence: 50, priceInput: 1 }),
        makeRow({ cursorName: 'D', intelligence: 55, priceInput: 4 }),
      ],
    ]
    for (const rows of cases) {
      const result = computePareto(rows, 'intelligence')
      assertPartition(result, rows.length)
    }
  })
})

describe('isOnFrontier', () => {
  test('returns true for frontier member', () => {
    const a = makeRow({ cursorName: 'A', intelligence: 60, priceInput: 1.0 })
    const b = makeRow({ cursorName: 'B', intelligence: 50, priceInput: 2.0 })
    const result = computePareto([a, b], 'intelligence')
    expect(isOnFrontier(a, result)).toBe(true)
    expect(isOnFrontier(b, result)).toBe(false)
  })
})
