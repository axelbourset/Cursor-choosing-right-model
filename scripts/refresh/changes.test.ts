import { describe, expect, test } from 'vitest'
import type { ModelRow, Snapshot } from '@schema/snapshot'
import {
  detectScoreRegressions,
  diffSnapshots,
  hasChanges,
  previousSnapshotSchema,
} from './changes'

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
    cursorTokenRateEligible: false,
    ...overrides,
  }
}

function snapshot(models: readonly ModelRow[], usdPerMillionTokens = 0.25): Snapshot {
  return {
    schemaVersion: 2,
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
    cursorTokenRate: { usdPerMillionTokens, excludedModels: ['Excluded Model'] },
    models: [...models],
  }
}

describe('diffSnapshots', () => {
  test('1 — a first run has nothing to compare against', () => {
    const changes = diffSnapshots(null, snapshot([row({ cursorName: 'A' })]))

    expect(changes).toEqual({
      added: [],
      removed: [],
      remapped: [],
      tokenRate: null,
      nowEligible: [],
      nowExempt: [],
    })
    expect(hasChanges(changes)).toBe(false)
  })

  test('2 — an identical catalogue reports no changes', () => {
    const models = [row({ cursorName: 'A' }), row({ cursorName: 'B' })]

    expect(hasChanges(diffSnapshots(snapshot(models), snapshot(models)))).toBe(false)
  })

  test('3 — a model present only in the new run is added', () => {
    const changes = diffSnapshots(
      snapshot([row({ cursorName: 'A' })]),
      snapshot([row({ cursorName: 'A' }), row({ cursorName: 'B' })]),
    )

    expect(changes.added).toEqual(['B'])
    expect(changes.removed).toEqual([])
  })

  test('4 — a model present only in the old run is removed', () => {
    const changes = diffSnapshots(
      snapshot([row({ cursorName: 'A' }), row({ cursorName: 'B' })]),
      snapshot([row({ cursorName: 'A' })]),
    )

    expect(changes.removed).toEqual(['B'])
    expect(changes.added).toEqual([])
  })

  test('5 — a changed aaSlug is reported with both values', () => {
    const changes = diffSnapshots(
      snapshot([row({ cursorName: 'A', aaSlug: 'old' })]),
      snapshot([row({ cursorName: 'A', aaSlug: 'new' })]),
    )

    expect(changes.remapped).toEqual([{ cursorName: 'A', from: 'old', to: 'new' }])
  })

  test('6 — a model that gained an AA record is a remap from null', () => {
    const changes = diffSnapshots(
      snapshot([row({ cursorName: 'A', aaSlug: null })]),
      snapshot([row({ cursorName: 'A', aaSlug: 'now-scored' })]),
    )

    expect(changes.remapped).toEqual([{ cursorName: 'A', from: null, to: 'now-scored' }])
  })

  test('7 — a score moving without the mapping changing is not a remap', () => {
    const changes = diffSnapshots(
      snapshot([row({ cursorName: 'A', intelligence: 50 })]),
      snapshot([row({ cursorName: 'A', intelligence: 60 })]),
    )

    expect(changes.remapped).toEqual([])
    expect(hasChanges(changes)).toBe(false)
  })

  test('8 — an added model is not also counted as remapped', () => {
    const changes = diffSnapshots(snapshot([]), snapshot([row({ cursorName: 'A' })]))

    expect(changes.added).toEqual(['A'])
    expect(changes.remapped).toEqual([])
  })

  test('9 — a moved Cursor Token Rate is reported with both amounts', () => {
    const models = [row({ cursorName: 'A' })]

    const changes = diffSnapshots(snapshot(models, 0.25), snapshot(models, 0.3))

    expect(changes.tokenRate).toEqual({ from: 0.25, to: 0.3 })
    expect(hasChanges(changes)).toBe(true)
  })

  test('10 — models flipping eligibility are listed by direction', () => {
    const changes = diffSnapshots(
      snapshot([
        row({ cursorName: 'Now Pays', cursorTokenRateEligible: false }),
        row({ cursorName: 'Now Exempt', cursorTokenRateEligible: true }),
        row({ cursorName: 'Unchanged', cursorTokenRateEligible: true }),
      ]),
      snapshot([
        row({ cursorName: 'Now Pays', cursorTokenRateEligible: true }),
        row({ cursorName: 'Now Exempt', cursorTokenRateEligible: false }),
        row({ cursorName: 'Unchanged', cursorTokenRateEligible: true }),
      ]),
    )

    expect(changes.nowEligible).toEqual(['Now Pays'])
    expect(changes.nowExempt).toEqual(['Now Exempt'])
  })

  test('11 — a version 1 previous snapshot still diffs, without false rate or eligibility changes', () => {
    const v1File = {
      schemaVersion: 1,
      models: [
        { cursorName: 'A', aaSlug: 'aa-slug', provider: 'Anthropic' },
        { cursorName: 'Retired', aaSlug: null, provider: 'OpenAI' },
      ],
    }
    const previous = previousSnapshotSchema.parse(v1File)

    const changes = diffSnapshots(
      previous,
      snapshot([row({ cursorName: 'A', cursorTokenRateEligible: true })]),
    )

    expect(changes.removed).toEqual(['Retired'])
    expect(changes.tokenRate).toBeNull()
    expect(changes.nowEligible).toEqual([])
    expect(changes.nowExempt).toEqual([])
  })
})

describe('detectScoreRegressions', () => {
  const resolvedRows = (count: number) =>
    Array.from({ length: count }, (_, index) => row({ cursorName: `M${String(index)}` }))
  const withAaVersion = (snap: Snapshot, aaIndexVersion: number): Snapshot => ({
    ...snap,
    source: { ...snap.source, aaIndexVersion },
  })

  test('1 — a first run has nothing to regress from', () => {
    expect(detectScoreRegressions(null, snapshot(resolvedRows(3)))).toEqual({
      indexVersion: null,
      resolved: null,
    })
  })

  test('2 — a new Artificial Analysis index version is flagged with both versions', () => {
    const models = resolvedRows(3)

    const regressions = detectScoreRegressions(
      withAaVersion(snapshot(models), 4.3),
      withAaVersion(snapshot(models), 5),
    )

    expect(regressions.indexVersion).toEqual({ from: 4.3, to: 5 })
    expect(regressions.resolved).toBeNull()
  })

  test('3 — matched models falling by more than 30% is flagged; a smaller dip is not', () => {
    const previous = snapshot(resolvedRows(10))

    expect(detectScoreRegressions(previous, snapshot(resolvedRows(6))).resolved).toEqual({
      from: 10,
      to: 6,
    })
    expect(detectScoreRegressions(previous, snapshot(resolvedRows(7))).resolved).toBeNull()
  })

  test('4 — a version 1 previous file without a source block still counts its matches', () => {
    const previous = previousSnapshotSchema.parse({
      models: [
        { cursorName: 'A', aaSlug: 'a' },
        { cursorName: 'B', aaSlug: 'b' },
        { cursorName: 'C', aaSlug: null },
      ],
    })

    const regressions = detectScoreRegressions(previous, snapshot([row({ cursorName: 'A' })]))

    expect(regressions.indexVersion).toBeNull()
    expect(regressions.resolved).toEqual({ from: 2, to: 1 })
  })
})
