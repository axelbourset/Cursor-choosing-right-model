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
      // Consistent with the single row below: snapshotSchema now rejects a coverage block
      // that contradicts models.length.
      totalRows: 1,
      resolved: 1,
      intelligence: 1,
      coding: 1,
      agentic: 1,
      aaCostPerTask: 1,
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
    children?: React.ReactNode
  } = {},
) {
  const onFile = options.onFile ?? vi.fn()
  render(
    <SnapshotDropZone result={result} lastGood={options.lastGood ?? null} onFile={onFile}>
      {options.children ?? <div>child content</div>}
    </SnapshotDropZone>,
  )
  return { onFile }
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

  test('9 — ok state renders children', () => {
    renderZone(
      { kind: 'ok', snapshot: validSnapshot(), source: 'local' },
      { children: <div>child content</div> },
    )
    expect(screen.getByText('child content')).toBeInTheDocument()
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

  test('16 — dropping a file on the visible target calls onFile', () => {
    // The handlers used to live on the <input>, which styles.css clips to 1x1, so a drop on
    // the panel never reached them and the browser navigated away instead.
    const onFile = vi.fn()
    render(
      <SnapshotDropZone result={{ kind: 'empty' }} lastGood={null} onFile={onFile}>
        <div />
      </SnapshotDropZone>,
    )

    const target = screen.getByText('Drop your snapshot').closest('label')
    expect(target).not.toBeNull()

    const file = new File(['{}'], 'models.json', { type: 'application/json' })
    fireEvent.drop(target!, { dataTransfer: { files: [file] } })

    expect(onFile).toHaveBeenCalledTimes(1)
    expect(onFile.mock.calls[0]![0]).toBe(file)
  })

  test('17 — dragover is prevented so the browser does not navigate away', () => {
    render(
      <SnapshotDropZone result={{ kind: 'empty' }} lastGood={null} onFile={vi.fn()}>
        <div />
      </SnapshotDropZone>,
    )

    const target = screen.getByText('Drop your snapshot').closest('label')!
    const event = new Event('dragover', { bubbles: true, cancelable: true })
    fireEvent(target, event)

    expect(event.defaultPrevented).toBe(true)
  })

  test('18 — the loading state renders neither the guide nor the drop target', () => {
    render(
      <SnapshotDropZone result={{ kind: 'loading' }} lastGood={null} onFile={vi.fn()}>
        <div />
      </SnapshotDropZone>,
    )

    expect(screen.queryByText('Drop your snapshot')).toBeNull()
    expect(screen.queryByText(/API key/i)).toBeNull()
  })
})
