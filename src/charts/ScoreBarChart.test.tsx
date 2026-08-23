import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ModelRow } from '@schema/snapshot'
import { DEFAULT_FILTERS } from '@domain/selection'
import { ScoreBarChart } from './ScoreBarChart'

const setOption = vi.fn()

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption,
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}))

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

function makeFiveRows(): ModelRow[] {
  return [
    makeRow({ cursorName: 'A', cursorSlug: 'a' }),
    makeRow({ cursorName: 'B', cursorSlug: 'b' }),
    makeRow({ cursorName: 'C', cursorSlug: 'c' }),
    makeRow({ cursorName: 'D', cursorSlug: 'd' }),
    makeRow({ cursorName: 'E', cursorSlug: 'e' }),
  ]
}

function latestSeriesLength(): number {
  const lastCall = setOption.mock.calls.at(-1)
  const option = lastCall?.[0] as { series: Array<{ data: unknown[] }> }
  return option.series[0]!.data.length
}

afterEach(() => {
  cleanup()
  setOption.mockClear()
})

describe('ScoreBarChart', () => {
  test('8 — 5 rows, all with all metrics: renders 5/5 shown', () => {
    render(
      <ScoreBarChart
        rows={makeFiveRows()}
        filters={DEFAULT_FILTERS}
        metric="intelligence"
        onMetricChange={vi.fn()}
      />,
    )
    expect(screen.getByText('5/5 shown')).toBeInTheDocument()
  })

  test('9 — 5 rows, 2 lacking coding; click Coding tab: renders 3/5 shown', () => {
    const rows = [
      makeRow({ cursorSlug: 'a' }),
      makeRow({ cursorSlug: 'b', coding: null }),
      makeRow({ cursorSlug: 'c' }),
      makeRow({ cursorSlug: 'd', coding: null }),
      makeRow({ cursorSlug: 'e' }),
    ]
    const onMetricChange = vi.fn()
    render(
      <ScoreBarChart
        rows={rows}
        filters={DEFAULT_FILTERS}
        metric="intelligence"
        onMetricChange={onMetricChange}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Coding' }))
    expect(onMetricChange).toHaveBeenCalledWith('coding')
    render(
      <ScoreBarChart
        rows={rows}
        filters={DEFAULT_FILTERS}
        metric="coding"
        onMetricChange={onMetricChange}
      />,
    )
    expect(screen.getByText('3/5 shown')).toBeInTheDocument()
  })

  test('10 — three tab buttons labelled Intelligence, Coding, Agentic', () => {
    render(
      <ScoreBarChart
        rows={makeFiveRows()}
        filters={DEFAULT_FILTERS}
        metric="intelligence"
        onMetricChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Intelligence' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Coding' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Agentic' })).toBeInTheDocument()
  })

  test('11 — initial render: Intelligence tab is active', () => {
    render(
      <ScoreBarChart
        rows={makeFiveRows()}
        filters={DEFAULT_FILTERS}
        metric="intelligence"
        onMetricChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Intelligence' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Coding' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('tab', { name: 'Agentic' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('12 — coverage number equals the number of points in the chart series', () => {
    const rows = [
      makeRow({ cursorSlug: 'a' }),
      makeRow({ cursorSlug: 'b', coding: null }),
      makeRow({ cursorSlug: 'c' }),
      makeRow({ cursorSlug: 'd', coding: null }),
      makeRow({ cursorSlug: 'e' }),
    ]
    render(
      <ScoreBarChart
        rows={rows}
        filters={DEFAULT_FILTERS}
        metric="coding"
        onMetricChange={vi.fn()}
      />,
    )
    const shown = Number(screen.getByText(/shown/).textContent?.split('/')[0])
    expect(shown).toBe(latestSeriesLength())
  })
})
