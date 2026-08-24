import { describe, expect, test } from 'vitest'
import type { ModelRow } from '@schema/snapshot'
import type { ParetoResult } from '@domain/pareto'
import { buildCostScatterOption } from './costScatterOption'
import { CHART_THEME, type ChartTheme } from './theme'

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

function scatterSeries(option: ReturnType<typeof buildCostScatterOption>) {
  const series = option.series as Array<{ type: string; data: unknown[] }>
  return series.filter((s) => s.type === 'scatter')
}

function allSeriesData(option: ReturnType<typeof buildCostScatterOption>): unknown[] {
  const series = option.series as Array<{ data: unknown[] }>
  return series.flatMap((s) => s.data)
}

describe('buildCostScatterOption', () => {
  const frontier = [
    makeRow({ cursorName: 'F1', intelligence: 60, aaCostPerTask: 1.0 }),
    makeRow({ cursorName: 'F2', intelligence: 70, aaCostPerTask: 2.0 }),
  ]
  const dominated = [
    makeRow({ cursorName: 'D1', intelligence: 40, aaCostPerTask: 3.0 }),
    makeRow({ cursorName: 'D2', intelligence: 45, aaCostPerTask: 4.0 }),
    makeRow({ cursorName: 'D3', intelligence: 42, aaCostPerTask: 5.0 }),
  ]
  const pareto: ParetoResult = { frontier, dominated, excluded: [] }

  test('1 — frontier 2, dominated 3: two scatter series with 2 and 3 points', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', false)
    const scatters = scatterSeries(option)
    expect(scatters).toHaveLength(2)
    expect(scatters[0]!.data).toHaveLength(2)
    expect(scatters[1]!.data).toHaveLength(3)
  })

  test('2 — showFrontier: true: a line series exists', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', true)
    const series = option.series as Array<{ type: string }>
    expect(series.some((s) => s.type === 'line')).toBe(true)
  })

  test('3 — showFrontier: false: no line series', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', false)
    const series = option.series as Array<{ type: string }>
    expect(series.some((s) => s.type === 'line')).toBe(false)
  })

  test('4 — the option: xAxis.type === log', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', false)
    const xAxis = option.xAxis as { type: string }
    expect(xAxis.type).toBe('log')
  })

  test('5 — excluded has 4 rows: none of them appears in any series', () => {
    const excluded = [
      makeRow({ cursorName: 'E1', intelligence: 10, aaCostPerTask: null }),
      makeRow({ cursorName: 'E2', intelligence: null, aaCostPerTask: 1.0 }),
      makeRow({ cursorName: 'E3', intelligence: 20, aaCostPerTask: 0.5 }),
      makeRow({ cursorName: 'E4', intelligence: 25, aaCostPerTask: 0.8 }),
    ]
    const result: ParetoResult = { frontier, dominated, excluded }
    const option = buildCostScatterOption(result, 'intelligence', true)
    const data = allSeriesData(option)
    for (const row of excluded) {
      const cost = row.aaCostPerTask
      const score = row.intelligence
      if (cost !== null && score !== null) {
        expect(data).not.toContainEqual([cost, score])
      }
    }
    expect(data).not.toContainEqual([null, 10])
    expect(data).not.toContainEqual([1.0, null])
  })

  test('6 — the dominated series: has lower opacity than the frontier series', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', false)
    const scatters = scatterSeries(option) as Array<{ itemStyle?: { opacity?: number } }>
    const frontierOpacity = scatters[0]!.itemStyle?.opacity ?? 1
    const dominatedOpacity = scatters[1]!.itemStyle?.opacity ?? 1
    expect(dominatedOpacity).toBeLessThan(frontierOpacity)
  })

  test('7 — the line series points: ordered ascending by cost', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', true)
    const series = option.series as Array<{ type: string; data: Array<[number, number]> }>
    const line = series.find((s) => s.type === 'line')
    expect(line).toBeDefined()
    const costs = line!.data.map((point) => point[0])
    expect(costs).toEqual([...costs].sort((a, b) => a - b))
    expect(costs).toEqual([1.0, 2.0])
  })

  test('8 — empty ParetoResult: no throw, all series empty', () => {
    const empty: ParetoResult = { frontier: [], dominated: [], excluded: [] }
    const option = buildCostScatterOption(empty, 'intelligence', true)
    const scatters = scatterSeries(option)
    expect(scatters[0]!.data).toHaveLength(0)
    expect(scatters[1]!.data).toHaveLength(0)
  })

  test("9 — metric 'agentic': Y values come from agentic", () => {
    const rows = [
      makeRow({ cursorName: 'F1', agentic: 11, aaCostPerTask: 1.0 }),
      makeRow({ cursorName: 'D1', agentic: 22, aaCostPerTask: 2.0 }),
    ]
    const result: ParetoResult = {
      frontier: [rows[0]!],
      dominated: [rows[1]!],
      excluded: [],
    }
    const option = buildCostScatterOption(result, 'agentic', false)
    const scatters = scatterSeries(option) as Array<{ data: Array<[number, number]> }>
    expect(scatters[0]!.data[0]).toEqual([1.0, 11])
    expect(scatters[1]!.data[0]).toEqual([2.0, 22])
  })

  test('10 — explicit theme: frontier uses series[0], dominated uses series[1], legend present', () => {
    const custom: ChartTheme = {
      ...CHART_THEME,
      series: [
        '#ff0000',
        '#00ff00',
        '#0000ff',
        '#aaaaaa',
        '#bbbbbb',
        '#cccccc',
        '#dddddd',
        '#eeeeee',
      ],
    }
    const option = buildCostScatterOption(pareto, 'intelligence', false, custom)
    const scatters = scatterSeries(option) as Array<{ itemStyle?: { color?: string } }>
    expect(scatters[0]!.itemStyle?.color).toBe('#ff0000')
    expect(scatters[1]!.itemStyle?.color).toBe('#00ff00')
    const legend = option.legend as { show?: boolean; data?: string[] } | undefined
    expect(legend?.show).toBe(true)
    expect(legend?.data).toEqual(['Frontier', 'Dominated'])
  })
})
