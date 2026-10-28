import { describe, expect, test } from 'vitest'
import type { ModelRow } from '@schema/snapshot'
import { withCursorTokenRate } from './price'

function makeRow(overrides: Partial<ModelRow> = {}): ModelRow {
  return {
    cursorName: 'Test Model',
    cursorSlug: 'test-model',
    provider: 'Anthropic',
    hidden: false,
    aaSlug: 'test-model',
    aaName: 'Test Model',
    aaVariantNote: null,
    intelligence: 50,
    coding: 40,
    agentic: 30,
    aaCostPerTask: 0.01,
    priceInput: 2,
    priceOutput: 10,
    priceCacheRead: 0.1,
    priceCacheWrite: 2.5,
    cursorTokenRateEligible: true,
    ...overrides,
  }
}

describe('withCursorTokenRate', () => {
  test('1 — an eligible row gains the rate on every price', () => {
    const [row] = withCursorTokenRate([makeRow()], 0.25)

    expect(row).toMatchObject({
      priceInput: 2.25,
      priceOutput: 10.25,
      priceCacheRead: 0.35,
      priceCacheWrite: 2.75,
    })
  })

  test('2 — an exempt row is returned untouched, as the same object', () => {
    const exempt = makeRow({ cursorTokenRateEligible: false })

    const [row] = withCursorTokenRate([exempt], 0.25)

    expect(row).toBe(exempt)
  })

  test('3 — a missing price stays missing rather than becoming the rate', () => {
    const [row] = withCursorTokenRate([makeRow({ priceCacheRead: null })], 0.25)

    expect(row?.priceCacheRead).toBeNull()
  })

  test('4 — sums are rounded, so float noise never reaches the table', () => {
    // Unrounded, 0.032 + 0.25 is 0.28200000000000003 and 0.09 + 0.25 is 0.33999999999999997.
    const rows = withCursorTokenRate(
      [makeRow({ priceCacheRead: 0.032 }), makeRow({ priceCacheRead: 0.09 })],
      0.25,
    )

    expect(rows.map((row) => String(row.priceCacheRead))).toEqual(['0.282', '0.34'])
  })

  test('5 — the input array is not mutated', () => {
    const original = makeRow()

    withCursorTokenRate([original], 0.25)

    expect(original.priceCacheRead).toBe(0.1)
  })
})
