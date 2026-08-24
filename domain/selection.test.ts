import { describe, expect, test, vi } from 'vitest'
import type { ModelRow } from '@schema/snapshot'
import * as pareto from './pareto'
import { DEFAULT_FILTERS, selectForMetric, selectPlottable, type Filters } from './selection'

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

function makeFiveRows(): ModelRow[] {
  return [
    makeRow({ cursorName: 'A', cursorSlug: 'a', provider: 'Anthropic' }),
    makeRow({ cursorName: 'B', cursorSlug: 'b', provider: 'Anthropic' }),
    makeRow({ cursorName: 'C', cursorSlug: 'c', provider: 'OpenAI', hidden: true }),
    makeRow({ cursorName: 'D', cursorSlug: 'd', provider: 'Google', hidden: true }),
    makeRow({ cursorName: 'E', cursorSlug: 'e', provider: 'Google', hidden: true }),
  ]
}

function assertInvariant(selection: ReturnType<typeof selectForMetric>): void {
  expect(selection.shown + selection.excludedForMissingMetric.length).toBe(selection.total)
}

describe('selectForMetric', () => {
  test('1 — 5 rows, no filters, all have intelligence', () => {
    const rows = makeFiveRows()
    const selection = selectForMetric(rows, 'intelligence', DEFAULT_FILTERS)
    expect(selection.shown).toBe(5)
    expect(selection.total).toBe(5)
    assertInvariant(selection)
  })

  test('2 — 5 rows, 2 lack coding, metric = coding', () => {
    const rows = [
      makeRow({ cursorSlug: 'a' }),
      makeRow({ cursorSlug: 'b', coding: null }),
      makeRow({ cursorSlug: 'c' }),
      makeRow({ cursorSlug: 'd', coding: null }),
      makeRow({ cursorSlug: 'e' }),
    ]
    const selection = selectForMetric(rows, 'coding', DEFAULT_FILTERS)
    expect(selection.shown).toBe(3)
    expect(selection.total).toBe(5)
    assertInvariant(selection)
  })

  test('3 — 5 rows including hidden models: all remain visible', () => {
    const rows = makeFiveRows()
    const selection = selectForMetric(rows, 'intelligence', DEFAULT_FILTERS)
    expect(selection.total).toBe(5)
    expect(selection.shown).toBe(5)
    assertInvariant(selection)
  })

  test('4 — 5 rows, 2 visible Anthropic, 1 lacks coding', () => {
    const rows = [
      makeRow({ cursorSlug: 'a', provider: 'Anthropic' }),
      makeRow({ cursorSlug: 'b', provider: 'Anthropic', coding: null }),
      makeRow({ cursorSlug: 'c', provider: 'OpenAI', hidden: true }),
      makeRow({ cursorSlug: 'd', provider: 'Google', hidden: true }),
      makeRow({ cursorSlug: 'e', provider: 'Google', hidden: true }),
    ]
    const selection = selectForMetric(rows, 'coding', DEFAULT_FILTERS)
    expect(selection.shown).toBe(4)
    expect(selection.total).toBe(5)
    assertInvariant(selection)
  })

  test("5 — provider: 'Anthropic' with 2 of 5 Anthropic", () => {
    const rows = makeFiveRows()
    const filters: Filters = { ...DEFAULT_FILTERS, provider: 'Anthropic' }
    const selection = selectForMetric(rows, 'intelligence', filters)
    expect(selection.total).toBe(2)
    assertInvariant(selection)
  })

  test("6 — provider: 'Nonexistent'", () => {
    const rows = makeFiveRows()
    const filters: Filters = { ...DEFAULT_FILTERS, provider: 'Nonexistent' }
    const selection = selectForMetric(rows, 'intelligence', filters)
    expect(selection.shown).toBe(0)
    expect(selection.total).toBe(0)
    assertInvariant(selection)
  })

  test('7 — shown + excludedForMissingMetric.length === total on every non-pareto case', () => {
    const rows = makeFiveRows()
    const cases: Array<{ metric: 'intelligence' | 'coding'; filters: Filters }> = [
      { metric: 'intelligence', filters: DEFAULT_FILTERS },
      { metric: 'coding', filters: DEFAULT_FILTERS },
      { metric: 'intelligence', filters: { ...DEFAULT_FILTERS, provider: 'Anthropic' } },
      { metric: 'intelligence', filters: { ...DEFAULT_FILTERS, provider: 'Nonexistent' } },
    ]
    for (const { metric, filters } of cases) {
      assertInvariant(selectForMetric(rows, metric, filters))
    }
  })

  test('8 — DEFAULT_FILTERS', () => {
    expect(DEFAULT_FILTERS).toEqual({
      provider: null,
      paretoOnly: false,
    })
  })

  test('9 — a row with metric 0', () => {
    const rows = [makeRow({ intelligence: 0 })]
    const selection = selectForMetric(rows, 'intelligence', DEFAULT_FILTERS)
    expect(selection.visible).toHaveLength(1)
    expect(selection.shown).toBe(1)
    expect(selection.excludedForMissingMetric).toHaveLength(0)
    assertInvariant(selection)
  })

  test('10 — paretoOnly: true, 4 rows of which 2 are dominated for this metric', () => {
    const rows = [
      makeRow({ cursorName: 'A', intelligence: 60, priceInput: 1 }),
      makeRow({ cursorName: 'B', intelligence: 50, priceInput: 2 }),
      makeRow({ cursorName: 'C', intelligence: 70, priceInput: 3 }),
      makeRow({ cursorName: 'D', intelligence: 60, priceInput: 4 }),
    ]
    const filters: Filters = { ...DEFAULT_FILTERS, paretoOnly: true }
    const selection = selectForMetric(rows, 'intelligence', filters)
    expect(selection.visible).toHaveLength(2)
    expect(selection.total).toBe(4)
  })

  test('11 — paretoOnly: true with a different metric', () => {
    const rows = [
      makeRow({ cursorName: 'A', intelligence: 70, coding: 30, priceInput: 3 }),
      makeRow({ cursorName: 'B', intelligence: 60, coding: 80, priceInput: 2 }),
      makeRow({ cursorName: 'C', intelligence: 50, coding: 50, priceInput: 1 }),
      makeRow({ cursorName: 'D', intelligence: 55, coding: 40, priceInput: 4 }),
    ]
    const filters: Filters = { ...DEFAULT_FILTERS, paretoOnly: true }
    const intel = selectForMetric(rows, 'intelligence', filters)
    const coding = selectForMetric(rows, 'coding', filters)
    expect(intel.visible.map((r) => r.cursorName).sort()).not.toEqual(
      coding.visible.map((r) => r.cursorName).sort(),
    )
  })

  test('12 — paretoOnly: false', () => {
    const spy = vi.spyOn(pareto, 'computePareto')
    const rows = [makeRow(), makeRow({ cursorSlug: 'b' })]
    selectForMetric(rows, 'intelligence', DEFAULT_FILTERS)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('selectPlottable', () => {
  test('1 — paretoOnly: chartRows is frontier subset of plottable', () => {
    const rows = [
      makeRow({ cursorName: 'A', intelligence: 60, priceInput: 1 }),
      makeRow({ cursorName: 'B', intelligence: 50, priceInput: 2 }),
      makeRow({ cursorName: 'C', intelligence: 70, priceInput: 3 }),
      makeRow({ cursorName: 'D', intelligence: 60, priceInput: 4 }),
    ]
    const all = selectPlottable(rows, 'intelligence', DEFAULT_FILTERS)
    expect(all.plottable).toHaveLength(4)
    expect(all.chartRows).toHaveLength(4)

    const frontierOnly = selectPlottable(rows, 'intelligence', {
      ...DEFAULT_FILTERS,
      paretoOnly: true,
    })
    expect(frontierOnly.chartRows).toHaveLength(2)
    expect(frontierOnly.shown).toBe(2)
  })

  test('2 — rows without input price are excluded from plottable', () => {
    const rows = [
      makeRow({ cursorSlug: 'a', priceInput: 1 }),
      makeRow({ cursorSlug: 'b', priceInput: null }),
    ]
    const selection = selectPlottable(rows, 'intelligence', DEFAULT_FILTERS)
    expect(selection.plottable).toHaveLength(1)
    expect(selection.total).toBe(2)
  })
})
