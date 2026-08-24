import { describe, expect, test } from 'vitest'
import type { ModelRow } from '@schema/snapshot'
import { buildScoreBarOption } from './scoreBarOption'
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

describe('buildScoreBarOption', () => {
  const threeRows = [
    makeRow({ cursorName: 'Alpha', intelligence: 10, coding: 11, agentic: 12 }),
    makeRow({ cursorName: 'Beta', intelligence: 20, coding: 21, agentic: 22 }),
    makeRow({ cursorName: 'Gamma', intelligence: 30, coding: 31, agentic: 32 }),
  ]

  test('1 — 3 rows with intelligence: series[0].data has length 3', () => {
    const option = buildScoreBarOption(threeRows, 'intelligence')
    const series = option.series as Array<{ data: unknown[] }>
    expect(series[0]!.data).toHaveLength(3)
  })

  test('2 — 3 rows with intelligence: yAxis.data equals the three cursorNames', () => {
    const option = buildScoreBarOption(threeRows, 'intelligence')
    const yAxis = option.yAxis as { data: string[] }
    expect(yAxis.data).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  test("3 — metric 'coding': values come from coding, not intelligence", () => {
    const option = buildScoreBarOption(threeRows, 'coding')
    const series = option.series as Array<{ data: number[] }>
    expect(series[0]!.data).toEqual([11, 21, 31])
  })

  test('4 — empty rows: series[0].data has length 0, no throw', () => {
    const option = buildScoreBarOption([], 'intelligence')
    const series = option.series as Array<{ data: unknown[] }>
    expect(series[0]!.data).toHaveLength(0)
  })

  test('5 — returned option: series[0].data contains no 0 unless metric is genuinely 0', () => {
    const rows = [
      makeRow({ cursorName: 'Zero', intelligence: 0 }),
      makeRow({ cursorName: 'NonZero', intelligence: 42 }),
    ]
    const option = buildScoreBarOption(rows, 'intelligence')
    const series = option.series as Array<{ data: number[] }>
    expect(series[0]!.data).toEqual([0, 42])
    expect(series[0]!.data.filter((value) => value === 0)).toHaveLength(1)
  })

  test('6 — option: labelLayout.hideOverlap === true', () => {
    const option = buildScoreBarOption(threeRows, 'intelligence')
    expect(option.labelLayout).toEqual({ hideOverlap: true })
  })

  test('7 — option: yAxis.type === category (horizontal bars)', () => {
    const option = buildScoreBarOption(threeRows, 'intelligence')
    const yAxis = option.yAxis as { type: string }
    expect(yAxis.type).toBe('category')
  })

  test('8 — explicit theme: bar series uses theme.series[0] and no legend', () => {
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
    const option = buildScoreBarOption(threeRows, 'intelligence', custom)
    const series = option.series as Array<{ itemStyle?: { color?: string } }>
    expect(series[0]!.itemStyle?.color).toBe('#ff0000')
    expect(option.legend).toBeUndefined()
  })
})
