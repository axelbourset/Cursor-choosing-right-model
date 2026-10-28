import { describe, expect, test, vi } from 'vitest'
import type { ModelRow, Snapshot } from '@schema/snapshot'
import { computeCoverage } from '@domain/coverage'
import type { SnapshotChanges } from './changes'
import { buildChangeReport, buildReport, buildWarnings } from './report'

const NO_CHANGES: SnapshotChanges = {
  added: [],
  removed: [],
  remapped: [],
  tokenRate: null,
  nowEligible: [],
  nowExempt: [],
}

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
    cursorTokenRateEligible: false,
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  const models = overrides.models ?? [makeRow()]
  const coverage = computeCoverage(models)

  return {
    schemaVersion: 2,
    generatedAt: '2026-08-21T12:00:00.000Z',
    source: {
      aaIndexVersion: 163,
      attribution: 'Artificial Analysis (artificialanalysis.ai)',
    },
    coverage,
    unmatched: [],
    cursorTokenRate: { usdPerMillionTokens: 0.25, excludedModels: ['Excluded Model'] },
    models,
    ...overrides,
  }
}

describe('buildReport', () => {
  test('1 — a snapshot with 3 rows, 2 resolved', () => {
    const snapshot = makeSnapshot({
      models: [
        makeRow({ cursorSlug: 'a' }),
        makeRow({ cursorSlug: 'b' }),
        makeRow({
          cursorSlug: 'c',
          aaSlug: null,
          aaName: null,
          aaVariantNote: null,
          intelligence: null,
          coding: null,
          agentic: null,
          aaCostPerTask: null,
        }),
      ],
      unmatched: [{ cursorName: 'Unresolved Model', reason: 'no AA record' }],
    })

    const lines = buildReport(snapshot, null)
    const rowsLine = lines.find((line) => line.startsWith('Rows:'))
    expect(rowsLine).toMatch(/3 total · 2 resolved · 1 unmatched/)
  })

  test('2 — coverage line includes all four metrics', () => {
    const snapshot = makeSnapshot({
      models: [
        makeRow({ cursorSlug: 'a', coding: null, agentic: null, aaCostPerTask: null }),
        makeRow({ cursorSlug: 'b' }),
      ],
    })

    const lines = buildReport(snapshot, null)
    const coverageLine = lines.find((line) => line.startsWith('Coverage:'))
    expect(coverageLine).toBeDefined()
    expect(coverageLine).toMatch(/intelligence \d+\/\d+/)
    expect(coverageLine).toMatch(/coding \d+\/\d+/)
    expect(coverageLine).toMatch(/agentic \d+\/\d+/)
    expect(coverageLine).toMatch(/cost \d+\/\d+/)
  })

  test('3 — 2 unmatched entries', () => {
    const snapshot = makeSnapshot({
      unmatched: [
        { cursorName: 'Composer 2.5', reason: 'AA has never benchmarked this model' },
        { cursorName: 'Mystery Model', reason: 'no AA record' },
      ],
    })

    const lines = buildReport(snapshot, null)
    const unmatchedIndex = lines.findIndex((line) => line === 'Unmatched (2):')
    expect(unmatchedIndex).toBeGreaterThanOrEqual(0)

    const bulletLines = lines.filter((line) => line.startsWith('  - '))
    expect(bulletLines).toHaveLength(2)
    expect(bulletLines[0]).toBe('  - Composer 2.5 — AA has never benchmarked this model')
    expect(bulletLines[1]).toBe('  - Mystery Model — no AA record')
  })

  test('4 — 0 unmatched', () => {
    const snapshot = makeSnapshot({ unmatched: [] })

    const lines = buildReport(snapshot, null)
    expect(lines).toContain('Unmatched (0): none')
    expect(lines.some((line) => line.startsWith('  - '))).toBe(false)
  })

  test("5 — rateLimitRemaining: '94'", () => {
    const snapshot = makeSnapshot()

    const lines = buildReport(snapshot, '94')
    expect(lines.some((line) => line.includes('rate limit remaining: 94'))).toBe(true)
  })

  test('6 — rateLimitRemaining: null', () => {
    const snapshot = makeSnapshot()

    const lines = buildReport(snapshot, null)
    expect(lines.some((line) => line.includes('rate limit remaining: unknown'))).toBe(true)
  })

  test('7 — the coverage numbers match computeCoverage(snapshot.models)', () => {
    const snapshot = makeSnapshot({
      models: [
        makeRow({ cursorSlug: 'a' }),
        makeRow({ cursorSlug: 'b', coding: null }),
        makeRow({
          cursorSlug: 'c',
          aaSlug: null,
          aaName: null,
          aaVariantNote: null,
          intelligence: null,
          coding: null,
          agentic: null,
          aaCostPerTask: null,
        }),
      ],
    })

    const coverage = computeCoverage(snapshot.models)
    const lines = buildReport(snapshot, null)
    const coverageLine = lines.find((line) => line.startsWith('Coverage:'))
    expect(coverageLine).toBe(
      `Coverage:         intelligence ${coverage.intelligence}/${coverage.totalRows} · coding ${coverage.coding}/${coverage.totalRows} · agentic ${coverage.agentic}/${coverage.totalRows} · cost ${coverage.aaCostPerTask}/${coverage.totalRows}`,
    )
  })

  test('8 — buildReport returns an array and prints nothing itself', () => {
    const snapshot = makeSnapshot()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const lines = buildReport(snapshot, '94')

    expect(Array.isArray(lines)).toBe(true)
    expect(logSpy).not.toHaveBeenCalled()

    logSpy.mockRestore()
  })

  test('8 — the Cursor Token Rate line counts who pays it and lists unknown exclusions', () => {
    const snapshot = makeSnapshot({
      models: [
        makeRow({ cursorSlug: 'sonnet', provider: 'Anthropic', cursorTokenRateEligible: true }),
        makeRow({ cursorSlug: 'grok', provider: 'Cursor', cursorTokenRateEligible: false }),
        makeRow({ cursorSlug: 'gpt-5-mini', provider: 'OpenAI', cursorTokenRateEligible: false }),
      ],
      cursorTokenRate: { usdPerMillionTokens: 0.25, excludedModels: ['GPT-5 Mini', 'GPT-4o Mini'] },
    })

    const line = buildReport(snapshot, null).find((l) => l.startsWith('Token rate:'))

    expect(line).toBe(
      'Token rate:       $0.25 / 1M tokens · 1 eligible · 2 exempt (1 Cursor, 1 excluded) · 1 listed exclusions not in catalogue: GPT-4o Mini',
    )
  })
})

