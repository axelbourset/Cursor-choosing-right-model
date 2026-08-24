import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ModelRow, Snapshot } from '@schema/snapshot'
import type { UseSnapshot } from './snapshot/useSnapshot'

const useSnapshotMock = vi.fn<() => UseSnapshot>()

vi.mock('./snapshot/useSnapshot', () => ({
  useSnapshot: () => useSnapshotMock(),
}))

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}))

import App from './App'

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

function makeSnapshot(models: ModelRow[], generatedAt = '2026-08-21T12:00:00.000Z'): Snapshot {
  return {
    schemaVersion: 1,
    generatedAt,
    source: {
      aaIndexVersion: 163,
      attribution: 'Artificial Analysis (artificialanalysis.ai)',
    },
    coverage: {
      totalRows: models.length,
      resolved: models.length,
      intelligence: models.length,
      coding: models.length,
      agentic: models.length,
      aaCostPerTask: models.length,
    },
    unmatched: [],
    models,
  }
}

function mockSnapshotHook(
  result: UseSnapshot['result'],
  overrides: Partial<UseSnapshot> = {},
): void {
  useSnapshotMock.mockReturnValue({
    result,
    lastGood: null,
    acceptFile: vi.fn(),
    useLocalFile: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  })
}

function tbodyRows(): HTMLTableRowElement[] {
  const table = screen.getByRole('table', { name: 'Cursor models' })
  const tbody = table.querySelector('tbody')
  return tbody ? Array.from(tbody.querySelectorAll('tr')) : []
}

