import { describe, expect, test } from 'vitest'
import type { Snapshot } from '@schema/snapshot'
import { findViolations } from './guard-no-data'

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
    unmatched: [{ cursorName: 'Fixture Unmatched', reason: 'no AA record' }],
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

describe('findViolations', () => {
  test('1 — built dist asset with cursorSlug and aaVariantNote literals', () => {
    const violations = findViolations(
      { tracked: [], built: ['dist/assets/app.js'] },
      () => '{"cursorSlug":"x","aaVariantNote":"y"}',
    )
    expect(violations).toHaveLength(1)
  })

  test('2 — built dist asset containing a full real-shaped snapshot', () => {
    const violations = findViolations({ tracked: [], built: ['dist/assets/app.js'] }, () =>
      JSON.stringify(validSnapshot()),
    )
    expect(violations).toHaveLength(1)
  })

  test('3 — fetchArtificialAnalysis.ts may name AA API keys', () => {
    const violations = findViolations(
      { tracked: ['scripts/refresh/fetchArtificialAnalysis.ts'], built: [] },
      () => 'const key = "artificial_analysis_coding_index"',
    )
    expect(violations).toHaveLength(0)
  })

  test('4 — src file must not contain AA API key names', () => {
    const violations = findViolations(
      { tracked: ['src/charts/x.ts'], built: [] },
      () => 'const key = "artificial_analysis_coding_index"',
    )
    expect(violations).toHaveLength(1)
  })

  test('5 — fixtures may contain AA API key names', () => {
    const violations = findViolations(
      { tracked: ['fixtures/aa-free-page.synthetic.json'], built: [] },
      () => '"artificial_analysis_coding_index": 42',
    )
    expect(violations).toHaveLength(0)
  })

  test('6 — .env.example placeholder must not trigger API key rule', () => {
    const violations = findViolations(
      { tracked: ['.env.example'], built: [] },
      () => 'AA_API_KEY=paste_your_key_here',
    )
    expect(violations).toHaveLength(0)
  })

  test('7 — real-looking API key value is a violation', () => {
    const violations = findViolations(
      { tracked: ['notes.txt'], built: [] },
      () => 'AA_API_KEY=sk-abcdefghijklmnopqrstuvwxyz',
    )
    expect(violations).toHaveLength(1)
  })

  test('8 — public json path is a violation without reading', () => {
    const read = () => {
      throw new Error('reader must not be called for path-only rules')
    }
    const violations = findViolations({ tracked: ['public/data/models.json'], built: [] }, read)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.path).toBe('public/data/models.json')
  })

  test('9 — src must not import from data/', () => {
    const violations = findViolations(
      { tracked: ['src/App.tsx'], built: [] },
      () => "import x from '../data/models.json'",
    )
    expect(violations).toHaveLength(1)
  })

  test('10 — clean tracked and built lists yield no violations', () => {
    const violations = findViolations(
      {
        tracked: ['src/App.tsx', 'package.json'],
        built: ['dist/index.html'],
      },
      () => 'export const ok = true',
    )
    expect(violations).toHaveLength(0)
  })

  test('11 — every violation has a non-empty reason', () => {
    const violations = findViolations(
      {
        tracked: ['public/data/models.json', 'src/charts/x.ts', 'notes.txt', 'src/App.tsx'],
        built: ['dist/assets/app.js'],
      },
      (path) => {
        if (path === 'dist/assets/app.js') return '{"cursorSlug":"x","aaVariantNote":"y"}'
        if (path === 'src/charts/x.ts') return 'artificial_analysis_coding_index'
        if (path === 'notes.txt') return 'AA_API_KEY=sk-abcdefghijklmnopqrstuvwxyz'
        if (path === 'src/App.tsx') return "import x from '../data/models.json'"
        return ''
      },
    )
    expect(violations.length).toBeGreaterThan(0)
    for (const violation of violations) {
      expect(violation.reason.length).toBeGreaterThan(0)
    }
  })

  test('12 — untracked data/models.json is not checked', () => {
    const read = () => {
      throw new Error('reader must not be called when file is absent from inputs')
    }
    const violations = findViolations({ tracked: [], built: [] }, read)
    expect(violations).toHaveLength(0)
  })
})
