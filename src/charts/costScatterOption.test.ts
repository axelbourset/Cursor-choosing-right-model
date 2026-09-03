import { describe, expect, test } from 'vitest'
import type { ModelRow } from '@schema/snapshot'
import { makeParetoResult, type ParetoResult } from '@domain/pareto'
import { buildCostScatterOption } from './costScatterOption'
import { colorForProvider } from './providerColors'

function makeRow(overrides: Partial<ModelRow> = {}): ModelRow {
  return {
    cursorName: 'Test Model',
    // Derived from the name so fixture rows get distinct slugs, as real snapshots do
    // (resolve.ts emits one declaration per catalogue row, and ModelTable keys on it).
    cursorSlug: (overrides.cursorName ?? 'test-model').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
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

function scatterSeries(option: ReturnType<typeof buildCostScatterOption>) {
  const series = option.series as { type: string; data: unknown[] }[]
  return series.filter((s) => s.type === 'scatter')
}

function allScatterX(option: ReturnType<typeof buildCostScatterOption>): number[] {
  const scatters = scatterSeries(option) as { data: { value: [number, number] }[] }[]
  return scatters.flatMap((s) => s.data.map((point) => point.value[0]))
}

describe('buildCostScatterOption', () => {
  const frontier = [
    makeRow({ cursorName: 'F1', provider: 'Anthropic', intelligence: 60, priceInput: 1.0 }),
    makeRow({ cursorName: 'F2', provider: 'OpenAI', intelligence: 70, priceInput: 2.0 }),
  ]
  const dominated = [
    makeRow({ cursorName: 'D1', provider: 'Google', intelligence: 40, priceInput: 3.0 }),
    makeRow({ cursorName: 'D2', provider: 'Anthropic', intelligence: 45, priceInput: 4.0 }),
    makeRow({ cursorName: 'D3', provider: 'OpenAI', intelligence: 42, priceInput: 5.0 }),
  ]
  const pareto: ParetoResult = makeParetoResult({ frontier, dominated, excluded: [] })

  test('1 — three providers: three scatter series with correct point counts', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', 'input', false)
    const scatters = scatterSeries(option)
    expect(scatters).toHaveLength(3)
    expect(scatters.map((s) => (s as { data: unknown[] }).data.length).sort()).toEqual([1, 2, 2])
  })

  test('2 — showFrontier: true: a line series exists', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', 'input', true)
    const series = option.series as { type: string }[]
    expect(series.some((s) => s.type === 'line')).toBe(true)
  })

  test('3 — showFrontier: false: no line series', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', 'input', false)
    const series = option.series as { type: string }[]
    expect(series.some((s) => s.type === 'line')).toBe(false)
  })

  test('4 — the option: xAxis.type === log and names input token price', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', 'input', false)
    const xAxis = option.xAxis as { type: string; name?: string }
    expect(xAxis.type).toBe('log')
    expect(xAxis.name).toContain('1M input tokens')
  })

  test('4b — output cost axis: xAxis names output token price', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', 'output', false)
    const xAxis = option.xAxis as { name?: string }
    expect(xAxis.name).toContain('1M output tokens')
  })

  test('4c — output cost axis: scatter X values use priceOutput', () => {
    const rows = [
      makeRow({ cursorName: 'F1', intelligence: 60, priceInput: 1.0, priceOutput: 10.0 }),
      makeRow({ cursorName: 'D1', intelligence: 40, priceInput: 3.0, priceOutput: 30.0 }),
    ]
    const result: ParetoResult = makeParetoResult({
      frontier: [rows[0]!],
      dominated: [rows[1]!],
      excluded: [],
    })
    const option = buildCostScatterOption(result, 'intelligence', 'output', false)
    expect(allScatterX(option)).toEqual(expect.arrayContaining([10.0, 30.0]))
    expect(allScatterX(option)).not.toEqual(expect.arrayContaining([1.0, 3.0]))
  })

  test('4d — cache read cost axis: xAxis names cache-read token price', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', 'cacheRead', false)
    const xAxis = option.xAxis as { name?: string }
    expect(xAxis.name).toContain('cache-read')
  })

  test('4e — cache read cost axis: scatter X values use priceCacheRead', () => {
    const rows = [
      makeRow({
        cursorName: 'F1',
        intelligence: 60,
        priceInput: 1.0,
        priceOutput: 10.0,
        priceCacheRead: 0.1,
      }),
      makeRow({
        cursorName: 'D1',
        intelligence: 40,
        priceInput: 3.0,
        priceOutput: 30.0,
        priceCacheRead: 0.3,
      }),
    ]
    const result: ParetoResult = makeParetoResult({
      frontier: [rows[0]!],
      dominated: [rows[1]!],
      excluded: [],
    })
    const option = buildCostScatterOption(result, 'intelligence', 'cacheRead', false)
    expect(allScatterX(option)).toEqual(expect.arrayContaining([0.1, 0.3]))
  })

  test('5 — excluded rows: never appear in scatter data', () => {
    const excluded = [
      makeRow({ cursorName: 'E1', intelligence: 10, priceInput: null }),
      makeRow({ cursorName: 'E2', intelligence: null, priceInput: 1.0 }),
      makeRow({ cursorName: 'E3', intelligence: 20, priceInput: 0 }),
    ]
    const result: ParetoResult = makeParetoResult({ frontier, dominated, excluded })
    const option = buildCostScatterOption(result, 'intelligence', 'input', true)
    const xs = allScatterX(option)
    expect(xs).not.toContain(0)
    for (const row of excluded) {
      if (row.priceInput !== null && row.intelligence !== null && row.priceInput > 0) {
        expect(xs).not.toContain(row.priceInput)
      }
    }
  })

  test('6 — dominated points: lower opacity than frontier in the same provider', () => {
    const local: ParetoResult = makeParetoResult({
      frontier: [
        makeRow({ cursorName: 'F', provider: 'Anthropic', intelligence: 80, priceInput: 1 }),
      ],
      dominated: [
        makeRow({ cursorName: 'D', provider: 'Anthropic', intelligence: 40, priceInput: 3 }),
      ],
      excluded: [],
    })
    const option = buildCostScatterOption(local, 'intelligence', 'input', false)
    const scatters = scatterSeries(option) as {
      data: { itemStyle?: { opacity?: number } }[]
    }[]
    const opacities = scatters[0]!.data.map((point) => point.itemStyle?.opacity ?? 1)
    expect(Math.min(...opacities)).toBeLessThan(Math.max(...opacities))
  })

  test('7 — frontier line points: ordered ascending by input price', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', 'input', true)
    const series = option.series as { type: string; data: [number, number][] }[]
    const line = series.find((s) => s.type === 'line')
    expect(line).toBeDefined()
    const costs = line!.data.map((point) => point[0])
    expect(costs).toEqual([...costs].sort((a, b) => a - b))
    expect(costs).toEqual([1.0, 2.0])
  })

  test('8 — empty ParetoResult: no throw, legend hidden', () => {
    const empty: ParetoResult = makeParetoResult({ frontier: [], dominated: [], excluded: [] })
    const option = buildCostScatterOption(empty, 'intelligence', 'input', true)
    expect(scatterSeries(option)).toHaveLength(0)
    const legend = option.legend as { show?: boolean } | undefined
    expect(legend?.show).toBe(false)
  })

  test("9 — metric 'agentic': Y values come from agentic", () => {
    const rows = [
      makeRow({ cursorName: 'F1', agentic: 11, priceInput: 1.0 }),
      makeRow({ cursorName: 'D1', agentic: 22, priceInput: 2.0 }),
    ]
    const result: ParetoResult = makeParetoResult({
      frontier: [rows[0]!],
      dominated: [rows[1]!],
      excluded: [],
    })
    const option = buildCostScatterOption(result, 'agentic', 'input', false)
    const scatters = scatterSeries(option) as { data: { value: [number, number] }[] }[]
    const ys = scatters.flatMap((s) => s.data.map((point) => point.value[1]))
    expect(ys).toEqual(expect.arrayContaining([11, 22]))
  })

  test('10 — legend lists providers and tooltip formatter is present', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', 'input', false)
    const legend = option.legend as { show?: boolean; data?: string[] } | undefined
    expect(legend?.show).toBe(true)
    expect(legend?.data).toEqual(expect.arrayContaining(['Anthropic', 'Google', 'OpenAI']))
    expect(option.tooltip).toBeDefined()
    const formatter = (option.tooltip as { formatter: (params: unknown) => string }).formatter
    expect(formatter).toBeTypeOf('function')

    // Invoked, not just type-checked: this formatter is the only place raw field values
    // reach the screen, and it shipped rendering a null price as the string "$null".
    const nullPriced = makeRow({
      cursorName: 'Null Priced',
      intelligence: 50,
      priceInput: 2,
      priceOutput: null,
      priceCacheRead: null,
    })
    const html = formatter({ data: { row: nullPriced, value: [2, 50] } })

    expect(html).toContain('Output: <b>—</b>')
    expect(html).toContain('Cache read: <b>—</b>')
    expect(html).not.toContain('null')
    expect(html).not.toContain('$0')
  })

  test('12b — the frontier line series has no row, and the formatter returns empty', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', 'input', true)
    const formatter = (option.tooltip as { formatter: (params: unknown) => string }).formatter

    expect(formatter({ data: [1, 2] })).toBe('')
    expect(formatter({})).toBe('')
  })

  test('11 — provider series colours come from the provider palette, not the theme', () => {
    const local: ParetoResult = makeParetoResult({
      frontier: [
        makeRow({ cursorName: 'F', provider: 'Anthropic', intelligence: 80, priceInput: 1 }),
      ],
      dominated: [],
      excluded: [],
    })
    const option = buildCostScatterOption(local, 'intelligence', 'input', false)
    const scatters = scatterSeries(option) as { itemStyle?: { color?: string } }[]
    expect(scatters[0]!.itemStyle?.color).toBe(colorForProvider('Anthropic'))
  })

  test('12 — every scatter series uses the circle symbol regardless of provider', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', 'input', false)
    const scatters = scatterSeries(option) as { symbol?: string }[]
    expect(scatters).toHaveLength(3)
    for (const scatter of scatters) {
      expect(scatter.symbol).toBe('circle')
    }
  })

  test('13 — tooltip escapes model and provider strings', () => {
    // ECharts injects the tooltip with innerHTML and the snapshot is user-supplied, so a
    // crafted cursorName would otherwise execute in the page origin on hover.
    const evil = makeRow({
      cursorName: '<img src=x onerror="alert(1)">',
      provider: '<script>alert(2)</script>',
      intelligence: 50,
      priceInput: 2,
    })
    const option = buildCostScatterOption(
      makeParetoResult({ frontier: [evil], dominated: [], excluded: [] }),
      'intelligence',
      'input',
      false,
    )
    const formatter = (option.tooltip as { formatter: (params: unknown) => string }).formatter
    const html = formatter({ data: { row: evil, value: [2, 50] } })

    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;img')
  })

  test('14 — the tooltip guard rejects a malformed data payload', () => {
    const option = buildCostScatterOption(pareto, 'intelligence', 'input', false)
    const formatter = (option.tooltip as { formatter: (params: unknown) => string }).formatter

    expect(formatter({ data: { row: 5 } })).toBe('')
    expect(formatter('nonsense')).toBe('')
    expect(formatter(null)).toBe('')
  })
})
