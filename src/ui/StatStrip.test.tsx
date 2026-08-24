import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { StatStrip } from './StatStrip'

afterEach(() => {
  cleanup()
})

describe('StatStrip', () => {
  test('1 — renders four colour-block tiles with the given values', () => {
    render(<StatStrip models={47} providers={6} shown={29} total={43} frontier={4} />)
    expect(screen.getByText('Models')).toBeInTheDocument()
    expect(screen.getByText('47')).toBeInTheDocument()
    expect(screen.getByText('Providers')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('Plotted')).toBeInTheDocument()
    expect(screen.getByText('29/43')).toBeInTheDocument()
    expect(screen.getByText('Frontier')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Snapshot statistics' })).toBeInTheDocument()
  })

  test('2 — renders nothing when there is no data', () => {
    const { container } = render(
      <StatStrip models={0} providers={0} shown={0} total={0} frontier={0} />,
    )
    expect(container.querySelector('.stat-strip')).toBeNull()
  })
})
