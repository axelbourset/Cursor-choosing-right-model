import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Snapshot } from '@schema/snapshot'
import { SnapshotDropZone } from './SnapshotDropZone'
import type { LoadResult } from './loadSnapshot'

function validSnapshot(): Snapshot {
  return {
    schemaVersion: 1,
    generatedAt: '2026-08-21T12:00:00.000Z',
    source: {
      aaIndexVersion: 1,
      attribution: 'Artificial Analysis (artificialanalysis.ai)',
    },
    coverage: {
      totalRows: 47,
      resolved: 43,
      intelligence: 43,
      coding: 31,
      agentic: 31,
      aaCostPerTask: 29,
    },
    unmatched: [],
    models: [
      {
        cursorName: 'Fixture Model',
        cursorSlug: 'fixture-model',
        provider: 'Fixture Provider',
        hidden: false,
        aaSlug: 'fixture-aa-slug',
        aaName: 'Fixture AA Name',
        aaVariantNote: 'explicit variant',
        intelligence: 42.1,
        coding: 38.5,
        agentic: 35.2,
        aaCostPerTask: 1.234,
        priceInput: 0.01,
        priceOutput: 0.02,
        priceCacheRead: 0.003,
        priceCacheWrite: 0.004,
      },
    ],
  }
}

function renderZone(
  result: LoadResult,
  options: {
    lastGood?: Snapshot | null
    onFile?: (file: File) => void
    onUseLocal?: () => void
    onClear?: () => void
    children?: React.ReactNode
  } = {},
) {
  const onFile = options.onFile ?? vi.fn()
  const onUseLocal = options.onUseLocal ?? vi.fn()
  const onClear = options.onClear ?? vi.fn()
  render(
    <SnapshotDropZone
      result={result}
      lastGood={options.lastGood ?? null}
      onFile={onFile}
      onUseLocal={onUseLocal}
      onClear={onClear}
    >
      {options.children ?? <div>child content</div>}
    </SnapshotDropZone>,
  )
  return { onFile, onUseLocal, onClear }
}

afterEach(() => {
  cleanup()
})

describe('SnapshotDropZone', () => {
  test('1 — empty state shows drop instruction', () => {
    renderZone({ kind: 'empty' })
    expect(screen.getByText('Drop the resulting data/models.json above')).toBeInTheDocument()
  })

  test('2 — empty state has json file input', () => {
    renderZone({ kind: 'empty' })
    expect(screen.getByLabelText(/snapshot file/i)).toHaveAttribute('accept', 'application/json')
  })

  test('3 — empty state shows attribution', () => {
    renderZone({ kind: 'empty' })
    expect(
      screen.getByText('Data: Artificial Analysis (artificialanalysis.ai)'),
    ).toBeInTheDocument()
  })

  test('4 — empty state shows never uploaded reassurance', () => {
    renderZone({ kind: 'empty' })
    expect(screen.getByText(/never uploaded/i)).toBeInTheDocument()
  })

  test('5 — invalid state shows errors', () => {
    renderZone({ kind: 'invalid', errors: ['bad'] })
    expect(screen.getByText('Not a valid snapshot:')).toBeInTheDocument()
    expect(screen.getByText('bad')).toBeInTheDocument()
  })

  test('6 — stale state shows version mismatch', () => {
    renderZone({ kind: 'stale', found: 99, expected: 1 })
    expect(screen.getByText(/99/)).toBeInTheDocument()
    expect(screen.getByText(/npm run refresh/)).toBeInTheDocument()
  })

  test('7 — ok dropped shows banner and use local file button', () => {
    renderZone({
      kind: 'ok',
      snapshot: validSnapshot(),
      source: 'dropped',
    })
    expect(screen.getByText(/dropped file/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /use local file/i })).toBeInTheDocument()
  })

  test('8 — ok local shows banner without use local file button', () => {
    renderZone({
      kind: 'ok',
      snapshot: validSnapshot(),
      source: 'local',
    })
    expect(screen.getByText(/local file/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /use local file/i })).not.toBeInTheDocument()
  })

  test('9 — ok state renders children', () => {
    renderZone(
      { kind: 'ok', snapshot: validSnapshot(), source: 'local' },
      { children: <div>child content</div> },
    )
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  test('10 — ok state has clear data button', () => {
    renderZone({ kind: 'ok', snapshot: validSnapshot(), source: 'local' })
    expect(screen.getByRole('button', { name: /clear data/i })).toBeInTheDocument()
  })

  test('11 — clicking clear data calls onClear once', () => {
    const onClear = vi.fn()
    renderZone({ kind: 'ok', snapshot: validSnapshot(), source: 'local' }, { onClear })
    fireEvent.click(screen.getByRole('button', { name: /clear data/i }))
    expect(onClear).toHaveBeenCalledOnce()
  })

  test('12 — selecting a file calls onFile once', () => {
    const onFile = vi.fn()
    renderZone({ kind: 'empty' }, { onFile })
    const file = new File(['{}'], 'models.json', { type: 'application/json' })
    const input = screen.getByLabelText(/snapshot file/i)
    fireEvent.change(input, { target: { files: [file] } })
    expect(onFile).toHaveBeenCalledOnce()
    expect(onFile).toHaveBeenCalledWith(file)
  })

  test('13 — empty state does not render children', () => {
    renderZone({ kind: 'empty' }, { children: <div>child content</div> })
    expect(screen.queryByText('child content')).not.toBeInTheDocument()
  })

  test('14 — invalid with lastGood still renders children', () => {
    renderZone(
      { kind: 'invalid', errors: ['bad'] },
      { lastGood: validSnapshot(), children: <div>child content</div> },
    )
    expect(screen.getByText('bad')).toBeInTheDocument()
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  test('15 — invalid without lastGood does not render children', () => {
    renderZone(
      { kind: 'invalid', errors: ['bad'] },
      { lastGood: null, children: <div>child content</div> },
    )
    expect(screen.getByText('bad')).toBeInTheDocument()
    expect(screen.queryByText('child content')).not.toBeInTheDocument()
  })
})
