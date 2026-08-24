import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import type { ModelRow } from '@schema/snapshot'
import { colorForProvider, textOnProvider } from '../charts/providerColors'
import { ModelTable } from './ModelTable'

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

function tbodyRows(container: HTMLElement): HTMLTableRowElement[] {
  const tbody = container.querySelector('tbody')
  return tbody ? Array.from(tbody.querySelectorAll('tr')) : []
}

function rowNames(container: HTMLElement): string[] {
  return tbodyRows(container).map((row) => within(row).getAllByRole('cell')[0]!.textContent ?? '')
}

afterEach(() => {
  cleanup()
})

describe('ModelTable', () => {
  test('1 — 3 rows rendered', () => {
    const { container } = render(
      <ModelTable
        rows={[
          makeRow({ cursorSlug: 'a', cursorName: 'A' }),
          makeRow({ cursorSlug: 'b', cursorName: 'B' }),
          makeRow({ cursorSlug: 'c', cursorName: 'C' }),
        ]}
      />,
    )
    expect(tbodyRows(container)).toHaveLength(3)
  })

  test('2 — a row with coding: null', () => {
    render(
      <ModelTable
        rows={[makeRow({ cursorSlug: 'null-coding', cursorName: 'Null Coding', coding: null })]}
      />,
    )
    expect(screen.getByRole('cell', { name: '—' })).toBeInTheDocument()
  })

  test('3 — a row with coding: 0', () => {
    render(
      <ModelTable
        rows={[makeRow({ cursorSlug: 'zero-coding', cursorName: 'Zero Coding', coding: 0 })]}
      />,
    )
    expect(screen.getByRole('cell', { name: '0' })).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: '—' })).not.toBeInTheDocument()
  })

  test('4 — initial order', () => {
    const { container } = render(
      <ModelTable
        rows={[
          makeRow({ cursorSlug: 'a', cursorName: 'A', intelligence: 90 }),
          makeRow({ cursorSlug: 'b', cursorName: 'B', intelligence: 50 }),
          makeRow({ cursorSlug: 'c', cursorName: 'C', intelligence: 70 }),
        ]}
      />,
    )
    expect(rowNames(container)).toEqual(['A', 'C', 'B'])
  })

  test('5 — click the Intelligence header', () => {
    const { container } = render(
      <ModelTable
        rows={[
          makeRow({ cursorSlug: 'a', cursorName: 'A', intelligence: 90 }),
          makeRow({ cursorSlug: 'b', cursorName: 'B', intelligence: 50 }),
          makeRow({ cursorSlug: 'c', cursorName: 'C', intelligence: 70 }),
        ]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Intelligence' }))
    expect(rowNames(container)).toEqual(['B', 'C', 'A'])
  })

  test('6 — click Intelligence twice', () => {
    const { container } = render(
      <ModelTable
        rows={[
          makeRow({ cursorSlug: 'a', cursorName: 'A', intelligence: 90 }),
          makeRow({ cursorSlug: 'b', cursorName: 'B', intelligence: 50 }),
          makeRow({ cursorSlug: 'c', cursorName: 'C', intelligence: 70 }),
        ]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Intelligence' }))
    fireEvent.click(screen.getByRole('button', { name: 'Intelligence' }))
    expect(rowNames(container)).toEqual(['A', 'C', 'B'])
  })

  test('7 — click the Coding header', () => {
    const { container } = render(
      <ModelTable
        rows={[
          makeRow({ cursorSlug: 'a', cursorName: 'A', coding: 90 }),
          makeRow({ cursorSlug: 'b', cursorName: 'B', coding: 50 }),
          makeRow({ cursorSlug: 'c', cursorName: 'C', coding: 70 }),
        ]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Coding' }))
    expect(rowNames(container)).toEqual(['A', 'C', 'B'])
  })

  test('8 — 5 rows, 2 with null intelligence, sorted asc', () => {
    const { container } = render(
      <ModelTable
        rows={[
          makeRow({ cursorSlug: 'a', cursorName: 'A', intelligence: 70 }),
          makeRow({ cursorSlug: 'b', cursorName: 'B', intelligence: null }),
          makeRow({ cursorSlug: 'c', cursorName: 'C', intelligence: 50 }),
          makeRow({ cursorSlug: 'd', cursorName: 'D', intelligence: null }),
          makeRow({ cursorSlug: 'e', cursorName: 'E', intelligence: 60 }),
        ]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Intelligence' }))
    const rows = tbodyRows(container)
    expect(rows[3]!.textContent).toContain('B')
    expect(rows[4]!.textContent).toContain('D')
    expect(
      rows
        .slice(0, 3)
        .every((row) => !row.textContent?.includes('B') || row.textContent.includes('E')),
    ).toBe(true)
    expect(
      rows
        .slice(0, 3)
        .map((row) => within(row).getAllByRole('cell')[0]!.textContent)
        .sort(),
    ).toEqual(['A', 'C', 'E'])
  })

  test('9 — the same, sorted desc', () => {
    const rows = [
      makeRow({ cursorSlug: 'a', cursorName: 'A', intelligence: 70 }),
      makeRow({ cursorSlug: 'b', cursorName: 'B', intelligence: null }),
      makeRow({ cursorSlug: 'c', cursorName: 'C', intelligence: 50 }),
      makeRow({ cursorSlug: 'd', cursorName: 'D', intelligence: null }),
      makeRow({ cursorSlug: 'e', cursorName: 'E', intelligence: 60 }),
    ]
    const { container } = render(<ModelTable rows={rows} />)
    const tableRows = tbodyRows(container)
    expect(tableRows[3]!.textContent).toContain('B')
    expect(tableRows[4]!.textContent).toContain('D')
    expect(
      tableRows
        .slice(0, 3)
        .map((row) => within(row).getAllByRole('cell')[0]!.textContent)
        .sort(),
    ).toEqual(['A', 'C', 'E'])
  })

  test('10 — every column header', () => {
    render(<ModelTable rows={[makeRow()]} />)
    const headers = [
      'Model',
      'Provider',
      'Intelligence',
      'Coding',
      'Agentic',
      '$/task',
      'In $',
      'Out $',
      'Cache R $',
    ]
    for (const label of headers) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  test('11 — all 9 columns', () => {
    render(<ModelTable rows={[makeRow()]} />)
    expect(screen.getByRole('columnheader', { name: 'Model' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Provider' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Intelligence' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Coding' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Agentic' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '$/task' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'In $' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Out $' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Cache R $' })).toBeInTheDocument()
  })

  test('12 — a model with no AA data at all', () => {
    render(
      <ModelTable
        rows={[
          makeRow({
            cursorName: 'Composer 2.5',
            cursorSlug: 'composer-2-5',
            provider: 'Cursor',
            aaSlug: null,
            aaName: null,
            aaVariantNote: null,
            intelligence: null,
            coding: null,
            agentic: null,
            aaCostPerTask: null,
            priceInput: 0.5,
            priceOutput: 2.5,
            priceCacheRead: 0.2,
          }),
        ]}
      />,
    )
    const row = screen.getByText('Composer 2.5').closest('tr')!
    const cells = within(row).getAllByRole('cell')
    expect(cells[2]).toHaveTextContent('—')
    expect(cells[3]).toHaveTextContent('—')
    expect(cells[4]).toHaveTextContent('—')
    expect(cells[5]).toHaveTextContent('—')
    expect(cells[6]).toHaveTextContent('0.5')
    expect(cells[7]).toHaveTextContent('2.5')
    expect(cells[8]).toHaveTextContent('0.2')
  })

  test('14 — search filters rows by model name', () => {
    const { container } = render(
      <ModelTable
        rows={[
          makeRow({ cursorSlug: 'a', cursorName: 'Claude Opus 5', provider: 'Anthropic' }),
          makeRow({ cursorSlug: 'b', cursorName: 'GPT-5.6 Sol', provider: 'OpenAI' }),
          makeRow({ cursorSlug: 'c', cursorName: 'Gemini 3.7', provider: 'Google' }),
        ]}
      />,
    )
    expect(tbodyRows(container)).toHaveLength(3)
    fireEvent.change(screen.getByLabelText('Search models'), { target: { value: 'claude' } })
    expect(tbodyRows(container)).toHaveLength(1)
    expect(rowNames(container)).toEqual(['Claude Opus 5'])
  })

  test('15 — provider column shows a colour-filled pill', () => {
    render(
      <ModelTable
        rows={[makeRow({ provider: 'Anthropic', cursorName: 'Claude Opus 5', cursorSlug: 'opus' })]}
      />,
    )
    const row = screen.getByText('Claude Opus 5').closest('tr')!
    const chip = row.querySelector('.provider-chip') as HTMLElement | null
    expect(chip).not.toBeNull()
    // jsdom serialises colours to rgb() — normalise back to hex for the assertion
    const toHex = (css: string): string => {
      const m = css.match(/rgba?\((\d+), (\d+), (\d+)/)
      if (!m) return css
      return (
        '#' +
        [m[1]!, m[2]!, m[3]!].map((part) => Number(part).toString(16).padStart(2, '0')).join('')
      )
    }
    expect(toHex(chip!.style.backgroundColor)).toBe(colorForProvider('Anthropic'))
    expect(toHex(chip!.style.color)).toBe(textOnProvider(colorForProvider('Anthropic')))
    expect(chip).toHaveTextContent('Anthropic')
  })

  test('13 — the table', () => {
    render(<ModelTable rows={[makeRow()]} />)
    const table = screen.getByRole('table')
    expect(table.querySelector('caption') ?? table.getAttribute('aria-label')).toBeTruthy()
  })
})