beforeEach(() => {
  useSnapshotMock.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('App', () => {
  test('1 — snapshot state empty: the drop zone renders; no table, no charts', () => {
    mockSnapshotHook({ kind: 'empty' })
    render(<App />)
    expect(screen.getByText('Drop the resulting data/models.json above')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cost-scatter-chart')).not.toBeInTheDocument()
    expect(screen.queryByTestId('score-bar-chart')).not.toBeInTheDocument()
  })

  test('2 — snapshot state ok with 5 rows: the table, scatter chart and filter bar render', () => {
    const models = Array.from({ length: 5 }, (_, index) =>
      makeRow({ cursorSlug: `model-${index}`, cursorName: `Model ${index}` }),
    )
    mockSnapshotHook({ kind: 'ok', source: 'local', snapshot: makeSnapshot(models) })
    render(<App />)
    expect(screen.getByRole('table', { name: 'Cursor models' })).toBeInTheDocument()
    expect(screen.getByTestId('cost-scatter-chart')).toBeInTheDocument()
    expect(screen.queryByTestId('score-bar-chart')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Provider')).toBeInTheDocument()
    expect(screen.getByLabelText('Only Pareto models')).toBeInTheDocument()
  })

  test('3 — state ok: the footer attribution text is present', () => {
    mockSnapshotHook({
      kind: 'ok',
      source: 'local',
      snapshot: makeSnapshot([makeRow()]),
    })
    render(<App />)
    expect(
      screen.getByRole('link', { name: 'Data: Artificial Analysis (artificialanalysis.ai)' }),
    ).toBeInTheDocument()
  })

  test('4 — state ok: the header shows the snapshot generatedAt as a short readable date, full ISO on hover', () => {
    mockSnapshotHook({
      kind: 'ok',
      source: 'local',
      snapshot: makeSnapshot([makeRow()], '2026-03-15T09:30:00.000Z'),
    })
    render(<App />)
    const generatedAt = screen.getByTestId('generated-at')
    expect(generatedAt).toHaveTextContent('15 Mar 2026')
    expect(generatedAt).toHaveAttribute('title', '2026-03-15T09:30:00.000Z')
  })

  test('5 — selecting a provider in the chart toolbar: the table row count drops accordingly', () => {
    const models = [
      makeRow({ cursorSlug: 'a', cursorName: 'A', provider: 'Alpha' }),
      makeRow({ cursorSlug: 'b', cursorName: 'B', provider: 'Alpha' }),
      makeRow({ cursorSlug: 'c', cursorName: 'C', provider: 'Beta' }),
    ]
    mockSnapshotHook({ kind: 'ok', source: 'local', snapshot: makeSnapshot(models) })
    render(<App />)
    expect(tbodyRows()).toHaveLength(3)
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'Alpha' } })
    expect(tbodyRows()).toHaveLength(2)
  })

  test('6 — checking Pareto only: the table and chart both shrink to frontier models', () => {
    const models = [
      makeRow({
        cursorSlug: 'frontier',
        cursorName: 'Frontier',
        intelligence: 90,
        priceInput: 1.0,
      }),
      makeRow({
        cursorSlug: 'dominated',
        cursorName: 'Dominated',
        intelligence: 70,
        priceInput: 2.0,
      }),
      makeRow({
        cursorSlug: 'also-dominated',
        cursorName: 'Also Dominated',
        intelligence: 60,
        priceInput: 3.0,
      }),
    ]
    mockSnapshotHook({ kind: 'ok', source: 'local', snapshot: makeSnapshot(models) })
    render(<App />)
    expect(tbodyRows()).toHaveLength(3)
    fireEvent.click(screen.getByLabelText('Only Pareto models'))
    expect(tbodyRows()).toHaveLength(1)
    expect(within(tbodyRows()[0]!).getAllByRole('cell')[0]).toHaveTextContent('Frontier')
    expect(screen.getByText('1/3 shown')).toBeInTheDocument()
  })

  test('6b — switching the metric with Pareto only on: the table rows change', () => {
    const models = [
      makeRow({
        cursorSlug: 'intel-frontier',
        cursorName: 'Intel Frontier',
        intelligence: 90,
        coding: 30,
        priceInput: 1.0,
      }),
      makeRow({
        cursorSlug: 'coding-frontier',
        cursorName: 'Coding Frontier',
        intelligence: 60,
        coding: 90,
        priceInput: 1.0,
      }),
      makeRow({
        cursorSlug: 'dominated-both',
        cursorName: 'Dominated Both',
        intelligence: 50,
        coding: 50,
        priceInput: 5.0,
      }),
    ]
    mockSnapshotHook({ kind: 'ok', source: 'local', snapshot: makeSnapshot(models) })
    render(<App />)
    fireEvent.click(screen.getByLabelText('Only Pareto models'))
    expect(tbodyRows()).toHaveLength(1)
    expect(within(tbodyRows()[0]!).getAllByRole('cell')[0]).toHaveTextContent('Intel Frontier')
    fireEvent.click(screen.getByRole('radio', { name: 'Coding' }))
    expect(tbodyRows()).toHaveLength(1)
    expect(within(tbodyRows()[0]!).getAllByRole('cell')[0]).toHaveTextContent('Coding Frontier')
  })

  test('8 — DOM order: the scatter appears before the table', () => {
    mockSnapshotHook({
      kind: 'ok',
      source: 'local',
      snapshot: makeSnapshot([makeRow()]),
    })
    render(<App />)
    const scatter = screen.getByTestId('cost-scatter-chart')
    const table = screen.getByRole('table', { name: 'Cursor models' })
    expect(scatter.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('9 — state ok: exactly one table is rendered', () => {
    mockSnapshotHook({
      kind: 'ok',
      source: 'local',
      snapshot: makeSnapshot([makeRow()]),
    })
    render(<App />)
    expect(screen.getAllByRole('table')).toHaveLength(1)
  })

  // Moved from SnapshotDropZone.test.tsx (10, 11, 12, 13 below): provenance and the
  // replace/use-local/clear controls now live in the header's meta row, not in a
  // banner owned by SnapshotDropZone — same assertions, new home.
  test('10 — ok dropped: header shows dropped-file label and a use local file button', () => {
    mockSnapshotHook({
      kind: 'ok',
      source: 'dropped',
      snapshot: makeSnapshot([makeRow()]),
    })
    render(<App />)
    expect(screen.getByText(/dropped file/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /use local file/i })).toBeInTheDocument()
  })

  test('11 — ok local: header shows local-file label and no use local file button', () => {
    mockSnapshotHook({
      kind: 'ok',
      source: 'local',
      snapshot: makeSnapshot([makeRow()]),
    })
    render(<App />)
    expect(screen.getByText(/local file/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /use local file/i })).not.toBeInTheDocument()
  })

  test('12 — ok state: header has a clear data button', () => {
    mockSnapshotHook({
      kind: 'ok',
      source: 'local',
      snapshot: makeSnapshot([makeRow()]),
    })
    render(<App />)
    expect(screen.getByRole('button', { name: /clear data/i })).toBeInTheDocument()
  })

  test('13 — clicking clear data calls clear once', () => {
    const clear = vi.fn()
    mockSnapshotHook(
      { kind: 'ok', source: 'local', snapshot: makeSnapshot([makeRow()]) },
      { clear },
    )
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /clear data/i }))
    expect(clear).toHaveBeenCalledOnce()
  })
})
