import { describe, expect, test } from 'vitest'
import type { ModelRow, Snapshot } from '@schema/snapshot'
import { diffSnapshots, hasChanges } from './changes'

function row(overrides: Partial<ModelRow> & Pick<ModelRow, 'cursorName'>): ModelRow {
  return {
    cursorSlug: overrides.cursorName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    provider: 'Anthropic',
    hidden: false,
    aaSlug: 'aa-slug',
    aaName: 'AA Name',
    aaVariantNote: 'note',
    intelligence: 50,
    coding: 40,
    agentic: 30,
    aaCostPerTask: 1,
    priceInput: 1,
    priceOutput: 2,
    priceCacheRead: null,
    priceCacheWrite: null,
    ...overrides,
  }
}

function snapshot(models: readonly ModelRow[]): Snapshot {
  return {
    schemaVersion: 1,
    generatedAt: '2026-08-21T12:00:00.000Z',
    source: { aaIndexVersion: 4.1, attribution: 'Artificial Analysis (artificialanalysis.ai)' },
    coverage: {
      totalRows: models.length,
      resolved: models.length,
      intelligence: models.length,
      coding: models.length,
      agentic: models.length,
      aaCostPerTask: models.length,
    },
    unmatched: [],
    models: [...models],
  }
}

describe('diffSnapshots', () => {
  test('1 — a first run has nothing to compare against', () => {
    const changes = diffSnapshots(null, [row({ cursorName: 'A' })])

    expect(changes).toEqual({ added: [], removed: [], remapped: [] })
    expect(hasChanges(changes)).toBe(false)
  })

  test('2 — an identical catalogue reports no changes', () => {
    const models = [row({ cursorName: 'A' }), row({ cursorName: 'B' })]

    expect(hasChanges(diffSnapshots(snapshot(models), models))).toBe(false)
  })

  test('3 — a model present only in the new run is added', () => {
    const changes = diffSnapshots(snapshot([row({ cursorName: 'A' })]), [
      row({ cursorName: 'A' }),
      row({ cursorName: 'B' }),
    ])

    expect(changes.added).toEqual(['B'])
    expect(changes.removed).toEqual([])
  })

  test('4 — a model present only in the old run is removed', () => {
    const changes = diffSnapshots(snapshot([row({ cursorName: 'A' }), row({ cursorName: 'B' })]), [
      row({ cursorName: 'A' }),
    ])

    expect(changes.removed).toEqual(['B'])
    expect(changes.added).toEqual([])
  })

  test('5 — a changed aaSlug is reported with both values', () => {
    const changes = diffSnapshots(snapshot([row({ cursorName: 'A', aaSlug: 'old' })]), [
      row({ cursorName: 'A', aaSlug: 'new' }),
    ])

    expect(changes.remapped).toEqual([{ cursorName: 'A', from: 'old', to: 'new' }])
  })

  test('6 — a model that gained an AA record is a remap from null', () => {
    const changes = diffSnapshots(snapshot([row({ cursorName: 'A', aaSlug: null })]), [
      row({ cursorName: 'A', aaSlug: 'now-scored' }),
    ])

    expect(changes.remapped).toEqual([{ cursorName: 'A', from: null, to: 'now-scored' }])
  })

  test('7 — a score moving without the mapping changing is not a remap', () => {
    const changes = diffSnapshots(snapshot([row({ cursorName: 'A', intelligence: 50 })]), [
      row({ cursorName: 'A', intelligence: 60 }),
    ])

    expect(changes.remapped).toEqual([])
    expect(hasChanges(changes)).toBe(false)
  })

  test('8 — an added model is not also counted as remapped', () => {
    const changes = diffSnapshots(snapshot([]), [row({ cursorName: 'A' })])

    expect(changes.added).toEqual(['A'])
    expect(changes.remapped).toEqual([])
  })
})