describe('buildChangeReport', () => {
  test('1 — a first run with nothing to compare produces no lines', () => {
    expect(buildChangeReport(NO_CHANGES, [])).toEqual([])
  })

  test('2 — an added model is listed', () => {
    const lines = buildChangeReport({ ...NO_CHANGES, added: ['Claude Fable 5.1'] }, [])

    expect(lines.join('\n')).toMatch(/\+ Claude Fable 5\.1/)
  })

  test('3 — a removed model says why it vanished', () => {
    const lines = buildChangeReport({ ...NO_CHANGES, removed: ['Retired'] }, [])

    expect(lines.join('\n')).toMatch(/- Retired \(no longer published by Cursor\)/)
  })

  test('4 — a remapped model shows both slugs', () => {
    const lines = buildChangeReport(
      { ...NO_CHANGES, remapped: [{ cursorName: 'X', from: 'old-slug', to: 'new-slug' }] },
      [],
    )

    expect(lines.join('\n')).toMatch(/~ X: old-slug -> new-slug/)
  })

  test('5 — a mapping that gained or lost an AA record reads clearly', () => {
    const lines = buildChangeReport(
      { ...NO_CHANGES, remapped: [{ cursorName: 'X', from: null, to: 'now-scored' }] },
      [],
    )

    expect(lines.join('\n')).toMatch(/~ X: no AA record -> now-scored/)
  })

  test('6 — an override naming a model Cursor no longer publishes is flagged', () => {
    const lines = buildChangeReport(NO_CHANGES, ['Ghost Model'])

    expect(lines.join('\n')).toMatch(/Unused override: Ghost Model .* safe to delete/)
  })

  test('7 — a moved Cursor Token Rate and eligibility flips are listed', () => {
    const lines = buildChangeReport(
      {
        ...NO_CHANGES,
        tokenRate: { from: 0.25, to: 0.3 },
        nowEligible: ['Pays'],
        nowExempt: ['Free'],
      },
      [],
    ).join('\n')

    expect(lines).toMatch(/~ Cursor Token Rate: \$0\.25 -> \$0\.3 per 1M tokens/)
    expect(lines).toMatch(/~ Pays: now pays the Cursor Token Rate/)
    expect(lines).toMatch(/~ Free: now exempt from the Cursor Token Rate/)
  })
})

describe('buildWarnings', () => {
  test('1 — no regressions, no lines', () => {
    expect(buildWarnings({ indexVersion: null, resolved: null })).toEqual([])
  })

  test('2 — an index version change and a coverage drop each get a WARNING line', () => {
    const lines = buildWarnings({
      indexVersion: { from: 4.3, to: 5 },
      resolved: { from: 57, to: 13 },
    })

    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/^WARNING: Artificial Analysis index version changed 4\.3 -> 5\./)
    expect(lines[1]).toMatch(/^WARNING: matched models fell from 57 to 13 \(-77%\)/)
  })
})
