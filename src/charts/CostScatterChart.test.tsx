import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ModelRow } from '@schema/snapshot'
import { DEFAULT_FILTERS } from '@domain/selection'
import { CostScatterChart } from './CostScatterChart'

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

function scatterXValues(): number[] {
  const lastCall = setOption.mock.calls.at(-1)
  const option = lastCall?.[0] as { series: Array<{ type: string; data: Array<[number, number]> }> }
  return option.series
    .filter((s) => s.type === 'scatter')
    .flatMap((s) => s.data.map((point) => point[0]))
}

function frontierLegendCount(): number {
  const text = screen.getByTestId('frontier-legend').textContent ?? ''
  const match = text.match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

afterEach(() => {
  cleanup()
  setOption.mockClear()
})

describe('CostScatterChart', () => {
  test('10 — 4 rows, 1 with null cost: the coverage note shows 3/4', () => {
    const rows = [
      makeRow({ cursorSlug: 'a', aaCostPerTask: 1.0 }),
      makeRow({ cursorSlug: 'b', aaCostPerTask: 2.0 }),
      makeRow({ cursorSlug: 'c', aaCostPerTask: null }),
      makeRow({ cursorSlug: 'd', aaCostPerTask: 3.0 }),
    ]
    render(
      <CostScatterChart
        rows={rows}
        filters={DEFAULT_FILTERS}
        metric="intelligence"
        showFrontier={true}
        onMetricChange={vi.fn()}
        onFrontierChange={vi.fn()}
      />,
    )
    expect(screen.getByText('3/4 shown')).toBeInTheDocument()
  })

  test('10b — the same: the null-cost row is counted in total and excluded from the series', () => {
    const rows = [
      makeRow({ cursorSlug: 'a', aaCostPerTask: 1.0 }),
      makeRow({ cursorSlug: 'b', aaCostPerTask: 2.0 }),
      makeRow({ cursorSlug: 'c', aaCostPerTask: null }),
      makeRow({ cursorSlug: 'd', aaCostPerTask: 3.0 }),
    ]
    render(
      <CostScatterChart
        rows={rows}
        filters={DEFAULT_FILTERS}
        metric="intelligence"
        showFrontier={true}
        onMetricChange={vi.fn()}
        onFrontierChange={vi.fn()}
      />,
    )
    expect(screen.getByText('3/4 shown')).toBeInTheDocument()
    expect(scatterXValues()).not.toContain(0)
    expect(scatterXValues()).toHaveLength(3)
  })

  test('11 — switching the Y axis to Coding: the frontier is recomputed', () => {
    const rows = [
      makeRow({
        cursorName: 'A',
        cursorSlug: 'a',
        intelligence: 90,
        coding: 20,
        aaCostPerTask: 5.0,
      }),
      makeRow({
        cursorName: 'B',
        cursorSlug: 'b',
        intelligence: 50,
        coding: 80,
        aaCostPerTask: 1.0,
      }),
      makeRow({
        cursorName: 'C',
        cursorSlug: 'c',
        intelligence: 70,
        coding: 50,
        aaCostPerTask: 3.0,
      }),
    ]
    const onMetricChange = vi.fn()
    render(
      <CostScatterChart
        rows={rows}
        filters={DEFAULT_FILTERS}
        metric="intelligence"
        showFrontier={true}
        onMetricChange={onMetricChange}
        onFrontierChange={vi.fn()}
      />,
    )
    expect(frontierLegendCount()).toBe(3)

    fireEvent.click(screen.getByRole('radio', { name: 'Coding' }))
    expect(onMetricChange).toHaveBeenCalledWith('coding')

    cleanup()
    render(
      <CostScatterChart
        rows={rows}
        filters={DEFAULT_FILTERS}
        metric="coding"
        showFrontier={true}
        onMetricChange={onMetricChange}
        onFrontierChange={vi.fn()}
      />,
    )
    expect(frontierLegendCount()).toBe(1)
  })

  test('12 — three Y-axis radios labelled Intelligence, Coding, Agentic', () => {
    render(
      <CostScatterChart
        rows={[makeRow()]}
        filters={DEFAULT_FILTERS}
        metric="intelligence"
        showFrontier={true}
        onMetricChange={vi.fn()}
        onFrontierChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('radio', { name: 'Intelligence' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Coding' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Agentic' })).toBeInTheDocument()
  })

  test('13 — a frontier checkbox: present and checked by default', () => {
    render(
      <CostScatterChart
        rows={[makeRow()]}
        filters={DEFAULT_FILTERS}
        metric="intelligence"
        showFrontier={true}
        onMetricChange={vi.fn()}
        onFrontierChange={vi.fn()}
      />,
    )
    const checkbox = screen.getByRole('checkbox', { name: /frontier/i })
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).toBeChecked()
  })

  test('14 — a row with null cost: never rendered at x=0', () => {
    const rows = [
      makeRow({ cursorSlug: 'a', aaCostPerTask: 1.5 }),
      makeRow({ cursorSlug: 'b', aaCostPerTask: null }),
      makeRow({ cursorSlug: 'c', aaCostPerTask: 2.5 }),
    ]
    render(
      <CostScatterChart
        rows={rows}
        filters={DEFAULT_FILTERS}
        metric="intelligence"
        showFrontier={true}
        onMetricChange={vi.fn()}
        onFrontierChange={vi.fn()}
      />,
    )
    expect(scatterXValues()).not.toContain(0)
    expect(scatterXValues()).toEqual(expect.arrayContaining([1.5, 2.5]))
  })
})
